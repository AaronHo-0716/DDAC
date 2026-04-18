using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/support")]
[Authorize]
public class SupportMessageController(ISupportMessageService supportService) : BaseController
{
    [HttpPost("conversation")]
    public async Task<ActionResult<ConversationDto>> StartSupportChat()
    {
        try { return Ok(await supportService.GetOrCreateSupportConversationAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetMySupportChats()
    {
        return Ok(await supportService.GetSupportConversationsAsync());
    }

    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(Guid conversationId)
    {
        try { return Ok(await supportService.GetConversationMessagesAsync(conversationId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("conversations/{conversationId}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid conversationId, [FromBody] SendMessageRequest req)
    {
        try { return Ok(await supportService.SendSupportMessageAsync(conversationId, req)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("conversations/{conversationId}/read")]
    public async Task<IActionResult> MarkRead(Guid conversationId)
    {
        await supportService.MarkAsReadAsync(conversationId);
        return NoContent();
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountResponse>> GetTotalUnread()
    {
        var count = await supportService.GetTotalUnreadCountAsync();
        return Ok(new UnreadCountResponse(count));
    }
}