using IdentityService.API.Data;
using IdentityService.API.Authorization;
using IdentityService.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;

namespace IdentityService.API.Extensions;

public static class AuthDbSeeder
{
    public static void Seed(
        AuthDbContext context,
        IPasswordHasher<ApplicationUser> passwordHasher,
        IConfiguration configuration)
    {
        if (context.Users.Any(user =>
            user.Role == UserRoles.Admin || user.Role == UserRoles.SuperAdmin))
        {
            return;
        }

        var email = configuration["BootstrapAdmin:Email"];
        var password = configuration["BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var admin = context.Users.FirstOrDefault(user => user.Email == email);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                FullName = "System Admin",
                Email = email
            };
            context.Users.Add(admin);
        }

        admin.Role = UserRoles.SuperAdmin;
        admin.PasswordHash = passwordHasher.HashPassword(admin, password);
        context.SaveChanges();
    }
}
