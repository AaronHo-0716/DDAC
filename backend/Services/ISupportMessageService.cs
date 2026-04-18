using backend.Models.DTOs;

namespace backend.Services;

public interface ISupportMessageService
{
    Task<ConversationDto> GetOrCreateSupportConversationAsync();
    Task<MessageDto> SendSupportMessageAsync(Guid conversationId, SendMessageRequest request);
    Task<IEnumerable<ConversationDto>> GetSupportConversationsAsync();
    Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId);
    Task MarkAsReadAsync(Guid conversationId);
    Task<int> GetTotalUnreadCountAsync();
}