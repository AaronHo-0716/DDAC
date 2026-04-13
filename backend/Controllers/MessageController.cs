using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.RateLimiting;
using System.Net;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessageController(IMessageService messageService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string UserRole => User.FindFirstValue(ClaimTypes.Role) ?? "user";

    [HttpPost("conversations/job")]
    public async Task<ActionResult<ConversationDto>> StartJobChat(CreateJobChatRequest request)
        => Ok(await messageService.GetOrCreateJobConversationAsync(request, UserId));

    [HttpPost("conversations/support")]
    public async Task<ActionResult<ConversationDto>> StartSupportChat(CreateSupportChatRequest request)
        => Ok(await messageService.GetOrCreateSupportConversationAsync(request, UserId, UserRole));

    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
        => Ok(await messageService.GetUserConversationsAsync(UserId));

    [HttpGet("conversations/{conversationId}")]
    public async Task<ActionResult<ConversationDto>> GetConversation(Guid conversationId)
        => Ok(await messageService.GetConversationByIdAsync(conversationId, UserId));

    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(Guid conversationId)
        => Ok(await messageService.GetConversationMessagesAsync(conversationId, UserId));

    [HttpPost("conversations/{conversationId}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid conversationId, SendMessageRequest request)
        => Ok(await messageService.SendMessageAsync(conversationId, UserId, request));

    [HttpPatch("conversations/{conversationId}/read")]
    public async Task<IActionResult> MarkRead(Guid conversationId)
    {
        await messageService.MarkAsReadAsync(conversationId, UserId);
        return NoContent();
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetTotalUnread()
        => Ok(await messageService.GetTotalUnreadCountAsync(UserId));

    [HttpGet("unread-by-conversation")]
    public async Task<ActionResult<IEnumerable<UnreadGroupDto>>> GetUnreadByConversation()
        => Ok(await messageService.GetUnreadCountsByConversationAsync(UserId));
}
