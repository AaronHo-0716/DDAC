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

    /// <summary>
    /// Example of a write operation using Transactions and Concurrency checks
    /// to avoid race conditions when updating user status.
    /// </summary>
    public async Task<bool> UpdateUserStatus(Guid userId, bool isActive)
    {
        // Use an explicit transaction if multiple steps are involved
        using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            var user = await context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return false;

            user.IsActive = isActive;

            // SaveChangesAsync will throw a DbUpdateConcurrencyException if the 
            // record was changed by someone else between our 'Fetch' and 'Save'.
            await context.SaveChangesAsync();

            await transaction.CommitAsync();
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Roll back the transaction if a race condition is detected
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
