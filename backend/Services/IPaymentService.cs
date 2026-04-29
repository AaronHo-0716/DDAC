using backend.Models.DTOs;

namespace backend.Services;

public interface IPaymentService
{
    Task<CreateCheckoutSessionResponse> CreateCheckoutSessionAsync(Guid jobId);
    Task HandleWebhookAsync(string requestBody, string? signatureHeader);
}
