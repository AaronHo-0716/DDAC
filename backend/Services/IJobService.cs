using backend.Models.DTOs;

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


