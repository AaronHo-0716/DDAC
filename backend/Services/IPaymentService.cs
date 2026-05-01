using backend.Models.DTOs;

namespace backend.Services;

public interface IPaymentService
{
    Task<CreateCheckoutSessionResponse> CreateCheckoutSessionAsync(Guid jobId);
    Task ConfirmCheckoutSessionAsync(Guid jobId, string sessionId);
    Task HandleWebhookAsync(string requestBody, string? signatureHeader);
    Task<PaymentTransactionsResponse> GetPaymentTransactionsAsync(int page, int pageSize);
    Task<AdminPaymentStatsDto> GetAdminPaymentStatsAsync();
}
