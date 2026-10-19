using System.Security.Cryptography;
using IdentityService.API.Data;
using IdentityService.API.Authorization;
using IdentityService.API.DTOs;
using IdentityService.API.Models;
using IdentityService.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthDbContext _context;

    private readonly IJwtTokenService _jwtTokenService;

    private readonly IPasswordHasher<ApplicationUser> _passwordHasher;

    public AuthController(
        AuthDbContext context,
        IJwtTokenService jwtTokenService,
        IPasswordHasher<ApplicationUser> passwordHasher)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _passwordHasher = passwordHasher;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterRequestDto request)
    {
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(
                x => x.Email == request.Email);

        if (existingUser != null)
        {
            return BadRequest(
                new AuthResponseDto
                {
                    Success = false,
                    Message = "User already exists"
                });
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = request.Email,
            Role = UserRoles.Dispatcher
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);

        await _context.SaveChangesAsync();

        return Ok(
            new AuthResponseDto
            {
                Success = true,
                Message = "User registered successfully",
                Role = user.Role
            });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginRequestDto request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(
                x => x.Email == request.Email);

        if (user is null)
        {
            return Unauthorized(
                new AuthResponseDto
                {
                    Success = false,
                    Message = "Invalid credentials"
                });
        }

        if (!VerifyPassword(user, request.Password, out var shouldRehash))
        {
            return Unauthorized(
                new AuthResponseDto
                {
                    Success = false,
                    Message = "Invalid credentials"
                });
        }

        if (shouldRehash)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
            await _context.SaveChangesAsync();
        }

        var token =
            _jwtTokenService.GenerateToken(user);

        return Ok(
            new AuthResponseDto
            {
                Success = true,
                Token = token,
                Message = "Login successful",
                Role = user.Role,
                FullName = user.FullName
            });
    }

    [HttpGet("users")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .OrderBy(user => user.FullName)
            .Select(user => new UserSummaryDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role
            })
            .ToListAsync();

        return Ok(new AuthResponseDto
        {
            Success = true,
            Message = "Users fetched successfully",
            Data = users
        });
    }

    [HttpPut("users/{id:guid}/role")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<IActionResult> UpdateUserRole(
        Guid id,
        UpdateUserRoleRequestDto request)
    {
        if (Guid.TryParse(User.FindFirst("UserId")?.Value, out var actingUserId) &&
            actingUserId == id)
        {
            return BadRequest(new AuthResponseDto
            {
                Success = false,
                Message = "Administrators cannot change their own role."
            });
        }

        var role = UserRoles.AssignableRoles.FirstOrDefault(candidate =>
            string.Equals(candidate, request.Role, StringComparison.OrdinalIgnoreCase));
        if (role is null)
        {
            return BadRequest(new AuthResponseDto
            {
                Success = false,
                Message = "The requested role is not assignable."
            });
        }

        var user = await _context.Users.FindAsync(id);
        if (user is null)
        {
            return NotFound(new AuthResponseDto
            {
                Success = false,
                Message = "User not found."
            });
        }

        user.Role = role;
        await _context.SaveChangesAsync();

        return Ok(new AuthResponseDto
        {
            Success = true,
            Message = "User role updated successfully.",
            Role = user.Role
        });
    }

    [HttpDelete("users/{id:guid}")]
    [Authorize(Roles = UserRoles.SuperAdmin)]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        if (Guid.TryParse(User.FindFirst("UserId")?.Value, out var actingUserId) &&
            actingUserId == id)
        {
            return BadRequest(new AuthResponseDto
            {
                Success = false,
                Message = "SuperAdmins cannot delete their own account."
            });
        }

        var user = await _context.Users.FindAsync(id);
        if (user is null)
        {
            return NotFound(new AuthResponseDto
            {
                Success = false,
                Message = "User not found."
            });
        }

        if (string.Equals(user.Role, UserRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase) &&
            await _context.Users.CountAsync(candidate => candidate.Role == UserRoles.SuperAdmin) <= 1)
        {
            return Conflict(new AuthResponseDto
            {
                Success = false,
                Message = "The last SuperAdmin account cannot be deleted."
            });
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(new AuthResponseDto
        {
            Success = true,
            Message = "User deleted successfully."
        });
    }

    private bool VerifyPassword(
        ApplicationUser user,
        string password,
        out bool shouldRehash)
    {
        var legacyMatch = VerifyLegacySha256(
            user.PasswordHash,
            password,
            out var isLegacyHash);

        if (isLegacyHash)
        {
            shouldRehash = legacyMatch;
            return legacyMatch;
        }

        var result = _passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            password);
        shouldRehash = result == PasswordVerificationResult.SuccessRehashNeeded;
        return result != PasswordVerificationResult.Failed;
    }

    private static bool VerifyLegacySha256(
        string storedHash,
        string password,
        out bool isLegacyHash)
    {
        isLegacyHash = false;
        byte[] expectedHash;
        try
        {
            expectedHash = Convert.FromBase64String(storedHash);
        }
        catch (FormatException)
        {
            return false;
        }

        if (expectedHash.Length != 32)
        {
            return false;
        }

        isLegacyHash = true;
        var passwordHash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(password));
        return CryptographicOperations.FixedTimeEquals(passwordHash, expectedHash);
    }
}
