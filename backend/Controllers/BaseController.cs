using System.Net;
using System.Security.Claims;
using backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

public abstract class BaseController : ControllerBase
{
    protected async Task<Guid> GetCurrentUserIdAsync()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email)) throw new HttpRequestException("Unauthorized: invalid authentication token.", null, HttpStatusCode.Unauthorized);

        // Automatically resolve the DbContext from the internal DI container
        var context = HttpContext.RequestServices.GetRequiredService<NeighbourHelpDbContext>();

        return await context.Users
            .Where(u => u.Email == email.ToLower().Trim())
            .Select(u => u.Id)
            .FirstOrDefaultAsync();
    }

    protected ObjectResult HandleError(HttpRequestException ex)
    {
        var statusCode = (int)(ex.StatusCode ?? HttpStatusCode.InternalServerError);
        return StatusCode(statusCode, new { message = ex.Message });
    }
}