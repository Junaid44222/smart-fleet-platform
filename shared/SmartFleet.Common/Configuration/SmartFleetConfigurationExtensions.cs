using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;

namespace SmartFleet.Common.Configuration;

public static class SmartFleetConfigurationExtensions
{
    private const string SharedSettingsResourceName =
        "SmartFleet.Common.appsettings.shared.json";

    public static WebApplicationBuilder AddSmartFleetSharedConfiguration(
        this WebApplicationBuilder builder,
        string[] args)
    {
        using var resource = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream(SharedSettingsResourceName)
            ?? throw new InvalidOperationException(
                $"Shared configuration resource '{SharedSettingsResourceName}' was not found.");

        using var sharedSettings = new MemoryStream();
        resource.CopyTo(sharedSettings);
        sharedSettings.Position = 0;
        builder.Configuration.AddJsonStream(sharedSettings);

        // Re-apply deployment overrides after shared defaults while preserving CLI precedence.
        builder.Configuration.AddEnvironmentVariables();
        if (args.Length > 0)
        {
            builder.Configuration.AddCommandLine(args);
        }

        return builder;
    }
}
