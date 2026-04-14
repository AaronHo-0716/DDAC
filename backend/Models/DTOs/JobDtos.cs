using backend.Constants;

namespace backend.Models.DTOs;

public record JobDto(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string Location,
    decimal? Latitude,
    decimal? Longitude,
    decimal? Budget,
    string Status,
    bool IsEmergency,
    UserDto PostedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int BidCount,
    List<string>? ImageUrls
);

public record CreateJobRequest(
    string Title,
    string Description,
    string Category,
    string Location,
    decimal? Latitude,
    decimal? Longitude,
    decimal? Budget,
    bool IsEmergency = false,
    List<string>? ImageUrls = null
);

public record UpdateJobRequest(
    string Title,
    string Description,
    string Category,
    string Location,
    decimal? Latitude,
    decimal? Longitude,
    decimal? Budget,
    bool IsEmergency = false
);

public record JobListResponse(
    List<JobDto> Jobs,
    int Page,
    int PageSize,
    int TotalCount
);

public record JobFilterQuery(
    int Page = 1,
    int PageSize = 10,
    string? Category = null,
    JobStatus? Status = null,
    string? Search = null,
    bool? IsEmergency = null,
    decimal? MaxDistanceKm = null
);
