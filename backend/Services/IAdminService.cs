using backend.Models.DTOs;

namespace backend.Services;

public interface IAdminService
{
    Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request);
}
