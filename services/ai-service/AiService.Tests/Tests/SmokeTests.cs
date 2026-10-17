using AiService.Application.DTOs;
using AiService.Infrastructure.Clients;
using AiService.Infrastructure.Options;
using AiService.Infrastructure.Services;
using Microsoft.Extensions.Options;
using System;
using System.Net;
using System.Net.Http;
using System.Text;
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
                Options.Create(new AzureOpenAiOptions()),
                Options.Create(new AiProviderOptions { Provider = "AzureOpenAI" }));

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
                Options.Create(new AzureOpenAiOptions()),
                Options.Create(new AiProviderOptions { Provider = "AzureOpenAI" }));

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

        [Fact]
        public async Task AskAsync_UsesOllamaOpenAiCompatibleEndpoint()
        {
            var handler = new StubMessageHandler();
            using var httpClient = new HttpClient(handler);
            var service = new AzureOpenAiAssistantService(
                httpClient,
                Options.Create(new AzureOpenAiOptions()),
                Options.Create(new AiProviderOptions
                {
                    Provider = "Ollama",
                    Endpoint = "http://localhost:11434/v1",
                    Model = "qwen3:0.6b"
                }));

            var response = await service.AskAsync(
                new AiChatRequestDto { Message = "Summarize fleet status" },
                CancellationToken.None);

            Assert.True(response.Success);
            Assert.Equal("Local model response", response.Data);
            Assert.Equal(
                "http://localhost:11434/v1/chat/completions",
                handler.RequestUri.ToString());
            Assert.Equal("Bearer ollama", handler.Authorization);
            Assert.Contains("\"model\":\"qwen3:0.6b\"", handler.RequestBody);
        }

        [Fact]
        public async Task AskAsync_UsesAzureDeploymentEndpoint_WhenAzureProviderIsSelected()
        {
            var handler = new StubMessageHandler();
            using var httpClient = new HttpClient(handler);
            var service = new AzureOpenAiAssistantService(
                httpClient,
                Options.Create(new AzureOpenAiOptions
                {
                    Endpoint = "https://fleet.example.test",
                    ApiKey = "test-key",
                    DeploymentName = "fleet-model",
                    ApiVersion = "2024-10-21"
                }),
                Options.Create(new AiProviderOptions { Provider = "AzureOpenAI" }));

            var response = await service.AskAsync(
                new AiChatRequestDto { Message = "Summarize fleet status" },
                CancellationToken.None);

            Assert.True(response.Success);
            Assert.Equal(
                "https://fleet.example.test/openai/deployments/fleet-model/chat/completions?api-version=2024-10-21",
                handler.RequestUri.ToString());
            Assert.Equal("test-key", handler.ApiKey);
            Assert.DoesNotContain("\"model\"", handler.RequestBody);
        }

        [Fact]
        public async Task FleetVehicleContextProvider_ReturnsVerifiedDetails_AndForwardsBearerToken()
        {
            var handler = new StubFleetDataHandler();
            using var httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://localhost:5000/")
            };
            var provider = new FleetVehicleContextProvider(httpClient);

            var context = await provider.GetVehicleContextAsync(
                "What is the fuel capacity of MH01AB1005?",
                "Bearer test-token",
                CancellationToken.None);

            Assert.Contains("fuel capacity 350 litres", context);
            Assert.Equal("Bearer test-token", handler.Authorization);
            Assert.Equal("/fleet/Vehicles", handler.RequestUri.AbsolutePath);
        }

        private sealed class StubMessageHandler : HttpMessageHandler
        {
            public Uri RequestUri { get; private set; } = new("about:blank");

            public string Authorization { get; private set; } = string.Empty;

            public string ApiKey { get; private set; } = string.Empty;

            public string RequestBody { get; private set; } = string.Empty;

            protected override async Task<HttpResponseMessage> SendAsync(
                HttpRequestMessage request,
                CancellationToken cancellationToken)
            {
                RequestUri = request.RequestUri;
                Authorization = request.Headers.Authorization?.ToString();
                ApiKey = request.Headers.TryGetValues("api-key", out var apiKeyValues)
                    ? string.Join(",", apiKeyValues)
                    : string.Empty;
                RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        "{\"choices\":[{\"message\":{\"content\":\"Local model response\"}}]}",
                        Encoding.UTF8,
                        "application/json")
                };
            }
        }

        private sealed class StubFleetDataHandler : HttpMessageHandler
        {
            public Uri RequestUri { get; private set; } = new("about:blank");

            public string Authorization { get; private set; } = string.Empty;

            protected override Task<HttpResponseMessage> SendAsync(
                HttpRequestMessage request,
                CancellationToken cancellationToken)
            {
                RequestUri = request.RequestUri;
                Authorization = string.Join(",", request.Headers.GetValues("Authorization"));

                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        "{\"success\":true,\"data\":[{\"vehicleNumber\":\"MH01AB1005\",\"manufacturer\":\"Tata\",\"model\":\"Signa\",\"year\":2018,\"fuelCapacity\":350,\"status\":\"Active\"}]}",
                        Encoding.UTF8,
                        "application/json")
                });
            }
        }
    }
}