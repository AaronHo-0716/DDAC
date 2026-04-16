using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationController(INotificationService notificationService) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<NotificationListResponse>> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 1000)
    {
        var userId = await GetCurrentUserIdAsync();
    
        return Ok(await notificationService.GetUserNotificationsAsync(userId, page, pageSize));
    }

    [HttpPatch("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        try
        {
            await notificationService.MarkAsReadAsync(id, await GetCurrentUserIdAsync());
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        try
        {
            await notificationService.MarkAllAsReadAsync(await GetCurrentUserIdAsync());
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}