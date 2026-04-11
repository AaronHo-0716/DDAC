using backend.Data;
using backend.Models.Entities;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public interface IJobService
{
    Task<JobListResponse> GetJobsAsync(JobFilterQuery filter, Guid? userId, string userRole);

    Task<JobListResponse> GetMyJobsAsync(Guid userId, int page = 1, int pageSize = 10);

    Task<JobDto?> GetJobByIdAsync(Guid jobId, Guid? userId, string userRole);

    Task<JobDto> CreateJobAsync(CreateJobRequest request, Guid userId);

    Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request, Guid userId, string userRole);

    Task DeleteJobAsync(Guid jobId, Guid userId, string userRole);
}

public class JobService : IJobService
{
    private readonly NeighbourHelpDbContext _context;
    private readonly ILogger<JobService> _logger;
    private const int MaxDistance = 100; // km

    public JobService(NeighbourHelpDbContext context, ILogger<JobService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<JobListResponse> GetJobsAsync(JobFilterQuery filter, Guid? userId, string userRole)
    {
        var query = _context.Jobs.AsQueryable();

        if (userRole == "handyman")
        {
            query = query.Where(j => j.Status == "open");
        }
        else if (userRole == "homeowner")
        {
            query = query.Where(j => j.Status == "open" || j.Posted_By_User_Id == userId);
        }

        if (!string.IsNullOrEmpty(filter.Category))
        {
            query = query.Where(j => j.Category == filter.Category);
        }

        if (!string.IsNullOrEmpty(filter.Status))
        {
            query = query.Where(j => j.Status == filter.Status);
        }

        if (!string.IsNullOrEmpty(filter.Search))
        {
            query = query.Where(j => 
                j.Title.Contains(filter.Search) || 
                j.Description.Contains(filter.Search) ||
                j.Location_Text.Contains(filter.Search));
        }

        if (filter.IsEmergency.HasValue)
        {
            query = query.Where(j => j.Is_Emergency == filter.IsEmergency.Value);
        }

        if (filter.MaxDistanceKm.HasValue && userId.HasValue)
        {
            var maxDistance = filter.MaxDistanceKm.Value;
            query = query.Where(j => 
                j.Latitude != null && j.Longitude != null);
        }

        var totalCount = await query.CountAsync();

        var jobs = await query
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .OrderByDescending(j => j.Created_At_Utc)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        var jobDtos = jobs.Select(j => MapToDto(j)).ToList();

        return new JobListResponse(
            jobDtos,
            filter.Page,
            filter.PageSize,
            totalCount
        );
    }

    public async Task<JobListResponse> GetMyJobsAsync(Guid userId, int page = 1, int pageSize = 10)
    {
        var query = _context.Jobs
            .Where(j => j.Posted_By_User_Id == userId);

        var totalCount = await query.CountAsync();

        var jobs = await query
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .OrderByDescending(j => j.Created_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var jobDtos = jobs.Select(j => MapToDto(j)).ToList();

        return new JobListResponse(jobDtos, page, pageSize, totalCount);

    }

    public async Task<JobDto?> GetJobByIdAsync(Guid jobId, Guid? userId, string userRole)
    {
        var job = await _context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job == null)
            return null;

        if (userRole == "handyman" && job.Status != "open")
        {
            return null;
        }

        if (userRole == "homeowner" && job.Status != "open" && job.Posted_By_User_Id != userId)
        {
            return null;
        }

        return MapToDto(job);
    }

    public async Task<JobDto> CreateJobAsync(CreateJobRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Title is required");
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new ArgumentException("Description is required");
        if (request.Budget.HasValue && request.Budget < 0)
            throw new ArgumentException("Budget cannot be negative");

        var newJob = new Job
        {
            Id = Guid.NewGuid(),
            Posted_By_User_Id = userId,
            Title = request.Title,
            Description = request.Description,
            Category = request.Category,
            Location_Text = request.Location,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Budget = request.Budget,
            Status = "open",
            Is_Emergency = request.IsEmergency,
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };

        _context.Jobs.Add(newJob);

        if (request.ImageUrls != null && request.ImageUrls.Count > 0)
        {
            var images = request.ImageUrls.Select((url, index) => new Job_Image
            {
                Id = Guid.NewGuid(),
                Job_Id = newJob.Id,
                Image_Url = url,
                Object_Key = $"job-{newJob.Id}/image-{index}",
                Sort_Order = index,
                Created_At_Utc = DateTime.UtcNow
            }).ToList();

            _context.Job_Images.AddRange(images);
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Job {JobId} created by User {UserId}", newJob.Id, userId);

        var createdJob = await _context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstAsync(j => j.Id == newJob.Id);

        return MapToDto(createdJob);
    }

    public async Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request, Guid userId, string userRole)
    {
        var job = await _context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job == null)
            throw new KeyNotFoundException($"Job with id {jobId} not found");

        if (userRole != "admin" && job.Posted_By_User_Id != userId)
            throw new UnauthorizedAccessException("You can only update your own jobs");

        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Title is required");
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new ArgumentException("Description is required");
        if (request.Budget.HasValue && request.Budget < 0)
            throw new ArgumentException("Budget cannot be negative");

        job.Title = request.Title;
        job.Description = request.Description;
        job.Category = request.Category;
        job.Location_Text = request.Location;
        job.Latitude = request.Latitude;
        job.Longitude = request.Longitude;
        job.Budget = request.Budget;
        job.Is_Emergency = request.IsEmergency;
        job.Updated_At_Utc = DateTime.UtcNow;

        _context.Jobs.Update(job);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Job {JobId} updated by User {UserId}", jobId, userId);

        var updatedJob = await _context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstAsync(j => j.Id == jobId);

        return MapToDto(updatedJob);
    }

    public async Task DeleteJobAsync(Guid jobId, Guid userId, string userRole)
    {
        var job = await _context.Jobs.FirstOrDefaultAsync(j => j.Id == jobId);

        if (job == null)
            throw new KeyNotFoundException($"Job with id {jobId} not found");

        if (userRole != "admin" && job.Posted_By_User_Id != userId)
            throw new UnauthorizedAccessException("You can only delete your own jobs");

        _context.Jobs.Remove(job);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Job {JobId} deleted by User {UserId}", jobId, userId);
    }

    private JobDto MapToDto(Job job)
    {
        var bidCount = _context.Bids.Count(b => b.Job_Id == job.Id);
        
        return new JobDto(
            Id: job.Id,
            Title: job.Title,
            Description: job.Description,
            Category: job.Category,
            Location: job.Location_Text,
            Latitude: job.Latitude,
            Longitude: job.Longitude,
            Budget: job.Budget,
            Status: job.Status,
            IsEmergency: job.Is_Emergency,
            PostedBy: new UserDto(
                Id: job.Posted_By_User.Id,
                Name: job.Posted_By_User.Name,
                Email: job.Posted_By_User.Email,
                Role: job.Posted_By_User.Role,
                AvatarUrl: job.Posted_By_User.AvatarUrl,
                Rating: job.Posted_By_User.Rating,
                CreatedAt: job.Posted_By_User.CreatedAtUtc,
                IsActive: true
            ),
            CreatedAt: job.Created_At_Utc,
            UpdatedAt: job.Updated_At_Utc,
            BidCount: bidCount,
            ImageUrls: job.Job_Images.OrderBy(img => img.Sort_Order).Select(img => img.Image_Url).ToList()
        );
    }
}
