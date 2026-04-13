using System;
using System.ComponentModel.DataAnnotations;

namespace backend.Models.Entities;

public partial class Message_Moderation_Action
{
    [Key]
    public Guid Id { get; set; }

    public Guid? Message_Id { get; set; }

    public Guid Conversation_Id { get; set; }

    public Guid Admin_User_Id { get; set; }

    // Design: message_moderation_action_type (e.g., 'lock', 'hide', 'flag')
    public string Action_Type { get; set; } = null!;

    public string? Reason { get; set; }

    // Design: JSONB field
    public string Payload { get; set; } = "{}";

    public DateTime Created_At_Utc { get; set; } = DateTime.UtcNow;

    // Navigation Properties
    public virtual Message? Message { get; set; }
    public virtual Conversation Conversation { get; set; } = null!;
    public virtual User Admin_User { get; set; } = null!;
}
