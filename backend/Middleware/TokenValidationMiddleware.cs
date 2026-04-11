using System.Security.Claims;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Middleware;

public class TokenValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, NeighbourHelpDbContext dbContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var tokenVersionClaim = context.User.FindFirst("TokenVersion")?.Value;

            if (Guid.TryParse(userIdClaim, out var userId) && int.TryParse(tokenVersionClaim, out var tokenVersion))
            {
                // Check the DB for the current version
                var userVersion = await dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => u.TokenVersion)
                    .FirstOrDefaultAsync();

                // If the version in the Access Token is older than the DB version, 
                // the user has logged out or refreshed, so we block the request.
                if (userVersion != tokenVersion)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new { message = "Session expired. Please log in again." });
                    return;
                }
            }
        }
        await next(context);
    }
}
