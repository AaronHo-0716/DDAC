using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class MessageService(NeighbourHelpDbContext context, ILogger<MessageService> logger) : IMessageService
{
    public async Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request, Guid userId)
    {
        // 1. Security: Validate that the Bid and Job relation is legitimate
        var bid = await context.Bids
            .Include(b => b.Job)
            .FirstOrDefaultAsync(b => b.Id == request.BidId && b.Job_Id == request.JobId)
            ?? throw new KeyNotFoundException("The specified job/bid relation does not exist.");

        bool isAuthorized = (bid.Handyman_User_Id == userId && bid.Job.Posted_By_User_Id == request.OtherUserId) ||
                            (bid.Handyman_User_Id == request.OtherUserId && bid.Job.Posted_By_User_Id == userId);

        if (!isAuthorized) throw new UnauthorizedAccessException("You are not authorized to start a chat for this bid.");

        // 2. Check for existing conversation
        var existing = await context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Type == "job_chat" && c.Related_Bid_Id == request.BidId);

        if (existing != null) return await MapToDto(existing, userId);

        // 3. Create new if none exists
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            Type = "job_chat",
            Related_Job_Id = request.JobId,
            Related_Bid_Id = request.BidId,
            Created_By_User_Id = userId,
            Status = "active"
        };

        context.Conversations.Add(conversation);
        
        // Add both participants
        var participantIds = new[] { userId, request.OtherUserId };
        foreach (var pId in participantIds)
        {
            var user = await context.Users.FindAsync(pId);
            context.Conversation_Participants.Add(new Conversation_Participant
            {
                Id = Guid.NewGuid(),
                Conversation_Id = conversation.Id,
                User_Id = pId,
                Participant_Role = user!.Role
            });
        }

        await context.SaveChangesAsync();
        return await MapToDto(conversation, userId);
    }

    public async Task<ConversationDto> GetOrCreateSupportConversationAsync(CreateSupportChatRequest request, Guid userId, string userRole)
    {
        Guid targetUserId = (userRole == "admin" && request.TargetUserId.HasValue) 
            ? request.TargetUserId.Value 
            : userId;

        var existing = await context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Type == "admin_support" && c.Participants.Any(p => p.User_Id == targetUserId));

        if (existing != null) return await MapToDto(existing, userId);

        var conversation = new Conversation { Id = Guid.NewGuid(), Type = "admin_support", Created_By_User_Id = userId };
        context.Conversations.Add(conversation);
        
        // Logic: Add the user and a placeholder system/admin if needed, or just the user until an admin joins
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
            ?? throw new KeyNotFoundException("Conversation not found.");

        if (conversation.Status == "locked") throw new InvalidOperationException("Conversation is locked.");
        if (!conversation.Participants.Any(p => p.User_Id == userId)) throw new UnauthorizedAccessException();

        // Idempotency: prevent double-send
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
            Client_Message_Id = request.ClientMessageId
        };

        context.Messages.Add(message);
        conversation.Last_Message_At_Utc = DateTime.UtcNow;

        // Increment unread counts for others
        var others = await context.Conversation_Participants.Where(p => p.Conversation_Id == conversationId && p.User_Id != userId).ToListAsync();
        others.ForEach(o => o.Unread_Count++);

        await context.SaveChangesAsync();
        return MapToMessageDto(message);
    }

    public async Task MarkAsReadAsync(Guid conversationId, Guid userId)
    {
        var participant = await context.Conversation_Participants
            .FirstOrDefaultAsync(p => p.Conversation_Id == conversationId && p.User_Id == userId);

        if (participant != null)
        {
            participant.Unread_Count = 0;
            participant.Last_Read_Message_Id = await context.Messages
                .Where(m => m.Conversation_Id == conversationId)
                .OrderByDescending(m => m.Created_At_Utc)
                .Select(m => m.Id)
                .FirstOrDefaultAsync();

            await context.SaveChangesAsync();
        }
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
        if (!await context.Conversation_Participants.AnyAsync(p => p.Conversation_Id == conversationId && p.User_Id == userId))
            throw new UnauthorizedAccessException();

        return await context.Messages
            .Where(m => m.Conversation_Id == conversationId && !m.Is_Deleted)
            .OrderByDescending(m => m.Created_At_Utc)
            .Take(limit)
            .Select(m => MapToMessageDto(m))
            .ToListAsync();
    }

    public async Task<ConversationDto> GetConversationByIdAsync(Guid conversationId, Guid userId)
    {
        var conv = await context.Conversations
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == conversationId)
            ?? throw new KeyNotFoundException();

        return await MapToDto(conv, userId);
    }

    public async Task<int> GetTotalUnreadCountAsync(Guid userId) 
        => await context.Conversation_Participants.Where(p => p.User_Id == userId).SumAsync(p => p.Unread_Count);

    public async Task<IEnumerable<UnreadGroupDto>> GetUnreadCountsByConversationAsync(Guid userId)
        => await context.Conversation_Participants
            .Where(p => p.User_Id == userId && p.Unread_Count > 0)
            .Select(p => new UnreadGroupDto(p.Conversation_Id, p.Unread_Count))
            .ToListAsync();

    private async Task<ConversationDto> MapToDto(Conversation c, Guid userId)
    {
        var lastMsg = await context.Messages
            .Where(m => m.Conversation_Id == c.Id && !m.Is_Deleted)
            .OrderByDescending(m => m.Created_At_Utc)
            .FirstOrDefaultAsync();

        var myParticipant = c.Participants.FirstOrDefault(p => p.User_Id == userId);

        return new ConversationDto(
            c.Id, c.Type, c.Status, c.Created_At_Utc, c.Last_Message_At_Utc,
            myParticipant?.Unread_Count ?? 0,
            lastMsg != null ? MapToMessageDto(lastMsg) : null,
            c.Participants.Select(p => new ParticipantDto(p.User_Id, p.User.Name, p.User.Role, p.User.AvatarUrl)).ToList()
        );
    }

    private static MessageDto MapToMessageDto(Message m) => new(
        m.Id, m.Sender_User_Id, m.Message_Type, m.Is_Deleted ? "[Hidden]" : m.Body_Text,
        m.Created_At_Utc, m.Is_Edited, m.Is_Deleted, m.Client_Message_Id
    );

    public async Task LockConversationAsync(Guid conversationId, string reason, Guid adminId)
    {
        var conv = await context.Conversations.FindAsync(conversationId) 
            ?? throw new KeyNotFoundException("Conversation not found.");

        using var transaction = await context.Database.BeginTransactionAsync();
        
        conv.Status = "locked";

        var modAction = new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Admin_User_Id = adminId,
            Action_Type = "lock_conversation",
            Reason = reason,
            Created_At_Utc = DateTime.UtcNow
        };

        context.Message_Moderation_Actions.Add(modAction);

        // Global Admin Audit
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
            ?? throw new KeyNotFoundException("Conversation not found.");

        conv.Status = "active";

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Conversation_Id = conversationId,
            Admin_User_Id = adminId,
            Action_Type = "unlock_conversation",
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    public async Task HideMessageAsync(Guid messageId, string reason, Guid adminId)
    {
        var msg = await context.Messages.FindAsync(messageId) 
            ?? throw new KeyNotFoundException("Message not found.");

        using var transaction = await context.Database.BeginTransactionAsync();

        msg.Is_Deleted = true;
        msg.Deleted_At_Utc = DateTime.UtcNow;

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Message_Id = messageId,
            Conversation_Id = msg.Conversation_Id,
            Admin_User_Id = adminId,
            Action_Type = "hide_message",
            Reason = reason,
            Created_At_Utc = DateTime.UtcNow
        });

        context.Admin_Actions.Add(new Admin_Action
        {
            Id = Guid.NewGuid(),
            Admin_User_Id = adminId,
            Action_Type = "MESSAGE_HIDE",
            Target_Type = "MESSAGE",
            Target_Id = messageId,
            Reason = reason,
            Payload = "{}",
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task UnhideMessageAsync(Guid messageId, Guid adminId)
    {
        var msg = await context.Messages.FindAsync(messageId) 
            ?? throw new KeyNotFoundException("Message not found.");

        msg.Is_Deleted = false;
        msg.Deleted_At_Utc = null;

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Message_Id = messageId,
            Conversation_Id = msg.Conversation_Id,
            Admin_User_Id = adminId,
            Action_Type = "unhide_message",
            Created_At_Utc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    public async Task FlagMessageAsync(Guid messageId, string reason, Guid adminId)
    {
        var msg = await context.Messages.FindAsync(messageId) 
            ?? throw new KeyNotFoundException("Message not found.");

        context.Message_Moderation_Actions.Add(new Message_Moderation_Action
        {
            Id = Guid.NewGuid(),
            Message_Id = messageId,
            Conversation_Id = msg.Conversation_Id,
            Admin_User_Id = adminId,
            Action_Type = "flag_message",
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
}
