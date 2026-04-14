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
    public async Task<ActionResult<NotificationListResponse>> GetNotifications()
    {
        var userId = await GetCurrentUserIdAsync();

        return Ok(await notificationService.GetUserNotificationsAsync(userId));
    }

    [HttpPatch("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();

        try
        {
            await notificationService.MarkAsReadAsync(id, userId);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = await GetCurrentUserIdAsync();

        try
        {
            await notificationService.MarkAllAsReadAsync(userId);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}