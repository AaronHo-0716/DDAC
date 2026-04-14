using System.Security.Claims;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Middleware;

public class TokenValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, NeighbourHelpDbContext dbContext)
    {
        // 1. Only run logic if the user is already authenticated via JWT
        if (context.User.Identity?.IsAuthenticated == true)
        {
            // 2. Extract Email and TokenVersion from the JWT claims
            var email = context.User.FindFirst(ClaimTypes.Email)?.Value;
            var tokenVersionStr = context.User.FindFirst("TokenVersion")?.Value;

            if (!string.IsNullOrEmpty(email) && int.TryParse(tokenVersionStr, out var tokenVersion))
            {
                // 3. Look up the user in the DB by Email
                // Optimization: Use Select to fetch only the boolean and the integer
                var user = await dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.Email == email.ToLower().Trim())
                    .Select(u => new { u.IsActive, u.TokenVersion })
                    .FirstOrDefaultAsync();

                // 4. Validate user status and session integrity
                // - User must exist in DB
                // - User must not be blocked (IsActive)
                // - JWT version must match current DB version (allows global logout/password resets)
                if (user == null || !user.IsActive || user.TokenVersion != tokenVersion)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new 
                    { 
                        message = "Your session has expired or your account has been deactivated. Please log in again." 
                    });
                    return;
                }
            }
            else
            {
                // Fail-safe: If token is authenticated but missing required claims
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { message = "Invalid token structure." });
                return;
            }
        }

        await next(context);
    }
}
