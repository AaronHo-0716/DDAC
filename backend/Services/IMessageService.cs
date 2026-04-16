using backend.Models.DTOs;

namespace backend.Services;

public interface IMessageService
{
    Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request, Guid userId);
    Task<ConversationDto> GetOrCreateSupportConversationAsync(Guid userId);
    Task<MessageDto> SendMessageAsync(Guid conversationId, Guid userId, SendMessageRequest request);
    Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid userId, string role);
    Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, Guid userId);
    Task MarkAsReadAsync(Guid conversationId, Guid userId);
    Task<int> GetTotalUnreadCountAsync(Guid userId);
    Task<ConversationDto> GetConversationByIdAsync(Guid id, Guid userId);
}
