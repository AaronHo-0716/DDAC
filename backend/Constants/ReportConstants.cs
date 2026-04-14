namespace backend.Constants;

public enum ReportStatus { Pending, Reviewed, Resolved }

public static class ReportConstants
{
    public static string ToDbString(this ReportStatus status) => status.ToString().ToLower();

    public static ReportStatus ParseFromDb(string status)
    {
        return Enum.TryParse<ReportStatus>(status, true, out var result) 
            ? result 
            : ReportStatus.Pending;
    }
}
