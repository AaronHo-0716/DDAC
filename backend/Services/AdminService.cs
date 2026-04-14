using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class AdminService : BaseService, IAdminService
{
    private readonly NeighbourHelpDbContext _context;
    private readonly ILogger _logger;

    public AdminService(NeighbourHelpDbContext context, ILogger<AdminService> logger) : base(context, logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<AdminOverviewResponse> GetOverviewAsync()
    {
        var today = DateTime.UtcNow.Date;
        var openStatus = JobStatus.Open.ToDbString();

        return new AdminOverviewResponse(
            UsersCreatedToday: await _context.Users.CountAsync(u => u.CreatedAtUtc >= today),
            JobsPostedToday: await _context.Jobs.CountAsync(j => j.Created_At_Utc >= today),
            BidsCreatedToday: await _context.Bids.CountAsync(b => b.Created_At_Utc >= today),
            OpenEmergencies: await _context.Jobs.CountAsync(j => j.Is_Emergency && j.Status == openStatus),
            BlockedAccountCount: await _context.Users.CountAsync(u => !u.IsActive)
        );
    }

    public async Task<UserDto> CreateAdminAsync(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
            throw new HttpRequestException("Invalid email format.", null, HttpStatusCode.BadRequest);

        var emailLower = request.Email.ToLower().Trim();
        if (await _context.Users.AnyAsync(u => u.Email == emailLower))
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

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        _logger.LogInformation("New admin added with email: {Email}", request.Email);
        return await MapUserToDto(newUser);
    }

    public async Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request)
    {
        var query = _context.Users.AsNoTracking();
    
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
            query = query.Where(u => _context.Handyman_Verifications.Any(v => v.User_Id == u.Id && v.Status == veriStr));
        }
    
        var users = await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();
    
        var pagedUserIds = users.Select(u => u.Id).ToList();
        var verificationStatuses = await _context.Handyman_Verifications
            .Where(v => pagedUserIds.Contains(v.User_Id))
            .ToDictionaryAsync(v => v.User_Id, v => v.Status);
    
        var mappingTasks = users.Select(u => 
        {
            var statusStr = verificationStatuses.GetValueOrDefault(u.Id);
            
            return MapUserToDto(u, statusStr); 
        });
    
        return await Task.WhenAll(mappingTasks);
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id) 
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);
        
        string? statusStr = null;
        if (user.Role == UserRole.Handyman.ToDbString())
        {
            statusStr = await _context.Handyman_Verifications
                .Where(v => v.User_Id == user.Id)
                .Select(v => v.Status)
                .FirstOrDefaultAsync();
        }

        return await MapUserToDto(user);
    }

    public async Task<UserDto?> UpdateUserBlockStatusAsync(Guid targetId, bool block, string? reason, Guid adminId)
    {
        if (block && targetId == adminId)
            throw new HttpRequestException("Security Error: You cannot block your own account.", null, HttpStatusCode.BadRequest);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == targetId) 
            ?? throw new HttpRequestException("User not found.", null, HttpStatusCode.NotFound);

        user.IsActive = !block;
        user.Blocked_Reason = block ? reason : null;
        user.Blocked_At_Utc = block ? DateTime.UtcNow : null;
        user.Blocked_By_User_Id = block ? adminId : null;
        user.TokenVersion++;

        await _context.SaveChangesAsync();

        if (block)
        {
            _logger.LogInformation("User {UserId} blocked by Admin {AdminId}.", targetId, adminId);
            return await MapUserToDto(user);
        }

        _logger.LogInformation("User {UserId} unblocked by Admin {AdminId}", targetId, adminId);
        return null;
    }

    public async Task<IEnumerable<HandymanVerificationDto>> GetPendingVerificationsAsync()
    {
        var pendingStatus = VerificationStatus.Pending.ToDbString();
        
        return await _context.Handyman_Verifications
            .Include(v => v.User)
            .Where(v => v.Status == pendingStatus)
            .Select(v => new HandymanVerificationDto(
                v.Id, 
                v.User_Id, 
                v.User.Name, 
                VerificationStatus.Pending.ToDbString(), 
                v.Created_At_Utc))
            .ToListAsync();
    }

    public async Task VerifyHandymanAsync(Guid id, bool approve, string? notes, Guid adminId)
    {
        var verification = await _context.Handyman_Verifications
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

        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<JobDto>> GetEmergencyJobsAsync()
    {
        var openStatus = JobStatus.Open.ToDbString();
        
        var jobs = await _context.Jobs
            .Include(j => j.Posted_By_User)
            .Where(j => j.Is_Emergency && j.Status == openStatus)
            .ToListAsync();

        return jobs.Select(MapJobToDto);
    }

    public async Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId)
    {
        var job = await _context.Jobs.FindAsync(jobId) 
            ?? throw new HttpRequestException("Job not found.", null, HttpStatusCode.NotFound);
        
        job.Status = JobStatus.InProgress.ToDbString(); 
        await _context.SaveChangesAsync();
        _logger.LogInformation("Job {JobId} force-assigned by Admin {AdminId}", jobId, adminId);
    }

    public async Task<IEnumerable<BidTransactionDto>> GetBidTransactionsAsync(string? eventType = null)
    {
        var query = _context.Bid_Transactions.AsQueryable();
        if (!string.IsNullOrEmpty(eventType)) 
            query = query.Where(t => t.Event_Type == eventType.ToLower());

        return await query.OrderByDescending(t => t.Created_At_Utc)
            .Select(t => new BidTransactionDto(t.Id, t.Bid_Id, t.Job_Id, t.Event_Type, t.Event_Reason, t.Created_At_Utc))
            .ToListAsync();
    }

    public async Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id)
    {
        var transaction = await _context.Bid_Transactions.FindAsync(id);

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
        var bid = await _context.Bids.Include(b => b.Job).FirstOrDefaultAsync(b => b.Id == bidId) 
            ?? throw new HttpRequestException("Bid not found.", null, HttpStatusCode.NotFound);

        if (actionType == "FORCE_REJECT") 
            bid.Status = BidStatus.Rejected.ToDbString();

        _context.Bid_Transactions.Add(new Bid_Transaction {
            Id = Guid.NewGuid(), 
            Bid_Id = bidId, 
            Job_Id = bid.Job_Id, 
            Handyman_User_Id = bid.Handyman_User_Id,
            Homeowner_User_Id = bid.Job.Posted_By_User_Id, 
            Event_Type = actionType.ToLower(), 
            Event_By_User_Id = adminId,
            Event_Reason = reason, 
            Event_Metadata = "{}", 
            Created_At_Utc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<AdminActionDto>> GetAuditLogsAsync()
    {
        return await _context.Admin_Actions
            .OrderByDescending(a => a.Created_At_Utc)
            .Select(a => new AdminActionDto(a.Id, a.Admin_User_Id, a.Action_Type, a.Target_Type, a.Target_Id, a.Reason, a.Created_At_Utc))
            .ToListAsync();
    }
}
