using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize]
public class UploadController(IStorageService storageService) : BaseController
{
    [HttpPost("job-image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<UploadImageResponse>> UploadJobImage([FromForm] UploadImageRequest request, CancellationToken cancellationToken)
    {
        if (request.File == null)
        {
            return BadRequest(new { message = "File is required." });
        }

        try
        {
            var result = await storageService.UploadImageAsync(request.File, "job-images", cancellationToken);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}
