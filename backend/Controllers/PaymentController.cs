using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentController(IPaymentService paymentService) : BaseController
{
    [Authorize(Roles = "admin,homeowner")]
    [HttpPost("jobs/{jobId}/checkout-session")]
    public async Task<ActionResult<CreateCheckoutSessionResponse>> CreateCheckoutSession(Guid jobId)
    {
        try { return Ok(await paymentService.CreateCheckoutSessionAsync(jobId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> StripeWebhook()
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();
        var signatureHeader = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await paymentService.HandleWebhookAsync(payload, signatureHeader);
            return Ok();
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}
