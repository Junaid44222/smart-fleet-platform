using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Text.RegularExpressions;

namespace SmartFleet.Common.Diagnostics;

public static class SmartFleetDiagnosticsExtensions
{
    public static IServiceCollection AddSmartFleetDiagnostics(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<CorrelationIdOptions>(options =>
        {
            var section = configuration.GetSection("SmartFleet:Diagnostics");
            var headerName = section["CorrelationIdHeader"];
            if (!string.IsNullOrWhiteSpace(headerName) &&
                Regex.IsMatch(headerName, "^[!#$%&'*+.^_`|~0-9A-Za-z-]+$", RegexOptions.CultureInvariant))
            {
                options.HeaderName = headerName;
            }

            if (int.TryParse(section["MaxCorrelationIdLength"], out var maxLength) &&
                maxLength is > 0 and <= 512)
            {
                options.MaxLength = maxLength;
            }
        });

        return services;
    }

    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app) =>
        app.UseMiddleware<CorrelationIdMiddleware>();
}
