using backend.Models.DTOs;

namespace backend.Services;

public interface INotificationService
{
    Task<NotificationListResponse> GetUserNotificationsAsync(Guid userId, int page = 1, int pageSize = 1000);
    Task MarkAsReadAsync(Guid notificationId, Guid userId);
    Task MarkAllAsReadAsync(Guid userId);
}
