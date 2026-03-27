using backend.Models.DTOs;

namespace backend.Services;

public interface IUserService
{
    Task<IEnumerable<UserDto>> GetAllUsers(UserSearchRequest request);
}
