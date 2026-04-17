namespace backend.Constants;

public enum ConversationType { JobChat, AdminSupport }

public enum ConversationStatus { Active, Locked }

public enum MessageType { Text, Image, System }

// public enum ModerationActionType 
// {
//     LockConversation,
//     UnlockConversation,
//     HideMessage,
//     UnhideMessage,
//     FlagMessage
// }

public static class MessageConstants
{
    // public static string ToDbString(this ConversationType type) => type switch
    // {
    //     ConversationType.JobChat => "job_chat",
    //     ConversationType.AdminSupport => "admin_support",
    //     _ => type.ToString().ToLower()
    // };

    public static string ToDbString(this ConversationStatus status) => status.ToString().ToLower();

    public static string ToDbString(this MessageType type) => type.ToString().ToLower();

    // public static string ToDbString(this ModerationActionType type) => type switch
    // {
    //     ModerationActionType.LockConversation => "lock_conversation",
    //     ModerationActionType.UnlockConversation => "unlock_conversation",
    //     ModerationActionType.HideMessage => "hide_message",
    //     ModerationActionType.UnhideMessage => "unhide_message",
    //     ModerationActionType.FlagMessage => "flag_message",
    //     _ => type.ToString().ToLower()
    // };
}
