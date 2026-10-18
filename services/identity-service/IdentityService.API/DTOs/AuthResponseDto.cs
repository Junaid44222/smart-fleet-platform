namespace IdentityService.API.DTOs;

public class AuthResponseDto
{
    public bool Success { get; set; }

    public string Token { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public object? Data { get; set; }
}