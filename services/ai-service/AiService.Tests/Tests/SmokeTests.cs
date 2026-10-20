using AiService.Application.DTOs;
using AiService.Infrastructure.Clients;
using AiService.Infrastructure.Options;
using AiService.Infrastructure.Services;
using AiService.API.Controllers;
using AiService.API.Authorization;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Net;
using System.Linq;
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
        public async Task PlanActionAsync_ParsesPermittedTripDraftWithoutExecutingIt()
        {
            var handler = new StubMessageHandler
            {
                ResponseContent = "{\"choices\":[{\"message\":{\"content\":\"{\\\"action\\\":\\\"scheduleTrip\\\",\\\"assistantMessage\\\":\\\"Review this trip draft.\\\",\\\"trip\\\":{\\\"vehicleNumber\\\":\\\"MH01AB1005\\\",\\\"driverEmail\\\":\\\"driver@example.test\\\",\\\"source\\\":\\\"Pune\\\",\\\"destination\\\":\\\"Mumbai\\\",\\\"startDate\\\":\\\"2026-11-01T09:00:00Z\\\",\\\"endDate\\\":\\\"2026-11-01T13:00:00Z\\\"},\\\"maintenance\\\":null}\"}}]}"
            };
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

            var plan = await service.PlanActionAsync(
                new AiActionPlanRequestDto { Message = "Schedule this trip" },
                ["scheduleTrip"],
                CancellationToken.None);

            Assert.Equal("scheduleTrip", plan.Action);
            Assert.Equal("MH01AB1005", plan.Trip?.VehicleNumber);
            Assert.Equal("driver@example.test", plan.Trip?.DriverEmail);
            Assert.Null(plan.Maintenance);
            Assert.Contains("Permitted actions", handler.RequestBody);
        }

        [Fact]
        public async Task PlanActionAsync_RejectsModelActionOutsideSignedInRolesPermissions()
        {
            var handler = new StubMessageHandler
            {
                ResponseContent = "{\"choices\":[{\"message\":{\"content\":\"{\\\"action\\\":\\\"scheduleTrip\\\",\\\"assistantMessage\\\":\\\"Ready.\\\",\\\"trip\\\":{},\\\"maintenance\\\":null}\"}}]}"
            };
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

            var plan = await service.PlanActionAsync(
                new AiActionPlanRequestDto { Message = "Schedule this trip" },
                ["createMaintenance"],
                CancellationToken.None);

            Assert.Equal("none", plan.Action);
            Assert.Null(plan.Trip);
            Assert.Contains("isn't allowed", plan.AssistantMessage);
        }

        [Fact]
        public async Task PlanActionAsync_UsesExplicitUserIntentEvenWhenModelOmitsAction()
        {
            var handler = new StubMessageHandler
            {
                ResponseContent = "{\"choices\":[{\"message\":{\"content\":\"{\\\"action\\\":\\\"none\\\",\\\"assistantMessage\\\":\\\"Please review.\\\",\\\"trip\\\":null,\\\"maintenance\\\":null}\"}}]}"
            };
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

            var plan = await service.PlanActionAsync(
                new AiActionPlanRequestDto { Message = "Please schedule a trip from Pune to Mumbai." },
                ["scheduleTrip"],
                CancellationToken.None);

            Assert.Equal("scheduleTrip", plan.Action);
            Assert.NotNull(plan.Trip);
            Assert.Equal("Please review.", plan.AssistantMessage);
        }

        [Fact]
        public void AiAssistantEndpointsRequireAuthenticatedFleetUsers()
        {
            Assert.NotNull(Attribute.GetCustomAttribute(
                typeof(AiAssistantController), typeof(AuthorizeAttribute)));
        }

        [Theory]
        [InlineData("Admin", true, true)]
        [InlineData("SuperAdmin", true, true)]
        [InlineData("FleetManager", true, true)]
        [InlineData("Dispatcher", true, false)]
        [InlineData("MaintenanceTechnician", false, true)]
        [InlineData("SafetyOfficer", false, false)]
        [InlineData("Viewer", false, false)]
        [InlineData("Driver", false, false)]
        public void AiActionPermissions_MatchFleetWriteRoles(
            string role,
            bool canScheduleTrips,
            bool canCreateMaintenance)
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.Role, role)],
                "test"));

            var actions = AiActionPermissions.GetPermittedActions(user);

            Assert.Equal(canScheduleTrips, actions.Contains(AiActionPermissions.ScheduleTrip));
            Assert.Equal(canCreateMaintenance, actions.Contains(AiActionPermissions.CreateMaintenance));
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

        [Fact]
        public async Task FleetVehicleContextProvider_IncludesOnlyMatchingMaintenanceRecords()
        {
            var handler = new StubFleetDataHandler();
            using var httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://localhost:5000/")
            };
            var provider = new FleetVehicleContextProvider(httpClient);

            var context = await provider.GetVehicleContextAsync(
                "Show maintenance history for MH01AB1005",
                "Bearer test-token",
                CancellationToken.None);

            Assert.Contains("Brake Inspection", context);
            Assert.Contains("Brake pads replaced", context);
            Assert.DoesNotContain("Other vehicle private record", context);
            Assert.Equal(
                new[] { "/fleet/Vehicles", "/fleet/MaintenanceRecords" },
                handler.RequestPaths);
        }

        [Fact]
        public async Task FleetVehicleContextProvider_IncludesOnlyMatchingFuelRecords()
        {
            var handler = new StubFleetDataHandler();
            using var httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://localhost:5000/")
            };
            var provider = new FleetVehicleContextProvider(httpClient);

            var context = await provider.GetVehicleContextAsync(
                "Show fuel consumption history for MH01AB1005",
                "Bearer test-token",
                CancellationToken.None);

            Assert.Contains("quantity 42.5 litres", context);
            Assert.DoesNotContain("Other vehicle private fuel record", context);
            Assert.Equal(
                new[] { "/fleet/Vehicles", "/fleet/FuelRecords" },
                handler.RequestPaths);
        }

        [Fact]
        public async Task FleetVehicleContextProvider_DoesNotGuess_WhenRegistrationIsUnknown()
        {
            var handler = new StubFleetDataHandler();
            using var httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://localhost:5000/")
            };
            var provider = new FleetVehicleContextProvider(httpClient);

            var context = await provider.GetVehicleContextAsync(
                "What is the fuel capacity of MH99ZZ9999?",
                "Bearer test-token",
                CancellationToken.None);

            Assert.Contains("no vehicle registered as MH99ZZ9999", context);
            Assert.DoesNotContain("fuel capacity", context);
            Assert.Equal(new[] { "/fleet/Vehicles" }, handler.RequestPaths);
        }

        private sealed class StubMessageHandler : HttpMessageHandler
        {
            public string ResponseContent { get; init; } =
                "{\"choices\":[{\"message\":{\"content\":\"Local model response\"}}]}";

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
                    Content = new StringContent(ResponseContent, Encoding.UTF8, "application/json")
                };
            }
        }

        private sealed class StubFleetDataHandler : HttpMessageHandler
        {
            public Uri RequestUri { get; private set; } = new("about:blank");

            public string Authorization { get; private set; } = string.Empty;

            public List<string> RequestPaths { get; } = [];

            protected override Task<HttpResponseMessage> SendAsync(
                HttpRequestMessage request,
                CancellationToken cancellationToken)
            {
                RequestUri = request.RequestUri;
                Authorization = string.Join(",", request.Headers.GetValues("Authorization"));
                RequestPaths.Add(RequestUri.AbsolutePath);

                var responseBody = RequestUri.AbsolutePath switch
                {
                    "/fleet/Vehicles" => "{\"success\":true,\"data\":[{" +
                        "\"id\":\"vehicle-1\",\"vehicleNumber\":\"MH01AB1005\",\"manufacturer\":\"Tata\",\"model\":\"Signa\",\"year\":2018,\"fuelCapacity\":350,\"status\":\"Active\"},{" +
                        "\"id\":\"vehicle-2\",\"vehicleNumber\":\"MH01AB1006\",\"manufacturer\":\"Volvo\",\"model\":\"FMX\",\"year\":2022,\"fuelCapacity\":400,\"status\":\"Active\"}]}",
                    "/fleet/MaintenanceRecords" => "{\"success\":true,\"data\":[{" +
                        "\"vehicleId\":\"vehicle-1\",\"serviceType\":\"Brake Inspection\",\"description\":\"Brake pads replaced\",\"scheduledDate\":\"2026-08-12T00:00:00Z\",\"completedDate\":\"2026-08-12T00:00:00Z\",\"cost\":1400,\"vendor\":\"FleetWorks\",\"status\":\"Completed\",\"isDeleted\":false},{" +
                        "\"vehicleId\":\"vehicle-2\",\"serviceType\":\"Oil Change\",\"description\":\"Other vehicle private record\",\"scheduledDate\":\"2026-08-12T00:00:00Z\",\"cost\":900,\"vendor\":\"FleetWorks\",\"status\":\"Completed\",\"isDeleted\":false}]}",
                    "/fleet/FuelRecords" => "{\"success\":true,\"data\":[{" +
                        "\"vehicleId\":\"vehicle-1\",\"fuelDate\":\"2026-10-10T00:00:00Z\",\"quantity\":42.5,\"cost\":5200,\"odometerReading\":102500,\"isDeleted\":false},{" +
                        "\"vehicleId\":\"vehicle-2\",\"fuelDate\":\"2026-10-10T00:00:00Z\",\"quantity\":60,\"cost\":7000,\"odometerReading\":220000,\"isDeleted\":false}]}",
                    _ => "{\"success\":true,\"data\":[]}"
                };

                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        responseBody,
                        Encoding.UTF8,
                        "application/json")
                });
            }
        }
    }
}
