using backend.Models.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend.Services;

public interface INotificationService
{
    Task<NotificationListResponse> GetUserNotificationsAsync(Guid userId);
    Task MarkAsReadAsync(Guid notificationId, Guid userId);
    Task MarkAllAsReadAsync(Guid userId);
}
