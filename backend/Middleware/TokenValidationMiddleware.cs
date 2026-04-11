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
                var user = await dbContext.Users
                    .AsNoTracking()
                    .Select(u => new { u.Id, u.IsActive, u.TokenVersion })
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (user == null || !user.IsActive || user.TokenVersion != tokenVersion)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new { message = "Session invalidated. Please log in again." });
                    return;
                }
            }
        }
        await next(context);
    }
}
