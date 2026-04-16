using System.Net;
using System.Security.Claims;
using backend.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Hubs;

public abstract class BaseHub(NeighbourHelpDbContext dbContext) : Hub
{
    protected async Task<Guid> GetCurrentUserIdAsync()
    {
        var email = Context.User?.FindFirstValue(ClaimTypes.Email);
        
        if (string.IsNullOrEmpty(email))
            throw new HttpRequestException("Unauthorized: invalid authentication token.", null, HttpStatusCode.Unauthorized);

        return await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Email == email.ToLower().Trim())
            .Select(u => u.Id)
            .FirstOrDefaultAsync();
    }

    protected string GetCurrentUserRole()
    {
        return Context.User?.FindFirstValue(ClaimTypes.Role) ?? 
            throw new HttpRequestException("Unauthorized: invalid authentication token.", null, HttpStatusCode.Unauthorized);
    }
}