using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace backend.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize] // All notification endpoints require the user to be logged in
public class NotificationController(INotificationService notificationService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<NotificationListResponse>> GetNotifications()
    {
        var result = await notificationService.GetUserNotificationsAsync(UserId);
        return Ok(result);
    }

    [HttpPatch("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        try
        {
            await notificationService.MarkAsReadAsync(id, UserId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        await notificationService.MarkAllAsReadAsync(UserId);
        return NoContent();
    }
}
