namespace backend.Constants;

public enum UserRole { Handyman, Homeowner, Admin }

public enum VerificationStatus { Pending, Approved, Rejected }

public static class AuthConstants
{
    public const int RefreshTokenExpiryDays = 7;
    public const int DefaultJwtExpiryMinutes = 60;

    public static string ToDbString(this UserRole role) => role.ToString().ToLower();
    public static string ToDbString(this VerificationStatus status) => status.ToString().ToLower();
    public static VerificationStatus ParseVerification(string? statusStr, string roleDbString)
    {
        if (roleDbString != UserRole.Handyman.ToDbString())
        {
            return VerificationStatus.Approved;
        }

        if (string.IsNullOrWhiteSpace(statusStr))
        {
            return VerificationStatus.Pending;
        }

        return Enum.TryParse<VerificationStatus>(statusStr, true, out var result) 
            ? result 
            : VerificationStatus.Pending;
    }
}