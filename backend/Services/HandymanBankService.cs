using backend.Constants;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace backend.Services;

public class HandymanBankService(ServiceDependencies deps) : BaseService(deps), IHandymanBankService
{
    private static readonly HashSet<string> BankStatuses = ["unverified", "verified", "rejected", "disabled"];

    public async Task<BankDetailsDto?> GetBankDetailsAsync()
    {
        var userId = await GetCurrentUserIdAsync();
        var bankDetails = await GetCurrentBankDetailsAsync(userId);

        return bankDetails == null ? null : MapToBankDetailsDto(bankDetails);
    }

    public async Task<BankDetailsDto> AddBankDetailsAsync(CreateBankDetailsRequest request)
    {
        var userId = await GetCurrentUserIdAsync();

        var hasPendingWithdrawal = await HasPendingWithdrawalAsync(userId);

        if (hasPendingWithdrawal)
            throw new HttpRequestException("Cannot submit new bank details while you have a pending withdrawal request.", null, HttpStatusCode.BadRequest);

        var validated = ValidateBankDetailsInput(request.BankName, request.AccountName, request.AccountNumber);

        var bankDetails = new Handyman_Bank_Details
        {
            Id = Guid.NewGuid(),
            Handyman_User_Id = userId,
            Bank_Name = validated.BankName,
            Account_Name = validated.AccountName,
            Account_Number = validated.AccountNumber,
            Verification_Status = "unverified",
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };

        Context.Handyman_Bank_Details.Add(bankDetails);
        await Context.SaveChangesAsync();

        await CreateNotification(
            userId,
            NotificationType.SystemMessage,
            "Your bank details have been submitted. Please upload your bank statement proof for admin verification."
        );

        await CreateNotifications(
            NotificationType.SystemMessage,
            "A handyman has added bank details and is awaiting verification review.",
            UserRole.Admin
        );

        Logger.LogInformation("Bank details added for handyman {HandymanId}", userId);

        return MapToBankDetailsDto(bankDetails);
    }

    public async Task DeleteBankDetailsAsync()
    {
        var userId = await GetCurrentUserIdAsync();

        var bankDetails = await Context.Handyman_Bank_Details
            .Where(b => b.Handyman_User_Id == userId && b.Verification_Status != "verified")
            .OrderByDescending(b => b.Updated_At_Utc)
            .FirstOrDefaultAsync()
            ?? await GetCurrentBankDetailsAsync(userId)
            ?? throw new HttpRequestException("Bank details not found.", null, HttpStatusCode.NotFound);

        var hasPendingWithdrawal = await HasPendingWithdrawalAsync(userId);
        if (hasPendingWithdrawal)
            throw new HttpRequestException("Cannot delete bank details while you have a pending withdrawal request.", null, HttpStatusCode.BadRequest);

        var isUsedByWithdrawal = await Context.Withdrawal_Requests.AnyAsync(w => w.Bank_Details_Id == bankDetails.Id);
        if (isUsedByWithdrawal)
            throw new HttpRequestException("Cannot delete bank details that are linked to withdrawal history. Submit new bank details instead.", null, HttpStatusCode.BadRequest);

        Context.Handyman_Bank_Details.Remove(bankDetails);
        await Context.SaveChangesAsync();

        Logger.LogInformation("Bank details deleted for handyman {HandymanId}", userId);
    }

    // public async Task<BankDetailsDto> UploadBankStatementProofAsync(IFormFile file)
    // {
    //     var userId = await GetCurrentUserIdAsync();
    //     var bankDetails = await Context.Handyman_Bank_Details
    //         .Include(b => b.Handyman_User)
    //         .FirstOrDefaultAsync(b => b.Handyman_User_Id == userId)
    //         ?? throw new HttpRequestException("Bank details not found. Please add bank details first.", null, HttpStatusCode.NotFound);

    //     var proofUrl = await StorageService.UpdateBankStatementProofAsync(file, bankDetails.Id);

    //     bankDetails.Bank_Statement_Proof_Url = proofUrl;
    //     bankDetails.Updated_At_Utc = DateTime.UtcNow;

    //     await Context.SaveChangesAsync();

