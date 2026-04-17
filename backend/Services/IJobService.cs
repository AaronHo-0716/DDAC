using backend.Models.DTOs;

namespace backend.Services;

public interface IJobService
{
    Task<JobListResponse> GetJobsAsync(JobFilterQuery filter);
    Task<JobListResponse> AdminGetJobsAsync(JobFilterQuery filter);
    Task<JobListResponse> GetMyJobsAsync(int page = 1, int pageSize = 1000);
    Task<JobDto?> GetJobByIdAsync(Guid jobId);
    Task<JobDto> CreateJobAsync(CreateJobRequest request);
    Task<JobDto> UpdateJobAsync(Guid jobId, UpdateJobRequest request);
    Task<JobDto> CompleteJobAsync(Guid jobId);
    Task DeleteJobAsync(Guid jobId);
}


