// using backend.Constants;

namespace backend.Models.DTOs;

public record CreateReportRequest(
    Guid TargetUserId,
    string Reason,
    string Description
);

public record UserReportDto(
    Guid Id,
    Guid ReporterId,
    string ReporterName,
    Guid TargetUserId,
    string TargetUserName,
    string Reason,
    string Description,
    string Status,
    DateTime CreatedAtUtc,
    Guid? AdminId,
    string? AdminName,
    DateTime? ReviewAtUtc,
    string? AdminNotes = null
);
