using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace backend.Services;

public class ReportService(NeighbourHelpDbContext context, ILogger<ReportService> logger) : IReportService
{ 
    public async Task CreateReportAsync(CreateReportRequest request, Guid reporterId)
    {
        if (request.TargetUserId == reporterId)
            throw new ArgumentException("You cannot report yourself.");

        var targetExists = await context.Users.AnyAsync(u => u.Id == request.TargetUserId);
        if (!targetExists) throw new KeyNotFoundException("Target user not found.");

        var report = new User_Report
        {
            Id = Guid.NewGuid(),
            Reporter_Id = reporterId,
            Target_User_Id = request.TargetUserId,
            Reason = request.Reason,
            Description = request.Description,
            Status = "pending",
            Created_At_Utc = DateTime.UtcNow
        };

        context.User_Reports.Add(report);

        var adminIds = await context.Users.Where(u => u.Role == "admin").Select(u => u.Id).ToListAsync();
        var adminNotifications = adminIds.Select(adminId => new Notification
        {
            Id = Guid.NewGuid(),
            User_Id = adminId,
            Type = "new_user_report",
            Message = $"New report filed against user for: {request.Reason}",
            Is_Read = false,
            Created_At_Utc = DateTime.UtcNow
        });
        
        context.Notifications.AddRange(adminNotifications);
        await context.SaveChangesAsync();
        
        logger.LogInformation("User {ReporterId} filed a report against {TargetId}", reporterId, request.TargetUserId);
    }

    public async Task<IEnumerable<UserReportDto>> GetMyReportsAsync(Guid userId)
    {
        var reports = await context.User_Reports
            .Include(r => r.Reporter)
            .Include(r => r.Target_User)
            .Include(r => r.Reviewed_By_Admin)
            .Where(r => r.Reporter_Id == userId)
            .OrderByDescending(r => r.Created_At_Utc)
            .ToListAsync();

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
            r.Reviewed_By_Admin_Id,
            r.Reviewed_By_Admin?.Name,
            r.Reviewed_At_Utc,
            r.Admin_Notes
        ));
    }

    public async Task<IEnumerable<UserReportDto>> GetAllReportsAsync(ReportStatusFilter? status = null)
    {
        var query = context.User_Reports
            .Include(r => r.Reporter)
            .Include(r => r.Target_User)
            .Include(r => r.Reviewed_By_Admin)
            .AsNoTracking();
    
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
            r.Reviewed_By_Admin_Id,
            r.Reviewed_By_Admin?.Name,
            r.Reviewed_At_Utc,
            r.Admin_Notes
        ));
    }

    public async Task ResolveReportAsync(Guid reportId, string adminNotes, Guid adminId)
    {
        var report = await context.User_Reports.FirstOrDefaultAsync(r => r.Id == reportId)
            ?? throw new KeyNotFoundException("Report not found.");

        if (report.Status == "resolved")
        {
            throw new InvalidOperationException("This report has already been resolved and cannot be modified.");
        }

        report.Status = "resolved";
        report.Admin_Notes = adminNotes;
        report.Reviewed_At_Utc = DateTime.UtcNow;
        report.Reviewed_By_Admin_Id = adminId;

        await context.SaveChangesAsync();
        logger.LogInformation("Report {ReportId} resolved by Admin {AdminId}", reportId, adminId);
    }

    public async Task ReviewReportAsync(Guid reportId, string adminNotes, Guid adminId)
    {
        var report = await context.User_Reports.FirstOrDefaultAsync(r => r.Id == reportId)
            ?? throw new KeyNotFoundException("Report not found.");

        if (report.Status == "resolved")
        {
            throw new InvalidOperationException("This report has already been resolved and cannot be marked as 'under review'.");
        }
    
        report.Status = "reviewed";
        report.Admin_Notes = adminNotes; // Save notes provided during review
        report.Reviewed_By_Admin_Id = adminId;
        report.Reviewed_At_Utc = DateTime.UtcNow;
    
        await context.SaveChangesAsync();
        logger.LogInformation("Report {ReportId} status updated to 'reviewed' with notes by Admin {AdminId}", reportId, adminId);
    }
}
