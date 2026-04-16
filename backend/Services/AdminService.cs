using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Amazon.S3;
using backend.Models.Config;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class AdminService : BaseService, IAdminService
{
    public AdminService(NeighbourHelpDbContext context, ILogger<AdminService> logger, IAmazonS3 s3Client, IOptions<StorageOptions> storageOptions) 
        : base(context, logger, s3Client, storageOptions)
    { }

    public async Task<AdminOverviewResponse> GetOverviewAsync()
    {
        var today = DateTime.UtcNow.Date;
        var openStatus = JobStatus.Open.ToDbString();

        return new AdminOverviewResponse(
            UsersCreatedToday: await Context.Users.CountAsync(u => u.CreatedAtUtc >= today),
            JobsPostedToday: await Context.Jobs.CountAsync(j => j.Created_At_Utc >= today),
            BidsCreatedToday: await Context.Bids.CountAsync(b => b.Created_At_Utc >= today),
            OpenEmergencies: await Context.Jobs.CountAsync(j => j.Is_Emergency && j.Status == openStatus),
            BlockedAccountCount: await Context.Users.CountAsync(u => !u.IsActive)
        );
    }

    public async Task<UserDto> CreateAdminAsync(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
            throw new HttpRequestException("Invalid email format.", null, HttpStatusCode.BadRequest);

        var emailLower = request.Email.ToLower().Trim();
        if (await Context.Users.AnyAsync(u => u.Email == emailLower))
            throw new HttpRequestException("A user with this email already exists.", null, HttpStatusCode.Conflict);

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = emailLower,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = UserRole.Admin.ToDbString(),
            IsActive = true,
            TokenVersion = 1
        };

        Context.Users.Add(newUser);
        await Context.SaveChangesAsync();

        Logger.LogInformation("New admin added with email: {Email}", request.Email);
        return await MapUserToDto(newUser);
    }

    public async Task<UserListResponse> GetAllUsers(UserSearchRequest request)
    {
        var query = Context.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
            query = query.Where(u => u.Name.ToLower().Contains(request.Name.ToLower()));
        if (!string.IsNullOrWhiteSpace(request.Email))
            query = query.Where(u => u.Email.ToLower().Contains(request.Email.ToLower()));
        if (request.Role.HasValue)
            query = query.Where(u => u.Role == request.Role.Value.ToDbString());
        if (request.IsActive.HasValue)
            query = query.Where(u => u.IsActive == request.IsActive.Value);

        if (request.Verification.HasValue)
        {
            var veriStr = request.Verification.Value.ToDbString();
            query = query.Where(u => Context.Handyman_Verifications.Any(v => v.User_Id == u.Id && v.Status == veriStr));
        }

        var totalCount = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();
    
        var pagedUserIds = users.Select(u => u.Id).ToList();
        var verificationStatuses = await Context.Handyman_Verifications
            .Where(v => pagedUserIds.Contains(v.User_Id))
            .ToDictionaryAsync(v => v.User_Id, v => v.Status);

        var mappingTasks = users.Select(u => 
        {
            var statusStr = verificationStatuses.GetValueOrDefault(u.Id);
            return MapUserToDto(u, statusStr); 
        });

        var mappedData = await Task.WhenAll(mappingTasks);

        return new UserListResponse(mappedData, totalCount, request.Page, request.PageSize);
    }

    public async Task<object> GetUserByIdAsync(Guid id, bool searchByHandyman = false)
    {
        if (!searchByHandyman) {
            var user = await Context.Users.FindAsync(id) 
                ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
            
            string? statusStr = null;
            if (user.Role == UserRole.Handyman.ToDbString())
            {
                statusStr = await Context.Handyman_Verifications
                    .Where(v => v.User_Id == user.Id)
                    .Select(v => v.Status)
                    .FirstOrDefaultAsync();
            }

            return await MapUserToDto(user);
        } else
        {
            var user = await Context.Handyman_Verifications.FindAsync(id) 
                ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
            
            return MapPendingToDto(user);
        }
    }

    public async Task<UserDto> UpdateUserBlockStatusAsync(Guid targetId, bool block, string? reason, Guid adminId)
    {
        if (block && targetId == adminId)
            throw new HttpRequestException("Security Error: You cannot block your own account.", null, HttpStatusCode.BadRequest);

        var user = await Context.Users.FirstOrDefaultAsync(u => u.Id == targetId) 
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        user.IsActive = !block;
        user.Blocked_Reason = block ? reason : null;
        user.Blocked_At_Utc = block ? DateTime.UtcNow : null;
        user.Blocked_By_User_Id = block ? adminId : null;
        user.TokenVersion++;

        await Context.SaveChangesAsync();

        if (block)
        {
            Logger.LogInformation("User {UserId} blocked by Admin {AdminId}.", targetId, adminId);
            return await MapUserToDto(user);
        }

        Logger.LogInformation("User {UserId} unblocked by Admin {AdminId}", targetId, adminId);
        return await MapUserToDto(user);
    }

    public async Task<HandymanVerificationListResponse> GetPendingVerificationsAsync(int page = 1, int pageSize = 1000)
    {
        var pendingStatus = VerificationStatus.Pending.ToDbString();
        
        var query = Context.Handyman_Verifications
            .Include(v => v.User)
            .Where(v => v.Status == pendingStatus);

        var totalCount = await query.CountAsync();

        var verifications = await query
            .OrderByDescending(v => v.Created_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var data = verifications.Select(v => new HandymanVerificationDto(
            v.Id, 
            v.User_Id, 
            v.User.Name, 
            v.Status, 
            GetPresignedUrl(v.IdentityCardURL),
            GetPresignedUrl(v.SelfieImageURL),
            v.Created_At_Utc,
            v.Updated_At_Utc
        ));

        return new HandymanVerificationListResponse(data, totalCount, page, pageSize);
    }

    public async Task<HandymanVerificationDto> VerifyHandymanAsync(Guid id, bool approve, string? notes, Guid adminId)
    {
        var verification = await Context.Handyman_Verifications
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => v.Id == id) 
            ?? throw new HttpRequestException("Verification record not found.", null, HttpStatusCode.NotFound);

        if  (verification.Status == VerificationStatus.Approved.ToDbString()) 
            throw new HttpRequestException("This handyman has already been approved.", null, HttpStatusCode.BadRequest);

        var newStatus = approve ? VerificationStatus.Approved : VerificationStatus.Rejected;
        
        verification.Status = newStatus.ToDbString();
        verification.Reviewed_At_Utc = DateTime.UtcNow;
        verification.Reviewed_By_User_Id = adminId;
        verification.Notes = notes;
        verification.Updated_At_Utc = DateTime.UtcNow;

        CreateNotification(verification.User_Id, 
                    NotificationType.VerificationResult, 
                    approve ? "Your handyman account has been approved!" : $"Your handyman verification was rejected. Reason: {notes}");

        await Context.SaveChangesAsync();

        return MapPendingToDto(verification);
    }

    public async Task<IEnumerable<JobDto>> GetEmergencyJobsAsync()
    {
        var openStatus = JobStatus.Open.ToDbString();
        
        var jobs = await Context.Jobs
            .Include(j => j.Posted_By_User)
            .Where(j => j.Is_Emergency && j.Status == openStatus)
            .ToListAsync();

        return jobs.Select(MapJobToDto);
    }

    public async Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId)
    {
        var job = await Context.Jobs.FindAsync(jobId) 
            ?? throw new HttpRequestException("Job not found.", null, HttpStatusCode.NotFound);
        
        job.Status = JobStatus.InProgress.ToDbString(); 
        await Context.SaveChangesAsync();
        Logger.LogInformation($"Job {jobId} force-assigned by Admin {adminId}", jobId, adminId);
    }

    public async Task<IEnumerable<BidTransactionDto>> GetBidTransactionsAsync(string? eventType = null)
    {
        var query = Context.Bid_Transactions.AsQueryable();
        if (!string.IsNullOrEmpty(eventType)) 
            query = query.Where(t => t.Event_Type == eventType.ToLower());

        return await query.OrderByDescending(t => t.Created_At_Utc)
            .Select(t => new BidTransactionDto(t.Id, t.Bid_Id, t.Job_Id, t.Event_Type, t.Event_Reason, t.Created_At_Utc))
            .ToListAsync();
    }

    public async Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id)
    {
        var transaction = await Context.Bid_Transactions.FindAsync(id);

        if (transaction == null)
        {
            throw new HttpRequestException("Bid transaction record not found.", null, HttpStatusCode.NotFound);
        }

        return new BidTransactionDto(
            transaction.Id, 
            transaction.Bid_Id, 
            transaction.Job_Id, 
            transaction.Event_Type, 
            transaction.Event_Reason, 
            transaction.Created_At_Utc
        );
    }

    public async Task HandleBidActionAsync(Guid bidId, string actionType, string reason, Guid adminId)
    {
        var bid = await Context.Bids.Include(b => b.Job).FirstOrDefaultAsync(b => b.Id == bidId) 
            ?? throw new HttpRequestException("Bid not found.", null, HttpStatusCode.NotFound);

        var normalizedActionType = actionType.Trim().ToLowerInvariant();
        var normalizedReason = (reason ?? string.Empty).ToLowerInvariant();
        var now = DateTime.UtcNow;

        var eventTypeToStore = ResolveBidEventType(normalizedActionType, normalizedReason);

        if (eventTypeToStore == BidEventType.ForceRejected.ToDbString())
            bid.Status = BidStatus.Rejected.ToDbString();

        if (eventTypeToStore == BidEventType.LockAdded.ToDbString())
        {
            var existingLock = await Context.Bid_Locks.FirstOrDefaultAsync(x => x.Bid_Id == bidId);
            if (existingLock == null)
            {
                Context.Bid_Locks.Add(new Bid_Lock
                {
                    Bid_Id = bidId,
                    Locked_By_User_Id = adminId,
                    Locked_Reason = reason,
                    Locked_At_Utc = DateTime.UtcNow
                });
            }
            else
            {
                existingLock.Locked_By_User_Id = adminId;
                existingLock.Locked_Reason = reason;
                existingLock.Locked_At_Utc = DateTime.UtcNow;
            }
        }

        if (eventTypeToStore == BidEventType.LockRemoved.ToDbString())
        {
            var existingLock = await Context.Bid_Locks.FirstOrDefaultAsync(x => x.Bid_Id == bidId);
            if (existingLock != null)
                Context.Bid_Locks.Remove(existingLock);
        }

        Context.Bid_Transactions.Add(new Bid_Transaction {
            Id = Guid.NewGuid(), 
            Bid_Id = bidId, 
            Job_Id = bid.Job_Id, 
            Handyman_User_Id = bid.Handyman_User_Id,
            Homeowner_User_Id = bid.Job.Posted_By_User_Id, 
            Event_Type = eventTypeToStore, 
            Event_By_User_Id = adminId,
            Event_Reason = reason, 
            Event_Metadata = "{}", 
            Created_At_Utc = now
        });

        await Context.SaveChangesAsync();
    }

    private static string ResolveBidEventType(string normalizedActionType, string normalizedReason)
    {
        return normalizedActionType switch
        {
            var action when action == BidModerationAction.Flag.ToDbString() =>
                normalizedReason.Contains("unflag") ? BidEventType.FlagRemoved.ToDbString() : BidEventType.FlagAdded.ToDbString(),

            var action when action == BidModerationAction.Lock.ToDbString() =>
                normalizedReason.Contains("unlock") ? BidEventType.LockRemoved.ToDbString() : BidEventType.LockAdded.ToDbString(),

            var action when action == BidModerationAction.ForceReject.ToDbString() =>
                BidEventType.ForceRejected.ToDbString(),

            _ => throw new HttpRequestException("Invalid bid moderation action.", null, HttpStatusCode.BadRequest)
        };
    }

    public async Task<IEnumerable<AdminActionDto>> GetAuditLogsAsync()
    {
        return await Context.Admin_Actions
            .OrderByDescending(a => a.Created_At_Utc)
            .Select(a => new AdminActionDto(a.Id, a.Admin_User_Id, a.Action_Type, a.Target_Type, a.Target_Id, a.Reason, a.Created_At_Utc))
            .ToListAsync();
    }
}
