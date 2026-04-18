namespace backend.Constants;

public enum NotificationType { 
    NewHandymanRegistration,
    NewUserReport,
    VerificationResult,
    BidReceived,
    BidAccepted,
    BidRejected,
    SystemMessage,
    ResubmitVerification,
    NewRating,
    UpdateRating,
    ReportResolved,
    ReportReviewed
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
        NotificationType.NewRating => "new_rating",
        NotificationType.UpdateRating => "rating_update",
        NotificationType.ReportResolved => "report_resolved",
        NotificationType.ReportReviewed => "report_reviewed",
        _ => type.ToString().ToLower()
    };
}