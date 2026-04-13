using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using backend.Models.DTOs;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/bids")]
[Authorize]
public class BidController(IBidService bidService, ILogger<BidController> logger) : ControllerBase
{
    [Authorize]
    [HttpGet("my")]
    public async Task<ActionResult<BidListResponse>> GetMyBids(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var userId = GetUserIdFromClaims();
        var userRole = GetUserRoleFromClaims();

        if (userId == null)
            return Unauthorized("User ID not found in token");

        if (userRole != "handyman")
            return Forbid();

        var result = await bidService.GetMyBidsAsync(userId.Value, page, pageSize);
        return Ok(result);
    }

    [Authorize]
    [HttpPatch("{bidId}/accept")]
    public async Task<ActionResult<BidDto>> AcceptBid(Guid bidId)
    {
        var userId = GetUserIdFromClaims();
        var userRole = GetUserRoleFromClaims();

        if (userId == null)
            return Unauthorized("User ID not found in token");

        try
        {
            var bid = await bidService.AcceptBidAsync(bidId, userId.Value, userRole);
            return Ok(bid);
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
    }

    [Authorize]
    [HttpPatch("{bidId}/reject")]
    public async Task<ActionResult<BidDto>> RejectBid(Guid bidId)
    {
        var userId = GetUserIdFromClaims();
        var userRole = GetUserRoleFromClaims();

        if (userId == null)
            return Unauthorized("User ID not found in token");

        try
        {
            var bid = await bidService.RejectBidAsync(bidId, userId.Value, userRole);
            return Ok(bid);
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
    }

    [Authorize]
    [HttpDelete("{bidId}")]
    public async Task<IActionResult> DeleteBid(Guid bidId)
    {
        var userId = GetUserIdFromClaims();
        var userRole = GetUserRoleFromClaims();

        if (userId == null)
            return Unauthorized("User ID not found in token");

        try
        {
            await bidService.DeleteBidAsync(bidId, userId.Value, userRole);
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
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
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
