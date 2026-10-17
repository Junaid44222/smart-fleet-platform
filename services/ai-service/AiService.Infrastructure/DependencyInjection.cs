using AiService.Application.Interfaces;
using AiService.Infrastructure.Clients;
using AiService.Infrastructure.Options;
using AiService.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AiService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AzureOpenAiOptions>(
            configuration.GetSection(AzureOpenAiOptions.SectionName));
        services.Configure<AiProviderOptions>(
            configuration.GetSection(AiProviderOptions.SectionName));

        var fleetBaseUrl = configuration["FleetData:BaseUrl"] ?? "http://localhost:5000/";
        services.AddHttpClient<IFleetVehicleContextProvider, FleetVehicleContextProvider>(
            client => client.BaseAddress = new Uri(fleetBaseUrl));

        services.AddHttpClient<IAiAssistantService, AzureOpenAiAssistantService>(
            client => client.Timeout = TimeSpan.FromMinutes(3));

        return services;
    }
}
