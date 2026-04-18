using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using backend.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class SupportMessageService(ServiceDependencies deps) : BaseService(deps), ISupportMessageService
{
    public async Task<ConversationDto> GetOrCreateSupportConversationAsync()
    {
        var currentUserId = await GetCurrentUserIdAsync();

        var existing = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => 
                c.Type == ConversationType.AdminSupport.ToString() && 
                c.Created_By_User_Id == currentUserId);

        if (existing != null) return await MapToConversationDto(existing, currentUserId);

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            Type = ConversationType.AdminSupport.ToString(),
            Created_By_User_Id = currentUserId,
            Status = ConversationStatus.Active.ToDbString()
        };

        Context.Conversations.Add(conversation);

        Context.Conversation_Participants.Add(new Conversation_Participant
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversation.Id,
            User_Id = currentUserId,
            Participant_Role = "customer"
        });

        await Context.SaveChangesAsync();
        return await GetConversationByIdAsync(conversation.Id);
    }

    public async Task<MessageDto> SendSupportMessageAsync(Guid conversationId, SendMessageRequest request)
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var currentUserRole = GetCurrentUserRole();

        var conv = await Context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId)
            ?? throw new HttpRequestException("Support chat not found.", null, HttpStatusCode.NotFound);

        var isParticipant = conv.Participants.Any(p => p.User_Id == currentUserId);
        if (!isParticipant && currentUserRole == UserRole.Admin.ToDbString())
        {
            Context.Conversation_Participants.Add(new Conversation_Participant {
                Id = Guid.NewGuid(), 
                Conversation_Id = conversationId, 
                User_Id = currentUserId, 
                Participant_Role = UserRole.Admin.ToDbString()
            });
            
            if (ChatHubContext != null)
            {
                await ChatHubContext.Clients.Group(UserRole.Admin.ToDbString())
                    .SendAsync("SupportChatTaken", new { conversationId, adminId = currentUserId });
            }
        }
        else if (!isParticipant) throw new HttpRequestException("Forbidden.", null, HttpStatusCode.Forbidden); 

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
        
        return MapMessageToDto(message);
    }

    public async Task<IEnumerable<ConversationDto>> GetSupportConversationsAsync()
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var role = GetCurrentUserRole();

        var query = Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .Where(c => c.Type == ConversationType.AdminSupport.ToString());

        if (role != UserRole.Admin.ToDbString())
        {
            query = query.Where(c => c.Created_By_User_Id == currentUserId);
        }

        var list = await query.OrderByDescending(c => c.Last_Message_At_Utc).ToListAsync();
        
        var results = new List<ConversationDto>();
        foreach (var c in list) results.Add(await MapToConversationDto(c, currentUserId));
        return results;
    }

    public async Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId)
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var role = GetCurrentUserRole();

        var conv = await Context.Conversations.FindAsync(conversationId);
        
        if (role != UserRole.Admin.ToDbString() && conv?.Created_By_User_Id != currentUserId)
            throw new HttpRequestException("Forbidden.", null, HttpStatusCode.Forbidden);

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
    }

    private async Task<ConversationDto> GetConversationByIdAsync(Guid id)
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var c = await Context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == id) ?? throw new KeyNotFoundException();
        return await MapToConversationDto(c, currentUserId);
    }

    public async Task<int> GetTotalUnreadCountAsync()
    {
        var currentUserId = await GetCurrentUserIdAsync();
        var currentUserRole = GetCurrentUserRole();

        var joinedUnread = await Context.Conversation_Participants
            .Where(p => p.User_Id == currentUserId && p.Conversation.Type == ConversationType.AdminSupport.ToString())
            .SumAsync(p => p.Unread_Count);

        if (currentUserRole == UserRole.Admin.ToDbString())
        {
            var unassignedUnread = await Context.Conversations
                .Where(c => c.Type == ConversationType.AdminSupport.ToString() && 
                            !c.Participants.Any(p => p.Participant_Role == UserRole.Admin.ToDbString()))
                .CountAsync();

            return joinedUnread + unassignedUnread;
        }

        return joinedUnread;
    }
    
    private async Task<ConversationDto> MapToConversationDto(Conversation c, Guid currentUserId)
    {
        var currentUserRole = GetCurrentUserRole();
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

        int displayUnread = 0;
        var myParticipantRecord = c.Participants.FirstOrDefault(p => p.User_Id == currentUserId);

        if (myParticipantRecord != null) displayUnread = myParticipantRecord.Unread_Count;
        
        else if (currentUserRole == UserRole.Admin.ToDbString())
        {
            bool hasAnyAdminJoined = c.Participants.Any(p => p.Participant_Role == UserRole.Admin.ToDbString());
            if (!hasAnyAdminJoined) displayUnread = 1; 
        }

        var participants = new List<ChatParticipantDto>();
        foreach (var p in c.Participants)
        {
            var userDto = await MapUserToDto(p.User);
            participants.Add(new ChatParticipantDto(userDto.Id, userDto.Name, userDto.Role, userDto.AvatarUrl, userDto.Rating));
        }

        Enum.TryParse<ConversationType>(c.Type.Replace("_", ""), true, out var typeEnum);

        return new ConversationDto(
            c.Id, 
            typeEnum, 
            c.Related_Job_Id,
            relatedJobTitle,
            c.Created_At_Utc, 
            c.Last_Message_At_Utc,
            displayUnread,
            lastMsg != null ? MapMessageToDto(lastMsg) : null,
            participants
        );
    }
}