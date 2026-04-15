using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using backend.Models.DTOs;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/jobs")]
[Authorize]
public class JobController(IJobService jobService, IBidService bidService) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<JobListResponse>> GetJobs([FromQuery] JobFilterQuery query)
    {
        try { return Ok(await jobService.GetJobsAsync(query, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("my")]
    public async Task<ActionResult<JobListResponse>> GetMyJobs([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try { return Ok(await jobService.GetMyJobsAsync(await GetCurrentUserIdAsync(), page, pageSize)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<JobDto>> GetJobById(Guid id)
    {

        try { return Ok(await jobService.GetJobByIdAsync(id, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost]
    public async Task<ActionResult<JobDto>> CreateJob([FromBody] CreateJobRequest request)
    {
        try
        {
            var job = await jobService.CreateJobAsync(request, await GetCurrentUserIdAsync());
            return CreatedAtAction(nameof(GetJobById), new { id = job.Id }, job);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<JobDto>> UpdateJob(Guid id, [FromBody] UpdateJobRequest request)
    {
        try { return Ok(await jobService.UpdateJobAsync(id, request, await GetCurrentUserIdAsync())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteJob(Guid id)
    {
        try
        {
            await jobService.DeleteJobAsync(id, await GetCurrentUserIdAsync());
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("{jobId}/bids")]
    public async Task<ActionResult<BidListResponse>> GetBidsByJobId(Guid jobId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try { return Ok(await bidService.GetBidsByJobIdAsync(jobId, page, pageSize)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("{jobId}/bids")]
    public async Task<ActionResult<BidDto>> CreateBid(Guid jobId, [FromBody] CreateBidRequest request)
    {
        try
        {
            var bid = await bidService.CreateBidAsync(jobId, request, await GetCurrentUserIdAsync());
            return CreatedAtAction(nameof(GetBidsByJobId), new { jobId }, bid);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    private string GetUserRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "guest";
}