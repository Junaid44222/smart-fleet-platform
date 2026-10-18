using IdentityService.API.Data;
using IdentityService.API.Models;
using Microsoft.AspNetCore.Identity;

namespace IdentityService.API.Extensions;

public static class AuthDbSeeder
{
    public static void Seed(
        AuthDbContext context,
        IPasswordHasher<ApplicationUser> passwordHasher)
    {
        if (context.Users.Any())
        {
            return;
        }

        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = "System Admin",
            Email = "admin@smartfleet.com",
            Role = "SuperAdmin"
        };
        admin.PasswordHash = passwordHasher.HashPassword(admin, "Admin@123");

        context.Users.Add(admin);
        context.SaveChanges();
    }

}
