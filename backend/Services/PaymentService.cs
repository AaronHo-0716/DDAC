using System.Net;
using System.Text.Json;
using backend.Constants;
using backend.Models.Config;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

namespace backend.Services;

public class PaymentService(ServiceDependencies deps, IOptions<StripeOptions> stripeOptions) : BaseService(deps), IPaymentService
{
    private readonly StripeOptions _stripeOptions = stripeOptions.Value;

    public async Task<CreateCheckoutSessionResponse> CreateCheckoutSessionAsync(Guid jobId)
    {
        var userId = await GetCurrentUserIdAsync();
        var userRole = GetCurrentUserRole();

        EnsureStripeConfiguredForCheckout();

        var job = await Context.Jobs
            .FirstOrDefaultAsync(j => j.Id == jobId)
            ?? throw new HttpRequestException($"Job with id {jobId} not found.", null, HttpStatusCode.NotFound);

        if (userRole == UserRole.Homeowner.ToDbString() && job.Posted_By_User_Id != userId)
            throw new HttpRequestException("You are not the owner of this job.", null, HttpStatusCode.Forbidden);

        if (job.Status != JobStatus.Completed.ToDbString())
            throw new HttpRequestException("Payment is only available for completed jobs.", null, HttpStatusCode.BadRequest);

        var acceptedBid = await Context.Bids
            .FirstOrDefaultAsync(b => b.Job_Id == jobId && b.Status == BidStatus.Accepted.ToDbString())
            ?? throw new HttpRequestException("No accepted bid found for this job.", null, HttpStatusCode.BadRequest);

        if (acceptedBid.Locked)
            throw new HttpRequestException("Cannot proceed with payment while the accepted bid is locked.", null, HttpStatusCode.BadRequest);

        var paidEventType = BidEventType.PaymentPaid.ToDbString();
        var existingPaid = await Context.Bid_Transactions.AnyAsync(tx =>
            tx.Bid_Id == acceptedBid.Id && tx.Event_Type == paidEventType);

        if (existingPaid)
            throw new HttpRequestException("This job has already been paid.", null, HttpStatusCode.BadRequest);

        StripeConfiguration.ApiKey = _stripeOptions.SecretKey;

        var amountInSmallestUnit = (long)Math.Round(acceptedBid.Price * 100m, MidpointRounding.AwayFromZero);
        if (amountInSmallestUnit <= 0)
            throw new HttpRequestException("Accepted bid amount must be greater than zero.", null, HttpStatusCode.BadRequest);

        var successUrl = BuildFrontendReturnUrl(_stripeOptions.SuccessUrlBase, jobId, "success", includeSessionId: true);
        var cancelUrl = BuildFrontendReturnUrl(_stripeOptions.CancelUrlBase, jobId, "cancel", includeSessionId: false);

        var sessionOptions = new SessionCreateOptions
        {
            Mode = "payment",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string>
            {
                ["job_id"] = job.Id.ToString(),
                ["bid_id"] = acceptedBid.Id.ToString(),
                ["homeowner_user_id"] = job.Posted_By_User_Id.ToString(),
                ["handyman_user_id"] = acceptedBid.Handyman_User_Id.ToString()
            },
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = _stripeOptions.Currency.ToLowerInvariant(),
                        UnitAmount = amountInSmallestUnit,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"NeighbourHelp Job Payment - {job.Title}"
                        }
                    }
                }
            ]
        };

        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(sessionOptions);

        if (string.IsNullOrWhiteSpace(session.Url))
            throw new HttpRequestException("Stripe did not return a checkout URL.", null, HttpStatusCode.BadGateway);

        var initiatedMetadata = JsonSerializer.Serialize(new
        {
            session_id = session.Id,
            payment_intent = session.PaymentIntentId,
            amount = acceptedBid.Price,
            amount_in_smallest_unit = amountInSmallestUnit,
            currency = _stripeOptions.Currency.ToLowerInvariant(),
            status = "initiated"
        });

        Context.Bid_Transactions.Add(new Bid_Transaction
        {
            Id = Guid.NewGuid(),
            Bid_Id = acceptedBid.Id,
            Job_Id = job.Id,
            Handyman_User_Id = acceptedBid.Handyman_User_Id,
            Homeowner_User_Id = job.Posted_By_User_Id,
            Event_Type = BidEventType.PaymentInitiated.ToDbString(),
            Event_By_User_Id = userId,
            Event_Reason = "Stripe checkout session created.",
            Event_Metadata = initiatedMetadata,
            Created_At_Utc = DateTime.UtcNow
        });

        await Context.SaveChangesAsync();

        return new CreateCheckoutSessionResponse(
            CheckoutUrl: session.Url,
            SessionId: session.Id
        );
    }

    public async Task HandleWebhookAsync(string requestBody, string? signatureHeader)
    {
        EnsureStripeConfiguredForWebhook();

        if (string.IsNullOrWhiteSpace(signatureHeader))
            throw new HttpRequestException("Missing Stripe signature header.", null, HttpStatusCode.BadRequest);

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(requestBody, signatureHeader, _stripeOptions.WebhookSecret);
        }
        catch (StripeException ex)
        {
            Logger.LogWarning(ex, "Stripe webhook signature verification failed.");
            throw new HttpRequestException("Invalid Stripe webhook signature.", null, HttpStatusCode.BadRequest);
        }

        if (stripeEvent.Type != EventTypes.CheckoutSessionCompleted)
            return;

        if (stripeEvent.Data.Object is not Session session)
        {
            Logger.LogWarning("Stripe webhook payload did not contain a checkout session object.");
            return;
        }

        if (session.Metadata is null || !session.Metadata.TryGetValue("bid_id", out var bidIdValue) || !Guid.TryParse(bidIdValue, out var bidId))
        {
            Logger.LogWarning("Stripe webhook session metadata missing or invalid bid_id. Session: {SessionId}", session.Id);
            return;
        }

        var bid = await Context.Bids
            .Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == bidId);

        if (bid is null)
        {
            Logger.LogWarning("Stripe webhook references unknown bid {BidId}. Session: {SessionId}", bidId, session.Id);
            return;
        }

        var paidEventType = BidEventType.PaymentPaid.ToDbString();
        var existingPaidEvents = await Context.Bid_Transactions
            .Where(tx => tx.Bid_Id == bid.Id && tx.Event_Type == paidEventType)
            .ToListAsync();

        var alreadyPaidForSession = existingPaidEvents.Any(tx =>
            string.Equals(PaymentLedgerHelper.ExtractSessionId(tx.Event_Metadata), session.Id, StringComparison.OrdinalIgnoreCase));

        if (alreadyPaidForSession)
            return;

        if (existingPaidEvents.Count > 0)
            return;

        var amount = session.AmountTotal.HasValue
            ? session.AmountTotal.Value / 100m
            : bid.Price;

        var paymentMetadata = JsonSerializer.Serialize(new
        {
            session_id = session.Id,
            payment_intent = session.PaymentIntentId,
            amount,
            amount_in_smallest_unit = session.AmountTotal,
            currency = session.Currency,
            status = "paid"
        });

        Context.Bid_Transactions.Add(new Bid_Transaction
        {
            Id = Guid.NewGuid(),
            Bid_Id = bid.Id,
            Job_Id = bid.Job_Id,
            Handyman_User_Id = bid.Handyman_User_Id,
            Homeowner_User_Id = bid.Job.Posted_By_User_Id,
            Event_Type = paidEventType,
            Event_By_User_Id = bid.Job.Posted_By_User_Id,
            Event_Reason = "Payment completed via Stripe checkout.",
            Event_Metadata = paymentMetadata,
            Created_At_Utc = DateTime.UtcNow
        });

        await CreateNotification(
            bid.Handyman_User_Id,
            NotificationType.SystemMessage,
            $"Payment received for '{bid.Job.Title}'.",
            bid.Job_Id
        );

        if (bid.Job.Posted_By_User_Id != bid.Handyman_User_Id)
        {
            await CreateNotification(
                bid.Job.Posted_By_User_Id,
                NotificationType.SystemMessage,
                $"Payment marked as paid for '{bid.Job.Title}'.",
                bid.Job_Id
            );
        }

        await Context.SaveChangesAsync();
    }

    private void EnsureStripeConfiguredForCheckout()
    {
        if (string.IsNullOrWhiteSpace(_stripeOptions.SecretKey))
            throw new HttpRequestException("Stripe secret key is not configured.", null, HttpStatusCode.InternalServerError);

        if (string.IsNullOrWhiteSpace(_stripeOptions.SuccessUrlBase) || string.IsNullOrWhiteSpace(_stripeOptions.CancelUrlBase))
            throw new HttpRequestException("Stripe success/cancel URL base is not configured.", null, HttpStatusCode.InternalServerError);
    }

    private void EnsureStripeConfiguredForWebhook()
    {
        if (string.IsNullOrWhiteSpace(_stripeOptions.WebhookSecret))
            throw new HttpRequestException("Stripe webhook secret is not configured.", null, HttpStatusCode.InternalServerError);

        if (string.IsNullOrWhiteSpace(_stripeOptions.SecretKey))
            throw new HttpRequestException("Stripe secret key is not configured.", null, HttpStatusCode.InternalServerError);

        StripeConfiguration.ApiKey = _stripeOptions.SecretKey;
    }

    private static string BuildFrontendReturnUrl(string baseUrl, Guid jobId, string paymentResult, bool includeSessionId)
    {
        var trimmedBase = baseUrl.TrimEnd('/');
        var sessionPlaceholder = includeSessionId ? "&session_id={CHECKOUT_SESSION_ID}" : string.Empty;
        return $"{trimmedBase}/jobs/{jobId}?payment={paymentResult}{sessionPlaceholder}";
    }
}
