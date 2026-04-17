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
        try
        {
            await reportService.CreateReportAsync(request);
            return Ok(new { message = "Report submitted successfully. Administrators will review it shortly." });
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<ReportListResponse>>> GetMyReports()
    {  
        return Ok(await reportService.GetMyReportsAsync());
    }
}