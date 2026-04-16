using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using Microsoft.AspNetCore.RateLimiting;
using System.Net;

namespace backend.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessageController(IMessageService messageService) : BaseController
{
    [HttpPost("conversations/job")]
    public async Task<ActionResult<ConversationDto>> StartJobChat([FromBody] CreateJobChatRequest req) {
        try { return Ok(await messageService.GetOrCreateJobConversationAsync(req, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("conversations/support")]
    public async Task<ActionResult<ConversationDto>> StartSupportChat() {
        try { return Ok(await messageService.GetOrCreateSupportConversationAsync(await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations() {
        return Ok(await messageService.GetUserConversationsAsync(await GetCurrentUserIdAsync(), GetCurrentUserRole()));
    }

    [HttpGet("conversations/{conversationId}")]
    public async Task<ActionResult<ConversationDto>> GetConversation(Guid conversationId) {
        try { return Ok(await messageService.GetConversationByIdAsync(conversationId, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(Guid conversationId) =>
        Ok(await messageService.GetConversationMessagesAsync(conversationId, await GetCurrentUserIdAsync()));

    [HttpPost("conversations/{conversationId}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid conversationId, [FromBody] SendMessageRequest req) 
    {
        try 
        { 
            var userId = await GetCurrentUserIdAsync();
            return Ok(await messageService.SendMessageAsync(conversationId, userId, req)); 
        }
        catch (HttpRequestException ex) 
        { 
            return HandleError(ex); 
        }
    }

    [HttpPatch("conversations/{conversationId}/read")]
    public async Task<IActionResult> MarkRead(Guid conversationId) {
        await messageService.MarkAsReadAsync(conversationId, await GetCurrentUserIdAsync());
        return NoContent();
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountResponse>> GetTotalUnread() =>
        Ok(new UnreadCountResponse(await messageService.GetTotalUnreadCountAsync(await GetCurrentUserIdAsync())));
}