using AiService.Application.DTOs;
using AiService.Infrastructure.Options;
using AiService.Infrastructure.Services;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace AiService.Tests
{
    public class SmokeTests
    {
        [Fact]
        public void ProjectBuilds_Smoke()
        {
            // Basic smoke test to ensure test project loads and references build
            Assert.True(true);
        }

        [Fact]
        public async Task AskAsync_ReturnsConfigurationError_WhenAzureOpenAiIsNotConfigured()
        {
            using var httpClient = new HttpClient();
            var service = new AzureOpenAiAssistantService(
                httpClient,
                Options.Create(new AzureOpenAiOptions()));

            var response = await service.AskAsync(
                new AiChatRequestDto { Message = "Summarize fleet status" },
                CancellationToken.None);

            Assert.False(response.Success);
            Assert.Null(response.Data);
            Assert.Contains("Azure OpenAI configuration is missing", response.Message);
        }

        [Fact]
        public async Task AnalyzeFleetHealthAsync_ReturnsConfigurationError_WhenAzureOpenAiIsNotConfigured()
        {
            using var httpClient = new HttpClient();
            var service = new AzureOpenAiAssistantService(
                httpClient,
                Options.Create(new AzureOpenAiOptions()));

            var response = await service.AnalyzeFleetHealthAsync(
                new FleetHealthAnalysisRequestDto
                {
                    VehicleSummary = "1 active vehicle",
                    MaintenanceSummary = "No open maintenance records"
                },
                CancellationToken.None);

            Assert.False(response.Success);
            Assert.Null(response.Data);
            Assert.Contains("Azure OpenAI configuration is missing", response.Message);
        }
    }
}