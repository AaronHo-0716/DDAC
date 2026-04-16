namespace backend.Models.Entities;

public class Conversation_Participant
{
    public Guid Id { get; set; }
    public Guid Conversation_Id { get; set; }
    public Guid User_Id { get; set; }
    public string Participant_Role { get; set; } = null!;
    public int Unread_Count { get; set; } = 0;
    public DateTime Joined_At_Utc { get; set; } = DateTime.UtcNow;

    // Navigation Properties
    public virtual Conversation Conversation { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}