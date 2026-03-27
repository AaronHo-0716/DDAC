using backend.Data;
using backend.Models.DTOs;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class UserService(NeighbourHelpDbContext context) : IUserService
{
    public async Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request)
    {
        // 1. Start with the IQueryable
        var query = context.Users.AsNoTracking(); // AsNoTracking is faster for searches

        // 2. Filter by Name (Partial Match)
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var nameLower = request.Name.ToLower().Trim();
            query = query.Where(u => u.Name.ToLower().Contains(nameLower));
        }

        // 3. Filter by Email/User (Partial Match)
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailLower = request.Email.ToLower().Trim();
            query = query.Where(u => u.Email.ToLower().Contains(emailLower));
        }

        // 4. Filter by Role (STRICT match)
        if (request.Role.HasValue)
        {
            var targetRole = request.Role.Value.ToString().ToLower();
            query = query.Where(u => u.Role == targetRole);
        }

        // 5. Filter by Active Status
        if (request.IsActive.HasValue)
        {
            query = query.Where(u => u.IsActive == request.IsActive.Value);
        }

        // 6. Execute the query
        var users = await query.ToListAsync();

        // 7. Map to DTO
        return users.Select(u => new UserDto(
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
