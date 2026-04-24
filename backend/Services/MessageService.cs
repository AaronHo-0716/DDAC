using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Microsoft.AspNetCore.SignalR;

namespace backend.Services;

public class MessageService(ServiceDependencies deps) : BaseService(deps), IMessageService
{
    public async Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request)
    {
        var currentUserId = await GetCurrentUserIdAsync();

        var job = await Context.Jobs.FindAsync(request.JobId)
            ?? throw new HttpRequestException("Job not found.", null, HttpStatusCode.NotFound);

        Guid homeownerId = job.Posted_By_User_Id;
        Guid handymanId;

        if (currentUserId == homeownerId)
        {
            handymanId = request.OtherUserId;
            var hasBid = await Context.Bids.AnyAsync(b => b.Job_Id == job.Id && b.Handyman_User_Id == handymanId);
            
            if (!hasBid)
                throw new HttpRequestException("This user has not placed a bid on your job.", null, HttpStatusCode.Forbidden);
        }
        else
        {
            handymanId = currentUserId;
            
            if (request.OtherUserId != homeownerId)
                throw new HttpRequestException("You can only start a chat with the owner of this job.", null, HttpStatusCode.Forbidden);

            var myBid = await Context.Bids.AnyAsync(b => b.Job_Id == job.Id && b.Handyman_User_Id == handymanId);
            if (!myBid)
                throw new HttpRequestException("You must place a bid on this job before you can message the owner.", null, HttpStatusCode.Forbidden);
        }

        var existing = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => 
                c.Type == ConversationType.JobChat.ToString() && 
                c.Related_Job_Id == job.Id &&
                c.Participants.Any(p => p.User_Id == homeownerId) &&
                c.Participants.Any(p => p.User_Id == handymanId));

        if (existing != null) return await MapToConversationDto(existing, currentUserId);

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            Type = ConversationType.JobChat.ToString(),
            Related_Job_Id = job.Id,
            Created_By_User_Id = currentUserId,
            Status = ConversationStatus.Active.ToDbString()
        };

        Context.Conversations.Add(conversation);

        var participants = new[] { homeownerId, handymanId };
        foreach (var pId in participants)
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
        
        await Context.SaveChangesAsync();

        var dto = MapMessageToDto(message);

        var targetIds = conv.Participants.Select(p => p.User_Id.ToString()).ToList();
        await ChatHubContext.Clients.Groups(targetIds)
            .SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });

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
            .Where(c => c.Type == ConversationType.JobChat.ToString())
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

    public async Task MarkAsReadAsync(Guid conversationId) => await base.MarkAsReadAsync(conversationId);

    public async Task<int> GetTotalUnreadCountAsync()
    {
        var currentUserId = await GetCurrentUserIdAsync();

        return await Context.Conversation_Participants
            .Where(p => p.User_Id == currentUserId && 
                        p.Conversation.Type == ConversationType.JobChat.ToString())
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

    private async Task<ConversationDto> MapToConversationDto(Conversation c, Guid currentUserId)
    {
        var lastMsg = await Context.Messages
            .Where(m => m.Conversation_Id == c.Id)
            .OrderByDescending(m => m.Created_At_Utc)
            .FirstOrDefaultAsync();

        string? relatedJobTitle = c.Related_Job?.Title;
        if (relatedJobTitle is null && c.Related_Job_Id.HasValue)
        {
            relatedJobTitle = await Context.Jobs
                .Where(j => j.Id == c.Related_Job_Id.Value)
                .Select(j => j.Title)
                .FirstOrDefaultAsync();
        }

        var participants = new List<ChatParticipantDto>();
        foreach (var p in c.Participants)
        {
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
            c.Related_Job_Id,
            relatedJobTitle,
            c.Created_At_Utc,
            c.Last_Message_At_Utc,
            c.Participants.FirstOrDefault(p => p.User_Id == currentUserId)?.Unread_Count ?? 0,
            lastMsg != null ? MapMessageToDto(lastMsg) : null,
            participants
        );
    }
}