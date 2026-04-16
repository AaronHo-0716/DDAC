namespace backend.Models.Entities;

public class Message
{
    public Guid Id { get; set; }
    public Guid Conversation_Id { get; set; }
    public Guid Sender_User_Id { get; set; }
    public string Message_Type { get; set; } = "text"; // text, image
    public string Body_Text { get; set; } = null!;
    public DateTime Created_At_Utc { get; set; } = DateTime.UtcNow;

    // Navigation Properties
    public virtual Conversation Conversation { get; set; } = null!;
    public virtual User Sender_User { get; set; } = null!;
}