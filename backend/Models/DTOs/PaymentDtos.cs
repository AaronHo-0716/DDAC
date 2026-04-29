namespace backend.Models.DTOs;

public record CreateCheckoutSessionResponse(
    string CheckoutUrl,
    string SessionId
);
