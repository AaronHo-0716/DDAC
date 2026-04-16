using backend.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/ratings")]
[Authorize(Roles = "admin")]
public class AdminRatingController(IRatingService ratingService) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<HandymanRatingListResponse>> GetHandymansRatings([FromQuery] int page = 1, int pageSize = 10)
    {
        try
        {
            var result = await ratingService.GetVerifiedHandymenReportAsync(page, pageSize);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}
