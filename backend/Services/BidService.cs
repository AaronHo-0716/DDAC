using backend.Data;
using backend.Models.Entities;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace backend.Services;

public class BidService : IBidService
{
    private readonly NeighbourHelpDbContext _context;

    public BidService(NeighbourHelpDbContext context)
    {
        _context = context;
    }

    public async Task<BidListResponse> GetBidsByJobIdAsync(Guid jobId, int page = 1, int pageSize = 10)
    {
        var jobExists = await _context.Jobs.AnyAsync(j => j.Id == jobId);
        if (!jobExists)
            throw new KeyNotFoundException($"Job with id {jobId} not found");

        var query = _context.Bids
            .Where(b => b.Job_Id == jobId)
            .OrderByDescending(b => b.Created_At_Utc);

        var totalCount = await query.CountAsync();

        var bids = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(b => b.Handyman_User)
            .ToListAsync();

        var bidDtos = bids.Select(b => MapBidToDto(b)).ToList();

        return new BidListResponse(
            Bids: bidDtos,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount
        );
    }

    public async Task<BidDto> CreateBidAsync(Guid jobId, CreateBidRequest request, Guid userId, string userRole)
    {
        if (userRole != "handyman")
            throw new UnauthorizedAccessException("Only handymen can create bids");

        var job = await _context.Jobs.FirstOrDefaultAsync(j => j.Id == jobId);
        if (job == null)
            throw new KeyNotFoundException($"Job with id {jobId} not found");

        if (job.Status != "open")
            throw new ArgumentException($"Cannot bid on a job with status '{job.Status}'. Job must be open.");

        if (job.Posted_By_User_Id == userId)
            throw new ArgumentException("You cannot bid on your own job");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.IsActive)
            throw new UnauthorizedAccessException("User account is inactive or blocked");

