using Microsoft.EntityFrameworkCore;
using backend.Models.Entities; // You need this to see the User class

namespace backend.Data;

public class NeighbourHelpDbContext : DbContext
{
    public NeighbourHelpDbContext(DbContextOptions<NeighbourHelpDbContext> options)
        : base(options)
    {
    }

    // This line tells EF Core: "Create a table called 'Users' based on the User class"
    public DbSet<User> Users { get; set; }

    // Later, you will add more here, for example:
    // public DbSet<Job> Jobs { get; set; }
    // public DbSet<Bid> Bids { get; set; }
}
