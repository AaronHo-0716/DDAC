using Microsoft.EntityFrameworkCore;
using backend.Models.Entities; // <--- Add this to fix the 'User' error

namespace backend.Data;

public class AppDbContext : DbContext
{
    public DbSet<User> Users { get; set; }
}
