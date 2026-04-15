using System.Text;
using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using backend.Data;
using backend.Data.Seeders;
using backend.Middleware;
using backend.Models.Config;
using backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// 1. Serilog Setup (Structured Logging)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// 2. AWS SSM (Production only)
if (!builder.Environment.IsDevelopment())
{
    builder.Configuration.AddSystemsManager("/app/", optional: true);
}

// 3. Service Registration
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// Health Checks
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!);

// Rate Limiting (Brute Force Protection)
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth_policy", opt =>
    {
        opt.PermitLimit = 10; // 5 requests
        opt.Window = TimeSpan.FromSeconds(30); // per 30 seconds
        opt.QueueLimit = 0;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Metrics
builder.Services.AddMetrics();
builder.Services.AddSingleton<MetricsService>();

builder.Services.AddEndpointsApiExplorer();

// Swagger Configuration with JWT Support
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "NeighborHelp API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token only (No 'Bearer' prefix needed here)"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Database: PostgreSQL
builder.Services.AddDbContext<NeighbourHelpDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// Storage (S3 / LocalStack)
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.AddSingleton<IAmazonS3>(serviceProvider =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    var storageOptions = configuration.GetSection(StorageOptions.SectionName).Get<StorageOptions>() ?? new StorageOptions();
    var s3Options = storageOptions.S3;

    if (string.IsNullOrWhiteSpace(s3Options.BucketName))
    {
        throw new InvalidOperationException("Storage:S3:BucketName is required.");
    }

    var s3Config = new AmazonS3Config
    {
        ForcePathStyle = s3Options.ForcePathStyle,
        AuthenticationRegion = s3Options.Region,
        RegionEndpoint = RegionEndpoint.GetBySystemName(s3Options.Region)
    };

    if (!string.IsNullOrWhiteSpace(s3Options.ServiceUrl))
    {
        s3Config.ServiceURL = s3Options.ServiceUrl;
        s3Config.UseHttp = s3Options.ServiceUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase);
    }

    if (!string.IsNullOrWhiteSpace(s3Options.AccessKey) && !string.IsNullOrWhiteSpace(s3Options.SecretKey))
    {
        return new AmazonS3Client(new BasicAWSCredentials(s3Options.AccessKey, s3Options.SecretKey), s3Config);
    }

    return new AmazonS3Client(s3Config);
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("NextJsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// DI
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IJobService, JobService>();
builder.Services.AddScoped<IBidService, BidService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IStorageService, S3StorageService>();

var app = builder.Build();

// 4. Database Seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<NeighbourHelpDbContext>();
    var logger = services.GetRequiredService<ILogger<Program>>();

    // Production-ready retry logic to wait for the DB container to initialize
    int maxRetries = 10;
    int delayMilliseconds = 5000; // 5 seconds between retries

    for (int i = 1; i <= maxRetries; i++)
    {
        try
        {
            logger.LogInformation("Attempting to connect to database (Attempt {Attempt}/{MaxRetries})...", i, maxRetries);
            await DbInitializer.SeedAsync(context);
            logger.LogInformation("Database connection and seeding successful.");
            break; // Exit loop on success
        }
        catch (Exception ex)
        {
            if (i == maxRetries)
            {
                logger.LogCritical(ex, "Database connection failed after {MaxRetries} attempts. API shutting down.", maxRetries);
                throw;
            }

            logger.LogWarning("Database is not ready yet. Retrying in {Delay}s...", delayMilliseconds / 1000);
            await Task.Delay(delayMilliseconds);
        }
    }
}

// 5. Middleware Pipeline
app.UseMiddleware<GlobalExceptionMiddleware>(); 
app.UseMiddleware<SecurityHeadersMiddleware>(); 

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging(); 
app.UseRateLimiter(); 

app.UseCors("NextJsPolicy");
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseMiddleware<TokenValidationMiddleware>(); 
app.UseAuthorization();

// Health Check Endpoints
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready");

app.MapControllers();
app.MapGet("/", () => "NeighborHelp API is running...");

app.Run();

public partial class Program { }
