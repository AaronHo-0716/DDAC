using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using backend.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Amazon.S3;
using Microsoft.Extensions.Options;
using backend.Models.Config;

namespace backend.Services;

public class NotificationService(
    NeighbourHelpDbContext context, 
    ILogger<NotificationService> logger,
    IAmazonS3 s3,
    IOptions<StorageOptions> options,
    IHubContext<NotificationHub> notificationHub)
    : BaseService(context, logger, s3, options, notificationHub), INotificationService
{
    public async Task<NotificationListResponse> GetUserNotificationsAsync(Guid userId, int page = 1, int pageSize = 1000)
    {
        var baseQuery = Context.Notifications.Where(n => n.User_Id == userId);

        var totalCount = await baseQuery.CountAsync();
        var unreadCount = await baseQuery.CountAsync(n => !n.Is_Read);

        var notifications = await baseQuery
            .OrderByDescending(n => n.Created_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new NotificationListResponse(
            Data: notifications.Select(MapNotificationToDto).ToList(),
            UnreadCount: unreadCount,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize
        );
    }

    public async Task MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await Context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.User_Id == userId)
            ?? throw new HttpRequestException("Notification not found.", null, HttpStatusCode.NotFound);

        if (notification.Is_Read) return;

        notification.Is_Read = true;
        await Context.SaveChangesAsync();
        
        await NotificationHubContext.Clients.Group($"{ClientGroupType.Notify_}{userId}").SendAsync(HubMethod.NotificationMarkedRead.ToString(), notificationId);
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        await Context.Notifications
            .Where(n => n.User_Id == userId && !n.Is_Read)
            .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.Is_Read, true));

        await NotificationHubContext.Clients.Group($"{ClientGroupType.Notify_}{userId}").SendAsync(HubMethod.AllNotificationsMarkedRead.ToString());
    }

}