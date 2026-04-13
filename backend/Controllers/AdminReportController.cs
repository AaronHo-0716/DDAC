using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/report")]
[Authorize(Roles = "admin")]
public class AdminReportController(IReportService reportService) : ControllerBase 
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserReportDto>>> GetReports([FromQuery] ReportStatusFilter? status)
    {
        return Ok(await reportService.GetAllReportsAsync(status));
    }
    
    [HttpPatch("{id}/resolve")]
    public async Task<IActionResult> ResolveReport(Guid id, [FromBody] string notes)
    {
        try
        {
            await reportService.ResolveReportAsync(id, notes, AdminId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/review")]
    public async Task<IActionResult> ReviewReport(Guid id, [FromBody] string notes)
    {
        try
        {
            await reportService.ReviewReportAsync(id, notes, AdminId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
