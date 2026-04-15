namespace backend.Constants;

public enum BidStatus { Pending, Accepted, Rejected, Retracted }

public enum BidEventType
{
    Created,
    Accepted,
    Rejected,
    Retracted,
    LockAdded,
    LockRemoved,
    FlagAdded,
    FlagRemoved,
    ForceRejected
}

public enum BidModerationAction
{
    ForceReject,
    Lock,
    Flag
}

public static class BidConstants
{
    public static string ToDbString(this BidStatus status) => status.ToString().ToLower();

    public static string ToDbString(this BidEventType type) => type switch
    {
        BidEventType.LockAdded => "lock_added",
        BidEventType.LockRemoved => "lock_removed",
        BidEventType.FlagAdded => "flag_added",
        BidEventType.FlagRemoved => "flag_removed",
        BidEventType.ForceRejected => "force_rejected",
        _ => type.ToString().ToLower()
    };

    public static string ToDbString(this BidModerationAction action) => action switch
    {
        BidModerationAction.ForceReject => "force_reject",
        BidModerationAction.Lock => "lock",
        BidModerationAction.Flag => "flag",
        _ => action.ToString().ToLower()
    };

    public static BidStatus ParseFromDb(string status)
    {
        return Enum.TryParse<BidStatus>(status, true, out var result) 
            ? result 
            : BidStatus.Pending;
    }
}
