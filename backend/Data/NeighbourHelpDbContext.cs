using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class NeighbourHelpDbContext : DbContext
{
    public NeighbourHelpDbContext(DbContextOptions<NeighbourHelpDbContext> options)
        : base(options)
    {
    }


}
