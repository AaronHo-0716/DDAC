using backend.Models.DTOs;
using backend.Constants;

namespace backend.Services;

public interface IReportService
{
    Task<ReportListResponse> GetAllReportsAsync(ReportStatus? status = null, int page = 1, int pageSize = 1000);
    Task ResolveReportAsync(Guid reportId, string adminNotes);
    Task ReviewReportAsync(Guid reportId, string adminNotes);
    Task CreateReportAsync(CreateReportRequest request);
    Task<ReportListResponse> GetMyReportsAsync(int page = 1, int pageSize = 1000);
}
