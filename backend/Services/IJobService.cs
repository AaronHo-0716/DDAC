using backend.Models.DTOs;

namespace backend.Services;

public interface IJobService
{
    Task<JobListResponse> GetJobsAsync(JobFilterQuery filter, Guid? userId);
    Task<JobListResponse> AdminGetJobsAsync(JobFilterQuery filter, Guid? userId);
    Task<JobListResponse> GetMyJobsAsync(Guid userId, int page = 1, int pageSize = 1000);
    Task<JobDto?> GetJobByIdAsync(Guid jobId, Guid? userId);
    Task<JobDto> CreateJobAsync(CreateJobRequest request, Guid userId);
    Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request, Guid userId);
    Task<JobDto> CompleteJobAsync(Guid jobId, Guid userId);
    Task DeleteJobAsync(Guid jobId, Guid userId);
}


