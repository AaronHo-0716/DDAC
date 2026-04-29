namespace backend.Models.Config;

public class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string SuccessUrlBase { get; set; } = string.Empty;
    public string CancelUrlBase { get; set; } = string.Empty;
    public string Currency { get; set; } = "myr";
}
