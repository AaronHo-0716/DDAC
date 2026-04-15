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
        try { return Ok(await messageService.GetOrCreateJobConversationAsync(request, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("conversations/support")]
    public async Task<ActionResult<ConversationDto>> StartSupportChat(CreateSupportChatRequest request)
    {
        try { return Ok(await messageService.GetOrCreateSupportConversationAsync(request, await GetCurrentUserIdAsync(), GetUserRole())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        return Ok(await messageService.GetUserConversationsAsync(await GetCurrentUserIdAsync()));
    }

    [HttpGet("conversations/{conversationId}")]
    public async Task<ActionResult<ConversationDto>> GetConversation(Guid conversationId)
    {
        try { return Ok(await messageService.GetConversationByIdAsync(conversationId, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(Guid conversationId)
    {
        try { return Ok(await messageService.GetConversationMessagesAsync(conversationId, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("conversations/{conversationId}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid conversationId, SendMessageRequest request)
    {
        try { return Ok(await messageService.SendMessageAsync(conversationId, await GetCurrentUserIdAsync(), request)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("conversations/{conversationId}/read")]
    public async Task<IActionResult> MarkRead(Guid conversationId)
    {
        await messageService.MarkAsReadAsync(conversationId, await GetCurrentUserIdAsync());
        return NoContent();
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetTotalUnread()
    {
        return Ok(await messageService.GetTotalUnreadCountAsync(await GetCurrentUserIdAsync()));
    }

    [HttpGet("unread-by-conversation")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<UnreadGroupDto>>> GetUnreadByConversation()
    {
        return Ok(await messageService.GetUnreadCountsByConversationAsync(await GetCurrentUserIdAsync()));
    }
    
    private string GetUserRole() => User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "guest";
}