using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using backend.Models.DTOs;
using backend.Constants;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/withdrawals")]
[Authorize(Roles = "admin")]
public class AdminWithdrawalController(IWithdrawalService withdrawalService) : BaseController
{
    /// <summary>
    /// Get all withdrawal requests (admin only)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<WithdrawalRequestsResponse>> GetAllWithdrawalRequests(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var response = await withdrawalService.GetAllWithdrawalRequestsAsync(status, page, pageSize);
            return Ok(response);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Get specific withdrawal request by ID (admin only)
    /// </summary>
    [HttpGet("{requestId}")]
    public async Task<ActionResult<WithdrawalRequestDto>> GetWithdrawalRequestById(Guid requestId)
    {
        try
        {
            var request = await withdrawalService.GetWithdrawalRequestByIdAsync(requestId);
            return Ok(request);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Approve a pending withdrawal request (admin only)
    /// </summary>
    [HttpPatch("{requestId}/approve")]
    public async Task<ActionResult<WithdrawalRequestDto>> ApproveWithdrawal(
        Guid requestId,
        [FromBody] ApproveWithdrawalRequest? request = null)
    {
        try
        {
            var withdrawal = await withdrawalService.ApproveWithdrawalAsync(requestId, request);
            return Ok(withdrawal);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Reject a withdrawal request (admin only)
    /// </summary>
    [HttpPatch("{requestId}/reject")]
    public async Task<ActionResult<WithdrawalRequestDto>> RejectWithdrawal(
        Guid requestId,
        [FromBody] RejectWithdrawalRequest request)
    {
        try
        {
            var withdrawal = await withdrawalService.RejectWithdrawalAsync(requestId, request);
            return Ok(withdrawal);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Mark a withdrawal request as paid (admin only)
    /// </summary>
    [HttpPatch("{requestId}/mark-paid")]
    public async Task<ActionResult<WithdrawalRequestDto>> MarkWithdrawalPaid(
        Guid requestId,
        [FromBody] MarkWithdrawalPaidRequest? request = null)
    {
        try
        {
            var withdrawal = await withdrawalService.MarkWithdrawalPaidAsync(requestId, request);
            return Ok(withdrawal);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Get withdrawal statistics (admin only)
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<WithdrawalStats>> GetWithdrawalStats()
    {
        try
        {
            var stats = await withdrawalService.GetWithdrawalStatsAsync();
            return Ok(stats);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}
