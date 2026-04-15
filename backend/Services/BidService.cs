using backend.Data;
using backend.Models.Entities;
using backend.Models.DTOs;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Net;

namespace backend.Services;

public class BidService : BaseService, IBidService
{
    private readonly NeighbourHelpDbContext _context;
    private readonly ILogger _logger;

    public BidService( NeighbourHelpDbContext context, ILogger<BidService> logger) : base(context, logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<BidListResponse> GetBidsByJobIdAsync(Guid jobId, int page = 1, int pageSize = 10)
    {
        if (!await _context.Jobs.AnyAsync(j => j.Id == jobId))
            throw new HttpRequestException($"Job with id {jobId} not found", null, HttpStatusCode.NotFound);

        var query = _context.Bids
            .Where(b => b.Job_Id == jobId)
            .OrderByDescending(b => b.Created_At_Utc);

        return await GetPagedBidsResponse(query, page, pageSize);
    }

    public async Task<BidListResponse> GetMyBidsAsync(Guid userId, int page = 1, int pageSize = 10)
    {
        var query = _context.Bids
            .Where(b => b.Handyman_User_Id == userId)
            .OrderByDescending(b => b.Created_At_Utc);

        return await GetPagedBidsResponse(query, page, pageSize);
    }

    public async Task<BidDto> CreateBidAsync(Guid jobId, CreateBidRequest request, Guid userId)
    {
        var job = await _context.Jobs.FirstOrDefaultAsync(j => j.Id == jobId) 
            ?? throw new HttpRequestException($"Job with id {jobId} not found", null, HttpStatusCode.NotFound);

        if (job.Status != JobStatus.Open.ToDbString())
            throw new HttpRequestException($"Cannot bid on a job with status '{job.Status}'. Job must be open.", null, HttpStatusCode.BadRequest);

        if (job.Posted_By_User_Id == userId)
            throw new HttpRequestException("You cannot bid on your own job", null, HttpStatusCode.BadRequest);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.IsActive)
            throw new HttpRequestException("User account is inactive or blocked", null, HttpStatusCode.Forbidden);

        var isVerified = await _context.Handyman_Verifications
            .AnyAsync(v => v.User_Id == userId && v.Status == VerificationStatus.Approved.ToDbString());
            
        if (!isVerified)
            throw new HttpRequestException("Your handyman account is not verified yet.", null, HttpStatusCode.BadRequest);

        if (await _context.Bids.AnyAsync(b => b.Job_Id == jobId && b.Handyman_User_Id == userId))
            throw new HttpRequestException("You have already placed a bid on this job", null, HttpStatusCode.BadRequest);

        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Job_Id = jobId,
            Handyman_User_Id = userId,
            Price = request.Price,
            Estimated_Arrival_Utc = request.EstimatedArrival,
            Message = request.Message,
            Status = BidStatus.Pending.ToDbString(),
            Is_Recommended = false,
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };

        _context.Bids.Add(bid);

        var metadata = JsonSerializer.Serialize(new { price = request.Price, estimated_arrival = request.EstimatedArrival });
        AddBidTransaction(bid.Id, jobId, userId, job.Posted_By_User_Id, BidEventType.Created, userId, "Bid created by handyman", metadata);

        CreateNotification(job.Posted_By_User_Id, NotificationType.BidReceived, $"{user.Name} has placed a bid of ${request.Price}", jobId);

        await _context.SaveChangesAsync();
        _logger.LogInformation("Bid {BidId} created for Job {JobId} by Handyman {UserId}", bid.Id, jobId, userId);

