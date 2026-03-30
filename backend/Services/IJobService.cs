using backend.Data;
using backend.Models.Entities;
using backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface IJobService
{
    /// <summary>
    /// Get all jobs with filters and pagination.
    /// Handyman can see open jobs, Admin can see all jobs.
    /// </summary>
    Task<JobListResponse> GetJobsAsync(JobFilterQuery filter, Guid? userId, string userRole);

    /// <summary>
    /// Get jobs posted by the current user (homeowner only).
    /// </summary>
    Task<JobListResponse> GetMyJobsAsync(Guid userId, int page = 1, int pageSize = 10);

    /// <summary>
    /// Get a single job by ID.
    /// Handyman can only see open jobs, Admin can see all.
    /// </summary>
    Task<JobDto?> GetJobByIdAsync(Guid jobId, Guid? userId, string userRole);

    /// <summary>
    /// Create a new job (homeowner only).
    /// </summary>
    Task<JobDto> CreateJobAsync(CreateJobRequest request, Guid userId);

    /// <summary>
    /// Update a job (homeowner owner only or admin).
    /// </summary>
    Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request, Guid userId, string userRole);

    /// <summary>
    /// Delete a job (homeowner owner only or admin).
    /// </summary>
    Task DeleteJobAsync(Guid jobId, Guid userId, string userRole);
}

public class JobService : IJobService
{
    private readonly NeighbourHelpDbContext _context;
    private const int MaxDistance = 100; // km

    public JobService(NeighbourHelpDbContext context)
    {
        _context = context;
    }

    public async Task<JobListResponse> GetJobsAsync(JobFilterQuery filter, Guid? userId, string userRole)
    {
        var query = _context.jobs.AsQueryable();

        // Apply role-based visibility rules
        if (userRole == "handyman")
        {
            // Handyman can only see open jobs
            query = query.Where(j => j.status == "open");
        }
        else if (userRole == "homeowner")
        {
            // Homeowner can see all open jobs (for discovery) and their own jobs
            query = query.Where(j => j.status == "open" || j.posted_by_user_id == userId);
        }
        // Admin can see all jobs (no filter)

        // Apply filters
        if (!string.IsNullOrEmpty(filter.Category))
        {
            query = query.Where(j => j.category == filter.Category);
        }

        if (!string.IsNullOrEmpty(filter.Status))
        {
            query = query.Where(j => j.status == filter.Status);
        }

        if (!string.IsNullOrEmpty(filter.Search))
        {
            query = query.Where(j => 
                j.title.Contains(filter.Search) || 
                j.description.Contains(filter.Search) ||
                j.location_text.Contains(filter.Search));
        }

        if (filter.IsEmergency.HasValue)
        {
            query = query.Where(j => j.is_emergency == filter.IsEmergency.Value);
        }

        // Distance filter (if latitude/longitude available)
        if (filter.MaxDistanceKm.HasValue && userId.HasValue)
        {
            // This is a simplified implementation. In production, use PostGIS or similar.
            // For now, we'll just apply basic distance logic if coordinates are available.
            var maxDistance = filter.MaxDistanceKm.Value;
            query = query.Where(j => 
                j.latitude != null && j.longitude != null);
        }

        // Get total count
        var totalCount = await query.CountAsync();

        // Apply pagination
        var jobs = await query
            .Include(j => j.posted_by_user)
            .Include(j => j.job_images)
            .OrderByDescending(j => j.created_at_utc)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        // Map to DTOs
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
        var query = _context.jobs
            .Where(j => j.posted_by_user_id == userId);

        var totalCount = await query.CountAsync();

        var jobs = await query
            .Include(j => j.posted_by_user)
            .Include(j => j.job_images)
            .Include(j => j.bid)
            .OrderByDescending(j => j.created_at_utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var jobDtos = jobs.Select(j => MapToDto(j)).ToList();

        return new JobListResponse(jobDtos, page, pageSize, totalCount);
    }

    public async Task<JobDto?> GetJobByIdAsync(Guid jobId, Guid? userId, string userRole)
    {
        var job = await _context.jobs
            .Include(j => j.posted_by_user)
            .Include(j => j.job_images)
            .FirstOrDefaultAsync(j => j.id == jobId);

        if (job == null)
            return null;

        // Apply visibility rules
        if (userRole == "handyman" && job.status != "open")
        {
            return null; // Handyman can only see open jobs
        }

        if (userRole == "homeowner" && job.status != "open" && job.posted_by_user_id != userId)
        {
            return null; // Homeowner can only see open jobs or their own
        }

        // Admin can see all jobs (no restriction)

        return MapToDto(job);
    }

    public async Task<JobDto> CreateJobAsync(CreateJobRequest request, Guid userId)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Title is required");
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new ArgumentException("Description is required");
        if (request.Budget.HasValue && request.Budget < 0)
            throw new ArgumentException("Budget cannot be negative");

        var newJob = new job
        {
            id = Guid.NewGuid(),
            posted_by_user_id = userId,
            title = request.Title,
            description = request.Description,
            category = request.Category,
            location_text = request.Location,
            latitude = request.Latitude,
            longitude = request.Longitude,
            budget = request.Budget,
            status = "open",
            is_emergency = request.IsEmergency,
            created_at_utc = DateTime.UtcNow,
            updated_at_utc = DateTime.UtcNow
        };

        _context.jobs.Add(newJob);

        // Add job images if provided
        if (request.ImageUrls != null && request.ImageUrls.Count > 0)
        {
            var images = request.ImageUrls.Select((url, index) => new job_image
            {
                id = Guid.NewGuid(),
                job_id = newJob.id,
                image_url = url,
                object_key = $"job-{newJob.id}/image-{index}",
                sort_order = index,
                created_at_utc = DateTime.UtcNow
            }).ToList();

            _context.job_images.AddRange(images);
        }

        await _context.SaveChangesAsync();

        // Fetch the job with related data
        var createdJob = await _context.jobs
            .Include(j => j.posted_by_user)
            .Include(j => j.job_images)
            .FirstAsync(j => j.id == newJob.id);

        return MapToDto(createdJob);
    }

