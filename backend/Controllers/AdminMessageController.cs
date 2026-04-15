using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/messages")]
[Authorize(Roles = "admin")]
public class AdminMessageController(IMessageService messageService) : BaseController
{
    [HttpPatch("conversations/{conversationId}/lock")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<IActionResult> LockConversation(Guid conversationId, [FromBody] string reason)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try { 
            await messageService.LockConversationAsync(conversationId, reason, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("conversations/{conversationId}/unlock")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<IActionResult> UnlockConversation(Guid conversationId)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try {
            await messageService.UnlockConversationAsync(conversationId, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("messages/{messageId}/hide")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<IActionResult> HideMessage(Guid messageId, [FromBody] string reason)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try {
            await messageService.HideMessageAsync(messageId, reason, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("messages/{messageId}/unhide")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<IActionResult> UnhideMessage(Guid messageId)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try {
            await messageService.UnhideMessageAsync(messageId, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("messages/{messageId}/flag")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<IActionResult> FlagMessage(Guid messageId, [FromBody] FlagMessageRequest request)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try {
            await messageService.FlagMessageAsync(messageId, request.Reason, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("moderation-actions")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<ModerationActionDto>>> GetModerationLog()
    {
        try { return Ok(await messageService.GetModerationActionsAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}