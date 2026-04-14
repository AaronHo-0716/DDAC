using backend.Data;
using backend.Models.Entities;
using backend.Models.DTOs;
using backend.Constants;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace backend.Services;

public class JobService(NeighbourHelpDbContext context, ILogger<JobService> logger) : BaseService(context, logger), IJobService
{
    public async Task<JobListResponse> GetJobsAsync(JobFilterQuery filter, Guid? userId, string userRole)
    {
        var query = context.Jobs.AsQueryable();

        if (userRole == UserRole.Handyman.ToDbString())
        {
            query = query.Where(j => j.Status == JobStatus.Open.ToDbString());
        }
        else if (userRole == UserRole.Homeowner.ToDbString())
        {
            query = query.Where(j => j.Status == JobStatus.Open.ToDbString() || j.Posted_By_User_Id == userId);
        }

        if (!string.IsNullOrEmpty(filter.Category))
            query = query.Where(j => j.Category == filter.Category);

        if (filter.Status.HasValue)
            query = query.Where(j => j.Status == filter.Status.Value.ToDbString());

        if (!string.IsNullOrEmpty(filter.Search))
        {
            query = query.Where(j => 
                j.Title.Contains(filter.Search) || 
                j.Description.Contains(filter.Search) ||
                j.Location_Text.Contains(filter.Search));
        }

        if (filter.IsEmergency.HasValue)
            query = query.Where(j => j.Is_Emergency == filter.IsEmergency.Value);

        if (filter.MaxDistanceKm.HasValue && userId.HasValue)
        {
            query = query.Where(j => j.Latitude != null && j.Longitude != null);
        }

        var totalCount = await query.CountAsync();

        var jobs = await query
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .OrderByDescending(j => j.Created_At_Utc)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new JobListResponse(
            jobs.Select(MapJobToDto).ToList(),
            filter.Page,
            filter.PageSize,
            totalCount
        );
    }

    public async Task<JobListResponse> GetMyJobsAsync(Guid userId, int page = 1, int pageSize = 10)
    {
        var query = context.Jobs.Where(j => j.Posted_By_User_Id == userId);
        var totalCount = await query.CountAsync();

        var jobs = await query
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .OrderByDescending(j => j.Created_At_Utc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new JobListResponse(jobs.Select(MapJobToDto).ToList(), page, pageSize, totalCount);
    }

    public async Task<JobDto?> GetJobByIdAsync(Guid jobId, Guid? userId, string userRole)
    {
        var job = await context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job == null) 
            throw new HttpRequestException($"Job with id {jobId} not found or access denied", null, HttpStatusCode.NotFound);

        string openStatus = JobStatus.Open.ToDbString();

        if (userRole == UserRole.Handyman.ToDbString() && job.Status != openStatus)
        {
            if (!userId.HasValue) 
                throw new HttpRequestException($"Job with id {jobId} not found or access denied", null, HttpStatusCode.NotFound);

            var hasAcceptedBid = await context.Bids.AnyAsync(b =>
                b.Job_Id == jobId &&
                b.Handyman_User_Id == userId.Value &&
                b.Status == BidStatus.Accepted.ToDbString());

            if (!hasAcceptedBid)
                throw new HttpRequestException($"Job with id {jobId} not found or access denied", null, HttpStatusCode.NotFound);

        }

        if (userRole == UserRole.Homeowner.ToDbString() && job.Status != openStatus && job.Posted_By_User_Id != userId)
            throw new HttpRequestException($"Job with id {jobId} not found or access denied", null, HttpStatusCode.NotFound);

        return MapJobToDto(job);
    }

    public async Task<JobDto> CreateJobAsync(CreateJobRequest request, Guid userId)
    {
        ValidateJobData(request.Title, request.Description, request.Budget);

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
            Status = JobStatus.Open.ToDbString(),
            Is_Emergency = request.IsEmergency,
            Created_At_Utc = DateTime.UtcNow,
            Updated_At_Utc = DateTime.UtcNow
        };

        context.Jobs.Add(newJob);

        if (request.ImageUrls?.Any() == true)
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
            context.Job_Images.AddRange(images);
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Job {JobId} created by User {UserId}", newJob.Id, userId);

        return await RefreshAndMap(newJob.Id);
    }

    public async Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request, Guid userId, string userRole)
    {
        var job = await context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job == null)
            throw new HttpRequestException($"Job with id {jobId} not found", null, HttpStatusCode.NotFound);

        if (userRole != UserRole.Admin.ToDbString() && job.Posted_By_User_Id != userId)
            throw new HttpRequestException("You can only update your own jobs", null, HttpStatusCode.Forbidden);

        ValidateJobData(request.Title, request.Description, request.Budget);

        job.Title = request.Title;
        job.Description = request.Description;
        job.Category = request.Category;
        job.Location_Text = request.Location;
        job.Latitude = request.Latitude;
        job.Longitude = request.Longitude;
        job.Budget = request.Budget;
        job.Is_Emergency = request.IsEmergency;
        job.Updated_At_Utc = DateTime.UtcNow;

        context.Jobs.Update(job);
        await context.SaveChangesAsync();
        logger.LogInformation("Job {JobId} updated by User {UserId}", jobId, userId);

        return await RefreshAndMap(jobId);
    }

    public async Task DeleteJobAsync(Guid jobId, Guid userId, string userRole)
    {
        var job = await context.Jobs.FirstOrDefaultAsync(j => j.Id == jobId)
            ?? throw new HttpRequestException($"Job with id {jobId} not found", null, HttpStatusCode.NotFound);

        if (userRole != UserRole.Admin.ToDbString() && job.Posted_By_User_Id != userId)
            throw new HttpRequestException("You can only delete your own jobs", null, HttpStatusCode.Forbidden);

        context.Jobs.Remove(job);
        await context.SaveChangesAsync();
        logger.LogInformation("Job {JobId} deleted by User {UserId}", jobId, userId);
    }

    private void ValidateJobData(string title, string description, decimal? budget)
    {
        if (string.IsNullOrWhiteSpace(title)) 
            throw new HttpRequestException("Title is required", null, HttpStatusCode.BadRequest);
        if (string.IsNullOrWhiteSpace(description)) 
            throw new HttpRequestException("Description is required", null, HttpStatusCode.BadRequest);
        if (budget.HasValue && budget < 0) 
            throw new HttpRequestException("Budget cannot be negative", null, HttpStatusCode.BadRequest);
    }

    private async Task<JobDto> RefreshAndMap(Guid jobId)
    {
        var job = await context.Jobs
            .Include(j => j.Posted_By_User)
            .Include(j => j.Job_Images)
            .FirstAsync(j => j.Id == jobId);
        return MapJobToDto(job);
    }

}
