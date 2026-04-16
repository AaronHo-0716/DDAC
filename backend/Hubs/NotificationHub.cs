using Microsoft.AspNetCore.Authorization;
using backend.Constants;
using backend.Data;
using Microsoft.AspNetCore.SignalR;

namespace backend.Hubs;

[Authorize]
public class NotificationHub(NeighbourHelpDbContext dbContext, ILogger<ChatHub> logger) : BaseHub(dbContext)
{
    public override async Task OnConnectedAsync()
    {
        var userId = await GetCurrentUserIdAsync();

        // The "System Alert" channel. Using a prefix (Notify_) to separate "Chat Messages" from "System Notifications" 
        // This keeps the frontend logic clean.
        await Groups.AddToGroupAsync(Context.ConnectionId, $"{ClientGroupType.Notify_}{userId}");

        if (GetCurrentUserRole() == UserRole.Admin.ToDbString())
            await Groups.AddToGroupAsync(Context.ConnectionId, $"{ClientGroupType.Notify_}{UserRole.Admin}");

        logger.LogInformation("User {UserId} connected to NotificationHub.", userId);

        await base.OnConnectedAsync();
    }
}