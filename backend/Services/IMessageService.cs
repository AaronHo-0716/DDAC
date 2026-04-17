using backend.Models.DTOs;

namespace backend.Services;

public interface IMessageService
{
    Task<ConversationDto> GetOrCreateJobConversationAsync(CreateJobChatRequest request);
    Task<ConversationDto> GetOrCreateSupportConversationAsync();
    Task<MessageDto> SendMessageAsync(Guid conversationId, SendMessageRequest request);
    Task<IEnumerable<ConversationDto>> GetUserConversationsAsync();
    Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId);
    Task MarkAsReadAsync(Guid conversationId);
    Task<int> GetTotalUnreadCountAsync();
    Task<ConversationDto> GetConversationByIdAsync(Guid id);
}
