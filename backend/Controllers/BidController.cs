using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using backend.Models.DTOs;

namespace backend.Controllers;

[ApiController]
[Route("api/bids")]
[Authorize]
public class BidController(IBidService bidService) : BaseController
{
    [HttpGet("my")]
    [Authorize(Roles = "admin,handyman")]
    public async Task<ActionResult<BidListResponse>> GetMyBids([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try { return Ok(await bidService.GetMyBidsAsync(await GetCurrentUserIdAsync(), page, pageSize)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [Authorize(Roles = "admin,homeowner")]
    [HttpPatch("{bidId}/accept")]
    public async Task<ActionResult<BidDto>> AcceptBid(Guid bidId)
    {
        try { return Ok(await bidService.AcceptBidAsync(bidId, await GetCurrentUserIdAsync(), GetCurrentUserRole())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [Authorize(Roles = "admin,homeowner")]
    [HttpPatch("{bidId}/reject")]
    public async Task<ActionResult<BidDto>> RejectBid(Guid bidId)
    {
        try { return Ok(await bidService.RejectBidAsync(bidId, await GetCurrentUserIdAsync(), GetCurrentUserRole())); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [Authorize(Roles = "admin,handyman")]
    [HttpDelete("{bidId}")]
    public async Task<IActionResult> DeleteBid(Guid bidId)
    {
        try
        {
            await bidService.DeleteBidAsync(bidId, await GetCurrentUserIdAsync());
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}