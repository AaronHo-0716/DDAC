using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace backend.Services;

public class AdminService(NeighbourHelpDbContext context, ILogger<AdminService> logger) : IAdminService
{
    public async Task<AdminOverviewResponse> GetOverviewAsync()
    {
        var today = DateTime.UtcNow.Date;
        return new AdminOverviewResponse(
            UsersCreatedToday: await context.Users.CountAsync(u => u.CreatedAtUtc >= today),
            JobsPostedToday: await context.Jobs.CountAsync(j => j.Created_At_Utc >= today),
            BidsCreatedToday: await context.Bids.CountAsync(b => b.Created_At_Utc >= today),
            OpenEmergencies: await context.Jobs.CountAsync(j => j.Is_Emergency && j.Status == "open"),
            BlockedAccountCount: await context.Users.CountAsync(u => !u.IsActive)
        );
    }

    public async Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request)
    {
        var query = context.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
            query = query.Where(u => u.Name.ToLower().Contains(request.Name.ToLower()));

        if (!string.IsNullOrWhiteSpace(request.Email))
            query = query.Where(u => u.Email.ToLower().Contains(request.Email.ToLower()));

        if (request.Role.HasValue)
        {
            var roleStr = request.Role.Value.ToString().ToLower();
            query = query.Where(u => u.Role == roleStr);
        }

        if (request.IsActive.HasValue)
            query = query.Where(u => u.IsActive == request.IsActive.Value);

        var users = await query
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        var approvedHandymanIds = await context.Handyman_Verifications
            .Where(v => v.Status == "approved")
            .Select(v => v.User_Id)
            .ToListAsync();

        return users.Select(u => new UserDto(
            u.Id,
            u.Name,
            u.Email,
            u.Role,
            u.AvatarUrl,
            u.Rating,
            u.CreatedAtUtc,
            u.IsActive,
            u.Role != "handyman" || approvedHandymanIds.Contains(u.Id),
            u.Blocked_Reason,
            u.Blocked_At_Utc
        ));
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id)
    {
        var u = await context.Users.FindAsync(id) ?? throw new KeyNotFoundException("User not found");

        bool isVerified = true;
        if (u.Role == "handyman")
        {
            isVerified = await context.Handyman_Verifications
                .AnyAsync(v => v.User_Id == u.Id && v.Status == "approved");
        }

        return new UserDto(
            u.Id,
            u.Name,
            u.Email,
            u.Role,
            u.AvatarUrl,
            u.Rating,
            u.CreatedAtUtc,
            u.IsActive,
            isVerified,
            u.Blocked_Reason,
            u.Blocked_At_Utc
        );
    }

    public async Task<BlockedUserResponse?> UpdateUserBlockStatusAsync(Guid targetId, bool block, string? reason, Guid adminIdFromToken)
    {
        if (block && targetId == adminIdFromToken)
        {
            logger.LogWarning("Admin {AdminId} attempted to block themselves.", adminIdFromToken);
            throw new InvalidOperationException("Critical Security Error: Self-blocking is prohibited.");
        }

        var user = await context.Users.FirstOrDefaultAsync(u => u.Id == targetId) 
            ?? throw new KeyNotFoundException("User not found");

        user.IsActive = !block;
        user.Blocked_Reason = block ? reason : null;
        user.Blocked_At_Utc = block ? DateTime.UtcNow : null;
        user.Blocked_By_User_Id = block ? adminIdFromToken : null;
        user.TokenVersion++;

        context.Admin_Actions.Add(new Admin_Action {
            Id = Guid.NewGuid(), Admin_User_Id = adminIdFromToken,
            Action_Type = block ? "BLOCK_USER" : "UNBLOCK_USER",
            Target_Type = "USER", Target_Id = targetId, Reason = reason,
            Payload = "{}", Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        if (block)
        {
            logger.LogInformation("User {UserId} was blocked by Admin {AdminId}. Reason: {Reason}", targetId, adminIdFromToken, reason);
            return new BlockedUserResponse(
                Message: "User has been successfully blocked.",
                Reason: user.Blocked_Reason ?? "No reason specified.",
                BlockedAt: user.Blocked_At_Utc
            );
        }

        logger.LogInformation("User {UserId} was unblocked by Admin {AdminId}", targetId, adminIdFromToken);
        return null;
    }

    public async Task<IEnumerable<HandymanVerificationDto>> GetPendingVerificationsAsync()
    {
        return await context.Handyman_Verifications
            .Include(v => v.User)
            .Where(v => v.Status == "pending")
            .Select(v => new HandymanVerificationDto(v.Id, v.User_Id, v.User.Name, v.Status, v.Created_At_Utc))
            .ToListAsync();
    }

    public async Task VerifyHandymanAsync(Guid id, bool approve, string? notes, Guid adminId)
    {
        var ver = await context.Handyman_Verifications
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => v.Id == id) 
            ?? throw new KeyNotFoundException("Verification record not found");

        ver.Status = approve ? "approved" : "rejected";
        ver.Reviewed_At_Utc = DateTime.UtcNow;
        ver.Reviewed_By_User_Id = adminId;
        ver.Notes = notes;
        ver.Updated_At_Utc = DateTime.UtcNow;

        // Notify only the specific handyman
        context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = ver.User_Id,
            Type = "verification_result",
            Message = approve 
                ? "Congratulations! Your handyman account has been approved." 
                : $"Your handyman verification was rejected. Reason: {notes}",
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    public async Task<IEnumerable<JobDto>> GetEmergencyJobsAsync()
    {
        var jobs = await context.Jobs
            .Include(j => j.Posted_By_User)
            .Where(j => j.Is_Emergency && j.Status == "open")
            .ToListAsync();

        return jobs.Select(j => new JobDto(j.Id, j.Title, j.Description, j.Category, j.Location_Text, j.Latitude, j.Longitude, j.Budget, j.Status, j.Is_Emergency, 
            new UserDto(j.Posted_By_User.Id, j.Posted_By_User.Name, j.Posted_By_User.Email, j.Posted_By_User.Role, null, null, DateTime.UtcNow, true), 
            j.Created_At_Utc, j.Updated_At_Utc, 0, null));
    }

    public async Task AssignJobAsync(Guid jobId, Guid handymanUserId, Guid adminId)
    {
        var job = await context.Jobs.FindAsync(jobId) ?? throw new KeyNotFoundException("Job not found");
        job.Status = "in_progress"; 

        context.Admin_Actions.Add(new Admin_Action {
            Id = Guid.NewGuid(), Admin_User_Id = adminId, Action_Type = "FORCE_ASSIGN_JOB",
            Target_Type = "JOB", Target_Id = jobId, Reason = "Admin assigned",
            Payload = JsonSerializer.Serialize(new { handymanId = handymanUserId }), Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        logger.LogInformation("Job {JobId} force-assigned to Handyman {HandymanId} by Admin {AdminId}", jobId, handymanUserId, adminId);
    }

    public async Task<IEnumerable<BidTransactionDto>> GetBidTransactionsAsync(string? eventType = null)
    {
        var query = context.Bid_Transactions.AsQueryable();
        if (!string.IsNullOrEmpty(eventType)) query = query.Where(t => t.Event_Type == eventType);

        return await query.OrderByDescending(t => t.Created_At_Utc)
            .Select(t => new BidTransactionDto(t.Id, t.Bid_Id, t.Job_Id, t.Event_Type, t.Event_Reason, t.Created_At_Utc))
            .ToListAsync();
    }

    public async Task<BidTransactionDto> GetBidTransactionByIdAsync(Guid id)
    {
        var t = await context.Bid_Transactions.FindAsync(id) ?? throw new KeyNotFoundException("Transaction not found");
        return new BidTransactionDto(t.Id, t.Bid_Id, t.Job_Id, t.Event_Type, t.Event_Reason, t.Created_At_Utc);
    }

    public async Task HandleBidActionAsync(Guid bidId, string actionType, string reason, Guid adminId)
    {
        var bid = await context.Bids.Include(b => b.Job).FirstOrDefaultAsync(b => b.Id == bidId) 
            ?? throw new KeyNotFoundException("Bid not found");

        if (actionType == "FORCE_REJECT") bid.Status = "rejected";

        context.Bid_Transactions.Add(new Bid_Transaction {
            Id = Guid.NewGuid(), Bid_Id = bidId, Job_Id = bid.Job_Id, Handyman_User_Id = bid.Handyman_User_Id,
            Homeowner_User_Id = bid.Job.Posted_By_User_Id, Event_Type = actionType, Event_By_User_Id = adminId,
            Event_Reason = reason, Event_Metadata = "{}", Created_At_Utc = DateTime.UtcNow
        });

        context.Admin_Actions.Add(new Admin_Action {
            Id = Guid.NewGuid(), Admin_User_Id = adminId, Action_Type = actionType,
            Target_Type = "BID", Target_Id = bidId, Reason = reason, Payload = "{}", Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        logger.LogInformation("Admin {AdminId} performed {Action} on Bid {BidId}", adminId, actionType, bidId);
    }

    public async Task<IEnumerable<AdminActionDto>> GetAuditLogsAsync()
    {
        return await context.Admin_Actions
            .OrderByDescending(a => a.Created_At_Utc)
            .Select(a => new AdminActionDto(a.Id, a.Admin_User_Id, a.Action_Type, a.Target_Type, a.Target_Id, a.Reason, a.Created_At_Utc))
            .ToListAsync();
    }

    public async Task<IEnumerable<UserReportDto>> GetAllReportsAsync(ReportStatusFilter? status = null)
    {
        var query = context.User_Reports
            .Include(r => r.Reporter)
            .Include(r => r.Target_User)
            .AsNoTracking();
    
        // Convert enum to string for DB filtering
        if (status.HasValue)
        {
            var statusStr = status.Value.ToString().ToLower();
            query = query.Where(r => r.Status == statusStr);
        }
    
        var reports = await query.OrderByDescending(r => r.Created_At_Utc).ToListAsync();
    
        return reports.Select(r => new UserReportDto(
            r.Id,
            r.Reporter_Id,
            r.Reporter.Name,
            r.Target_User_Id,
            r.Target_User.Name,
            r.Reason,
            r.Description,
            r.Status,
            r.Created_At_Utc,
            r.Admin_Notes
        ));
    }

    public async Task ResolveReportAsync(Guid reportId, string adminNotes, Guid adminId)
    {
        var report = await context.User_Reports.FirstOrDefaultAsync(r => r.Id == reportId)
            ?? throw new KeyNotFoundException("Report not found.");

        report.Status = "resolved";
        report.Admin_Notes = adminNotes;
        report.Reviewed_At_Utc = DateTime.UtcNow;
        report.Reviewed_By_Admin_Id = adminId;

        await context.SaveChangesAsync();
        logger.LogInformation("Report {ReportId} resolved by Admin {AdminId}", reportId, adminId);
    }
}
