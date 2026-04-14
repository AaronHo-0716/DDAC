using backend.Constants;

namespace backend.Models.DTOs;

public record CreateJobChatRequest(Guid JobId, Guid BidId, Guid OtherUserId);
public record CreateSupportChatRequest(Guid? TargetUserId); 
public record SendMessageRequest(string BodyText, string? ClientMessageId = null);

public record ConversationDto(
    Guid Id,
    string Type,
    string Status,
    DateTime CreatedAtUtc,
    DateTime? LastMessageAtUtc,
    int UnreadCount,
    MessageDto? LastMessage,
    List<ParticipantDto> Participants
);

public record ParticipantDto(Guid UserId, string Name, UserRole Role, string? AvatarUrl);

public record MessageDto(
    Guid Id,
    Guid SenderId,
    string MessageType,
    string BodyText,
    DateTime CreatedAtUtc,
    bool IsEdited,
    bool IsDeleted,
    string? ClientMessageId
);

public record UnreadGroupDto(Guid ConversationId, int UnreadCount);

public record ModerationActionDto(
    Guid Id,
    Guid? MessageId,
    Guid ConversationId,
    Guid AdminUserId,
    string ActionType,
    string? Reason,
    DateTime CreatedAtUtc
);

public record FlagMessageRequest(string Reason);