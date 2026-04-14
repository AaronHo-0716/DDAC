using backend.Models.DTOs;

namespace backend.Services;

public interface INotificationService
{
    Task<NotificationListResponse> GetUserNotificationsAsync(Guid userId);
    Task MarkAsReadAsync(Guid notificationId, Guid userId);
    Task MarkAllAsReadAsync(Guid userId);
}
