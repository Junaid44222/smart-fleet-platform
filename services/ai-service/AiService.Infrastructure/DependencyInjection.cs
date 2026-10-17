using AiService.Application.Interfaces;
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

        services.AddHttpClient<IAiAssistantService, AzureOpenAiAssistantService>(
            client => client.Timeout = TimeSpan.FromMinutes(3));

        return services;
    }
}