        var existingBid = await _context.Bids
            .FirstOrDefaultAsync(b => b.Job_Id == jobId && b.Handyman_User_Id == userId);
        if (existingBid != null)
            throw new ArgumentException("You have already placed a bid on this job");

        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Job_Id = jobId,
            Handyman_User_Id = userId,
            Price = request.Price,
            Estimated_Arrival_Utc = request.EstimatedArrival,
            Message = request.Message,
            Status = "pending",
            Is_Recommended = false,
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };

        _context.Bids.Add(bid);

        var metadata = JsonSerializer.Serialize(new { price = request.Price, estimated_arrival = request.EstimatedArrival });
        var bidTransaction = new Bid_Transaction
        {
            Id = Guid.NewGuid(),
            Bid_Id = bid.Id,
            Job_Id = jobId,
            Handyman_User_Id = userId,
            Homeowner_User_Id = job.Posted_By_User_Id,
            Event_Type = "created",
            Event_By_User_Id = userId,
            Event_Reason = "Bid created by handyman",
            Event_Metadata = metadata,
            Created_At_Utc = DateTime.UtcNow
        };

        _context.Bid_Transactions.Add(bidTransaction);

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = job.Posted_By_User_Id,
            Type = "bid_received",
            Message = $"{user.Name} has placed a bid of ${request.Price}",
            Related_Job_Id = jobId,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();

        var createdBid = await _context.Bids
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bid.Id);

        return MapBidToDto(createdBid!);
    }

    public async Task<BidDto> AcceptBidAsync(Guid bidId, Guid userId, string userRole)
    {
        if (userRole != "homeowner" && userRole != "admin")
            throw new UnauthorizedAccessException("Only the job owner or admin can accept bids");

        var bid = await _context.Bids
            .Include(b => b.Job)
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bidId);

        if (bid == null)
            throw new KeyNotFoundException($"Bid with id {bidId} not found");

        // Verify user is the job owner (for homeowner role)
        if (userRole == "homeowner" && bid.Job.Posted_By_User_Id != userId)
            throw new UnauthorizedAccessException("You are not the owner of this job");

        // Verify bid is pending
        if (bid.Status != "pending")
            throw new ArgumentException($"Cannot accept a bid with status '{bid.Status}'. Bid must be pending.");

        if (bid.Job.Status != "open")
            throw new ArgumentException("Cannot accept a bid for a job that is not open");

        using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            try
            {
                bid.Status = "accepted";
                bid.Updated_At_Utc = DateTime.UtcNow;
                _context.Bids.Update(bid);

                var otherPendingBids = await _context.Bids
                    .Where(b => b.Job_Id == bid.Job_Id && b.Id != bid.Id && b.Status == "pending")
                    .ToListAsync();

                foreach (var otherBid in otherPendingBids)
                {
                    otherBid.Status = "rejected";
                    otherBid.Updated_At_Utc = DateTime.UtcNow;
                    _context.Bids.Update(otherBid);

                    var rejectedMetadata = JsonSerializer.Serialize(new { accepted_bid_id = bid.Id });
                    var rejectedEvent = new Bid_Transaction
                    {
                        Id = Guid.NewGuid(),
                        Bid_Id = otherBid.Id,
                        Job_Id = bid.Job_Id,
                        Handyman_User_Id = otherBid.Handyman_User_Id,
                        Homeowner_User_Id = bid.Job.Posted_By_User_Id,
                        Event_Type = "rejected",
                        Event_By_User_Id = userId,
                        Event_Reason = "Rejected due to another bid being accepted",
                        Event_Metadata = rejectedMetadata,
                        Created_At_Utc = DateTime.UtcNow
                    };
                    _context.Bid_Transactions.Add(rejectedEvent);

                    var rejectionNotification = new Notification
                    {
                        Id = Guid.NewGuid(),
                        User_Id = otherBid.Handyman_User_Id,
                        Type = "bid_rejected",
                        Message = $"Your bid for '{bid.Job.Title}' was not accepted",
                        Related_Job_Id = bid.Job_Id,
                        Is_Read = false,
                        Created_At_Utc = DateTime.UtcNow
                    };
                    _context.Notifications.Add(rejectionNotification);
                }

                bid.Job.Status = "in_progress";
                bid.Job.Updated_At_Utc = DateTime.UtcNow;
                _context.Jobs.Update(bid.Job);

                var acceptedMetadata = JsonSerializer.Serialize(new {});
                var acceptedEvent = new Bid_Transaction
                {
                    Id = Guid.NewGuid(),
                    Bid_Id = bid.Id,
                    Job_Id = bid.Job_Id,
                    Handyman_User_Id = bid.Handyman_User_Id,
                    Homeowner_User_Id = bid.Job.Posted_By_User_Id,
                    Event_Type = "accepted",
                    Event_By_User_Id = userId,
                    Event_Reason = "Bid accepted by job owner",
                    Event_Metadata = acceptedMetadata,
                    Created_At_Utc = DateTime.UtcNow
                };
                _context.Bid_Transactions.Add(acceptedEvent);

                var acceptanceNotification = new Notification
                {
                    Id = Guid.NewGuid(),
                    User_Id = bid.Handyman_User_Id,
                    Type = "bid_accepted",
                    Message = $"Your bid for '{bid.Job.Title}' has been accepted!",
                    Related_Job_Id = bid.Job_Id,
                    Is_Read = false,
                    Created_At_Utc = DateTime.UtcNow
                };
                _context.Notifications.Add(acceptanceNotification);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        var updatedBid = await _context.Bids
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bid.Id);

        return MapBidToDto(updatedBid!);
    }

    public async Task<BidDto> RejectBidAsync(Guid bidId, Guid userId, string userRole)
    {
        if (userRole != "homeowner" && userRole != "admin")
            throw new UnauthorizedAccessException("Only the job owner or admin can reject bids");

        var bid = await _context.Bids
            .Include(b => b.Job)
            .Include(b => b.Handyman_User)
            .FirstOrDefaultAsync(b => b.Id == bidId);

        if (bid == null)
            throw new KeyNotFoundException($"Bid with id {bidId} not found");

        // Verify user is the job owner (for homeowner role)
        if (userRole == "homeowner" && bid.Job.Posted_By_User_Id != userId)
            throw new UnauthorizedAccessException("You are not the owner of this job");

        // Verify bid is pending
        if (bid.Status != "pending")
            throw new ArgumentException($"Cannot reject a bid with status '{bid.Status}'. Bid must be pending.");

        bid.Status = "rejected";
        bid.Updated_At_Utc = DateTime.UtcNow;
        _context.Bids.Update(bid);

        var rejectMetadata = JsonSerializer.Serialize(new {});
        var bidTransaction = new Bid_Transaction
        {
            Id = Guid.NewGuid(),
            Bid_Id = bid.Id,
            Job_Id = bid.Job_Id,
            Handyman_User_Id = bid.Handyman_User_Id,
            Homeowner_User_Id = bid.Job.Posted_By_User_Id,
            Event_Type = "rejected",
            Event_By_User_Id = userId,
            Event_Reason = "Bid rejected by job owner",
            Event_Metadata = rejectMetadata,
            Created_At_Utc = DateTime.UtcNow
        };
        _context.Bid_Transactions.Add(bidTransaction);

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = bid.Handyman_User_Id,
            Type = "bid_rejected",
            Message = $"Your bid for '{bid.Job.Title}' was rejected",
            Related_Job_Id = bid.Job_Id,
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();

        return MapBidToDto(bid);
    }

    public async Task DeleteBidAsync(Guid bidId, Guid userId, string userRole)
    {
        if (userRole != "handyman")
            throw new UnauthorizedAccessException("Only the handyman who created the bid can delete it");

        var bid = await _context.Bids
            .Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == bidId);

        if (bid == null)
            throw new KeyNotFoundException($"Bid with id {bidId} not found");

        if (bid.Handyman_User_Id != userId)
            throw new UnauthorizedAccessException("You can only delete your own bids");

        if (bid.Status != "pending")
            throw new ArgumentException($"Cannot delete a bid with status '{bid.Status}'. Only pending bids can be deleted.");

        var deleteMetadata = JsonSerializer.Serialize(new {});
        var bidTransaction = new Bid_Transaction
        {
            Id = Guid.NewGuid(),
            Bid_Id = bid.Id,
            Job_Id = bid.Job_Id,
            Handyman_User_Id = bid.Handyman_User_Id,
            Homeowner_User_Id = bid.Job.Posted_By_User_Id,
            Event_Type = "retracted",
            Event_By_User_Id = userId,
            Event_Reason = "Bid deleted/retracted by handyman",
            Event_Metadata = deleteMetadata,
            Created_At_Utc = DateTime.UtcNow
        };
        _context.Bid_Transactions.Add(bidTransaction);

        _context.Bids.Remove(bid);

        await _context.SaveChangesAsync();
    }

    private BidDto MapBidToDto(Bid bid)
    {
        return new BidDto(
            Id: bid.Id,
            JobId: bid.Job_Id,
            Handyman: new UserDto(
                Id: bid.Handyman_User.Id,
                Name: bid.Handyman_User.Name,
                Email: bid.Handyman_User.Email,
                Role: bid.Handyman_User.Role,
                AvatarUrl: bid.Handyman_User.AvatarUrl,
                Rating: bid.Handyman_User.Rating,
                CreatedAt: bid.Handyman_User.CreatedAtUtc,
                IsActive: bid.Handyman_User.IsActive
            ),
            Price: bid.Price,
            EstimatedArrival: bid.Estimated_Arrival_Utc,
            Message: bid.Message,
            Status: bid.Status,
            IsRecommended: bid.Is_Recommended,
            CreatedAt: bid.Created_At_Utc,
            UpdatedAt: bid.Updated_At_Utc
        );
    }
}
