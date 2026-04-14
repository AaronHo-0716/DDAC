using Microsoft.AspNetCore.Mvc;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using backend.Models.DTOs;

namespace backend.Controllers;

[ApiController]
[Authorize]
[Route("api/report")]
public class ReportController(IReportService reportService) : BaseController
{
    [HttpPost]
    public async Task<IActionResult> Report([FromBody] CreateReportRequest request)
    {
        var userId = await GetCurrentUserIdAsync();

        try
        {
            await reportService.CreateReportAsync(request, userId);
            return Ok(new { message = "Report submitted successfully. Administrators will review it shortly." });
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<UserReportDto>>> GetMyReports()
    {
        var userId = await GetCurrentUserIdAsync();

        return Ok(await reportService.GetMyReportsAsync(userId));
    }
}