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

public class PaymentService(ServiceDependencies deps, IOptions<StripeOptions> stripeOptions, IPaymentReceiptPdfService receiptPdfService)
    : BaseService(deps), IPaymentService
{
    private readonly StripeOptions _stripeOptions = stripeOptions.Value;
    private readonly IPaymentReceiptPdfService _receiptPdfService = receiptPdfService;

    public async Task<PaymentTransactionsResponse> GetPaymentTransactionsAsync(int page, int pageSize)
    {
        ValidatePage(page, pageSize);

        var userId = await GetCurrentUserIdAsync();
        var role = GetCurrentUserRole();

        var query = Context.Payments
            .AsNoTracking()
            .Include(p => p.Job)
            .Include(p => p.Homeowner_User)
            .Include(p => p.Handyman_User)
            .AsQueryable();

        if (role == UserRole.Homeowner.ToDbString())
            query = query.Where(p => p.Homeowner_User_Id == userId);
        else if (role == UserRole.Handyman.ToDbString())
            query = query.Where(p => p.Handyman_User_Id == userId);
        else if (role != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Only homeowners, handymen, and admins can view payment transactions.", null, HttpStatusCode.Forbidden);

        var totalCount = await query.CountAsync();
        var payments = await query
            .OrderByDescending(p => p.Updated_At_Utc)
            .ThenByDescending(p => p.Created_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PaymentTransactionsResponse(
            payments.Select(MapPaymentTransactionDto).ToList(),
            page,
            pageSize,
            totalCount
        );
    }

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

        var bidAmount = Math.Round(acceptedBid.Price, 2, MidpointRounding.AwayFromZero);
        var fees = CalculatePaymentFees(bidAmount);
        var amountInSmallestUnit = ToSmallestCurrencyUnit(fees.HomeownerTotal);
        if (amountInSmallestUnit <= 0)
            throw new HttpRequestException("Accepted bid amount must be greater than zero.", null, HttpStatusCode.BadRequest);

        var successUrl = BuildFrontendReturnUrl(_stripeOptions.SuccessUrlBase, jobId, "success", includeSessionId: true);
        var cancelUrl = BuildFrontendReturnUrl(_stripeOptions.CancelUrlBase, jobId, "cancel", includeSessionId: false);

        var allowedPaymentMethods = new List<string> { "card", "fpx", "grabpay", "alipay" };

        // must be one of card, acss_debit, affirm, afterpay_clearpay, alipay, au_becs_debit, bacs_debit, bancontact, blik, boleto, cashapp, crypto, customer_balance, eps, fpx, giropay, grabpay, ideal, klarna, konbini, link, mb_way, multibanco, oxxo, p24, pay_by_bank, paynow, paypal, payto, pix, promptpay, sepa_debit, sunbit, sofort, swish, upi, us_bank_account, wechat_pay, revolut_pay, mobilepay, zip, amazon_pay, alma, twint, kr_card, naver_pay, kakao_pay, payco, nz_bank_account, samsung_pay, billie, bizum, paypay, or satispay

        var sessionOptions = new SessionCreateOptions
        {
            Mode = "payment",
            PaymentMethodTypes = allowedPaymentMethods, 
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
            bid_amount = bidAmount,
            sst_amount = fees.SstAmount,
            homeowner_platform_fee = fees.HomeownerPlatformFee,
            handyman_platform_fee = fees.HandymanPlatformFee,
            homeowner_total = fees.HomeownerTotal,
            handyman_credit = fees.HandymanCredit,
            amount_in_smallest_unit = amountInSmallestUnit,
            currency = _stripeOptions.Currency.ToLowerInvariant(),
            status = "initiated"
        });

        Context.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            Bid_Id = acceptedBid.Id,
            Job_Id = job.Id,
            Homeowner_User_Id = job.Posted_By_User_Id,
            Handyman_User_Id = acceptedBid.Handyman_User_Id,
            Bid_Amount = fees.BidAmount,
            Sst_Amount = fees.SstAmount,
            Homeowner_Platform_Fee = fees.HomeownerPlatformFee,
            Handyman_Platform_Fee = fees.HandymanPlatformFee,
            Homeowner_Total = fees.HomeownerTotal,
            Handyman_Credit = fees.HandymanCredit,
            Stripe_Session_Id = session.Id,
            Stripe_Payment_Intent_Id = session.PaymentIntentId,
            Status = "initiated",
            Payment_Metadata = initiatedMetadata,
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
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

    public async Task ConfirmCheckoutSessionAsync(Guid jobId, string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            throw new HttpRequestException("Stripe checkout session id is required.", null, HttpStatusCode.BadRequest);

        EnsureStripeConfiguredForCheckout();
        StripeConfiguration.ApiKey = _stripeOptions.SecretKey;

        Session session;
        try
        {
            var sessionService = new SessionService();
            session = await sessionService.GetAsync(sessionId);
        }
        catch (StripeException ex)
        {
            Logger.LogWarning(ex, "Unable to retrieve Stripe checkout session {SessionId}.", sessionId);
            throw new HttpRequestException("Unable to verify Stripe checkout session.", null, HttpStatusCode.BadGateway);
        }

        await ProcessPaidCheckoutSessionAsync(session, expectedJobId: jobId, enforceCurrentUserAccess: true);
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

        await ProcessPaidCheckoutSessionAsync(session, expectedJobId: null, enforceCurrentUserAccess: false);
    }

    private async Task ProcessPaidCheckoutSessionAsync(Session session, Guid? expectedJobId, bool enforceCurrentUserAccess)
    {
        if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
        {
            Logger.LogInformation(
                "Stripe checkout session {SessionId} completed but payment status is {PaymentStatus}.",
                session.Id,
                session.PaymentStatus ?? "unknown");

            if (enforceCurrentUserAccess)
                throw new HttpRequestException("Stripe checkout session is not paid yet.", null, HttpStatusCode.BadRequest);

            return;
        }

        if (session.Metadata is null || !session.Metadata.TryGetValue("bid_id", out var bidIdValue) || !Guid.TryParse(bidIdValue, out var bidId))
        {
            Logger.LogWarning("Stripe webhook session metadata missing or invalid bid_id. Session: {SessionId}", session.Id);
            if (enforceCurrentUserAccess)
                throw new HttpRequestException("Stripe checkout session metadata is invalid.", null, HttpStatusCode.BadRequest);
            return;
        }

        var bid = await Context.Bids
            .Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == bidId);

        if (bid is null)
        {
            Logger.LogWarning("Stripe webhook references unknown bid {BidId}. Session: {SessionId}", bidId, session.Id);
            if (enforceCurrentUserAccess)
                throw new HttpRequestException("Stripe checkout session references an unknown bid.", null, HttpStatusCode.NotFound);
            return;
        }

        if (expectedJobId.HasValue && bid.Job_Id != expectedJobId.Value)
            throw new HttpRequestException("Stripe checkout session does not match this job.", null, HttpStatusCode.BadRequest);

        if (enforceCurrentUserAccess)
        {
            var userId = await GetCurrentUserIdAsync();
            var userRole = GetCurrentUserRole();

            if (userRole == UserRole.Homeowner.ToDbString() && bid.Job.Posted_By_User_Id != userId)
                throw new HttpRequestException("You are not the owner of this payment.", null, HttpStatusCode.Forbidden);
        }

        var bidAmount = Math.Round(bid.Price, 2, MidpointRounding.AwayFromZero);
        var fees = CalculatePaymentFees(bidAmount);
        var expectedAmountInSmallestUnit = ToSmallestCurrencyUnit(fees.HomeownerTotal);

        if (session.AmountTotal.HasValue && session.AmountTotal.Value != expectedAmountInSmallestUnit)
        {
            Logger.LogWarning(
                "Stripe session amount {StripeAmount} did not match expected homeowner total {ExpectedAmount} for bid {BidId}. Session: {SessionId}",
                session.AmountTotal.Value,
                expectedAmountInSmallestUnit,
                bid.Id,
                session.Id);
        }

        var currency = session.Currency ?? _stripeOptions.Currency.ToLowerInvariant();
        var paymentMetadata = JsonSerializer.Serialize(new
        {
            session_id = session.Id,
            payment_intent = session.PaymentIntentId,
            bid_amount = bidAmount,
            sst_amount = fees.SstAmount,
            homeowner_platform_fee = fees.HomeownerPlatformFee,
            handyman_platform_fee = fees.HandymanPlatformFee,
            homeowner_total = fees.HomeownerTotal,
            handyman_credit = fees.HandymanCredit,
            amount_in_smallest_unit = session.AmountTotal ?? expectedAmountInSmallestUnit,
            currency,
            status = "paid"
        });

        await using var transaction = await Context.Database.BeginTransactionAsync();

        var payment = await Context.Payments
            .FirstOrDefaultAsync(p => p.Stripe_Session_Id == session.Id);

        if (payment is null)
        {
            payment = new Payment
            {
                Id = Guid.NewGuid(),
                Bid_Id = bid.Id,
                Job_Id = bid.Job_Id,
                Homeowner_User_Id = bid.Job.Posted_By_User_Id,
                Handyman_User_Id = bid.Handyman_User_Id,
                Created_At_Utc = DateTime.UtcNow
            };

            Context.Payments.Add(payment);
        }

        var paidEventType = BidEventType.PaymentPaid.ToDbString();
        var existingPaidEvents = await Context.Bid_Transactions
            .Where(tx => tx.Bid_Id == bid.Id && tx.Event_Type == paidEventType)
            .ToListAsync();

        var alreadyPaidForSession = existingPaidEvents.Any(tx =>
            string.Equals(PaymentLedgerHelper.ExtractSessionId(tx.Event_Metadata), session.Id, StringComparison.OrdinalIgnoreCase));

        payment.Bid_Amount = fees.BidAmount;
        payment.Sst_Amount = fees.SstAmount;
        payment.Homeowner_Platform_Fee = fees.HomeownerPlatformFee;
        payment.Handyman_Platform_Fee = fees.HandymanPlatformFee;
        payment.Homeowner_Total = fees.HomeownerTotal;
        payment.Handyman_Credit = fees.HandymanCredit;
        payment.Stripe_Session_Id = session.Id;
        payment.Stripe_Payment_Intent_Id = session.PaymentIntentId;
        payment.Status = "paid";
        payment.Payment_Metadata = paymentMetadata;
        payment.Updated_At_Utc = DateTime.UtcNow;

        var existingEarnedCredit = await Context.Handyman_Credits.AnyAsync(c =>
            c.Transaction_Type == "earned" &&
            (c.Related_Payment_Id == payment.Id ||
             (c.Related_Bid_Id == bid.Id && c.Related_Job_Id == bid.Job_Id)));

        if (!existingEarnedCredit)
        {
            var handymanBalance = await CalculateHandymanBalanceAsync(bid.Handyman_User_Id) + fees.HandymanCredit;

            var creditTransaction = new Handyman_Credit
            {
                Id = Guid.NewGuid(),
                Handyman_User_Id = bid.Handyman_User_Id,
                Transaction_Type = "earned",
                Amount = fees.HandymanCredit,
                Description = $"Payment earned from job '{bid.Job.Title}'",
                Related_Payment_Id = payment.Id,
                Related_Job_Id = bid.Job_Id,
                Related_Bid_Id = bid.Id,
                Balance_After = handymanBalance,
                Created_At_Utc = DateTime.UtcNow
            };

            Context.Handyman_Credits.Add(creditTransaction);
        }

        var shouldAddPaidEvent = existingPaidEvents.Count == 0 && !alreadyPaidForSession;
        if (shouldAddPaidEvent)
        {
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
        }

        if (shouldAddPaidEvent)
        {
            await CreateNotification(
                bid.Handyman_User_Id,
                NotificationType.SystemMessage,
                $"Payment received for '{bid.Job.Title}'. RM {fees.HandymanCredit:F2} credited to your account.",
                bid.Job_Id
            );

            if (bid.Job.Posted_By_User_Id != bid.Handyman_User_Id)
            {
                await CreateNotification(
                    bid.Job.Posted_By_User_Id,
                    NotificationType.SystemMessage,
                    $"Payment marked as paid for '{bid.Job.Title}'. Total: RM {fees.HomeownerTotal:F2}",
                    bid.Job_Id
                );
            }
        }

        await Context.SaveChangesAsync();
        await transaction.CommitAsync();

        Logger.LogInformation("Payment processed and handyman credit allocated for bid {BidId}, amount {Amount}", bidId, fees.HandymanCredit);
    }

    private void EnsureStripeConfiguredForCheckout()
    {
        if (string.IsNullOrWhiteSpace(_stripeOptions.SecretKey))
            throw new HttpRequestException("Stripe secret key is not configured.", null, HttpStatusCode.InternalServerError);

        if (string.IsNullOrWhiteSpace(_stripeOptions.SuccessUrlBase) || string.IsNullOrWhiteSpace(_stripeOptions.CancelUrlBase))
            throw new HttpRequestException("Stripe success/cancel URL base is not configured.", null, HttpStatusCode.InternalServerError);
    }

    private static void ValidatePage(int page, int pageSize)
    {
        if (page < 1)
            throw new HttpRequestException("Page must be greater than zero.", null, HttpStatusCode.BadRequest);

        if (pageSize < 1 || pageSize > 100)
            throw new HttpRequestException("Page size must be between 1 and 100.", null, HttpStatusCode.BadRequest);
    }

    private static PaymentTransactionDto MapPaymentTransactionDto(Payment payment)
    {
        return new PaymentTransactionDto(
            Id: payment.Id,
            BidId: payment.Bid_Id,
            JobId: payment.Job_Id,
            JobTitle: payment.Job?.Title ?? "Unknown job",
            HomeownerUserId: payment.Homeowner_User_Id,
            HomeownerName: payment.Homeowner_User?.Name ?? "Unknown homeowner",
            HandymanUserId: payment.Handyman_User_Id,
            HandymanName: payment.Handyman_User?.Name ?? "Unknown handyman",
            BidAmount: payment.Bid_Amount,
            SstAmount: payment.Sst_Amount,
            HomeownerPlatformFee: payment.Homeowner_Platform_Fee,
            HandymanPlatformFee: payment.Handyman_Platform_Fee,
            HomeownerTotal: payment.Homeowner_Total,
            HandymanCredit: payment.Handyman_Credit,
            Status: payment.Status,
            CreatedAtUtc: payment.Created_At_Utc,
            UpdatedAtUtc: payment.Updated_At_Utc
        );
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

    /// <summary>
    /// Calculate payment fees and totals
    /// SST: 6% of bid amount
    /// Homeowner Platform Fee: 3% of bid amount
    /// Handyman Platform Fee: 3% of bid amount
    /// </summary>
    private static PaymentFeeBreakdown CalculatePaymentFees(decimal bidAmount)
    {
        var sstAmount = Math.Round(bidAmount * 0.06m, 2, MidpointRounding.AwayFromZero);
        var homeownerPlatformFee = Math.Round(bidAmount * 0.03m, 2, MidpointRounding.AwayFromZero);
        var handymanPlatformFee = Math.Round(bidAmount * 0.03m, 2, MidpointRounding.AwayFromZero);

        var homeownerTotal = bidAmount + sstAmount + homeownerPlatformFee;
        var handymanCredit = bidAmount - handymanPlatformFee;

        return new PaymentFeeBreakdown(
            BidAmount: bidAmount,
            SstAmount: sstAmount,
            HomeownerPlatformFee: homeownerPlatformFee,
            HandymanPlatformFee: handymanPlatformFee,
            HomeownerTotal: homeownerTotal,
            HandymanCredit: handymanCredit
        );
    }

    private static long ToSmallestCurrencyUnit(decimal amount)
    {
        return (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Calculate current balance for a handyman based on all completed transactions
    /// </summary>
    private async Task<decimal> CalculateHandymanBalanceAsync(Guid handymanId)
    {
        var transactions = await Context.Handyman_Credits
            .Where(c => c.Handyman_User_Id == handymanId)
            .ToListAsync();

        decimal balance = 0;
        foreach (var tx in transactions)
        {
            if (tx.Transaction_Type == "earned")
                balance += tx.Amount;
            else if (tx.Transaction_Type == "withdrawn")
                balance -= tx.Amount;
        }

        return balance;
    }

    public async Task<AdminPaymentStatsDto> GetAdminPaymentStatsAsync()
    {

        var today = DateTime.UtcNow.Date;
        
        // Get all paid payments
        var paidPayments = await Context.Payments
            .Where(p => p.Status == "paid")
            .ToListAsync();

        // Calculate total platform fees earned (homeowner fee + handyman fee)
        var totalPlatformFeesEarned = paidPayments.Sum(p => p.Homeowner_Platform_Fee + p.Handyman_Platform_Fee);

        // Calculate today's platform fees
        var todayPaidPayments = paidPayments.Where(p => p.Updated_At_Utc.Date == today).ToList();
        var todayPlatformFeesEarned = todayPaidPayments.Sum(p => p.Homeowner_Platform_Fee + p.Handyman_Platform_Fee);

        // Count pending bank approvals
        var pendingBankApprovals = await Context.Handyman_Bank_Details
            .CountAsync(b => b.Verification_Status == "unverified");

        // Count pending withdrawal requests
        var pendingWithdrawalRequests = await Context.Withdrawal_Requests
            .CountAsync(w => w.Status == "pending");

        // Count pending payments for withdrawal (approved but not yet paid)
        var pendingPaymentsForWithdrawal = await Context.Withdrawal_Requests
            .CountAsync(w => w.Status == "approved");

        return new AdminPaymentStatsDto(
            TotalPlatformFeesEarned: totalPlatformFeesEarned,
            TodayPlatformFeesEarned: todayPlatformFeesEarned,
            TotalPaymentsProcessed: paidPayments.Count,
            PendingBankApprovals: pendingBankApprovals,
            PendingWithdrawalRequests: pendingWithdrawalRequests,
            PendingPaymentsForWithdrawal: pendingPaymentsForWithdrawal
        );
    }

    public async Task<PaymentReceiptFile> GetPaymentReceiptAsync(Guid paymentId)
    {
        var userId = await GetCurrentUserIdAsync();
        var role = GetCurrentUserRole();

        var payment = await Context.Payments
            .AsNoTracking()
            .Include(p => p.Job)
            .Include(p => p.Homeowner_User)
            .Include(p => p.Handyman_User)
            .FirstOrDefaultAsync(p => p.Id == paymentId)
            ?? throw new HttpRequestException("Payment not found.", null, HttpStatusCode.NotFound);

        if (role == UserRole.Homeowner.ToDbString())
        {
            if (payment.Homeowner_User_Id != userId)
                throw new HttpRequestException("You are not allowed to access this receipt.", null, HttpStatusCode.Forbidden);
        }
        else if (role != UserRole.Admin.ToDbString())
        {
            throw new HttpRequestException("Only homeowners and admins can access receipts.", null, HttpStatusCode.Forbidden);
        }

        if (!string.Equals(payment.Status, "paid", StringComparison.OrdinalIgnoreCase))
            throw new HttpRequestException("Receipt is available only for paid payments.", null, HttpStatusCode.BadRequest);

        var paidAtUtc = payment.Updated_At_Utc == default ? payment.Created_At_Utc : payment.Updated_At_Utc;
        var receiptNumber = BuildReceiptNumber(payment, paidAtUtc);
        var currency = string.IsNullOrWhiteSpace(_stripeOptions.Currency) ? "MYR" : _stripeOptions.Currency.ToUpperInvariant();

        var model = new PaymentReceiptModel(
            ReceiptNumber: receiptNumber,
            PaidAtUtc: paidAtUtc,
            JobTitle: payment.Job?.Title ?? "Unknown job",
            JobId: payment.Job_Id,
            PaymentId: payment.Id,
            HomeownerName: payment.Homeowner_User?.Name ?? "Unknown homeowner",
            HomeownerEmail: payment.Homeowner_User?.Email ?? "unknown@neighborhelp.test",
            HandymanName: payment.Handyman_User?.Name ?? "Unknown handyman",
            HandymanEmail: payment.Handyman_User?.Email ?? "unknown@neighborhelp.test",
            BidAmount: payment.Bid_Amount,
            SstAmount: payment.Sst_Amount,
            HomeownerPlatformFee: payment.Homeowner_Platform_Fee,
            HandymanPlatformFee: payment.Handyman_Platform_Fee,
            HomeownerTotal: payment.Homeowner_Total,
            HandymanCredit: payment.Handyman_Credit,
            Currency: currency,
            StripeSessionId: payment.Stripe_Session_Id,
            StripePaymentIntentId: payment.Stripe_Payment_Intent_Id,
            CompanyName: "NeighbourHelp Services",
            CompanyAddress: "123 Jalan Jiran, Kuala Lumpur 50000, Malaysia",
            CompanyTaxId: "Tax ID: NH-000-123456",
            CompanyEmail: "billing@neighborhelp.test",
            CompanyPhone: "+60 3-1234 5678"
        );

        var pdfBytes = _receiptPdfService.Generate(model);
        var fileName = $"neighbourhelp-receipt-{receiptNumber}.pdf";
        return new PaymentReceiptFile(pdfBytes, fileName);
    }

    private static string BuildReceiptNumber(Payment payment, DateTime paidAtUtc)
    {
        var dateStamp = paidAtUtc.ToString("yyyyMMdd");
        var suffix = payment.Id.ToString("N")[..8].ToUpperInvariant();
        return $"NH-{dateStamp}-{suffix}";
    }

    private record PaymentFeeBreakdown(
        decimal BidAmount,
        decimal SstAmount,
        decimal HomeownerPlatformFee,
        decimal HandymanPlatformFee,
        decimal HomeownerTotal,
        decimal HandymanCredit
    );
}
