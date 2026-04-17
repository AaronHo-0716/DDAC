using System.Net;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

public abstract class BaseController : ControllerBase
{
    // protected async Task<Guid> GetCurrentUserIdAsync()
    // {
    //     var email = User.FindFirstValue(ClaimTypes.Email);
    //     if (string.IsNullOrEmpty(email)) throw new HttpRequestException("Unauthorized: invalid authentication token.", null, HttpStatusCode.Unauthorized);

    //     // Automatically resolve the DbContext from the internal DI container
    //     var context = HttpContext.RequestServices.GetRequiredService<NeighbourHelpDbContext>();

    //     return await context.Users
    //         .Where(u => u.Email == email.ToLower().Trim())
    //         .Select(u => u.Id)
    //         .FirstOrDefaultAsync();
    // }

    // protected string GetCurrentUserRole()
    // {
    //     return User.FindFirstValue(ClaimTypes.Role) ?? 
    //         throw new HttpRequestException("Unauthorized: invalid authentication token.", null, HttpStatusCode.Unauthorized);
    // }

    protected ObjectResult HandleError(HttpRequestException ex)
    {
        var statusCode = (int)(ex.StatusCode ?? HttpStatusCode.InternalServerError);
        return StatusCode(statusCode, new { message = ex.Message });
    }
}