using backend.Models.DTOs;
using backend.Services;
using backend.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace backend.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(IAdminService adminService, IJobService jobService) : BaseController
{
    [HttpGet("overview")]
    public async Task<ActionResult<AdminOverviewResponse>> GetOverview()
    {
        try { return Ok(await adminService.GetOverviewAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPost("new-admin")]
    [EnableRateLimiting("auth_policy")]
    public async Task<ActionResult<UserDto>> AddNewAdmin([FromBody] RegisterRequest request)
    {
        var adminId = await GetCurrentUserIdAsync();

        try { return Ok(await adminService.CreateAdminAsync(request)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("users")]
    public async Task<ActionResult<IEnumerable<UserListResponse>>> GetUsers([FromQuery] UserSearchRequest request)
    {
        try { return Ok(await adminService.GetAllUsers(request)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("users/{id}")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<UserDto>> GetUser(Guid id)
    {
        try { return Ok(await adminService.GetUserByIdAsync(id)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("users/{id}/block")]
    public async Task<ActionResult<UserDto>> BlockUser(Guid id, [FromBody] BlockUserRequest request)
    {
        var adminId = await GetCurrentUserIdAsync();

        try 
        {
            var result = await adminService.UpdateUserBlockStatusAsync(id, true, request.Reason, adminId);
            return Ok(result);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("users/{id}/unblock")]
    public async Task<ActionResult<UserDto>> UnblockUser(Guid id)
    {
        var adminId = await GetCurrentUserIdAsync();

        try { return Ok(await adminService.UpdateUserBlockStatusAsync(id, false, null, adminId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("handymen/pending-verification")]
    public async Task<ActionResult<IEnumerable<HandymanVerificationListResponse>>> GetPendingVerifications()
    {
        try { return Ok(await adminService.GetPendingVerificationsAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
    
    [HttpGet("handyman/{id}")]
    public async Task<ActionResult<HandymanVerificationDto>> GetHandymanById(Guid id)
    {
        try { return Ok(await adminService.GetUserByIdAsync(id, true)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("handymen/{id}/approve")]
    public async Task<ActionResult<HandymanVerificationDto>> ApproveHandyman(Guid id, [FromBody] string notes)
    {
        var adminId = await GetCurrentUserIdAsync();

        try { return Ok(await adminService.VerifyHandymanAsync(id, true, notes, adminId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("handymen/{id}/reject")]
    public async Task<ActionResult<HandymanVerificationDto>> RejectHandyman(Guid id, [FromBody] string notes)
    {
        var adminId = await GetCurrentUserIdAsync();

        try { return Ok(await adminService.VerifyHandymanAsync(id, false, notes, adminId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("jobs/emergency")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<JobDto>>> GetEmergencyJobs()
    {
        try { return Ok(await adminService.GetEmergencyJobsAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }


    [HttpGet("jobs")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<JobDto>>> GetJobs()
    {
        try { return Ok(await jobService.AdminGetJobsAsync(new JobFilterQuery(), null)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("jobs/{id}/assign")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<IActionResult> AssignJob(Guid id, [FromBody] AssignJobRequest request)
    {
        var adminId = await GetCurrentUserIdAsync();

        try
        {
            await adminService.AssignJobAsync(id, request.HandymanUserId, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("bid-transactions")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<BidDto>>> GetTransactions([FromQuery] string? type)
    {
        try { return Ok(await adminService.GetBidTransactionsAsync(type)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("bid-transactions/{bidId}/force-reject")]
    public async Task<IActionResult> ForceRejectBid(Guid bidId, [FromBody] string reason)
    {
        var adminId = await GetCurrentUserIdAsync();

        try
        {
            await adminService.HandleBidActionAsync(bidId, BidModerationAction.ForceReject.ToDbString(), reason, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("bid-transactions/{bidId}/lock")]
    public async Task<IActionResult> LockBid(Guid bidId, [FromBody] string reason)
    {
        var adminId = await GetCurrentUserIdAsync();

        try
        {
            await adminService.HandleBidActionAsync(bidId, BidModerationAction.Lock.ToDbString(), reason, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("bid-transactions/{bidId}/flag")]
    public async Task<IActionResult> FlagBid(Guid bidId, [FromBody] string reason)
    {
        var adminId = await GetCurrentUserIdAsync();

        try
        {
            await adminService.HandleBidActionAsync(bidId, BidModerationAction.Flag.ToDbString(), reason, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpGet("audit-log")]
    [Obsolete("Use specific moderation logs where available.")]
    public async Task<ActionResult<IEnumerable<AdminActionDto>>> GetAuditLogs()
    {
        try { return Ok(await adminService.GetAuditLogsAsync()); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}
