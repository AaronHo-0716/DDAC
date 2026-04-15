using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessageController(IMessageService messageService) : BaseController
{
    [HttpPost("conversations/job")]
    public async Task<ActionResult<ConversationDto>> StartJobChat(CreateJobChatRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();

        try { return Ok(await messageService.GetOrCreateJobConversationAsync(request, userId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("conversations/support")]
    public async Task<ActionResult<ConversationDto>> StartSupportChat(CreateSupportChatRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();

        try { return Ok(await messageService.GetOrCreateSupportConversationAsync(request, userId, GetUserRole())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();
        return Ok(await messageService.GetUserConversationsAsync(userId));
    }

    [HttpGet("conversations/{conversationId}")]
    public async Task<ActionResult<ConversationDto>> GetConversation(Guid conversationId)
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();

        try { return Ok(await messageService.GetConversationByIdAsync(conversationId, userId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(Guid conversationId)
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();

        try { return Ok(await messageService.GetConversationMessagesAsync(conversationId, userId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("conversations/{conversationId}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid conversationId, SendMessageRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();

        try { return Ok(await messageService.SendMessageAsync(conversationId, userId, request)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("conversations/{conversationId}/read")]
    public async Task<IActionResult> MarkRead(Guid conversationId)
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();
        await messageService.MarkAsReadAsync(conversationId, userId);
        return NoContent();
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetTotalUnread()
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();
        return Ok(await messageService.GetTotalUnreadCountAsync(userId));
    }

    [HttpGet("unread-by-conversation")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<UnreadGroupDto>>> GetUnreadByConversation()
    {
        var userId = await GetCurrentUserIdAsync();
        if (userId == Guid.Empty) return Unauthorized();
        return Ok(await messageService.GetUnreadCountsByConversationAsync(userId));
    }
    
    private string GetUserRole() => User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "guest";
}