    //     await CreateNotification(userId, NotificationType.SystemMessage, "Your bank details have been submitted for verification. Our team will review and get back to you soon.");
    //     await CreateNotifications(NotificationType.SystemMessage, $"New bank details submission from handyman {bankDetails.Handyman_User?.Name ?? "Unknown"} is pending review.", UserRole.Admin);

    //     Logger.LogInformation("Bank statement proof uploaded for handyman {HandymanId}", userId);

    //     return MapToBankDetailsDto(bankDetails);
    // }

    public async Task<CreditBalanceDto> GetCreditBalanceAsync()
    {
        var userId = await GetCurrentUserIdAsync();

        var transactions = await Context.Handyman_Credits
            .Where(c => c.Handyman_User_Id == userId)
            .OrderBy(c => c.Created_At_Utc)
            .ToListAsync();

        decimal earned = transactions.Where(t => t.Transaction_Type == "earned").Sum(t => t.Amount);
        decimal withdrawn = transactions.Where(t => t.Transaction_Type == "withdrawn" && (t.Related_Withdrawal_Request == null || t.Related_Withdrawal_Request.Status == "paid")).Sum(t => t.Amount);

        var pendingWithdrawals = await Context.Withdrawal_Requests
            .Where(w => w.Handyman_User_Id == userId && (w.Status == "pending" || w.Status == "approved"))
            .SumAsync(w => w.Amount);

        var available = earned - withdrawn - pendingWithdrawals;

        return new CreditBalanceDto(
            Earned: earned,
            Withdrawn: withdrawn,
            Available: Math.Max(0, available),
            Pending: pendingWithdrawals
        );
    }

    public async Task<CreditTransactionsResponse> GetCreditTransactionsAsync(int page, int pageSize)
    {
        ValidatePage(page, pageSize);

        var userId = await GetCurrentUserIdAsync();

        var query = Context.Handyman_Credits
            .Where(c => c.Handyman_User_Id == userId)
            .OrderByDescending(c => c.Created_At_Utc);

        var totalCount = await query.CountAsync();
        var transactions = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = transactions.Select(t => new CreditTransactionDto(
            Id: t.Id,
            TransactionType: t.Transaction_Type,
            Amount: t.Amount,
            Description: t.Description,
            RelatedJobId: t.Related_Job_Id,
            RelatedBidId: t.Related_Bid_Id,
            RelatedPaymentId: t.Related_Payment_Id,
            RelatedWithdrawalRequestId: t.Related_Withdrawal_Request_Id,
            CreatedAtUtc: t.Created_At_Utc
        )).ToList();

        return new CreditTransactionsResponse(dtos, page, pageSize, totalCount);
    }

    public async Task<WithdrawalRequestDto> RequestWithdrawalAsync(CreateWithdrawalRequestRequest request)
    {
        var userId = await GetCurrentUserIdAsync();

        if (request.Amount <= 0)
            throw new HttpRequestException("Withdrawal amount must be greater than zero.", null, HttpStatusCode.BadRequest);

        var requestedAmount = Math.Round(request.Amount, 2, MidpointRounding.AwayFromZero);
        if (requestedAmount != request.Amount)
            throw new HttpRequestException("Withdrawal amount can have at most 2 decimal places.", null, HttpStatusCode.BadRequest);

        var bankDetails = await Context.Handyman_Bank_Details
            .Where(b => b.Handyman_User_Id == userId && b.Verification_Status == "verified")
            .OrderByDescending(b => b.Updated_At_Utc)
            .FirstOrDefaultAsync()
            ?? throw new HttpRequestException("Bank details not found. Please add and verify bank details before requesting withdrawal.", null, HttpStatusCode.BadRequest);

        var balance = await GetCreditBalanceAsync();
        if (requestedAmount > balance.Available)
            throw new HttpRequestException("Withdrawal amount exceeds available balance.", null, HttpStatusCode.BadRequest);

        var hasPendingWithdrawal = await HasPendingWithdrawalAsync(userId);

        if (hasPendingWithdrawal)
            throw new HttpRequestException("You have a pending withdrawal request. Please wait for it to be processed before requesting another withdrawal.", null, HttpStatusCode.BadRequest);

        var snapshotJson = JsonSerializer.Serialize(new
        {
            bankName = bankDetails.Bank_Name,
            accountName = bankDetails.Account_Name,
            accountNumber = bankDetails.Account_Number
        });

        var withdrawalRequest = new Withdrawal_Request
        {
            Id = Guid.NewGuid(),
            Handyman_User_Id = userId,
            Bank_Details_Id = bankDetails.Id,
            Amount = requestedAmount,
            Bank_Details_Snapshot = snapshotJson,
            Status = "pending",
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };

        Context.Withdrawal_Requests.Add(withdrawalRequest);
        await Context.SaveChangesAsync();

        await CreateNotification(
            userId,
            NotificationType.SystemMessage,
            $"Your withdrawal request of RM {requestedAmount:F2} has been submitted and is pending admin review."
        );

        await CreateNotifications(
            NotificationType.SystemMessage,
            $"New withdrawal request submitted: RM {requestedAmount:F2}.",
            UserRole.Admin
        );

        Logger.LogInformation("Withdrawal request created for handyman {HandymanId}, amount {Amount}", userId, requestedAmount);

        return await MapToWithdrawalRequestDtoAsync(withdrawalRequest);
    }

