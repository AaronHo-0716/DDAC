using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace backend.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(IAdminService adminService) : ControllerBase
{
    private Guid AdminId 
    {
        get 
        {
            var claimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                             ?? User.FindFirst("sub")?.Value;

            return Guid.TryParse(claimValue, out var id) ? id : Guid.Empty;
        }
    }

    [HttpGet("overview")]
    public async Task<ActionResult<AdminOverviewResponse>> GetOverview() => Ok(await adminService.GetOverviewAsync());

    [HttpGet("users")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers([FromQuery] UserSearchRequest request) => Ok(await adminService.GetAllUsers(request));

    [HttpGet("users/{id}")]
    public async Task<ActionResult<UserDto>> GetUser(Guid id) => Ok(await adminService.GetUserByIdAsync(id));

    [HttpPatch("users/{id}/block")]
    public async Task<IActionResult> BlockUser(Guid id, [FromBody] BlockUserRequest request)
    {
        // 1. Validate Admin Identity
        if (AdminId == Guid.Empty) 
            return Unauthorized(new { message = "Could not identify admin session." });

        // 2. Prevent Self-Blocking
        if (id == AdminId) 
            return BadRequest(new { message = "Security Policy: You are not allowed to block your own account." });

        try 
        {
            var result = await adminService.UpdateUserBlockStatusAsync(id, true, request.Reason, AdminId);
            return Ok(result);
        }
        catch (InvalidOperationException ex) 
        { 
            return BadRequest(new { message = ex.Message }); 
        }
        catch (KeyNotFoundException ex) 
        { 
            return NotFound(new { message = ex.Message }); 
        }
    }

    [HttpPatch("users/{id}/unblock")]
    public async Task<IActionResult> UnblockUser(Guid id)
    {
        if (AdminId == Guid.Empty) return Unauthorized();

        try
        {
            await adminService.UpdateUserBlockStatusAsync(id, false, null, AdminId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // --- Handyman Verification ---
    [HttpGet("handymen/pending-verification")]
    public async Task<ActionResult<IEnumerable<HandymanVerificationDto>>> GetPendingVerifications() 
        => Ok(await adminService.GetPendingVerificationsAsync());

    [HttpPatch("handymen/{id}/approve")]
    public async Task<IActionResult> ApproveHandyman(Guid id, [FromBody] string notes)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        await adminService.VerifyHandymanAsync(id, true, notes, AdminId);
        return NoContent();
    }

    [HttpPatch("handymen/{id}/reject")]
    public async Task<IActionResult> RejectHandyman(Guid id, [FromBody] string notes)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        await adminService.VerifyHandymanAsync(id, false, notes, AdminId);
        return NoContent();
    }

    // --- Jobs ---
    [HttpGet("jobs/emergency")]
    public async Task<ActionResult<IEnumerable<JobDto>>> GetEmergencyJobs() 
        => Ok(await adminService.GetEmergencyJobsAsync());

    [HttpPatch("jobs/{id}/assign")]
    public async Task<IActionResult> AssignJob(Guid id, [FromBody] AssignJobRequest request)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        await adminService.AssignJobAsync(id, request.HandymanUserId, AdminId);
        return NoContent();
    }

    // --- Bid Transactions ---
    [HttpGet("bid-transactions")]
    public async Task<ActionResult<IEnumerable<BidTransactionDto>>> GetTransactions([FromQuery] string? type) 
        => Ok(await adminService.GetBidTransactionsAsync(type));

    [HttpPatch("bid-transactions/{bidId}/force-reject")]
    public async Task<IActionResult> ForceRejectBid(Guid bidId, [FromBody] string reason)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        await adminService.HandleBidActionAsync(bidId, "FORCE_REJECT", reason, AdminId);
        return NoContent();
    }

    [HttpPatch("bid-transactions/{bidId}/lock")]
    public async Task<IActionResult> LockBid(Guid bidId, [FromBody] string reason)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        await adminService.HandleBidActionAsync(bidId, "LOCK", reason, AdminId);
        return NoContent();
    }

    [HttpPatch("bid-transactions/{bidId}/flag")]
    public async Task<IActionResult> FlagBid(Guid bidId, [FromBody] string reason)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        await adminService.HandleBidActionAsync(bidId, "FLAG", reason, AdminId);
        return NoContent();
    }

    // --- Audit ---
    [HttpGet("audit-log")]
    public async Task<ActionResult<IEnumerable<AdminActionDto>>> GetAuditLogs() 
        => Ok(await adminService.GetAuditLogsAsync());
}
