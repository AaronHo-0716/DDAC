using backend.Models.DTOs;

namespace backend.Services;

public interface IMessageService
{
    Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request, Guid userId);
    Task<ConversationDto> GetOrCreateSupportConversationAsync(CreateSupportChatRequest request, Guid userId, string userRole);
    Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid userId);
    Task<ConversationDto> GetConversationByIdAsync(Guid conversationId, Guid userId);
    Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, Guid userId, int limit = 50);
    Task<MessageDto> SendMessageAsync(Guid conversationId, Guid userId, SendMessageRequest request);
    Task MarkAsReadAsync(Guid conversationId, Guid userId);
    Task<int> GetTotalUnreadCountAsync(Guid userId);
    Task<IEnumerable<UnreadGroupDto>> GetUnreadCountsByConversationAsync(Guid userId);
    // Admin Moderation Methods
    Task LockConversationAsync(Guid conversationId, string reason, Guid adminId);
    Task UnlockConversationAsync(Guid conversationId, Guid adminId);
    Task HideMessageAsync(Guid messageId, string reason, Guid adminId);
    Task UnhideMessageAsync(Guid messageId, Guid adminId);
    Task FlagMessageAsync(Guid messageId, string reason, Guid adminId);
    Task<IEnumerable<ModerationActionDto>> GetModerationActionsAsync();
}
