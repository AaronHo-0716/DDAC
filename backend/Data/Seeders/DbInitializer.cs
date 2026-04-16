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
            var admin = new User
            {
                Id = Guid.NewGuid(),
                Name = "System Admin",
                Email = "admin@nh.test",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("a"),
                Role = UserRole.Admin.ToDbString(),
                IsActive = true,
                TokenVersion = 1
            };
            context.Users.Add(admin);
            await context.SaveChangesAsync();
        }
    }
}
