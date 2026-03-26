using Microsoft.EntityFrameworkCore;
using backend.Data;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// 1. Load the connection string from appsettings.json
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// 2. Register the NeighbourHelpDbContext
// This is what allows your API to talk to Docker (now) and RDS (later)
builder.Services.AddDbContext<NeighbourHelpDbContext>(options =>
    options.UseSqlServer(connectionString, sqlOptions => 
        sqlOptions.CommandTimeout(300))); // Good for RDS latency

builder.Services.AddControllers();

app.MapGet("/", () => "Hello World!");
app.MapControllers();
app.Run();
