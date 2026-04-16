namespace backend.Models.Entities;

public class Conversation
{
    public Guid Id { get; set; }
    public string Type { get; set; } = null!; // job_chat, admin_support
    public Guid? Related_Job_Id { get; set; }
    public Guid? Related_Bid_Id { get; set; }
    public Guid Created_By_User_Id { get; set; }
    public string Status { get; set; } = "active";
    public DateTime Created_At_Utc { get; set; } = DateTime.UtcNow;
    public DateTime? Last_Message_At_Utc { get; set; }

    // Navigation Properties
    public virtual Job? Related_Job { get; set; }
    public virtual Bid? Related_Bid { get; set; }
    public virtual User Created_By_User { get; set; } = null!;
    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();
    public virtual ICollection<Conversation_Participant> Participants { get; set; } = new List<Conversation_Participant>();
}