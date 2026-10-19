using Microsoft.AspNetCore.Builder;
using SmartFleet.Common.Configuration;
using Xunit;

namespace FleetService.Tests;

public class SmartFleetConfigurationTests
{
    [Fact]
    public void AddSmartFleetSharedConfiguration_LoadsSharedDefaults()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = Array.Empty<string>()
        });

        builder.AddSmartFleetSharedConfiguration(Array.Empty<string>());

        Assert.Equal(
            "X-Correlation-ID",
            builder.Configuration["SmartFleet:Diagnostics:CorrelationIdHeader"]);
        Assert.True(bool.Parse(
            builder.Configuration["Logging:Console:IncludeScopes"]!));
    }

    [Fact]
    public void AddSmartFleetSharedConfiguration_AllowsCommandLineOverrides()
    {
        const string headerName = "X-Trace-ID";
        var args = new[] { $"SmartFleet:Diagnostics:CorrelationIdHeader={headerName}" };
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args
        });

        builder.AddSmartFleetSharedConfiguration(args);

        Assert.Equal(
            headerName,
            builder.Configuration["SmartFleet:Diagnostics:CorrelationIdHeader"]);
    }
}
