using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace backend.Models.Entities;

public partial class Message
{
    [Key]
    public Guid Id { get; set; }

    public Guid Conversation_Id { get; set; }

    public Guid Sender_User_Id { get; set; }

    // Design: message_type (e.g., 'text', 'image', 'system')
    public string Message_Type { get; set; } = "text";

    public string Body_Text { get; set; } = null!;

    // Design: JSONB field
    public string Metadata_Json { get; set; } = "{}";

    public bool Is_Edited { get; set; } = false;

    public DateTime? Edited_At_Utc { get; set; }

    public bool Is_Deleted { get; set; } = false;

    public DateTime? Deleted_At_Utc { get; set; }

    public DateTime Created_At_Utc { get; set; } = DateTime.UtcNow;

    public string? Client_Message_Id { get; set; }

    // Navigation Properties
    public virtual Conversation Conversation { get; set; } = null!;
    public virtual User Sender_User { get; set; } = null!;
    public virtual ICollection<Message_Moderation_Action> Moderation_Actions { get; set; } = new List<Message_Moderation_Action>();
}
