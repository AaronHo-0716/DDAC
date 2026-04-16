using backend.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/ratings")]
[Authorize]
public class RatingController(IRatingService ratingService) : BaseController
{
    [HttpPost]
    [Authorize(Roles = "admin,homeowner")]
    public async Task<IActionResult> RateUser([FromBody] SubmitRatingRequest request)
    {
        try
        {
            await ratingService.SubmitRatingAsync(await GetCurrentUserIdAsync(), request);
            return Ok(new { message = "Rating submitted successfully." });
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpGet("my")]
    public async Task<ActionResult<UserRatingSummaryDto>> GetRatings([FromQuery] int page = 1, int pageSize = 10)
    {
        try
        {
            var result = await ratingService.GetUserRatingsAsync(await GetCurrentUserIdAsync(), page, pageSize);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult<UserRatingSummaryDto>> GetRatingsByUserId(Guid targetId, [FromQuery] int page = 1, int pageSize = 10)
    {
        try
        {
            var result = await ratingService.GetUserRatingsAsync(targetId, page, pageSize);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}
