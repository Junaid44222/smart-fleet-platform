using IdentityService.API.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IdentityService.API.HealthChecks;

public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly AuthDbContext _dbContext;

    public DatabaseHealthCheck(AuthDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy("Identity database is reachable.")
                : HealthCheckResult.Unhealthy("Identity database is unreachable.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("Identity database is unreachable.", exception);
        }
    }
}
