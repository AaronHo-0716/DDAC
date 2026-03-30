using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace backend.Services;

public class AdminService(NeighbourHelpDbContext context) : IAdminService
{
    public async Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request)
    {
        // Use AsNoTracking for read-only operations to improve performance 
        // and avoid unnecessary locking/tracking.
        var query = context.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var nameLower = request.Name.ToLower().Trim();
            query = query.Where(u => u.Name.ToLower().Contains(nameLower));
        }

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailLower = request.Email.ToLower().Trim();
            query = query.Where(u => u.Email.ToLower().Contains(emailLower));
        }

        if (request.Role.HasValue)
        {
            var targetRole = request.Role.Value.ToString().ToLower();
            query = query.Where(u => u.Role == targetRole);
        }

        if (request.IsActive.HasValue)
        {
            query = query.Where(u => u.IsActive == request.IsActive.Value);
        }

        var usersList = await query.ToListAsync();

        return usersList.Select(u => new UserDto(
            u.Id,
            u.Name,
            u.Email,
            u.Role,
            u.AvatarUrl,
            u.Rating,
            u.CreatedAtUtc,
            u.IsActive
        ));
    }
}
