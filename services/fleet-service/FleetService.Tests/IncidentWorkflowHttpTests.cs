using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FleetService.API.Authorization;
using FleetService.API.Controllers;
using FleetService.API.Middleware;
using FleetService.Application.Features.Vehicles.Commands;
using FleetService.Application.Interfaces;
using FleetService.Application.Services;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging;
using FleetService.Infrastructure.Messaging.Interfaces;
using FleetService.Infrastructure.Persistence;
using FleetService.Infrastructure.Repositories;
using FleetService.Infrastructure.Services;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace FleetService.Tests;

public sealed class IncidentWorkflowHttpTests : IAsyncLifetime
{
    private const string SigningKey = "FleetService.HttpTests.SigningKey.MustBeAtLeast32Bytes.LongEnough.";
    private WebApplication? _application;
    private HttpClient? _client;
    private string? _connectionString;

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("FLEET_TEST_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            return;
        }

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing"
        });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Services.AddControllers()
            .AddApplicationPart(typeof(VehiclesController).Assembly);
        builder.Services.AddDbContext<FleetDbContext>(options => options.UseSqlServer(_connectionString));
        builder.Services.AddMediatR(options =>
            options.RegisterServicesFromAssembly(typeof(CreateVehicleCommand).Assembly));
        builder.Services.AddScoped<IAdministrativeVehicleService, AdministrativeVehicleService>();
        builder.Services.AddScoped<IVehicleAssignmentService, VehicleAssignmentService>();
        builder.Services.AddScoped<IVehicleRepository, VehicleRepository>();
        builder.Services.AddScoped<IMaintenanceRecordRepository, MaintenanceRecordRepository>();
        builder.Services.AddScoped<IMaintenanceRecordService, MaintenanceRecordService>();
        builder.Services.AddScoped<IFuelRecordRepository, FuelRecordRepository>();
        builder.Services.AddScoped<IFuelRecordService, FuelRecordService>();
        builder.Services.AddScoped<ITripService, TripService>();
        builder.Services.AddSingleton<IKafkaProducer, NoOpKafkaProducer>();
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = "FleetService.HttpTests",
                    ValidAudience = "FleetService.HttpTests.Client",
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
                    RoleClaimType = ClaimTypes.Role
                };
            });
        builder.Services.AddAuthorization();

        _application = builder.Build();
        _application.UseMiddleware<GlobalExceptionMiddleware>();
        _application.UseAuthentication();
        _application.UseAuthorization();
        _application.MapControllers();
        await _application.StartAsync();

        var address = _application.Services
            .GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!
            .Addresses.Single();
        _client = new HttpClient { BaseAddress = new Uri(address) };
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        if (_application is not null)
        {
            await _application.StopAsync();
            await _application.DisposeAsync();
        }
    }

    [FleetDatabaseFact]
    public async Task SignedAdminRequest_PersistsVehicleStatusAndIncidentWorkOrder()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();

        try
        {
            using var request = AuthorizedRequest(vehicleId, "Admin", "incident-admin@example.test");
            using var response = await _client!.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            await using var context = CreateContext();
            var vehicle = await context.Vehicles.AsNoTracking().SingleAsync(item => item.Id == vehicleId);
            var workOrder = await context.MaintenanceRecords.AsNoTracking()
                .SingleAsync(record => record.VehicleId == vehicleId);

            Assert.Equal("Maintenance", vehicle.Status);
            Assert.Equal("Unplanned Maintenance", workOrder.ServiceType);
            Assert.Equal("Integration-test incident", workOrder.Description);
            Assert.Equal("incident-admin@example.test", workOrder.CreatedBy);
            Assert.Equal("Scheduled", workOrder.Status);
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task SignedNonAdminRequest_IsForbiddenAndDoesNotChangeVehicle()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();

        try
        {
            using var request = AuthorizedRequest(vehicleId, "FleetManager", "fleet-manager@example.test");
            using var response = await _client!.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            await using var context = CreateContext();
            Assert.Equal("Active", (await context.Vehicles.AsNoTracking()
                .SingleAsync(item => item.Id == vehicleId)).Status);
            Assert.False(await context.MaintenanceRecords.AnyAsync(record => record.VehicleId == vehicleId));
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task AnonymousRequest_IsRejectedByAuthenticationMiddleware()
    {
        await EnsureConfiguredAsync();
        var vehicleId = Guid.NewGuid();
        using var request = StatusRequest(vehicleId);
        using var response = await _client!.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [FleetDatabaseTheory]
    [InlineData("MaintenanceRecords")]
    [InlineData("FuelRecords")]
    public async Task RecordDetailEndpoints_RequireAuthentication(string route)
    {
        await EnsureConfiguredAsync();
        using var response = await _client!.GetAsync($"/api/{route}/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [FleetDatabaseFact]
    public async Task MaintenanceDetailEndpoint_ReturnsPersistedRecordForViewer()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();
        var recordId = await CreateMaintenanceRecordAsync(vehicleId);

        try
        {
            using var request = AuthenticatedGet($"/api/MaintenanceRecords/{recordId}", "Viewer");
            using var response = await _client!.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(recordId.ToString(), json.RootElement.GetProperty("data").GetProperty("id").GetString());
            Assert.Equal("Scheduled Service", json.RootElement.GetProperty("data").GetProperty("serviceType").GetString());
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task MissingMaintenanceDetailEndpoint_ReturnsNotFound()
    {
        await EnsureConfiguredAsync();
        using var request = AuthenticatedGet($"/api/MaintenanceRecords/{Guid.NewGuid()}", "Viewer");
        using var response = await _client!.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [FleetDatabaseFact]
    public async Task FuelDetailEndpoint_ReturnsPersistedRecordForViewer()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();
        var recordId = await CreateFuelRecordAsync(vehicleId);

        try
        {
            using var request = AuthenticatedGet($"/api/FuelRecords/{recordId}", "Viewer");
            using var response = await _client!.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(recordId.ToString(), json.RootElement.GetProperty("data").GetProperty("id").GetString());
            Assert.Equal(42.5m, json.RootElement.GetProperty("data").GetProperty("quantity").GetDecimal());
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task MissingFuelDetailEndpoint_ReturnsNotFound()
    {
        await EnsureConfiguredAsync();
        using var request = AuthenticatedGet($"/api/FuelRecords/{Guid.NewGuid()}", "Viewer");
        using var response = await _client!.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [FleetDatabaseFact]
    public async Task MaintenanceRecordsApi_SupportsCreateListDetailUpdateAndDelete()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();

        try
        {
            var createDate = DateTime.UtcNow.Date.AddDays(2);
            using var createRequest = AuthenticatedJsonRequest(
                HttpMethod.Post,
                "/api/MaintenanceRecords",
                "MaintenanceTechnician",
                new
                {
                    vehicleId,
                    serviceType = "Integration API Service",
                    description = "Created through the maintenance API",
                    scheduledDate = createDate,
                    cost = 245.50m,
                    vendor = "Integration Vendor",
                    status = "Scheduled"
                });
            using var createResponse = await _client!.SendAsync(createRequest);

            Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
            using var createdJson = JsonDocument.Parse(await createResponse.Content.ReadAsStringAsync());
            var recordId = createdJson.RootElement.GetProperty("data").GetProperty("id").GetGuid();
            Assert.Equal("Integration API Service", createdJson.RootElement.GetProperty("data").GetProperty("serviceType").GetString());

            using var listRequest = AuthenticatedGet("/api/MaintenanceRecords", "Viewer");
            using var listResponse = await _client.SendAsync(listRequest);
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            using var listJson = JsonDocument.Parse(await listResponse.Content.ReadAsStringAsync());
            Assert.Contains(
                listJson.RootElement.GetProperty("data").EnumerateArray(),
                record => record.GetProperty("id").GetGuid() == recordId);

            using var detailRequest = AuthenticatedGet($"/api/MaintenanceRecords/{recordId}", "Viewer");
            using var detailResponse = await _client.SendAsync(detailRequest);
            Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);

            using var updateRequest = AuthenticatedJsonRequest(
                HttpMethod.Put,
                $"/api/MaintenanceRecords/{recordId}",
                "MaintenanceTechnician",
                new
                {
                    vehicleId,
                    serviceType = "Updated Integration Service",
                    description = "Updated through the maintenance API",
                    scheduledDate = createDate,
                    completedDate = (DateTime?)null,
                    cost = 300m,
                    vendor = "Updated Vendor",
                    status = "InProgress"
                });
            using var updateResponse = await _client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            using var updatedJson = JsonDocument.Parse(await updateResponse.Content.ReadAsStringAsync());
            Assert.Equal("Updated Integration Service", updatedJson.RootElement.GetProperty("data").GetProperty("serviceType").GetString());

            using var deleteRequest = AuthenticatedRequest(
                HttpMethod.Delete,
                $"/api/MaintenanceRecords/{recordId}",
                "Admin");
            using var deleteResponse = await _client.SendAsync(deleteRequest);
            Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

            using var deletedDetailRequest = AuthenticatedGet($"/api/MaintenanceRecords/{recordId}", "Viewer");
            using var deletedDetailResponse = await _client.SendAsync(deletedDetailRequest);
            Assert.Equal(HttpStatusCode.NotFound, deletedDetailResponse.StatusCode);
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task FuelRecordsApi_SupportsCreateListDetailUpdateAndDelete()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();

        try
        {
            using var createRequest = AuthenticatedJsonRequest(
                HttpMethod.Post,
                "/api/FuelRecords",
                "FleetManager",
                new
                {
                    vehicleId,
                    fuelDate = DateTime.UtcNow.AddMinutes(-1),
                    quantity = 55.5m,
                    cost = 88.25m,
                    odometerReading = 1325.5m
                });
            using var createResponse = await _client!.SendAsync(createRequest);

            Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
            using var createdJson = JsonDocument.Parse(await createResponse.Content.ReadAsStringAsync());
            var recordId = createdJson.RootElement.GetProperty("data").GetProperty("id").GetGuid();
            Assert.Equal(55.5m, createdJson.RootElement.GetProperty("data").GetProperty("quantity").GetDecimal());

            using var listRequest = AuthenticatedGet("/api/FuelRecords", "Viewer");
            using var listResponse = await _client.SendAsync(listRequest);
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            using var listJson = JsonDocument.Parse(await listResponse.Content.ReadAsStringAsync());
            Assert.Contains(
                listJson.RootElement.GetProperty("data").EnumerateArray(),
                record => record.GetProperty("id").GetGuid() == recordId);

            using var detailRequest = AuthenticatedGet($"/api/FuelRecords/{recordId}", "Viewer");
            using var detailResponse = await _client.SendAsync(detailRequest);
            Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);

            using var updateRequest = AuthenticatedJsonRequest(
                HttpMethod.Put,
                $"/api/FuelRecords/{recordId}",
                "FleetManager",
                new
                {
                    vehicleId,
                    fuelDate = DateTime.UtcNow.AddMinutes(-1),
                    quantity = 60m,
                    cost = 95.75m,
                    odometerReading = 1400m
                });
            using var updateResponse = await _client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            using var updatedJson = JsonDocument.Parse(await updateResponse.Content.ReadAsStringAsync());
            Assert.Equal(60m, updatedJson.RootElement.GetProperty("data").GetProperty("quantity").GetDecimal());

            using var deleteRequest = AuthenticatedRequest(
                HttpMethod.Delete,
                $"/api/FuelRecords/{recordId}",
                "Admin");
            using var deleteResponse = await _client.SendAsync(deleteRequest);
            Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

            using var deletedDetailRequest = AuthenticatedGet($"/api/FuelRecords/{recordId}", "Viewer");
            using var deletedDetailResponse = await _client.SendAsync(deletedDetailRequest);
            Assert.Equal(HttpStatusCode.NotFound, deletedDetailResponse.StatusCode);
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task FailedWorkOrderInsert_RollsBackVehicleStatusChange()
    {
        await EnsureConfiguredAsync();
        var vehicleId = await CreateVehicleAsync();

        try
        {
            // CreatedBy is limited to 100 characters in SQL Server. This forces the second insert
            // in the same SaveChanges call to fail after the tracked vehicle status has changed.
            var oversizedEmail = new string('x', 101);
            using var request = AuthorizedRequest(vehicleId, "Admin", oversizedEmail);
            using var response = await _client!.SendAsync(request);

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            await using var context = CreateContext();
            Assert.Equal("Active", (await context.Vehicles.AsNoTracking()
                .SingleAsync(item => item.Id == vehicleId)).Status);
            Assert.False(await context.MaintenanceRecords.AnyAsync(record => record.VehicleId == vehicleId));
        }
        finally
        {
            await DeleteVehicleAsync(vehicleId);
        }
    }

    [FleetDatabaseFact]
    public async Task DriverTripReads_ReturnOnlyTripsAssignedToAuthenticatedDriver()
    {
        await EnsureConfiguredAsync();
        var ownTrip = await CreateDriverTripAsync("driver-one@example.test");
        var otherTrip = await CreateDriverTripAsync("driver-two@example.test");

        try
        {
            using var request = AuthenticatedGet("/api/Trips/mine", "Driver", "driver-one@example.test");
            using var response = await _client!.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var trips = json.RootElement.GetProperty("data").EnumerateArray().ToArray();
            Assert.Single(trips);
            Assert.Equal(ownTrip.TripId.ToString(), trips[0].GetProperty("id").GetString());

            using var otherTripRequest = AuthenticatedGet($"/api/Trips/{otherTrip.TripId}", "Driver", "driver-one@example.test");
            using var otherTripResponse = await _client.SendAsync(otherTripRequest);
            Assert.Equal(HttpStatusCode.NotFound, otherTripResponse.StatusCode);
        }
        finally
        {
            await DeleteDriverTripAsync(ownTrip);
            await DeleteDriverTripAsync(otherTrip);
        }
    }

    [FleetDatabaseFact]
    public async Task DriverCanStartAndCompleteOnlyTheirAssignedTrip()
    {
        await EnsureConfiguredAsync();
        var ownTrip = await CreateDriverTripAsync("driver-one@example.test");
        var otherTrip = await CreateDriverTripAsync("driver-two@example.test");

        try
        {
            using var otherStart = AuthenticatedRequest(HttpMethod.Post, $"/api/Trips/{otherTrip.TripId}/start", "Driver", "driver-one@example.test");
            using var otherStartResponse = await _client!.SendAsync(otherStart);
            Assert.Equal(HttpStatusCode.NotFound, otherStartResponse.StatusCode);

            using var start = AuthenticatedRequest(HttpMethod.Post, $"/api/Trips/{ownTrip.TripId}/start", "Driver", "driver-one@example.test");
            using var startResponse = await _client.SendAsync(start);
            Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

            using var complete = AuthenticatedJsonRequest(HttpMethod.Post, $"/api/Trips/{ownTrip.TripId}/complete", "Driver", new
            {
                distance = 42.5m,
                fuelConsumed = 6.25m
            }, "driver-one@example.test");
            using var completeResponse = await _client.SendAsync(complete);
            Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);

            await using var context = CreateContext();
            var trip = await context.Trips.AsNoTracking().SingleAsync(item => item.Id == ownTrip.TripId);
            Assert.Equal(Trip.CompletedStatus, trip.Status);
            Assert.Equal(42.5m, trip.Distance);
            Assert.Equal(6.25m, trip.FuelConsumed);
        }
        finally
        {
            await DeleteDriverTripAsync(ownTrip);
            await DeleteDriverTripAsync(otherTrip);
        }
    }

    [FleetDatabaseFact]
    public async Task TripScheduleCanBeEditedAndSoftDeletedWithAdministratorOnlyDeletion()
    {
        await EnsureConfiguredAsync();
        var tripRecord = await CreateDriverTripAsync("trip-crud-driver@example.test");

        try
        {
            var startDate = DateTime.UtcNow.AddDays(2);
            using var update = AuthenticatedJsonRequest(HttpMethod.Put, $"/api/Trips/{tripRecord.TripId}", "Dispatcher", new
            {
                vehicleId = tripRecord.VehicleId,
                driverId = tripRecord.DriverId,
                source = "Updated pickup",
                destination = "Updated dropoff",
                startDate,
                endDate = startDate.AddHours(3)
            });
            using var updateResponse = await _client!.SendAsync(update);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            using var forbiddenDelete = AuthenticatedRequest(HttpMethod.Delete, $"/api/Trips/{tripRecord.TripId}", "Dispatcher");
            using var forbiddenDeleteResponse = await _client.SendAsync(forbiddenDelete);
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenDeleteResponse.StatusCode);

            using var delete = AuthenticatedRequest(HttpMethod.Delete, $"/api/Trips/{tripRecord.TripId}", "Admin");
            using var deleteResponse = await _client.SendAsync(delete);
            Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

            await using var context = CreateContext();
            var trip = await context.Trips.AsNoTracking().SingleAsync(item => item.Id == tripRecord.TripId);
            Assert.True(trip.IsDeleted);
            Assert.Equal("Updated pickup", trip.Source);
            Assert.Equal("Updated dropoff", trip.Destination);
        }
        finally
        {
            await DeleteDriverTripAsync(tripRecord);
        }
    }

    private async Task EnsureConfiguredAsync()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new InvalidOperationException(
                "FLEET_TEST_CONNECTION_STRING must point to a migrated, disposable FleetService SQL Server database.");
        }

        await using var context = CreateContext();
        if (!await context.Database.CanConnectAsync())
        {
            throw new InvalidOperationException(
                "The configured FleetService SQL Server database is unavailable.");
        }
    }

    private sealed class FleetDatabaseFactAttribute : FactAttribute
    {
        public FleetDatabaseFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FLEET_TEST_CONNECTION_STRING")))
            {
                Skip = "Set FLEET_TEST_CONNECTION_STRING to a migrated, disposable FleetService SQL Server database.";
            }
        }
    }

    private sealed class FleetDatabaseTheoryAttribute : TheoryAttribute
    {
        public FleetDatabaseTheoryAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FLEET_TEST_CONNECTION_STRING")))
            {
                Skip = "Set FLEET_TEST_CONNECTION_STRING to a migrated, disposable FleetService SQL Server database.";
            }
        }
    }

    private HttpRequestMessage AuthorizedRequest(Guid vehicleId, string role, string email)
    {
        var request = StatusRequest(vehicleId);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(role, email));
        return request;
    }

    private HttpRequestMessage AuthenticatedGet(string path, string role, string? email = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateToken(role, email ?? $"{role.ToLowerInvariant()}@example.test"));
        return request;
    }

    private HttpRequestMessage AuthenticatedRequest(HttpMethod method, string path, string role, string? email = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateToken(role, email ?? $"{role.ToLowerInvariant()}@example.test"));
        return request;
    }

    private HttpRequestMessage AuthenticatedJsonRequest(HttpMethod method, string path, string role, object body, string? email = null)
    {
        var request = AuthenticatedRequest(method, path, role, email);
        request.Content = JsonContent.Create(body);
        return request;
    }

    private async Task<(Guid TripId, Guid VehicleId, Guid DriverId)> CreateDriverTripAsync(string email)
    {
        var vehicleId = Guid.NewGuid();
        var driverId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var context = CreateContext();
        context.Vehicles.Add(new Vehicle
        {
            Id = vehicleId,
            VehicleNumber = $"TRIP-TEST-{vehicleId:N}",
            Manufacturer = "Test",
            Model = "Driver trip",
            Year = 2026,
            FuelCapacity = 100,
            Status = "Active"
        });
        context.Drivers.Add(new Driver
        {
            Id = driverId,
            EmployeeCode = $"DRIVER-{driverId:N}",
            FirstName = "Test",
            LastName = "Driver",
            PhoneNumber = "5550100",
            Email = email,
            LicenseNumber = $"LICENSE-{driverId:N}",
            LicenseExpiryDate = DateTime.UtcNow.AddYears(1),
            JoiningDate = DateTime.UtcNow.AddYears(-1),
            Status = "Active"
        });
        context.Trips.Add(new Trip
        {
            Id = tripId,
            TripNumber = $"TRIP-TEST-{tripId:N}",
            VehicleId = vehicleId,
            DriverId = driverId,
            Source = "Test pickup",
            Destination = "Test dropoff",
            StartDate = DateTime.UtcNow.AddHours(1),
            EndDate = DateTime.UtcNow.AddHours(2),
            CreatedBy = "fleet-test"
        });
        await context.SaveChangesAsync();
        return (tripId, vehicleId, driverId);
    }

    private async Task DeleteDriverTripAsync((Guid TripId, Guid VehicleId, Guid DriverId) record)
    {
        await using var context = CreateContext();
        var trip = await context.Trips.FindAsync(record.TripId);
        if (trip is not null) context.Trips.Remove(trip);
        var driver = await context.Drivers.FindAsync(record.DriverId);
        if (driver is not null) context.Drivers.Remove(driver);
        var vehicle = await context.Vehicles.FindAsync(record.VehicleId);
        if (vehicle is not null) context.Vehicles.Remove(vehicle);
        await context.SaveChangesAsync();
    }

    private static HttpRequestMessage StatusRequest(Guid vehicleId) => new(
        HttpMethod.Put,
        $"/api/Vehicles/{vehicleId}/status")
    {
        Content = JsonContent.Create(new
        {
            status = "Maintenance",
            reason = "Integration-test incident"
        })
    };

    private static string CreateToken(string role, string email)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: "FleetService.HttpTests",
            audience: "FleetService.HttpTests.Client",
            claims: [new Claim(ClaimTypes.Role, role), new Claim(ClaimTypes.Email, email)],
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<Guid> CreateVehicleAsync()
    {
        var id = Guid.NewGuid();
        await using var context = CreateContext();
        context.Vehicles.Add(new Vehicle
        {
            Id = id,
            VehicleNumber = $"HTTP-TEST-{id:N}",
            Manufacturer = "Test",
            Model = "Integration",
            Year = 2026,
            FuelCapacity = 100,
            Status = "Active"
        });
        await context.SaveChangesAsync();
        return id;
    }

    private async Task<Guid> CreateMaintenanceRecordAsync(Guid vehicleId)
    {
        var id = Guid.NewGuid();
        await using var context = CreateContext();
        context.MaintenanceRecords.Add(new MaintenanceRecord
        {
            Id = id,
            VehicleId = vehicleId,
            ServiceType = "Scheduled Service",
            Description = "Integration-test maintenance detail",
            ScheduledDate = DateTime.UtcNow.Date,
            Cost = 125,
            Vendor = "Test Vendor",
            Status = "Scheduled",
            CreatedBy = "integration-test"
        });
        await context.SaveChangesAsync();
        return id;
    }

    private async Task<Guid> CreateFuelRecordAsync(Guid vehicleId)
    {
        var id = Guid.NewGuid();
        await using var context = CreateContext();
        context.FuelRecords.Add(new FuelRecord
        {
            Id = id,
            VehicleId = vehicleId,
            FuelDate = DateTime.UtcNow,
            Quantity = 42.5m,
            Cost = 68.25m,
            OdometerReading = 1200,
            CreatedBy = "integration-test"
        });
        await context.SaveChangesAsync();
        return id;
    }

    private async Task DeleteVehicleAsync(Guid vehicleId)
    {
        await using var context = CreateContext();
        var workOrders = await context.MaintenanceRecords
            .Where(record => record.VehicleId == vehicleId)
            .ToListAsync();
        context.MaintenanceRecords.RemoveRange(workOrders);
        var fuelRecords = await context.FuelRecords
            .Where(record => record.VehicleId == vehicleId)
            .ToListAsync();
        context.FuelRecords.RemoveRange(fuelRecords);
        var vehicle = await context.Vehicles.SingleOrDefaultAsync(item => item.Id == vehicleId);
        if (vehicle is not null)
        {
            context.Vehicles.Remove(vehicle);
        }
        await context.SaveChangesAsync();
    }

    private FleetDbContext CreateContext() => new(
        new DbContextOptionsBuilder<FleetDbContext>()
            .UseSqlServer(_connectionString!)
            .Options);

    private sealed class NoOpKafkaProducer : IKafkaProducer
    {
        public Task ProduceAsync<T>(string topic, T message) => Task.CompletedTask;
    }
}
