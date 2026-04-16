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
    public async Task<IActionResult> UploadImage([FromForm] UploadImageRequest request, CancellationToken ct)
    {
        var userId = await GetCurrentUserIdAsync();
        
        try
        {
            object result = request.UploadType switch
            {
                UploadTypes.JobImage => await storageService.UpdateJobImageAsync(request, ct),
                
                UploadTypes.AvatarImage => 
                    await storageService.UpdateProfilePictureAsync(userId, request.File, ct),

                UploadTypes.IdentityCardImage => 
                    await storageService.UpdateIdentityCardAsync(userId, request.File, ct),
                
                UploadTypes.ChatAttachmentImage => 
                    await storageService.SendChatAttachmentAsync(userId, request, ct),

                _ => throw new HttpRequestException("Invalid upload type provided.", null, System.Net.HttpStatusCode.BadRequest)
            };

            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return HandleError(ex);
        }
    }    
}