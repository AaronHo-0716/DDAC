using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class MessageService(ServiceDependencies deps) : BaseService(deps), IMessageService
{
    public async Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request, Guid userId)
    {
        var bid = await Context.Bids.Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == request.BidId && b.Job_Id == request.JobId)
            ?? throw new HttpRequestException("Bid/Job relation not found.", null, HttpStatusCode.NotFound);

        if (bid.Handyman_User_Id != userId && bid.Job.Posted_By_User_Id != userId)
            throw new HttpRequestException("Forbidden.", null, HttpStatusCode.Forbidden);

        var existing = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Related_Bid_Id == request.BidId);

        if (existing != null) return await MapToConversationDto(existing, userId);

        var conversation = new Conversation {
            Id = Guid.NewGuid(), Type = ConversationType.JobChat.ToDbString(),
            Related_Job_Id = request.JobId, Related_Bid_Id = request.BidId,
            Created_By_User_Id = userId, Status = ConversationStatus.Active.ToDbString()
        };

        Context.Conversations.Add(conversation);
        Context.Conversation_Participants.AddRange(new[] {
            new Conversation_Participant { Id = Guid.NewGuid(), Conversation_Id = conversation.Id, User_Id = bid.Handyman_User_Id, Participant_Role = UserRole.Handyman.ToDbString() },
            new Conversation_Participant { Id = Guid.NewGuid(), Conversation_Id = conversation.Id, User_Id = bid.Job.Posted_By_User_Id, Participant_Role = UserRole.Homeowner.ToDbString() }
        });

        await Context.SaveChangesAsync();
        return await GetConversationByIdAsync(conversation.Id, userId);
    }

    public async Task<ConversationDto> GetOrCreateSupportConversationAsync(Guid userId)
    {
        var existing = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Type == ConversationType.AdminSupport.ToDbString() && c.Created_By_User_Id == userId);

        if (existing != null) return await MapToConversationDto(existing, userId);

        var conversation = new Conversation {
            Id = Guid.NewGuid(), Type = ConversationType.AdminSupport.ToDbString(),
            Created_By_User_Id = userId, Status = ConversationStatus.Active.ToDbString()
        };

        Context.Conversations.Add(conversation);
        Context.Conversation_Participants.Add(new Conversation_Participant { 
            Id = Guid.NewGuid(), Conversation_Id = conversation.Id, User_Id = userId, Participant_Role = "customer" 
        });

        await Context.SaveChangesAsync();
        return await GetConversationByIdAsync(conversation.Id, userId);
    }

    public async Task<MessageDto> SendMessageAsync(Guid conversationId, Guid userId, SendMessageRequest request)
    {
        var conv = await Context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId) 
            ?? throw new HttpRequestException("Conversation not found", null, HttpStatusCode.NotFound);

        var isParticipant = conv.Participants.Any(p => p.User_Id == userId);
        if (!isParticipant) {
            var user = await Context.Users.FindAsync(userId);
            if (user?.Role == UserRole.Admin.ToDbString()) {
                Context.Conversation_Participants.Add(new Conversation_Participant { 
                    Id = Guid.NewGuid(), Conversation_Id = conversationId, User_Id = userId, Participant_Role = UserRole.Admin.ToDbString()
                });
            } else throw new HttpRequestException("Forbidden", null, HttpStatusCode.Forbidden);
        }

        var msg = new Message {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Sender_User_Id = userId,
            Message_Type = request.MessageType.ToDbString(),
            Body_Text = request.Content,
            Created_At_Utc = DateTime.UtcNow
        };

        Context.Messages.Add(msg);
        conv.Last_Message_At_Utc = DateTime.UtcNow;

        await Context.Conversation_Participants
            .Where(p => p.Conversation_Id == conversationId && p.User_Id != userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Unread_Count, p => p.Unread_Count + 1));

        await Context.SaveChangesAsync();

        var dto = MapMessageToDto(msg);

        var targetIds = conv.Participants.Select(p => p.User_Id.ToString()).ToList();
        if (conv.Type == ConversationType.AdminSupport.ToDbString()) {
            await ChatHubContext.Clients.Group(UserRole.Admin.ToDbString()).SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });
        }
        await ChatHubContext.Clients.Groups(targetIds).SendAsync(HubMethod.ReceiveMessage.ToString(), new { convId = conversationId, message = dto });

        return dto;
    }
    
    public async Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid userId, string role)
    {
        var query = Context.Conversations.Include(c => c.Participants).ThenInclude(p => p.User).AsQueryable();

        if (role == UserRole.Admin.ToDbString())
            query = query.Where(c => c.Type == ConversationType.AdminSupport.ToDbString() || c.Participants.Any(p => p.User_Id == userId));
        else
            query = query.Where(c => c.Participants.Any(p => p.User_Id == userId));

        var list = await query.OrderByDescending(c => c.Last_Message_At_Utc).ToListAsync();
        var results = new List<ConversationDto>();
        foreach (var c in list) results.Add(await MapToConversationDto(c, userId));
        return results;
    }

    public async Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, Guid userId)
    {
        var messages = await Context.Messages
            .Where(m => m.Conversation_Id == conversationId)
            .OrderBy(m => m.Created_At_Utc).ToListAsync();
        return messages.Select(MapMessageToDto);
    }

    public async Task MarkAsReadAsync(Guid conversationId, Guid userId)
    {
        await Context.Conversation_Participants
            .Where(p => p.Conversation_Id == conversationId && p.User_Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Unread_Count, 0));
    }

    public async Task<int> GetTotalUnreadCountAsync(Guid userId) =>
        await Context.Conversation_Participants.Where(p => p.User_Id == userId).SumAsync(p => p.Unread_Count);

    public async Task<ConversationDto> GetConversationByIdAsync(Guid id, Guid userId)
    {
        var c = await Context.Conversations.Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == id) ?? throw new HttpRequestException("Not found", null, HttpStatusCode.NotFound);
        return await MapToConversationDto(c, userId);
    }

    private async Task<ConversationDto> MapToConversationDto(Conversation c, Guid userId)
    {
        var lastMsg = await Context.Messages.Where(m => m.Conversation_Id == c.Id).OrderByDescending(m => m.Created_At_Utc).FirstOrDefaultAsync();
        
        return new ConversationDto(
            c.Id, Enum.Parse<ConversationType>(c.Type.Replace("_", ""), true),
            c.Created_At_Utc, c.Last_Message_At_Utc,
            c.Participants.FirstOrDefault(p => p.User_Id == userId)?.Unread_Count ?? 0,
            lastMsg != null ? MapMessageToDto(lastMsg) : null,
            c.Participants.Select(p => new ChatParticipantDto(p.User_Id, p.User.Name, Enum.Parse<UserRole>(p.User.Role, true), GetPresignedUrl(p.User.AvatarUrl), p.User.Rating)).ToList()
        );
    }
}