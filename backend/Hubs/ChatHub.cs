using Microsoft.AspNetCore.Authorization;
using backend.Constants;
using backend.Data;


namespace backend.Hubs;

[Authorize]
public class ChatHub(NeighbourHelpDbContext dbContext, ILogger<ChatHub> logger) : BaseHub(dbContext)
{
    public override async Task OnConnectedAsync()
    {
        var userId = await GetCurrentUserIdAsync();

        // The "Private Mailbox". This is a group where only one specific person (you) belongs. 
        await Groups.AddToGroupAsync(Context.ConnectionId, userId.ToString());

        if (GetCurrentUserRole() == UserRole.Admin.ToDbString())
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, UserRole.Admin.ToString());
            logger.LogInformation("Admin {UserId} connected and joined Admins group.", userId);
        }
        else
        {
            logger.LogInformation("User {UserId} connected to chat.", userId);
        }

        await base.OnConnectedAsync();
    }
}