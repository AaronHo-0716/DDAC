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
    // Robust extraction of Admin ID from JWT
    private Guid GetCurrentAdminId()
    {
        // Try standard NameIdentifier (XML Soap)
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                    ?? User.FindFirst("sub")?.Value; // fallback to standard JWT 'sub'

        if (Guid.TryParse(claim, out var id)) return id;
        
        return Guid.Empty;
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
        var adminId = GetCurrentAdminId();

        // FAIL-SAFE 1: If we can't identify who is calling the API, we block the request entirely
        if (adminId == Guid.Empty)
        {
            return Unauthorized(new { message = "Could not identify admin from token." });
        }

        // FAIL-SAFE 2: Direct comparison in Controller before even hitting the Service
        if (id == adminId)
        {
            return BadRequest(new { message = "Security Policy: You are not allowed to block your own account." });
        }

        try 
        {
            await adminService.UpdateUserBlockStatusAsync(id, true, request.Reason, adminId);
            return NoContent();
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
        var adminId = GetCurrentAdminId();
        if (adminId == Guid.Empty) return Unauthorized();

        try
        {
            await adminService.UpdateUserBlockStatusAsync(id, false, null, adminId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // --- (Other Handyman and Bid endpoints remain the same) ---
    [HttpGet("handymen/pending-verification")]
    public async Task<ActionResult<IEnumerable<HandymanVerificationDto>>> GetPendingVerifications() => Ok(await adminService.GetPendingVerificationsAsync());

    [HttpPatch("handymen/{id}/approve")]
    public async Task<IActionResult> ApproveHandyman(Guid id, [FromBody] string notes) => Ok(await Task.FromResult(NoContent()));

    [HttpPatch("handymen/{id}/reject")]
    public async Task<IActionResult> RejectHandyman(Guid id, [FromBody] string notes) => Ok(await Task.FromResult(NoContent()));

    [HttpGet("audit-log")]
    public async Task<ActionResult<IEnumerable<AdminActionDto>>> GetAuditLogs() => Ok(await adminService.GetAuditLogsAsync());
}
