using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.RateLimiting;
using System.Net;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(IAdminService adminService, ILogger<AdminController> logger) : ControllerBase
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
    public async Task<ActionResult<AdminOverviewResponse>> GetOverview()
    {
        logger.LogInformation("Admin {AdminId} requested overview stats.", AdminId);
        return Ok(await adminService.GetOverviewAsync());
    }

    [HttpPost("new-admin")]
    [EnableRateLimiting("auth_policy")]
    public async Task<ActionResult<UserDto>> AddNewAdmin([FromBody] RegisterRequest request)
    {
        if (AdminId == Guid.Empty) return Unauthorized();

        try
        {
            var result = await adminService.CreateAdminAsync(request);
            return Ok(result);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "A user with this email already exists." });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode((int)(ex.StatusCode ?? System.Net.HttpStatusCode.InternalServerError), new { message = ex.Message });
        }
    }

    [HttpGet("users")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers([FromQuery] UserSearchRequest request)
    {
        return Ok(await adminService.GetAllUsers(request));
    }

    [HttpGet("users/{id}")]
    public async Task<ActionResult<UserDto>> GetUser(Guid id)
    {
        try
        {
            return Ok(await adminService.GetUserByIdAsync(id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("users/{id}/block")]
    public async Task<IActionResult> BlockUser(Guid id, [FromBody] BlockUserRequest request)
    {
        if (AdminId == Guid.Empty) 
            return Unauthorized(new { message = "Could not identify admin session." });

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
    [Obsolete("This endpoint is currently not in use. ")]
    public async Task<ActionResult<IEnumerable<AdminActionDto>>> GetAuditLogs() 
        => Ok(await adminService.GetAuditLogsAsync());

    // --- Report ---
    [HttpGet("reports")]
    public async Task<ActionResult<IEnumerable<UserReportDto>>> GetReports([FromQuery] ReportStatusFilter? status)
    {
        return Ok(await adminService.GetAllReportsAsync(status));
    }
    
    [HttpPatch("reports/{id}/resolve")]
    public async Task<IActionResult> ResolveReport(Guid id, [FromBody] string notes)
    {
        if (AdminId == Guid.Empty) return Unauthorized();
        
        try
        {
            await adminService.ResolveReportAsync(id, notes, AdminId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("reports/{id}/review")]
    public async Task<IActionResult> ReviewReport(Guid id)
    {
        if (AdminId == Guid.Empty) return Unauthorized();

        try
        {
            await adminService.ReviewReportAsync(id, AdminId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
