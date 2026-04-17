using backend.Models.DTOs;

namespace backend.Services;

public interface INotificationService
{
    Task<NotificationListResponse> GetUserNotificationsAsync(int page = 1, int pageSize = 1000);
    Task MarkAsReadAsync(Guid notificationId);
    Task MarkAllAsReadAsync();
}
