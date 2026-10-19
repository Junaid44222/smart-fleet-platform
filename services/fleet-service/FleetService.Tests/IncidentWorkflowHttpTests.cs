using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using FleetService.API.Authorization;
using FleetService.API.Controllers;
using FleetService.API.Middleware;
using FleetService.Application.Features.Vehicles.Commands;
using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging;
using FleetService.Infrastructure.Messaging.Interfaces;
using FleetService.Infrastructure.Persistence;
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
using Xunit.Sdk;

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
        builder.Services.AddSingleton<IKafkaProducer, KafkaProducerService>();
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

    [Fact]
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

    [Fact]
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

    [Fact]
    public async Task AnonymousRequest_IsRejectedByAuthenticationMiddleware()
    {
        await EnsureConfiguredAsync();
        var vehicleId = Guid.NewGuid();
        using var request = StatusRequest(vehicleId);
        using var response = await _client!.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
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

    private async Task EnsureConfiguredAsync()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new SkipException(
                "Set FLEET_TEST_CONNECTION_STRING to a migrated, disposable FleetService SQL Server database to run HTTP/database integration tests.");
        }

        await using var context = CreateContext();
        if (!await context.Database.CanConnectAsync())
        {
            throw new SkipException(
                "The configured FleetService SQL Server database is unavailable; HTTP/database integration checks were skipped.");
        }
    }

    private HttpRequestMessage AuthorizedRequest(Guid vehicleId, string role, string email)
    {
        var request = StatusRequest(vehicleId);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(role, email));
        return request;
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

    private async Task DeleteVehicleAsync(Guid vehicleId)
    {
        await using var context = CreateContext();
        var workOrders = await context.MaintenanceRecords
            .Where(record => record.VehicleId == vehicleId)
            .ToListAsync();
        context.MaintenanceRecords.RemoveRange(workOrders);
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
}
