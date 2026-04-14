using backend.Models.DTOs;
using backend.Constants;

namespace backend.Services;

public interface IReportService
{
    Task<IEnumerable<UserReportDto>> GetAllReportsAsync(ReportStatus? status = null);
    Task ResolveReportAsync(Guid reportId, string adminNotes, Guid adminId);
    Task ReviewReportAsync(Guid reportId, string adminNotes, Guid adminId);
    Task CreateReportAsync(CreateReportRequest request, Guid reporterId);
    Task<IEnumerable<UserReportDto>> GetMyReportsAsync(Guid userId);
}
