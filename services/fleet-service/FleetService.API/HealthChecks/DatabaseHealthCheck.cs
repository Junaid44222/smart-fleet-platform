using FleetService.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FleetService.API.HealthChecks;

public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly FleetDbContext _dbContext;

    public DatabaseHealthCheck(FleetDbContext dbContext)
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
                ? HealthCheckResult.Healthy("Fleet database is reachable.")
                : HealthCheckResult.Unhealthy("Fleet database is unreachable.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("Fleet database is unreachable.", exception);
        }
    }
}
