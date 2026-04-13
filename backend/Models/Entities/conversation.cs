using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace backend.Models.Entities;

public partial class Conversation
{
    [Key]
    public Guid Id { get; set; }

    // Design: conversation_type (e.g., 'job_chat', 'admin_support')
    public string Type { get; set; } = null!;

    public Guid? Related_Job_Id { get; set; }

    public Guid? Related_Bid_Id { get; set; }

    public Guid Created_By_User_Id { get; set; }

    // Design: conversation_status (e.g., 'active', 'locked', 'closed')
    public string Status { get; set; } = "active";

    public DateTime Created_At_Utc { get; set; } = DateTime.UtcNow;

    public DateTime? Last_Message_At_Utc { get; set; }

    public DateTime? Closed_At_Utc { get; set; }

    // Navigation Properties
    public virtual User Created_By_User { get; set; } = null!;
    public virtual Job? Related_Job { get; set; }
    public virtual Bid? Related_Bid { get; set; }
    public virtual ICollection<Conversation_Participant> Participants { get; set; } = new List<Conversation_Participant>();
    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();
    public virtual ICollection<Message_Moderation_Action> Moderation_Actions { get; set; } = new List<Message_Moderation_Action>();
}