    public async Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request, Guid userId, string userRole)
    {
        var job = await _context.jobs
            .Include(j => j.posted_by_user)
            .Include(j => j.job_images)
            .FirstOrDefaultAsync(j => j.id == jobId);

        if (job == null)
            throw new KeyNotFoundException($"Job with id {jobId} not found");

        // Authorization: only owner (homeowner) or admin can update
        if (userRole != "admin" && job.posted_by_user_id != userId)
            throw new UnauthorizedAccessException("You can only update your own jobs");

        // Validate input
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Title is required");
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new ArgumentException("Description is required");
        if (request.Budget.HasValue && request.Budget < 0)
            throw new ArgumentException("Budget cannot be negative");

        job.title = request.Title;
        job.description = request.Description;
        job.category = request.Category;
        job.location_text = request.Location;
        job.latitude = request.Latitude;
        job.longitude = request.Longitude;
        job.budget = request.Budget;
        job.is_emergency = request.IsEmergency;
        job.updated_at_utc = DateTime.UtcNow;

        _context.jobs.Update(job);
        await _context.SaveChangesAsync();

        // Fetch updated job with related data
        var updatedJob = await _context.jobs
            .Include(j => j.posted_by_user)
            .Include(j => j.job_images)
            .FirstAsync(j => j.id == jobId);

        return MapToDto(updatedJob);
    }

    public async Task DeleteJobAsync(Guid jobId, Guid userId, string userRole)
    {
        var job = await _context.jobs.FirstOrDefaultAsync(j => j.id == jobId);

        if (job == null)
            throw new KeyNotFoundException($"Job with id {jobId} not found");

        // Authorization: only owner (homeowner) or admin can delete
        if (userRole != "admin" && job.posted_by_user_id != userId)
            throw new UnauthorizedAccessException("You can only delete your own jobs");

        _context.jobs.Remove(job);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Helper method to map job entity to DTO, including bid count.
    /// </summary>
    private JobDto MapToDto(job job)
    {
        var bidCount = _context.bids.Count(b => b.job_id == job.id);
        
        return new JobDto(
            Id: job.id,
            Title: job.title,
            Description: job.description,
            Category: job.category,
            Location: job.location_text,
            Latitude: job.latitude,
            Longitude: job.longitude,
            Budget: job.budget,
            Status: job.status,
            IsEmergency: job.is_emergency,
            PostedBy: new UserDto(
                Id: job.posted_by_user.Id,
                Name: job.posted_by_user.Name,
                Email: job.posted_by_user.Email,
                Role: job.posted_by_user.Role,
                AvatarUrl: job.posted_by_user.AvatarUrl,
                Rating: job.posted_by_user.Rating,
                CreatedAt: job.posted_by_user.CreatedAtUtc,
                IsActive: true
            ),
            CreatedAt: job.created_at_utc,
            UpdatedAt: job.updated_at_utc,
            BidCount: bidCount,
            ImageUrls: job.job_images.OrderBy(img => img.sort_order).Select(img => img.image_url).ToList()
        );
    }
}
