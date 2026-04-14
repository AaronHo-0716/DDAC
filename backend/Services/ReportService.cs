using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class ReportService(NeighbourHelpDbContext context, ILogger<ReportService> logger) : BaseService(context, logger), IReportService
{
    public async Task CreateReportAsync(CreateReportRequest request, Guid reporterId)
    {

        if (request.TargetUserId == reporterId) 
        throw new HttpRequestException("Self-reporting is not allowed.", null, HttpStatusCode.BadRequest);
        
        var targetExists = await context.Users.AnyAsync(u => u.Id == request.TargetUserId);
        if (!targetExists) throw new HttpRequestException("The user you are trying to report no longer exists.", null, HttpStatusCode.NotFound);

        var report = new User_Report
        {
            Id = Guid.NewGuid(),
            Reporter_Id = reporterId,
            Target_User_Id = request.TargetUserId,
            Reason = request.Reason,
            Description = request.Description,
            Status = ReportStatus.Pending.ToDbString(),
            Created_At_Utc = DateTime.UtcNow
        };

        context.User_Reports.Add(report);
        
        await CreateNotifications(NotificationType.NewUserReport, $"New user report filed: {request.Reason}");

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

        return reports.Select(MapToDto);
    }

    public async Task<IEnumerable<UserReportDto>> GetAllReportsAsync(ReportStatus? status = null)
    {
        var query = context.User_Reports
            .Include(r => r.Reporter)
            .Include(r => r.Target_User)
            .Include(r => r.Reviewed_By_Admin)
            .AsNoTracking();

        if (status.HasValue)
        {
            var statusStr = status.Value.ToDbString();
            query = query.Where(r => r.Status == statusStr);
        }

        var reports = await query.OrderByDescending(r => r.Created_At_Utc).ToListAsync();
        return reports.Select(MapToDto);
    }

    public async Task ResolveReportAsync(Guid reportId, string adminNotes, Guid adminId)
    {
        var report = await context.User_Reports.FirstOrDefaultAsync(r => r.Id == reportId)
            ?? throw new HttpRequestException("Report not found.", null, HttpStatusCode.NotFound);

        if (report.Status == ReportStatus.Resolved.ToDbString())
            throw new HttpRequestException("This report has already been resolved and cannot be modified.", null, HttpStatusCode.BadRequest);
        
        report.Status = ReportStatus.Resolved.ToDbString();
        UpdateModerationDetails(report, adminNotes, adminId);

        await context.SaveChangesAsync();
        logger.LogInformation("Report {ReportId} resolved by Admin {AdminId}", reportId, adminId);
    }

    public async Task ReviewReportAsync(Guid reportId, string adminNotes, Guid adminId)
    {
        var report = await context.User_Reports.FirstOrDefaultAsync(r => r.Id == reportId)
            ?? throw new HttpRequestException("Report not found.", null, HttpStatusCode.NotFound);

        if (report.Status == ReportStatus.Resolved.ToDbString())
            throw new HttpRequestException("Resolved reports cannot be put back under review.", null, HttpStatusCode.BadRequest);
        

        report.Status = ReportStatus.Reviewed.ToDbString();
        UpdateModerationDetails(report, adminNotes, adminId);

        await context.SaveChangesAsync();
        logger.LogInformation("Report {ReportId} status updated to 'Reviewed' by Admin {AdminId}", reportId, adminId);
    }

    private static void UpdateModerationDetails(User_Report report, string notes, Guid adminId)
    {
        report.Admin_Notes = notes;
        report.Reviewed_By_Admin_Id = adminId;
        report.Reviewed_At_Utc = DateTime.UtcNow;
    }

    private static UserReportDto MapToDto(User_Report r)
    {
        return new UserReportDto(
            r.Id,
            r.Reporter_Id,
            r.Reporter.Name,
            r.Target_User_Id,
            r.Target_User.Name,
            r.Reason,
            r.Description,
            ReportConstants.ParseFromDb(r.Status).ToDbString(),
            r.Created_At_Utc,
            r.Reviewed_By_Admin_Id,
            r.Reviewed_By_Admin?.Name,
            r.Reviewed_At_Utc,
            r.Admin_Notes
        );
    }
}