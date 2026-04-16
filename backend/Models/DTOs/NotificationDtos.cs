// using backend.Constants;

namespace backend.Models.DTOs;

public record NotificationDto(
    Guid Id,
    string Type,
    string Message,
    Guid? RelatedJobId,
    bool IsRead,
    DateTime CreatedAtUtc
);

public record NotificationListResponse(
    List<NotificationDto> Data,
    int UnreadCount, 
    int TotalCount, 
    int Page,
    int PageSize
);
