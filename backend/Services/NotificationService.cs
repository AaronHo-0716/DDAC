using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace backend.Services;

public class NotificationService(NeighbourHelpDbContext context) : INotificationService
{
    public async Task<NotificationListResponse> GetUserNotificationsAsync(Guid userId)
    {
        var notifications = await context.Notifications
            .Where(n => n.User_Id == userId)
            .OrderByDescending(n => n.Created_At_Utc)
            .ToListAsync();

        var unreadCount = notifications.Count(n => !n.Is_Read);

        var dtos = notifications.Select(n => new NotificationDto(
            n.Id,
            n.Type,
            n.Message,
            n.Related_Job_Id,
            n.Is_Read,
            n.Created_At_Utc
        )).ToList();

        return new NotificationListResponse(dtos, unreadCount);
    }

    public async Task MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.User_Id == userId);

        if (notification == null)
            throw new KeyNotFoundException("Notification not found");

        notification.Is_Read = true;
        await context.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        var unreadNotifications = await context.Notifications
            .Where(n => n.User_Id == userId && !n.Is_Read)
            .ToListAsync();

        foreach (var n in unreadNotifications)
        {
            n.Is_Read = true;
        }

        await context.SaveChangesAsync();
    }
}
