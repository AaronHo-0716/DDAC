using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Microsoft.AspNetCore.SignalR;
using backend.Hubs;

namespace backend.Services;

public class MessageService(ServiceDependencies deps) : BaseService(deps), IMessageService
{
    public async Task<ConversationDto> GetOrCreateSupportConversationAsync() { return null; }
    public async Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request)
    {
        var currentUserId = await GetCurrentUserIdAsync();

        // 1. Validate Job/Bid and 1-on-1 Authorization
        var bid = await Context.Bids
            .Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == request.BidId && b.Job_Id == request.JobId)
            ?? throw new HttpRequestException("The specified job/bid relation does not exist.", null, HttpStatusCode.NotFound);

        bool isOwner = bid.Job.Posted_By_User_Id == currentUserId;
        bool isBidder = bid.Handyman_User_Id == currentUserId;

        if (!isOwner && !isBidder)
            throw new HttpRequestException("You are not authorized to chat for this job.", null, HttpStatusCode.Forbidden);

        // 2. Check for existing conversation for this specific bid
        var existing = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Type == ConversationType.JobChat.ToString() && c.Related_Bid_Id == request.BidId);

        if (existing != null) return await MapToConversationDto(existing, currentUserId);

        // 3. Create New 1-on-1 Conversation
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            Type = ConversationType.JobChat.ToString(),
            Related_Job_Id = request.JobId,
            Related_Bid_Id = request.BidId,
            Created_By_User_Id = currentUserId,
            Status = ConversationStatus.Active.ToDbString()
        };

        Context.Conversations.Add(conversation);

        // Add both participants (Homeowner and Handyman)
        var participantIds = new[] { bid.Job.Posted_By_User_Id, bid.Handyman_User_Id };
        foreach (var pId in participantIds)
        {
            var user = await Context.Users.FindAsync(pId);
            Context.Conversation_Participants.Add(new Conversation_Participant
            {
                Id = Guid.NewGuid(),
                Conversation_Id = conversation.Id,
                User_Id = pId,
                Participant_Role = user!.Role
            });
        }

        await Context.SaveChangesAsync();
        return await GetConversationByIdAsync(conversation.Id);
    }

    public async Task<MessageDto> SendMessageAsync(Guid conversationId, SendMessageRequest request)
    {
        var currentUserId = await GetCurrentUserIdAsync();

        var conv = await Context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId)
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        if (!conv.Participants.Any(p => p.User_Id == currentUserId))
            throw new HttpRequestException("Access Denied.", null, HttpStatusCode.Forbidden);

        if (conv.Status == ConversationStatus.Locked.ToDbString())
            throw new HttpRequestException("Conversation is locked.", null, HttpStatusCode.BadRequest);

        var message = new Message
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Sender_User_Id = currentUserId,
            Message_Type = request.MessageType.ToDbString(),
            Body_Text = request.Content,
            Created_At_Utc = DateTime.UtcNow
        };

        Context.Messages.Add(message);
        
        // Update unread counts and last message timestamp
        // (If you have the DB trigger installed, you can skip the unread count update line)
        await Context.SaveChangesAsync();

        var dto = MapMessageToDto(message);

        // SignalR Push to recipients
        if (ChatHubContext != null)
        {
            var targetIds = conv.Participants.Select(p => p.User_Id.ToString()).ToList();
            await ChatHubContext.Clients.Groups(targetIds)
                .SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });
        }

        return dto;
    }

    public async Task<IEnumerable<ConversationDto>> GetUserConversationsAsync()
    {
        var currentUserId = await GetCurrentUserIdAsync();

        var conversations = await Context.Conversation_Participants
            .Where(p => p.User_Id == currentUserId)
            .Include(p => p.Conversation).ThenInclude(c => c.Participants).ThenInclude(cp => cp.User)
            .OrderByDescending(p => p.Conversation.Last_Message_At_Utc)
            .Select(p => p.Conversation)
            .ToListAsync();

        var results = new List<ConversationDto>();
        foreach (var c in conversations) results.Add(await MapToConversationDto(c, currentUserId));
        return results;
    }

    public async Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId)
    {
        var currentUserId = await GetCurrentUserIdAsync();

        var isParticipant = await Context.Conversation_Participants
            .AnyAsync(p => p.Conversation_Id == conversationId && p.User_Id == currentUserId);

        if (!isParticipant) throw new HttpRequestException("Access Denied.", null, HttpStatusCode.Forbidden);

        var messages = await Context.Messages
            .Where(m => m.Conversation_Id == conversationId)
            .OrderBy(m => m.Created_At_Utc)
            .ToListAsync();

        return messages.Select(MapMessageToDto);
    }

    public async Task MarkAsReadAsync(Guid conversationId)
    {
        var currentUserId = await GetCurrentUserIdAsync();

        await Context.Conversation_Participants
            .Where(p => p.Conversation_Id == conversationId && p.User_Id == currentUserId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Unread_Count, 0));
            
        if (ChatHubContext != null)
        {
            await ChatHubContext.Clients.Group(currentUserId.ToString())
                .SendAsync(HubMethod.NotificationMarkedRead.ToString(), conversationId);
        }
    }

    public async Task<int> GetTotalUnreadCountAsync()
    {
        var currentUserId = await GetCurrentUserIdAsync();

        return await Context.Conversation_Participants
            .Where(p => p.User_Id == currentUserId)
            .SumAsync(p => p.Unread_Count);
    }

    public async Task<ConversationDto> GetConversationByIdAsync(Guid id)
    {
        var currentUserId = await GetCurrentUserIdAsync();

        var conv = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        return await MapToConversationDto(conv, currentUserId);
    }

    #region Helpers

    private async Task<ConversationDto> MapToConversationDto(Conversation c, Guid currentUserId)
    {
        var lastMsg = await Context.Messages
            .Where(m => m.Conversation_Id == c.Id)
            .OrderByDescending(m => m.Created_At_Utc)
            .FirstOrDefaultAsync();

        var participants = new List<ChatParticipantDto>();
        foreach (var p in c.Participants)
        {
            // MapUserToDto handles the rating and S3 avatars automatically
            var userDto = await MapUserToDto(p.User);
            participants.Add(new ChatParticipantDto(
                userDto.Id, 
                userDto.Name, 
                userDto.Role, 
                userDto.AvatarUrl, 
                userDto.Rating));
        }

        Enum.TryParse<ConversationType>(c.Type.Replace("_", ""), true, out var typeEnum);

        return new ConversationDto(
            c.Id,
            typeEnum,
            c.Created_At_Utc,
            c.Last_Message_At_Utc,
            c.Participants.FirstOrDefault(p => p.User_Id == currentUserId)?.Unread_Count ?? 0,
            lastMsg != null ? MapMessageToDto(lastMsg) : null,
            participants
        );
    }

    #endregion
}