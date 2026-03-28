using backend.Models.Entities;

namespace backend.Models.DTOs;

// Job response DTO
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

// Create job request
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

// Update job request
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

// Job listing response (paginated)
public record JobListResponse(
    List<JobDto> Jobs,
    int Page,
    int PageSize,
    int TotalCount
);

// Query filter parameters
public record JobFilterQuery(
    int Page = 1,
    int PageSize = 10,
    string? Category = null,
    string? Status = null,
    string? Search = null,
    bool? IsEmergency = null,
    decimal? MaxDistanceKm = null
);