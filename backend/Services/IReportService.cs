using backend.Models.DTOs;
using backend.Constants;

namespace backend.Services;

public interface IReportService
{
    Task<ReportListResponse> GetAllReportsAsync(ReportStatus? status = null, int page = 1, int pageSize = 1000);
    Task ResolveReportAsync(Guid reportId, string adminNotes, Guid adminId);
    Task ReviewReportAsync(Guid reportId, string adminNotes, Guid adminId);
    Task CreateReportAsync(CreateReportRequest request, Guid reporterId);
    Task<ReportListResponse> GetMyReportsAsync(Guid userId, int page = 1, int pageSize = 1000);
}
