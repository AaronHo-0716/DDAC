namespace backend.Models.DTOs;

public record ForgotPasswordRequest(string Email);
public record SendOtpRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
public record ChangePasswordRequest(string Otp, string OldPassword, string NewPassword);