        return await GetBidDtoWithUser(bid.Id);
    }

    public async Task<BidDto> AcceptBidAsync(Guid bidId, Guid userId, string userRole)
    {
        if (userRole != UserRole.Homeowner.ToDbString() && userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Unauthorized role for this action", null, HttpStatusCode.Forbidden);

        var bid = await _context.Bids
            .Include(b => b.Job)
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bidId) 
            ?? throw new HttpRequestException($"Bid with id {bidId} not found", null, HttpStatusCode.NotFound);

        if (userRole == UserRole.Homeowner.ToDbString() && bid.Job.Posted_By_User_Id != userId)
            throw new HttpRequestException("You are not the owner of this job", null, HttpStatusCode.Forbidden);

        if (bid.Status != BidStatus.Pending.ToDbString())
            throw new HttpRequestException($"Cannot accept a bid with status '{bid.Status}'.", null, HttpStatusCode.BadRequest);

        if (bid.Job.Status != JobStatus.Open.ToDbString())
            throw new HttpRequestException("Cannot accept a bid for a job that is not open", null, HttpStatusCode.BadRequest);

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            bid.Status = BidStatus.Accepted.ToDbString();
            bid.Updated_At_Utc = DateTime.UtcNow;

            var otherPendingBids = await _context.Bids
                .Where(b => b.Job_Id == bid.Job_Id && b.Id != bid.Id && b.Status == BidStatus.Pending.ToDbString())
                .ToListAsync();

            foreach (var otherBid in otherPendingBids)
            {
                otherBid.Status = BidStatus.Rejected.ToDbString();
                otherBid.Updated_At_Utc = DateTime.UtcNow;

                var rejectedMetadata = JsonSerializer.Serialize(new { accepted_bid_id = bid.Id });
                AddBidTransaction(otherBid.Id, bid.Job_Id, otherBid.Handyman_User_Id, bid.Job.Posted_By_User_Id, BidEventType.Rejected, userId, "Rejected due to another bid being accepted", rejectedMetadata);
                CreateNotification(otherBid.Handyman_User_Id, NotificationType.BidRejected, $"Your bid for '{bid.Job.Title}' was not accepted", bid.Job_Id);
            }

            bid.Job.Status = JobStatus.InProgress.ToDbString();
            bid.Job.Updated_At_Utc = DateTime.UtcNow;

            AddBidTransaction(bid.Id, bid.Job_Id, bid.Handyman_User_Id, bid.Job.Posted_By_User_Id, BidEventType.Accepted, userId, "Bid accepted by job owner");
            CreateNotification(bid.Handyman_User_Id, NotificationType.BidAccepted, $"Your bid for '{bid.Job.Title}' has been accepted!", bid.Job_Id);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            
            return await GetBidDtoWithUser(bid.Id);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Failed to accept bid {BidId}", bidId);
            throw;
        }
    }

    public async Task<BidDto> RejectBidAsync(Guid bidId, Guid userId, string userRole)
    {
        if (userRole != UserRole.Homeowner.ToDbString() && userRole != UserRole.Admin.ToDbString())
            throw new HttpRequestException("Unauthorized role for this action", null, HttpStatusCode.Forbidden);

        var bid = await _context.Bids
            .Include(b => b.Job)
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bidId) 
            ?? throw new HttpRequestException($"Bid with id {bidId} not found", null, HttpStatusCode.NotFound);

        if (userRole == UserRole.Homeowner.ToDbString() && bid.Job.Posted_By_User_Id != userId)
            throw new HttpRequestException("You are not the owner of this job", null, HttpStatusCode.Forbidden);

        if (bid.Status != BidStatus.Pending.ToDbString())
            throw new HttpRequestException($"Cannot reject a bid with status '{bid.Status}'.", null, HttpStatusCode.BadRequest);

        bid.Status = BidStatus.Rejected.ToDbString();
        bid.Updated_At_Utc = DateTime.UtcNow;

        AddBidTransaction(bid.Id, bid.Job_Id, bid.Handyman_User_Id, bid.Job.Posted_By_User_Id, BidEventType.Rejected, userId, "Bid rejected by job owner");
        CreateNotification(bid.Handyman_User_Id, NotificationType.BidRejected, $"Your bid for '{bid.Job.Title}' was rejected", bid.Job_Id);

        await _context.SaveChangesAsync();
        return MapBidToDto(bid);
    }

    public async Task DeleteBidAsync(Guid bidId, Guid userId)
    {
        var bid = await _context.Bids.Include(b => b.Job).FirstOrDefaultAsync(b => b.Id == bidId) 
            ?? throw new HttpRequestException($"Bid with id {bidId} not found", null, HttpStatusCode.NotFound);

        if (bid.Handyman_User_Id != userId)
            throw new HttpRequestException("You can only delete your own bids", null, HttpStatusCode.Forbidden);

        if (bid.Status != BidStatus.Pending.ToDbString())
            throw new HttpRequestException($"Cannot delete a bid with status '{bid.Status}'.", null, HttpStatusCode.BadRequest);

        AddBidTransaction(bid.Id, bid.Job_Id, bid.Handyman_User_Id, bid.Job.Posted_By_User_Id, BidEventType.Retracted, userId, "Bid deleted/retracted by handyman");

        _context.Bids.Remove(bid);
        await _context.SaveChangesAsync();
    }

    private async Task<BidListResponse> GetPagedBidsResponse(IQueryable<Bid> query, int page, int pageSize)
    {
        var totalCount = await query.CountAsync();
        var bids = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(b => b.Handyman_User)
            .ToListAsync();

        return new BidListResponse(bids.Select(MapBidToDto).ToList(), page, pageSize, totalCount);
    }

    private void AddBidTransaction(Guid bidId, Guid jobId, Guid handymanId, Guid homeownerId, BidEventType type, Guid actorId, string reason, string metadata = "{}")
    {
        _context.Bid_Transactions.Add(new Bid_Transaction
        {
            Id = Guid.NewGuid(),
            Bid_Id = bidId,
            Job_Id = jobId,
            Handyman_User_Id = handymanId,
            Homeowner_User_Id = homeownerId,
            Event_Type = type.ToDbString(),
            Event_By_User_Id = actorId,
            Event_Reason = reason,
            Event_Metadata = metadata,
            Created_At_Utc = DateTime.UtcNow
        });
    }

    private async Task<BidDto> GetBidDtoWithUser(Guid bidId)
    {
        var bid = await _context.Bids
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bidId);
        return MapBidToDto(bid!);
    }

    private void ValidateHandymanRole(string role)
    {
        if (role != UserRole.Handyman.ToDbString())
            throw new HttpRequestException("Only handymen are authorized for this action", null, HttpStatusCode.Forbidden);
    }

}