using backend.Constants;

namespace backend.Models.DTOs;

public record CreateJobChatRequest(Guid JobId, Guid BidId);
public record SendMessageRequest(
    string Content, 
    MessageType MessageType = MessageType.Text
);

public record UnreadCountResponse(int TotalUnread);

public record MessageDto(
    Guid Id,
    Guid SenderId,
    MessageType Type,
    string Content, 
    DateTime CreatedAtUtc
);

public record ChatParticipantDto(
    Guid UserId, 
    string Name, 
    string Role, 
    string? AvatarUrl, 
    decimal? AverageRating
);

public record ConversationDto(
    Guid Id,
    ConversationType Type,
    DateTime CreatedAtUtc,
    DateTime? LastMessageAtUtc,
    int UnreadCount,
    MessageDto? LastMessage,
    List<ChatParticipantDto> Participants
);