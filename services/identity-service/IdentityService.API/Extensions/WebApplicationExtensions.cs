using IdentityService.API.Data;
using IdentityService.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IdentityService.API.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication MigrateAndSeedDatabase(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<WebApplication>>();
        var context = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<ApplicationUser>>();

        try
        {
            EnsureDatabaseExists(context);
            context.Database.Migrate();
            AuthDbSeeder.Seed(context, passwordHasher);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to migrate or seed the IdentityService database.");
            throw;
        }

        return app;
    }

    private static void EnsureDatabaseExists(AuthDbContext context)
    {
        var connectionString =
            context.Database.GetConnectionString();

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "IdentityService database connection string is missing.");
        }

        var builder = new SqlConnectionStringBuilder(connectionString);
        var databaseName = builder.InitialCatalog;

        if (string.IsNullOrWhiteSpace(databaseName))
        {
            throw new InvalidOperationException(
                "IdentityService database name is missing from the connection string.");
        }

        builder.InitialCatalog = "master";

        using var connection = new SqlConnection(builder.ConnectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText =
            $"IF DB_ID(@databaseName) IS NULL CREATE DATABASE [{EscapeSqlIdentifier(databaseName)}];";

        command.Parameters.AddWithValue("@databaseName", databaseName);
        command.ExecuteNonQuery();
    }

    private static string EscapeSqlIdentifier(string value)
    {
        return value.Replace("]", "]]");
    }
}
