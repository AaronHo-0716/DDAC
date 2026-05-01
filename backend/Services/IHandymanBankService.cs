using backend.Models.DTOs;

namespace backend.Services;

public interface IHandymanBankService
{
    /// <summary>
    /// Get current bank details for the authenticated handyman user
    /// </summary>
    Task<BankDetailsDto?> GetBankDetailsAsync();

    /// <summary>
    /// Add new bank details for the authenticated handyman user
    /// </summary>
    Task<BankDetailsDto> AddBankDetailsAsync(CreateBankDetailsRequest request);

    /// <summary>
    /// Delete existing bank details for the authenticated handyman user
    /// </summary>
    Task DeleteBankDetailsAsync();

    /// <summary>
    /// Upload bank statement proof document for the authenticated handyman's bank details
    /// </summary>
    // Task<BankDetailsDto> UploadBankStatementProofAsync(IFormFile file);

    /// <summary>
    /// Get credit balance (earned, withdrawn, available, pending) for authenticated handyman
    /// </summary>
    Task<CreditBalanceDto> GetCreditBalanceAsync();

    /// <summary>
    /// Get paginated credit transaction history for authenticated handyman
    /// </summary>
    Task<CreditTransactionsResponse> GetCreditTransactionsAsync(int page, int pageSize);

    /// <summary>
    /// Request a withdrawal of earned credits (admin approval required)
    /// </summary>
    Task<WithdrawalRequestDto> RequestWithdrawalAsync(CreateWithdrawalRequestRequest request);

    /// <summary>
    /// Get paginated withdrawal requests for authenticated handyman
    /// </summary>
    Task<WithdrawalRequestsResponse> GetWithdrawalRequestsAsync(int page, int pageSize);

    Task<AdminBankDetailsResponse> GetAllBankDetailsAsync(string? status, int page, int pageSize);
    Task<AdminBankDetailsDto> ApproveBankDetailsAsync(Guid bankDetailsId);
    Task<AdminBankDetailsDto> RejectBankDetailsAsync(Guid bankDetailsId, RejectBankDetailsRequest request);
}
