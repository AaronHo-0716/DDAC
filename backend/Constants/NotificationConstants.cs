namespace backend.Constants;

public enum NotificationType { 
    NewHandymanRegistration,
    NewUserReport,
    VerificationResult,
    BidReceived,
    BidAccepted,
    BidRejected,
    SystemMessage,
    ResubmitVerification
}

public static class NotificationConstants
{
    public static string ToDbString(this NotificationType type) => type switch
    {
        NotificationType.NewHandymanRegistration => "new_handyman_registration",
        NotificationType.NewUserReport => "new_user_report",
        NotificationType.VerificationResult => "verification_result",
        NotificationType.BidReceived => "bid_received",
        NotificationType.BidAccepted => "bid_accepted",
        NotificationType.BidRejected => "bid_rejected",
        NotificationType.SystemMessage => "system_message",
        NotificationType.ResubmitVerification => "resubmmit_verification",
        _ => type.ToString().ToLower()
    };

    public static NotificationType ParseFromDb(string type)
    {
        var cleanType = type.Replace("_", "");
        return Enum.TryParse<NotificationType>(cleanType, true, out var result) 
            ? result 
            : NotificationType.SystemMessage;
    }
}