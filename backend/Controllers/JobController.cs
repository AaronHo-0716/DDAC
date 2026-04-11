using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using backend.Models.DTOs;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/jobs")]
[Authorize]
public class JobController(IJobService jobService, IBidService bidService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<JobListResponse>> GetJobs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] bool? isEmergency = null,
        [FromQuery] decimal? maxDistanceKm = null)
    {
        var userId = GetUserIdFromClaims();
        var userRole = GetUserRoleFromClaims();

        var filter = new JobFilterQuery(
            Page: page,
            PageSize: pageSize,
            Category: category,
            Status: status,
            Search: search,
            IsEmergency: isEmergency,
            MaxDistanceKm: maxDistanceKm
        );

        var result = await jobService.GetJobsAsync(filter, userId, userRole);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<ActionResult<JobListResponse>> GetMyJobs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var userId = GetUserIdFromClaims();
        if (userId == null)
            return Unauthorized("User ID not found in token");

        var result = await jobService.GetMyJobsAsync(userId.Value, page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<JobDto>> GetJobById(Guid id)
    {
        var userId = GetUserIdFromClaims();
        var userRole = GetUserRoleFromClaims();

        var job = await jobService.GetJobByIdAsync(id, userId, userRole);
        if (job == null)
            return NotFound($"Job with id {id} not found or you don't have permission to view it");

        return Ok(job);
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<JobDto>> CreateJob([FromBody] CreateJobRequest request)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            if (userId == null)
                return Unauthorized("User ID not found in token");

            var job = await jobService.CreateJobAsync(request, userId.Value);
            return CreatedAtAction(nameof(GetJobById), new { id = job.Id }, job);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<ActionResult<JobDto>> UpdateJob(Guid id, [FromBody] UpdateJobRequest request)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            var userRole = GetUserRoleFromClaims();

            if (userId == null)
                return Unauthorized("User ID not found in token");

            var job = await jobService.UpdateJobAsync(id, request, userId.Value, userRole);
            return Ok(job);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteJob(Guid id)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            var userRole = GetUserRoleFromClaims();

            if (userId == null)
                return Unauthorized("User ID not found in token");

            await jobService.DeleteJobAsync(id, userId.Value, userRole);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{jobId}/bids")]
    public async Task<ActionResult<BidListResponse>> GetBidsByJobId(
        Guid jobId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var result = await bidService.GetBidsByJobIdAsync(jobId, page, pageSize);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("{jobId}/bids")]
    public async Task<ActionResult<BidDto>> CreateBid(Guid jobId, [FromBody] CreateBidRequest request)
    {
        try
        {
            var userId = GetUserIdFromClaims();
            var userRole = GetUserRoleFromClaims();

            if (userId == null)
                return Unauthorized("User ID not found in token");

            var bid = await bidService.CreateBidAsync(jobId, request, userId.Value, userRole);
            return CreatedAtAction(nameof(GetBidsByJobId), new { jobId = jobId }, bid);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private Guid? GetUserIdFromClaims()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(userIdClaim, out var userId))
            return userId;

        return null;
    }

    private string GetUserRoleFromClaims()
    {
        return User.FindFirstValue(ClaimTypes.Role) ?? "guest";
    }
}
