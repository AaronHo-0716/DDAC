namespace backend.Constants;

public enum BidStatus { Pending, Accepted, Rejected, Retracted }

public enum BidEventType { Created, Accepted, Rejected, Retracted, LockAdded, LockRemoved }

public static class BidConstants
{
    public static string ToDbString(this BidStatus status) => status.ToString().ToLower();

    public static string ToDbString(this BidEventType type) => type switch
    {
        BidEventType.LockAdded => "lock_added",
        BidEventType.LockRemoved => "lock_removed",
        _ => type.ToString().ToLower()
    };

    public static BidStatus ParseFromDb(string status)
    {
        return Enum.TryParse<BidStatus>(status, true, out var result) 
            ? result 
            : BidStatus.Pending;
    }
}