    public async Task<WithdrawalRequestsResponse> GetWithdrawalRequestsAsync(int page, int pageSize)
    {
        ValidatePage(page, pageSize);

        var userId = await GetCurrentUserIdAsync();

        var query = Context.Withdrawal_Requests
            .Where(w => w.Handyman_User_Id == userId)
            .OrderByDescending(w => w.Created_At_Utc);

        var totalCount = await query.CountAsync();
        var requests = await query
            .Include(w => w.Bank_Details)
            .Include(w => w.Handyman_User)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = new List<WithdrawalRequestDto>();
        foreach (var req in requests)
            dtos.Add(await MapToWithdrawalRequestDtoAsync(req));

        return new WithdrawalRequestsResponse(dtos, page, pageSize, totalCount);
    }

    public async Task<AdminBankDetailsResponse> GetAllBankDetailsAsync(string? status, int page, int pageSize)
    {
        EnsureAdminRole();
        ValidatePage(page, pageSize);

        var normalizedStatus = NormalizeOptionalBankStatus(status);
        var query = Context.Handyman_Bank_Details
            .AsNoTracking()
            .Include(b => b.Handyman_User)
            .AsQueryable();

        if (normalizedStatus is not null)
            query = query.Where(b => b.Verification_Status == normalizedStatus);

        var totalCount = await query.CountAsync();
        var rows = await query
            .OrderByDescending(b => b.Updated_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new AdminBankDetailsResponse(rows.Select(MapToAdminBankDetailsDto).ToList(), page, pageSize, totalCount);
    }

    public async Task<AdminBankDetailsDto> ApproveBankDetailsAsync(Guid bankDetailsId)
    {
        EnsureAdminRole();
        var adminId = await GetCurrentUserIdAsync();

        var bankDetails = await Context.Handyman_Bank_Details
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bankDetailsId)
            ?? throw new HttpRequestException("Bank details not found.", null, HttpStatusCode.NotFound);

        var hasPendingWithdrawal = await HasPendingWithdrawalAsync(bankDetails.Handyman_User_Id);
        if (hasPendingWithdrawal)
            throw new HttpRequestException("Cannot approve new bank details while this handyman has a pending withdrawal request.", null, HttpStatusCode.BadRequest);

        if (string.IsNullOrWhiteSpace(bankDetails.Bank_Statement_Proof_Url))
            throw new HttpRequestException("Bank statement proof must be uploaded before approval.", null, HttpStatusCode.BadRequest);

        if (bankDetails.Verification_Status == "verified")
            throw new HttpRequestException("Bank details are already verified.", null, HttpStatusCode.BadRequest);

        var now = DateTime.UtcNow;

        var otherVerifiedDetails = await Context.Handyman_Bank_Details
            .Where(b => b.Handyman_User_Id == bankDetails.Handyman_User_Id && b.Id != bankDetails.Id && b.Verification_Status == "verified")
            .ToListAsync();

        foreach (var other in otherVerifiedDetails)
        {
            other.Verification_Status = "disabled";
            other.Updated_At_Utc = now;
        }

        bankDetails.Verification_Status = "verified";
        bankDetails.Verified_By_User_Id = adminId;
        bankDetails.Verified_At_Utc = now;
        bankDetails.Rejection_Reason = null;
        bankDetails.Updated_At_Utc = now;

        await CreateNotification(bankDetails.Handyman_User_Id, NotificationType.SystemMessage, "Your bank details have been verified. You can now request withdrawals.");
        await Context.SaveChangesAsync();

        return MapToAdminBankDetailsDto(bankDetails);
    }

