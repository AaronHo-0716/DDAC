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
        // 1. Start with the IQueryable. 
        var query = context.Users.AsNoTracking();

        // 2. Filter by Name (Partial Match)
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var nameLower = request.Name.ToLower().Trim();
            // Using PascalCase 'Name' to match your entity property
            query = query.Where(u => u.Name.ToLower().Contains(nameLower));
        }

        // 3. Filter by Email (Partial Match)
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailLower = request.Email.ToLower().Trim();
            // Using PascalCase 'Email' to match your entity property
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
            // Using PascalCase 'IsActive' to match your entity property
            query = query.Where(u => u.IsActive == request.IsActive.Value);
        }

        // 6. Execute the query
        var usersList = await query.ToListAsync();

        // 7. Map to DTO
        // Ensure property names match exactly with what is defined in the 'user' entity class
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
