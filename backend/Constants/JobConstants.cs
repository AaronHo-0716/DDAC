namespace backend.Constants;

public enum JobStatus { Open, InProgress, Completed, Cancelled }

public static class JobConstants
{
    public const int MaxSearchDistanceKm = 100;

    public static string ToDbString(this JobStatus status) => status switch
    {
        JobStatus.InProgress => "in_progress",
        _ => status.ToString().ToLower()
    };

    public static JobStatus ParseFromDb(string status)
    {
        var cleanStatus = status.Replace("_", "");
        return Enum.TryParse<JobStatus>(cleanStatus, true, out var result) 
            ? result 
            : JobStatus.Open;
    }
}