    public async Task<AdminBankDetailsDto> RejectBankDetailsAsync(Guid bankDetailsId, RejectBankDetailsRequest request)
    {
        EnsureAdminRole();
        var adminId = await GetCurrentUserIdAsync();
        var reason = ValidateReason(request.Reason, "Rejection reason");

        var bankDetails = await Context.Handyman_Bank_Details
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bankDetailsId)
            ?? throw new HttpRequestException("Bank details not found.", null, HttpStatusCode.NotFound);

        if (bankDetails.Verification_Status == "verified")
            throw new HttpRequestException("Verified bank details cannot be rejected. Ask the handyman to submit updated details first.", null, HttpStatusCode.BadRequest);

        bankDetails.Verification_Status = "rejected";
        bankDetails.Verified_By_User_Id = adminId;
        bankDetails.Verified_At_Utc = DateTime.UtcNow;
        bankDetails.Rejection_Reason = reason;
        bankDetails.Updated_At_Utc = DateTime.UtcNow;

        await CreateNotification(bankDetails.Handyman_User_Id, NotificationType.SystemMessage, $"Your bank details were rejected. Reason: {reason}");
        await Context.SaveChangesAsync();

        return MapToAdminBankDetailsDto(bankDetails);
    }

    private async Task<Handyman_Bank_Details?> GetCurrentBankDetailsAsync(Guid userId)
    {
        var verified = await Context.Handyman_Bank_Details
            .Where(b => b.Handyman_User_Id == userId && b.Verification_Status == "verified")
            .OrderByDescending(b => b.Updated_At_Utc)
            .FirstOrDefaultAsync();

        if (verified != null)
            return verified;

        return await Context.Handyman_Bank_Details
            .Where(b => b.Handyman_User_Id == userId)
            .OrderByDescending(b => b.Updated_At_Utc)
            .FirstOrDefaultAsync();
    }

    private Task<bool> HasPendingWithdrawalAsync(Guid userId)
    {
        return Context.Withdrawal_Requests
            .AnyAsync(w => w.Handyman_User_Id == userId && w.Status == "pending");
    }

    private static (string BankName, string AccountName, string AccountNumber) ValidateBankDetailsInput(string bankName, string accountName, string accountNumber)
    {
        var cleanBankName = bankName?.Trim() ?? string.Empty;
        var cleanAccountName = accountName?.Trim() ?? string.Empty;
        var cleanAccountNumber = Regex.Replace(accountNumber?.Trim() ?? string.Empty, @"[\s-]", "");

        if (cleanBankName.Length < 2 || cleanBankName.Length > 100)
            throw new HttpRequestException("Bank name must be at least 2 characters long.", null, HttpStatusCode.BadRequest);

        if (cleanAccountName.Length < 3 || cleanAccountName.Length > 120)
            throw new HttpRequestException("Account name must be at least 3 characters long.", null, HttpStatusCode.BadRequest);

        if (!Regex.IsMatch(cleanAccountNumber, @"^\d{8,20}$"))
            throw new HttpRequestException("Account number must be numeric and between 8 and 20 digits long.", null, HttpStatusCode.BadRequest);

        return (cleanBankName, cleanAccountName, cleanAccountNumber);
    }

    private BankDetailsDto MapToBankDetailsDto(Handyman_Bank_Details entity)
    {
        return new BankDetailsDto(
            Id: entity.Id,
            BankName: entity.Bank_Name,
            AccountName: entity.Account_Name,
            AccountNumber: entity.Account_Number,
            VerificationStatus: entity.Verification_Status,
            BankStatementProofUrl: GetPresignedUrl(entity.Bank_Statement_Proof_Url),
            RejectionReason: entity.Rejection_Reason,
            VerifiedAtUtc: entity.Verified_At_Utc ?? DateTime.MinValue,
            CreatedAtUtc: entity.Created_At_Utc,
            UpdatedAtUtc: entity.Updated_At_Utc
        );
    }

    private AdminBankDetailsDto MapToAdminBankDetailsDto(Handyman_Bank_Details entity)
    {
        return new AdminBankDetailsDto(
            Id: entity.Id,
            HandymanUserId: entity.Handyman_User_Id,
            HandymanName: entity.Handyman_User?.Name ?? "Unknown handyman",
            HandymanEmail: entity.Handyman_User?.Email ?? "",
            BankName: entity.Bank_Name,
            AccountName: entity.Account_Name,
            AccountNumber: entity.Account_Number,
            VerificationStatus: entity.Verification_Status,
            BankStatementProofUrl: GetPresignedUrl(entity.Bank_Statement_Proof_Url),
            RejectionReason: entity.Rejection_Reason,
            VerifiedAtUtc: entity.Verified_At_Utc,
            CreatedAtUtc: entity.Created_At_Utc,
            UpdatedAtUtc: entity.Updated_At_Utc
        );
    }

    private async Task<WithdrawalRequestDto> MapToWithdrawalRequestDtoAsync(Withdrawal_Request entity)
    {
        using var snapshot = JsonDocument.Parse(entity.Bank_Details_Snapshot);

        var handymanName = entity.Handyman_User?.Name
            ?? await Context.Users
                .Where(u => u.Id == entity.Handyman_User_Id)
                .Select(u => u.Name)
                .FirstOrDefaultAsync()
            ?? "Unknown handyman";

        var snapshotDto = new BankDetailsSnapshotDto(
            BankName: GetSnapshotString(snapshot, "bankName", "Bank_Name", entity.Bank_Details?.Bank_Name),
            AccountName: GetSnapshotString(snapshot, "accountName", "Account_Name", entity.Bank_Details?.Account_Name),
            AccountNumber: GetSnapshotString(snapshot, "accountNumber", "Account_Number", entity.Bank_Details?.Account_Number)
        );

        return new WithdrawalRequestDto(
            Id: entity.Id,
            HandymanUserId: entity.Handyman_User_Id,
            HandymanName: handymanName,
            Amount: entity.Amount,
            Status: entity.Status,
            RequestedAtUtc: entity.Created_At_Utc,
            ApprovedAtUtc: entity.Approved_At_Utc,
            PaidAtUtc: entity.Paid_At_Utc,
            RejectionReason: entity.Rejection_Reason,
            BankTransferReference: entity.Bank_Transfer_Reference,
            BankDetails: snapshotDto
        );
    }

    private async Task CreateNotification(Guid userId, string type, string message)
    {
        Context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = userId,
            Type = type,
            Message = message,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        });

        await Context.SaveChangesAsync();
    }

    private void EnsureAdminRole()
    {
        if (GetCurrentUserRole() != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can perform this action.", null, HttpStatusCode.Forbidden);
    }

    private static void ValidatePage(int page, int pageSize)
    {
        if (page < 1)
            throw new HttpRequestException("Page must be greater than zero.", null, HttpStatusCode.BadRequest);

        if (pageSize < 1 || pageSize > 100)
            throw new HttpRequestException("Page size must be between 1 and 100.", null, HttpStatusCode.BadRequest);
    }

    private static string? NormalizeOptionalBankStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return null;

        var normalized = status.Trim().ToLowerInvariant();
        if (!BankStatuses.Contains(normalized))
            throw new HttpRequestException("Invalid bank details status.", null, HttpStatusCode.BadRequest);

        return normalized;
    }

    private static string ValidateReason(string reason, string label)
    {
        var trimmed = reason?.Trim() ?? string.Empty;

        if (trimmed.Length < 3)
            throw new HttpRequestException($"{label} must be at least 3 characters long.", null, HttpStatusCode.BadRequest);

        if (trimmed.Length > 500)
            throw new HttpRequestException($"{label} must be 500 characters or fewer.", null, HttpStatusCode.BadRequest);

        return trimmed;
    }

    private static string GetSnapshotString(JsonDocument snapshot, string camelKey, string legacyKey, string? fallback = null)
    {
        if (snapshot.RootElement.TryGetProperty(camelKey, out var camelValue))
            return camelValue.GetString() ?? fallback ?? "";

        if (snapshot.RootElement.TryGetProperty(legacyKey, out var legacyValue))
            return legacyValue.GetString() ?? fallback ?? "";

        return fallback ?? "";
    }
}
