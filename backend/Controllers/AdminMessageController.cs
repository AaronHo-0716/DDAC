using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/messages")]
[Authorize(Roles = "admin")]
public class AdminMessageController(IMessageService messageService) : ControllerBase
{
    private Guid AdminId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPatch("conversations/{conversationId}/lock")]
    public async Task<IActionResult> LockConversation(Guid conversationId, [FromBody] string reason)
    {
        await messageService.LockConversationAsync(conversationId, reason, AdminId);
        return NoContent();
    }

    [HttpPatch("conversations/{conversationId}/unlock")]
    public async Task<IActionResult> UnlockConversation(Guid conversationId)
    {
        await messageService.UnlockConversationAsync(conversationId, AdminId);
        return NoContent();
    }

    [HttpPatch("messages/{messageId}/hide")]
    public async Task<IActionResult> HideMessage(Guid messageId, [FromBody] string reason)
    {
        await messageService.HideMessageAsync(messageId, reason, AdminId);
        return NoContent();
    }

    [HttpPatch("messages/{messageId}/unhide")]
    public async Task<IActionResult> UnhideMessage(Guid messageId)
    {
        await messageService.UnhideMessageAsync(messageId, AdminId);
        return NoContent();
    }

    [HttpPost("messages/{messageId}/flag")]
    public async Task<IActionResult> FlagMessage(Guid messageId, [FromBody] FlagMessageRequest request)
    {
        await messageService.FlagMessageAsync(messageId, request.Reason, AdminId);
        return NoContent();
    }

    [HttpGet("moderation-actions")]
    public async Task<ActionResult<IEnumerable<ModerationActionDto>>> GetModerationLog()
    {
        return Ok(await messageService.GetModerationActionsAsync());
    }
}
