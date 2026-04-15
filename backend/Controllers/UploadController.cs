using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Constants;

namespace backend.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize]
[Consumes("multipart/form-data")]
[RequestSizeLimit(10 * 1024 * 1024)]
public class UploadController(IStorageService storageService) : BaseController
{

    [HttpPost]
    public async Task<ActionResult<UploadImageResponse>> UploadImage([FromForm] UploadImageRequest request, CancellationToken cancellationToken)
    {
        if (request.File == null)
            throw new HttpRequestException("No file was provided for upload.", null, System.Net.HttpStatusCode.BadRequest);
        try
        {
            var result = await storageService.UploadImageAsync(request.File, request.UploadType.ToPrefixString(), cancellationToken);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }

    [HttpPost("profile-picture")]
    public async Task<ActionResult<UserDto>> UpdateProfilePicture([FromForm] UploadImageRequest request, CancellationToken cancellationToken)
    {
        if (request.File == null) throw new HttpRequestException("File is required.", null, System.Net.HttpStatusCode.BadRequest);

        try
        {
            return Ok(await storageService.UpdateProfilePictureAsync(await GetCurrentUserIdAsync(), request.File, cancellationToken));
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }
}