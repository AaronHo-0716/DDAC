using System.Diagnostics.Metrics;

namespace backend.Services;

public class MetricsService
{
    private readonly Counter<int> _bidCounter;
    private readonly Counter<int> _jobCounter;
    private readonly Counter<int> _userLoginCounter;

    public MetricsService(IMeterFactory meterFactory)
    {
        // Creates a meter for the application
        var meter = meterFactory.Create("NeighborHelp.Api");

        // Define specific metrics
        _bidCounter = meter.CreateCounter<int>("bids_placed_total", "count", "Total number of bids placed");
        _jobCounter = meter.CreateCounter<int>("jobs_created_total", "count", "Total number of jobs posted");
        _userLoginCounter = meter.CreateCounter<int>("user_logins_total", "count", "Total number of successful logins");
    }

    public void RecordBid() => _bidCounter.Add(1);
    public void RecordJobCreated() => _jobCounter.Add(1);
    public void RecordLogin() => _userLoginCounter.Add(1);
}
