using backend.Models.Entities;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Net;
using backend.Constants;
using System.Text.Json;

namespace backend.Services;

public class WithdrawalService(ServiceDependencies deps) : BaseService(deps), IWithdrawalService
{
    private static readonly HashSet<string> WithdrawalStatuses = ["pending", "approved", "rejected", "paid"];

    public async Task<WithdrawalRequestsResponse> GetAllWithdrawalRequestsAsync(string? status = null, int page = 1, int pageSize = 50)
    {
        // Verify admin role (this is enforced by controller, but double-check)
        var userRole = GetCurrentUserRole();
        if (userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can access withdrawal requests.", null, HttpStatusCode.Forbidden);

        ValidatePage(page, pageSize);
        var normalizedStatus = NormalizeOptionalStatus(status);

        var query = Context.Withdrawal_Requests.AsQueryable();

        if (normalizedStatus is not null)
            query = query.Where(w => w.Status == normalizedStatus);

        var totalCount = await query.CountAsync();

        var requests = await query
            .Include(w => w.Bank_Details)
            .Include(w => w.Handyman_User)
            .OrderByDescending(w => w.Created_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = new List<WithdrawalRequestDto>();
        foreach (var req in requests)
        {
            dtos.Add(await MapToWithdrawalRequestDtoAsync(req));
        }

        return new WithdrawalRequestsResponse(dtos, page, pageSize, totalCount);
    }

    public async Task<WithdrawalRequestDto> GetWithdrawalRequestByIdAsync(Guid requestId)
    {
        // Verify admin role
        var userRole = GetCurrentUserRole();
        if (userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can access withdrawal requests.", null, HttpStatusCode.Forbidden);

        var request = await Context.Withdrawal_Requests
            .Include(w => w.Bank_Details)
            .Include(w => w.Handyman_User)
            .FirstOrDefaultAsync(w => w.Id == requestId)
            ?? throw new HttpRequestException("Withdrawal request not found.", null, HttpStatusCode.NotFound);

        return await MapToWithdrawalRequestDtoAsync(request);
    }

    public async Task<WithdrawalRequestDto> ApproveWithdrawalAsync(Guid requestId, ApproveWithdrawalRequest? approveRequest = null)
    {
        var adminId = await GetCurrentUserIdAsync();
        var userRole = GetCurrentUserRole();

        if (userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can approve withdrawal requests.", null, HttpStatusCode.Forbidden);

        var request = await Context.Withdrawal_Requests
            .Include(w => w.Bank_Details)
            .Include(w => w.Handyman_User)
            .FirstOrDefaultAsync(w => w.Id == requestId)
            ?? throw new HttpRequestException("Withdrawal request not found.", null, HttpStatusCode.NotFound);

        if (request.Status != "pending")
            throw new HttpRequestException($"Can only approve pending requests. Current status: {request.Status}", null, HttpStatusCode.BadRequest);

        request.Status = "approved";
        request.Approved_By_User_Id = adminId;
        request.Approved_At_Utc = DateTime.UtcNow;
        request.Updated_At_Utc = DateTime.UtcNow;

        var notes = ValidateOptionalText(approveRequest?.Notes, "Admin notes", 500);
        if (!string.IsNullOrEmpty(notes))
            request.Metadata = JsonSerializer.Serialize(new { adminNotes = notes });


        // Append admin action
        //AppendAdminAction(adminId, "approve_withdrawal", "withdrawal_request", requestId, "Withdrawal request approved");

        await Context.SaveChangesAsync();

        // Notify handyman
        await CreateNotification(
            request.Handyman_User_Id,
            NotificationType.SystemMessage,
            $"Your withdrawal request of RM {request.Amount:F2} has been approved. It will be processed soon.",
            null
        );

        Logger.LogInformation("Withdrawal request {RequestId} approved by admin {AdminId}", requestId, adminId);

        return await MapToWithdrawalRequestDtoAsync(request);
    }

    public async Task<WithdrawalRequestDto> RejectWithdrawalAsync(Guid requestId, RejectWithdrawalRequest request)
    {
        var reason = ValidateRequiredText(request.Reason, "Rejection reason", 500);

        var adminId = await GetCurrentUserIdAsync();
        var userRole = GetCurrentUserRole();

        if (userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can reject withdrawal requests.", null, HttpStatusCode.Forbidden);

        var withdrawalRequest = await Context.Withdrawal_Requests
            .Include(w => w.Bank_Details)
            .Include(w => w.Handyman_User)
            .FirstOrDefaultAsync(w => w.Id == requestId)
            ?? throw new HttpRequestException("Withdrawal request not found.", null, HttpStatusCode.NotFound);

        if (withdrawalRequest.Status != "pending" && withdrawalRequest.Status != "approved")
            throw new HttpRequestException($"Can only reject pending or approved requests. Current status: {withdrawalRequest.Status}", null, HttpStatusCode.BadRequest);

        withdrawalRequest.Status = "rejected";
        withdrawalRequest.Rejection_Reason = reason;
        withdrawalRequest.Updated_At_Utc = DateTime.UtcNow;


        // Append admin action
        //AppendAdminAction(adminId, "reject_withdrawal", "withdrawal_request", requestId, reason);

        await Context.SaveChangesAsync();

        // Notify handyman
        await CreateNotification(
            withdrawalRequest.Handyman_User_Id,
            NotificationType.SystemMessage,
            $"Your withdrawal request of RM {withdrawalRequest.Amount:F2} was rejected. Reason: {reason}",
            null
        );

        Logger.LogInformation("Withdrawal request {RequestId} rejected by admin {AdminId}", requestId, adminId);

        return await MapToWithdrawalRequestDtoAsync(withdrawalRequest);
    }

    public async Task<WithdrawalRequestDto> MarkWithdrawalPaidAsync(Guid requestId, MarkWithdrawalPaidRequest? request = null)
    {
        var adminId = await GetCurrentUserIdAsync();
        var userRole = GetCurrentUserRole();

        if (userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can mark withdrawals as paid.", null, HttpStatusCode.Forbidden);

        var withdrawalRequest = await Context.Withdrawal_Requests
            .Include(w => w.Bank_Details)
            .Include(w => w.Handyman_User)
            .FirstOrDefaultAsync(w => w.Id == requestId)
            ?? throw new HttpRequestException("Withdrawal request not found.", null, HttpStatusCode.NotFound);

        if (withdrawalRequest.Status != "approved")
            throw new HttpRequestException($"Can only mark approved requests as paid. Current status: {withdrawalRequest.Status}", null, HttpStatusCode.BadRequest);

        withdrawalRequest.Status = "paid";
        withdrawalRequest.Paid_By_User_Id = adminId;
        withdrawalRequest.Paid_At_Utc = DateTime.UtcNow;
        withdrawalRequest.Updated_At_Utc = DateTime.UtcNow;

        var transferReference = ValidateOptionalText(request?.BankTransferReference, "Bank transfer reference", 120);
        if (!string.IsNullOrEmpty(transferReference))
            withdrawalRequest.Bank_Transfer_Reference = transferReference;


        // Create a credit transaction entry for the withdrawal
        var creditTransaction = new Handyman_Credit
        {
            Id = Guid.NewGuid(),
            Handyman_User_Id = withdrawalRequest.Handyman_User_Id,
            Transaction_Type = "withdrawn",
            Amount = withdrawalRequest.Amount,
            Description = $"Withdrawal request {requestId} marked as paid",
            Related_Withdrawal_Request_Id = requestId,
            Balance_After = await CalculateBalanceAfterAsync(withdrawalRequest.Handyman_User_Id, withdrawalRequest.Amount, "withdrawn"),
            Created_At_Utc = DateTime.UtcNow
        };

        Context.Handyman_Credits.Add(creditTransaction);

        // Append admin action
        //AppendAdminAction(adminId, "mark_withdrawal_paid", "withdrawal_request", requestId, $"Withdrawal marked as paid. Transfer ref: {transferReference ?? "N/A"}");

        await Context.SaveChangesAsync();

        Logger.LogInformation("Withdrawal request {RequestId} marked as paid by admin {AdminId}", requestId, adminId);

        // Notify handyman
        await CreateNotification(
            withdrawalRequest.Handyman_User_Id,
            NotificationType.SystemMessage,
            $"Your withdrawal request of RM {withdrawalRequest.Amount:F2} has been processed and transferred to your bank account.",
            null
        );

        return await MapToWithdrawalRequestDtoAsync(withdrawalRequest);
    }

    public async Task<WithdrawalStats> GetWithdrawalStatsAsync()
    {
        var userRole = GetCurrentUserRole();
        if (userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only admins can access withdrawal statistics.", null, HttpStatusCode.Forbidden);

        var allRequests = await Context.Withdrawal_Requests.ToListAsync();

        var pending = allRequests.Where(w => w.Status == "pending").ToList();
        var approved = allRequests.Where(w => w.Status == "approved").ToList();
        var paid = allRequests.Where(w => w.Status == "paid").ToList();
        var rejected = allRequests.Where(w => w.Status == "rejected").ToList();

        return new WithdrawalStats(
            TotalPending: pending.Sum(w => w.Amount),
            TotalApproved: approved.Sum(w => w.Amount),
            TotalPaid: paid.Sum(w => w.Amount),
            CountPending: pending.Count,
            CountApproved: approved.Count,
            CountPaid: paid.Count,
            CountRejected: rejected.Count
        );
    }

    // Helper methods

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

    private void AppendAdminAction(Guid adminId, string actionType, string targetType, Guid targetId, string reason)
    {
        var adminAction = new Admin_Action
        {
            Id = Guid.NewGuid(),
            Admin_User_Id = adminId,
            Action_Type = actionType,
            Target_Type = targetType,
            Target_Id = targetId,
            Reason = reason,
            Created_At_Utc = DateTime.UtcNow
        };

        Context.Admin_Actions.Add(adminAction);
    }

    private async Task<decimal> CalculateBalanceAfterAsync(Guid handymanId, decimal amount, string transactionType)
    {
        var allTransactions = await Context.Handyman_Credits
            .Where(c => c.Handyman_User_Id == handymanId)
            .OrderBy(c => c.Created_At_Utc)
            .ToListAsync();

        decimal balance = 0;
        foreach (var tx in allTransactions)
        {
            if (tx.Transaction_Type == "earned")
                balance += tx.Amount;
            else if (tx.Transaction_Type == "withdrawn")
                balance -= tx.Amount;
        }

        // Add the new transaction
        if (transactionType == "earned")
            balance += amount;
        else if (transactionType == "withdrawn")
            balance -= amount;

        return balance;
    }

    private async Task CreateNotification(Guid userId, string type, string message, Guid? relatedJobId)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = userId,
            Type = type,
            Message = message,
            Related_Job_Id = relatedJobId,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        };

        Context.Notifications.Add(notification);
        await Context.SaveChangesAsync();
    }

    private static void ValidatePage(int page, int pageSize)
    {
        if (page < 1)
            throw new HttpRequestException("Page must be greater than zero.", null, HttpStatusCode.BadRequest);

        if (pageSize < 1 || pageSize > 100)
            throw new HttpRequestException("Page size must be between 1 and 100.", null, HttpStatusCode.BadRequest);
    }

    private static string? NormalizeOptionalStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return null;

        var normalized = status.Trim().ToLowerInvariant();
        if (!WithdrawalStatuses.Contains(normalized))
            throw new HttpRequestException("Invalid withdrawal status.", null, HttpStatusCode.BadRequest);

        return normalized;
    }

    private static string ValidateRequiredText(string value, string label, int maxLength)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (trimmed.Length < 3)
            throw new HttpRequestException($"{label} must be at least 3 characters long.", null, HttpStatusCode.BadRequest);

        if (trimmed.Length > maxLength)
            throw new HttpRequestException($"{label} must be {maxLength} characters or fewer.", null, HttpStatusCode.BadRequest);

        return trimmed;
    }

    private static string? ValidateOptionalText(string? value, string label, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new HttpRequestException($"{label} must be {maxLength} characters or fewer.", null, HttpStatusCode.BadRequest);

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
