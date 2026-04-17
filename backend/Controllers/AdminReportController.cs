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
    public async Task<ActionResult<IEnumerable<ReportListResponse>>> GetReports([FromQuery] ReportStatus? status, int page = 1, int pageSize = 1000)
    {
        return Ok(await reportService.GetAllReportsAsync(status));
    }
    
    [HttpPatch("{id}/resolve")]
    public async Task<IActionResult> ResolveReport(Guid id, [FromBody] string notes)
    {
        try
        {
            await reportService.ResolveReportAsync(id, notes);
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
        try
        {
            await reportService.ReviewReportAsync(id, notes);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}
