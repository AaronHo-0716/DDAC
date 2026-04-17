using backend.Constants;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace backend.Data.Seeders;

public static class DbInitializer
{
    public static async Task SeedAsync(NeighbourHelpDbContext context)
    {
        await context.Database.MigrateAsync();

        if (!await context.Users.AnyAsync(u => u.Role == UserRole.Admin.ToDbString()))
        {
            context.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Name = "System Admin",
                Email = "admin@nh.test",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("a"),
                Role = UserRole.Admin.ToDbString(),
                IsActive = true,
                TokenVersion = 1
            });

            context.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Name = "System Admin",
                Email = "admin@neighborhelp.test",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
                Role = UserRole.Admin.ToDbString(),
                IsActive = true,
                TokenVersion = 1
            });
            await context.SaveChangesAsync();
        }
    }
}
