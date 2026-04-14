using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class MessageService(NeighbourHelpDbContext context, ILogger<MessageService> logger) : IMessageService
{
    public async Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request, Guid userId)
    {
        // 1. Security: Validate Job/Bid relation
        var bid = await context.Bids
            .Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == request.BidId && b.Job_Id == request.JobId)
            ?? throw new HttpRequestException("The specified job/bid relation does not exist.", null, HttpStatusCode.NotFound);

        bool isAuthorized = (bid.Handyman_User_Id == userId && bid.Job.Posted_By_User_Id == request.OtherUserId) ||
                            (bid.Handyman_User_Id == request.OtherUserId && bid.Job.Posted_By_User_Id == userId);

        if (!isAuthorized) 
            throw new HttpRequestException("You are not authorized to start a chat for this bid.", null, HttpStatusCode.Forbidden);

        // 2. Check existing
        var dbType = ConversationType.JobChat.ToDbString();
        var existing = await context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Type == dbType && c.Related_Bid_Id == request.BidId);

        if (existing != null) return await MapToDto(existing, userId);

        // 3. Create new
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            Type = dbType,
            Related_Job_Id = request.JobId,
            Related_Bid_Id = request.BidId,
            Created_By_User_Id = userId,
            Status = ConversationStatus.Active.ToDbString()
        };

        context.Conversations.Add(conversation);
        
        var participantIds = new[] { userId, request.OtherUserId };
        foreach (var pId in participantIds)
        {
            var user = await context.Users.FindAsync(pId) 
                ?? throw new HttpRequestException($"User {pId} not found.", null, HttpStatusCode.NotFound);

            context.Conversation_Participants.Add(new Conversation_Participant
            {
                Id = Guid.NewGuid(),
                Conversation_Id = conversation.Id,
                User_Id = pId,
                Participant_Role = user.Role
            });
        }

        await context.SaveChangesAsync();
        return await MapToDto(conversation, userId);
    }

    public async Task<ConversationDto> GetOrCreateSupportConversationAsync(CreateSupportChatRequest request, Guid userId, string userRole)
    {
        Guid targetUserId = (userRole == UserRole.Admin.ToDbString() && request.TargetUserId.HasValue) 
            ? request.TargetUserId.Value 
            : userId;

        var dbType = ConversationType.AdminSupport.ToDbString();
        var existing = await context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Type == dbType && c.Participants.Any(p => p.User_Id == targetUserId));

        if (existing != null) return await MapToDto(existing, userId);

        var conversation = new Conversation 
        { 
            Id = Guid.NewGuid(), 
            Type = dbType, 
            Created_By_User_Id = userId,
            Status = ConversationStatus.Active.ToDbString()
        };
        context.Conversations.Add(conversation);
        
        context.Conversation_Participants.Add(new Conversation_Participant { 
            Id = Guid.NewGuid(), Conversation_Id = conversation.Id, User_Id = targetUserId, Participant_Role = "customer" 
        });

        await context.SaveChangesAsync();
        return await MapToDto(conversation, userId);
    }

    public async Task<MessageDto> SendMessageAsync(Guid conversationId, Guid userId, SendMessageRequest request)
    {
        var conversation = await context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId)
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        if (conversation.Status == ConversationStatus.Locked.ToDbString()) 
            throw new HttpRequestException("Conversation is locked and cannot receive messages.", null, HttpStatusCode.BadRequest);

        if (!conversation.Participants.Any(p => p.User_Id == userId)) 
            throw new HttpRequestException("Access denied.", null, HttpStatusCode.Forbidden);

        if (!string.IsNullOrEmpty(request.ClientMessageId))
        {
            var existing = await context.Messages.FirstOrDefaultAsync(m => m.Conversation_Id == conversationId && m.Client_Message_Id == request.ClientMessageId);
            if (existing != null) return MapToMessageDto(existing);
        }

        var message = new Message
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Sender_User_Id = userId,
            Body_Text = request.BodyText,
            Message_Type = MessageType.Text.ToDbString(),
            Client_Message_Id = request.ClientMessageId,
            Created_At_Utc = DateTime.UtcNow
        };

        context.Messages.Add(message);
        conversation.Last_Message_At_Utc = DateTime.UtcNow;

        var others = await context.Conversation_Participants
            .Where(p => p.Conversation_Id == conversationId && p.User_Id != userId)
            .ToListAsync();
        others.ForEach(o => o.Unread_Count++);

        await context.SaveChangesAsync();
        return MapToMessageDto(message);
    }

    public async Task MarkAsReadAsync(Guid conversationId, Guid userId)
    {
        var participant = await context.Conversation_Participants
            .FirstOrDefaultAsync(p => p.Conversation_Id == conversationId && p.User_Id == userId);

        if (participant == null) return;

        participant.Unread_Count = 0;
        participant.Last_Read_Message_Id = await context.Messages
            .Where(m => m.Conversation_Id == conversationId)
            .OrderByDescending(m => m.Created_At_Utc)
            .Select(m => m.Id)
            .FirstOrDefaultAsync();

        await context.SaveChangesAsync();
    }

    public async Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid userId)
    {
        var conversations = await context.Conversation_Participants
            .Where(p => p.User_Id == userId)
            .Include(p => p.Conversation).ThenInclude(c => c.Participants).ThenInclude(cp => cp.User)
            .OrderByDescending(p => p.Conversation.Last_Message_At_Utc)
            .Select(p => p.Conversation)
            .ToListAsync();

        var results = new List<ConversationDto>();
        foreach (var c in conversations) results.Add(await MapToDto(c, userId));
        return results;
    }

    public async Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, Guid userId, int limit = 50)
    {
        var isParticipant = await context.Conversation_Participants.AnyAsync(p => p.Conversation_Id == conversationId && p.User_Id == userId);
        if (!isParticipant) throw new HttpRequestException("Access denied.", null, HttpStatusCode.Forbidden);

        var messages = await context.Messages
            .Where(m => m.Conversation_Id == conversationId && !m.Is_Deleted)
            .OrderByDescending(m => m.Created_At_Utc)
            .Take(limit)
            .ToListAsync();

        return messages.Select(MapToMessageDto);
    }

    public async Task<ConversationDto> GetConversationByIdAsync(Guid conversationId, Guid userId)
    {
        var conv = await context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == conversationId)
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        return await MapToDto(conv, userId);
    }

    public async Task<int> GetTotalUnreadCountAsync(Guid userId) 
        => await context.Conversation_Participants.Where(p => p.User_Id == userId).SumAsync(p => p.Unread_Count);

    public async Task<IEnumerable<UnreadGroupDto>> GetUnreadCountsByConversationAsync(Guid userId)
        => await context.Conversation_Participants
            .Where(p => p.User_Id == userId && p.Unread_Count > 0)
            .Select(p => new UnreadGroupDto(p.Conversation_Id, p.Unread_Count))
            .ToListAsync();

    public async Task LockConversationAsync(Guid conversationId, string reason, Guid adminId)
    {
        var conv = await context.Conversations.FindAsync(conversationId) 
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        using var transaction = await context.Database.BeginTransactionAsync();
        
        conv.Status = ConversationStatus.Locked.ToDbString();

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Admin_User_Id = adminId,
            Action_Type = ModerationActionType.LockConversation.ToDbString(),
            Reason = reason,
            Created_At_Utc = DateTime.UtcNow
        });

        context.Admin_Actions.Add(new Admin_Action
        {
            Id = Guid.NewGuid(),
            Admin_User_Id = adminId,
            Action_Type = "CONVERSATION_LOCK",
            Target_Type = "CONVERSATION",
            Target_Id = conversationId,
            Reason = reason,
            Payload = "{}",
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task UnlockConversationAsync(Guid conversationId, Guid adminId)
    {
        var conv = await context.Conversations.FindAsync(conversationId) 
            ?? throw new HttpRequestException("Conversation not found.", null, HttpStatusCode.NotFound);

        conv.Status = ConversationStatus.Active.ToDbString();

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Admin_User_Id = adminId,
            Action_Type = ModerationActionType.UnlockConversation.ToDbString(),
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    public async Task HideMessageAsync(Guid messageId, string reason, Guid adminId)
    {
        var msg = await context.Messages.FindAsync(messageId) 
            ?? throw new HttpRequestException("Message not found.", null, HttpStatusCode.NotFound);

        using var transaction = await context.Database.BeginTransactionAsync();

        msg.Is_Deleted = true;
        msg.Deleted_At_Utc = DateTime.UtcNow;

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Message_Id = messageId,
            Conversation_Id = msg.Conversation_Id,
            Admin_User_Id = adminId,
            Action_Type = ModerationActionType.HideMessage.ToDbString(),
            Reason = reason,
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task UnhideMessageAsync(Guid messageId, Guid adminId)
    {
        var msg = await context.Messages.FindAsync(messageId) 
            ?? throw new HttpRequestException("Message not found.", null, HttpStatusCode.NotFound);

        msg.Is_Deleted = false;
        msg.Deleted_At_Utc = null;

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Message_Id = messageId,
            Conversation_Id = msg.Conversation_Id,
            Admin_User_Id = adminId,
            Action_Type = ModerationActionType.UnhideMessage.ToDbString(),
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    public async Task FlagMessageAsync(Guid messageId, string reason, Guid adminId)
    {
        var msg = await context.Messages.FindAsync(messageId) 
            ?? throw new HttpRequestException("Message not found.", null, HttpStatusCode.NotFound);

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Message_Id = messageId,
            Conversation_Id = msg.Conversation_Id,
            Admin_User_Id = adminId,
            Action_Type = ModerationActionType.FlagMessage.ToDbString(),
            Reason = reason,
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    public async Task<IEnumerable<ModerationActionDto>> GetModerationActionsAsync()
    {
        return await context.Message_Moderation_Actions
            .OrderByDescending(a => a.Created_At_Utc)
            .Select(a => new ModerationActionDto(
                a.Id, a.Message_Id, a.Conversation_Id, a.Admin_User_Id, a.Action_Type, a.Reason, a.Created_At_Utc
            ))
            .ToListAsync();
    }

    private async Task<ConversationDto> MapToDto(Conversation c, Guid userId)
    {
        var lastMsg = await context.Messages
            .Where(m => m.Conversation_Id == c.Id && !m.Is_Deleted)
            .OrderByDescending(m => m.Created_At_Utc)
            .FirstOrDefaultAsync();

        var myParticipant = c.Participants.FirstOrDefault(p => p.User_Id == userId);
        
        Enum.TryParse<ConversationType>(c.Type.Replace("_", ""), true, out var typeEnum);
        Enum.TryParse<ConversationStatus>(c.Status, true, out var statusEnum);

        return new ConversationDto(
            c.Id, typeEnum.ToDbString(), statusEnum.ToDbString(), c.Created_At_Utc, c.Last_Message_At_Utc,
            myParticipant?.Unread_Count ?? 0,
            lastMsg != null ? MapToMessageDto(lastMsg) : null,
            c.Participants.Select(p => {
                Enum.TryParse<UserRole>(p.User.Role, true, out var r);
                return new ParticipantDto(p.User_Id, p.User.Name, r, p.User.AvatarUrl);
            }).ToList()
        );
    }

    private static MessageDto MapToMessageDto(Message m)
    {
        Enum.TryParse<MessageType>(m.Message_Type, true, out var typeEnum);
        return new MessageDto(
            m.Id, m.Sender_User_Id, typeEnum.ToDbString(), m.Is_Deleted ? "[Hidden]" : m.Body_Text,
            m.Created_At_Utc, m.Is_Edited, m.Is_Deleted, m.Client_Message_Id
        );
    }
}