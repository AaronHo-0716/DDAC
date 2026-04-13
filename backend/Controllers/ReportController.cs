using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using System.Net;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Authorize]
[Route("api/report")]
public class ReportController(IReportService reportService, ILogger<ReportController> logger) : ControllerBase
{

    [HttpPost]
    [EnableRateLimiting("auth_policy")]
    public async Task<IActionResult> Report([FromBody] CreateReportRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

        try
        {
            await reportService.CreateReportAsync(request, Guid.Parse(userIdClaim));
            return Ok(new { message = "Report submitted successfully. Administrators will review it shortly." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while processing your report.", details = ex.Message });
        }
    }

    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<UserReportDto>>> GetMyReports()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

        var reports = await reportService.GetMyReportsAsync(Guid.Parse(userIdClaim));
        return Ok(reports);
    }
}
