using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class NotificationService( NeighbourHelpDbContext context, ILogger<NotificationService> logger) : INotificationService
{
    public async Task<NotificationListResponse> GetUserNotificationsAsync(Guid userId)
    {
        var notifications = await context.Notifications
            .Where(n => n.User_Id == userId)
            .OrderByDescending(n => n.Created_At_Utc)
            .ToListAsync();

        var unreadCount = notifications.Count(n => !n.Is_Read);

        var dtos = notifications.Select(MapToDto).ToList();

        return new NotificationListResponse(dtos, unreadCount);
    }

    public async Task MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.User_Id == userId);

        if (notification == null)
        {
            logger.LogWarning("MarkAsRead failed: Notification {NotificationId} not found for User {UserId}", notificationId, userId);
            throw new HttpRequestException("Notification not found.", null, HttpStatusCode.NotFound);
        }

        if (notification.Is_Read) return;

        notification.Is_Read = true;
        await context.SaveChangesAsync();
        
        logger.LogInformation("Notification {NotificationId} marked as read by User {UserId}", notificationId, userId);
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        await context.Notifications
            .Where(n => n.User_Id == userId && !n.Is_Read)
            .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.Is_Read, true));

        logger.LogInformation("All notifications marked as read for User {UserId}", userId);
    }

    private static NotificationDto MapToDto(Notification entity)
    {
        return new NotificationDto(
            Id: entity.Id,
            Type: NotificationConstants.ParseFromDb(entity.Type).ToDbString(),
            Message: entity.Message,
            RelatedJobId: entity.Related_Job_Id,
            IsRead: entity.Is_Read,
            CreatedAtUtc: entity.Created_At_Utc
        );
    }
}
