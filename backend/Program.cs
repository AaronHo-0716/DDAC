using System.Text;
using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using backend.Data;
using backend.Data.Seeders;
using backend.Middleware;
using backend.Models.Config;
using backend.Services;
using backend.Hubs; 
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Threading.RateLimiting;
using StackExchange.Redis; 
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

// 1. LOGGING (Serilog)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// 2. CONFIGURATION & CORE SERVICES
if (!builder.Environment.IsDevelopment())
{
    builder.Configuration.AddSystemsManager("/app/", optional: true);
}

// Keep JWT claim names clean (e.g. "role" instead of schemas.xmlsoap...)
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// Health Checks & Metrics
builder.Services.AddHealthChecks().AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!);
builder.Services.AddMetrics();
builder.Services.AddSingleton<MetricsService>();
builder.Services.AddEndpointsApiExplorer();

// 3. DATABASE & REAL-TIME (SignalR + Redis)
builder.Services.AddDbContext<NeighbourHelpDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// SignalR Configuration with Redis Backplane
var redisUrl = builder.Configuration["Redis:ConnectionString"] ?? "redis:6379";
builder.Services.AddSignalR()
    .AddStackExchangeRedis(redisUrl, options => {
        options.Configuration.ChannelPrefix = RedisChannel.Literal("NeighborHelpChat");
    });

// 4. AUTHENTICATION & AUTHORIZATION
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ClockSkew = TimeSpan.Zero
        };

        // Handle JWT in QueryString for SignalR WebSocket Handshakes
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/api/chat-hub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();

// 5. INFRASTRUCTURE (CORS, Rate Limiting, Storage)
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

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth_policy", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromSeconds(30);
        opt.QueueLimit = 0;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// S3 Storage Setup
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

// 6. DEPENDENCY INJECTION
builder.Services.AddScoped<ServiceDependencies>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IJobService, JobService>();
builder.Services.AddScoped<IBidService, BidService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IRatingService, RatingService>();
builder.Services.AddScoped<IStorageService, S3StorageService>();

// Swagger
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "NeighborHelp API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http, Scheme = "Bearer", In = ParameterLocation.Header
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() }
    });
});

var app = builder.Build();

// 7. DATABASE SEEDING (With Retry Logic)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<NeighbourHelpDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    int maxRetries = 10;
    for (int i = 1; i <= maxRetries; i++)
    {
        try {
            await DbInitializer.SeedAsync(context);
            break;
        } catch {
            if (i == maxRetries) throw;
            await Task.Delay(5000);
        }
    }
}

// 8. MIDDLEWARE PIPELINE
app.UseMiddleware<GlobalExceptionMiddleware>(); 
app.UseMiddleware<SecurityHeadersMiddleware>(); 

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging(); 
app.UseCors("NextJsPolicy"); 
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseMiddleware<TokenValidationMiddleware>(); 
app.UseAuthorization();

app.UseRateLimiter();

// Hub & Controller Mapping
app.MapHub<ChatHub>("/api/chat-hub"); 
app.MapHub<NotificationHub>("/api/notification-hub");

// Health Check Endpoints
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready");

app.MapControllers();
app.MapGet("/", () => "NeighborHelp API is running...");

app.Run();

public partial class Program { }