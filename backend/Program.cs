using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using backend.Data;
using backend.Services;
using backend.Models.DTOs;
using backend.Models.Entities;

var builder = WebApplication.CreateBuilder(args);

// --- 1. SERVICE REGISTRATION (Must be BEFORE builder.Build) ---

// Controllers & JSON Formatting (Ensures camelCase for Frontend)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database: SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<NeighbourHelpDbContext>(options =>
    options.UseNpgsql(connectionString, sqlOptions =>
        sqlOptions.CommandTimeout(300)));

// Authentication: JWT Setup
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "Your_Super_Secret_Fallback_Key_32_Chars_Long!"))
        };
    });

builder.Services.AddAuthorization();

// CORS: Merged into one single policy for Next.js
builder.Services.AddCors(options =>
{
    options.AddPolicy("NextJsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required if you decide to use cookies later
    });
});

// Dependency Injection
builder.Services.AddScoped<IAuthService, AuthService>();

// Backend Error Handling (ProblemDetails) - Customizing to match your frontend client.ts
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["statusCode"] = context.HttpContext.Response.StatusCode;
    };
});


// --- 2. BUILD THE APP ---
var app = builder.Build();


// --- 3. MIDDLEWARE PIPELINE (Must be AFTER builder.Build) ---

// Use ProblemDetails middleware for better error responses
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// IMPORTANT: CORS must be called BEFORE UseAuthentication
app.UseCors("NextJsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<NeighbourHelpDbContext>();
        // EnsureCreated() creates the DB and all tables instantly 
        // if they don't exist. No migrations needed.
        context.Database.EnsureCreated();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred creating the DB.");
    }
}

// Simple Health Check
app.MapGet("/", () => "NeighborHelp API is running...");

app.Run();
