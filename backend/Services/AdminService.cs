using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class AdminService(ServiceDependencies deps) : BaseService(deps), IAdminService
{
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

        await CreateNotification(verification.User_Id, 
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
            .Include(j => j.Job_Images)
            .Where(j => j.Is_Emergency && j.Status == openStatus)
            .ToListAsync();

        var result = new List<JobDto>(jobs.Count);
        foreach (var job in jobs)
        {
            result.Add(await MapJobToDto(job));
        }

        return result;
    }

    public async Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId)
    {
        var job = await Context.Jobs.FindAsync(jobId) 
            ?? throw new HttpRequestException("Job not found.", null, HttpStatusCode.NotFound);
        
        job.Status = JobStatus.InProgress.ToDbString(); 
        await Context.SaveChangesAsync();
        Logger.LogInformation($"Job {jobId} force-assigned by Admin {adminId}", jobId, adminId);
    }

    public async Task<IEnumerable<BidDto>> GetBidTransactionsAsync(string? eventType = null)
    {
        var normalizedEventType = eventType?.Trim().ToLowerInvariant();
        var query = Context.Bids
            .AsNoTracking()
            .Include(b => b.Job)
            .Include(b => b.Handyman_User)
            .AsQueryable();

        if (!string.IsNullOrEmpty(normalizedEventType))
        {
            query = normalizedEventType switch
            {
                var e when e == BidEventType.LockAdded.ToDbString() => query.Where(b => b.Locked),
                var e when e == BidEventType.LockRemoved.ToDbString() => query.Where(b => !b.Locked),
                var e when e == BidEventType.FlagAdded.ToDbString() => query.Where(b => b.Flagged),
                var e when e == BidEventType.FlagRemoved.ToDbString() => query.Where(b => !b.Flagged),
                var e when e == BidEventType.ForceRejected.ToDbString() => query.Where(b => b.Status == BidStatus.Rejected.ToDbString()),
                _ => query.Where(b => b.Status == normalizedEventType)
            };
        }

        var bids = await query
            .OrderByDescending(b => b.Updated_At_Utc)
            .ToListAsync();

        var result = new List<BidDto>(bids.Count);
        foreach (var bid in bids)
        {
            result.Add(await MapBidToDto(bid));
        }

        return result;
    }

    public async Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id)
    {
        var bid = await Context.Bids.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new HttpRequestException("Bid record not found.", null, HttpStatusCode.NotFound);

        return new BidTransactionDto(
            bid.Id,
            bid.Id,
            bid.Job_Id,
            DeriveBidEventTypeFromState(bid),
            null,
            bid.Updated_At_Utc
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

        if (eventTypeToStore == BidEventType.ForceRejected.ToDbString()){
            if (bid.Locked)
                throw new HttpRequestException("The bid is locked, try to unlock it first.", null, HttpStatusCode.BadRequest);

            if (bid.Job.Status != JobStatus.Open.ToDbString() && bid.Job.Status != JobStatus.InProgress.ToDbString())
                throw new HttpRequestException("This job has already been completed, cannot force reject a completed job's bid.", null, HttpStatusCode.BadRequest);

            if (bid.Status == BidStatus.Rejected.ToDbString())
                throw new HttpRequestException("This bid has already been rejected.", null, HttpStatusCode.BadRequest);

            bid.Status = BidStatus.Rejected.ToDbString();
            bid.Job.Status = JobStatus.Open.ToDbString();
            bid.Job.Updated_At_Utc = now;
        }

        if (eventTypeToStore == BidEventType.LockAdded.ToDbString())
        {
            bid.Locked = true;

            var lockReason = string.IsNullOrWhiteSpace(reason) ? "No reason provided." : reason.Trim();
            var existingBidLock = await Context.Bid_Locks.FirstOrDefaultAsync(bl => bl.Bid_Id == bid.Id);

            if (existingBidLock is null)
            {
                Context.Bid_Locks.Add(new Bid_Lock
                {
                    Bid_Id = bid.Id,
                    Locked_By_User_Id = adminId,
                    Locked_Reason = lockReason,
                    Locked_At_Utc = now
                });
            }
            else
            {
                existingBidLock.Locked_By_User_Id = adminId;
                existingBidLock.Locked_Reason = lockReason;
                existingBidLock.Locked_At_Utc = now;
            }

            await CreateNotification(
                bid.Handyman_User_Id,
                NotificationType.SystemMessage,
                $"Your bid for '{bid.Job.Title}' was locked by admin. Reason: {lockReason}.",
                bid.Job_Id
            );
        }

        if (eventTypeToStore == BidEventType.LockRemoved.ToDbString())
        {
            bid.Locked = false;

            var existingBidLock = await Context.Bid_Locks.FirstOrDefaultAsync(bl => bl.Bid_Id == bid.Id);
            if (existingBidLock is not null)
                Context.Bid_Locks.Remove(existingBidLock);

            // Unlocking follows job lifecycle rules:
            // - open job: keep existing bid status
            // - in-progress/completed job: keep accepted bids, reject others
            if ((bid.Job.Status == JobStatus.InProgress.ToDbString() || bid.Job.Status == JobStatus.Completed.ToDbString())
                && bid.Status != BidStatus.Accepted.ToDbString())
                bid.Status = BidStatus.Rejected.ToDbString();
        }

        if (eventTypeToStore == BidEventType.FlagAdded.ToDbString())
            bid.Flagged = true;

        if (eventTypeToStore == BidEventType.FlagRemoved.ToDbString())
            bid.Flagged = false;

        bid.Updated_At_Utc = now;

        await Context.SaveChangesAsync();
    }

    private static string DeriveBidEventTypeFromState(Bid bid)
    {
        if (bid.Locked)
            return BidEventType.LockAdded.ToDbString();

        if (bid.Flagged)
            return BidEventType.FlagAdded.ToDbString();

        if (bid.Status == BidStatus.Rejected.ToDbString())
            return BidEventType.ForceRejected.ToDbString();

        return bid.Status;
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
