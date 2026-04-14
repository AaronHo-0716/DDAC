using backend.Models.DTOs;
using backend.Services;
using backend.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/report")]
[Authorize(Roles = "admin")]
public class AdminReportController(IReportService reportService) : BaseController 
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserReportDto>>> GetReports([FromQuery] ReportStatus? status)
    {
        return Ok(await reportService.GetAllReportsAsync(status));
    }
    
    [HttpPatch("{id}/resolve")]
    public async Task<IActionResult> ResolveReport(Guid id, [FromBody] string notes)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try
        {
            await reportService.ResolveReportAsync(id, notes, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpPatch("{id}/review")]
    public async Task<IActionResult> ReviewReport(Guid id, [FromBody] string notes)
    {
        var adminId = await GetCurrentUserIdAsync();
        if (adminId == Guid.Empty) return Unauthorized();

        try
        {
            await reportService.ReviewReportAsync(id, notes, adminId);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}