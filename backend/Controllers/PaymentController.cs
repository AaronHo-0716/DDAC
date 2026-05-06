using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentController(IPaymentService paymentService) : BaseController
{
    [Authorize(Roles = "admin,homeowner,handyman")]
    [HttpGet("transactions")]
    public async Task<ActionResult<PaymentTransactionsResponse>> GetPaymentTransactions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try { return Ok(await paymentService.GetPaymentTransactionsAsync(page, pageSize)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [Authorize(Roles = "admin,homeowner")]
    [HttpGet("{paymentId}/receipt")]
    public async Task<IActionResult> GetReceipt(Guid paymentId)
    {
        try
        {
            var receipt = await paymentService.GetPaymentReceiptAsync(paymentId);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{receipt.FileName}\"";
            return File(receipt.Content, "application/pdf");
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [Authorize(Roles = "admin,homeowner")]
    [HttpPost("jobs/{jobId}/checkout-session")]
    public async Task<ActionResult<CreateCheckoutSessionResponse>> CreateCheckoutSession(Guid jobId)
    {
        try { return Ok(await paymentService.CreateCheckoutSessionAsync(jobId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [Authorize(Roles = "admin,homeowner")]
    [HttpPost("jobs/{jobId}/checkout-sessions/{sessionId}/confirm")]
    public async Task<IActionResult> ConfirmCheckoutSession(Guid jobId, string sessionId)
    {
        try
        {
            await paymentService.ConfirmCheckoutSessionAsync(jobId, sessionId);
            return NoContent();
        }
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

    [Authorize(Roles = "admin")]
    [HttpGet("admin/stats")]
    public async Task<ActionResult<AdminPaymentStatsDto>> GetAdminPaymentStats()
    {
        try { return Ok(await paymentService.GetAdminPaymentStatsAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}
