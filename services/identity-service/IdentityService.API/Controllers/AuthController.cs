using System.Security.Cryptography;
using IdentityService.API.Data;
using IdentityService.API.DTOs;
using IdentityService.API.Models;
using IdentityService.API.Services;
using Microsoft.AspNetCore.Identity;
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
            Role = request.Role
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);

        await _context.SaveChangesAsync();

        return Ok(
            new AuthResponseDto
            {
                Success = true,
                Message = "User registered successfully"
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
                Message = "Login successful"
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