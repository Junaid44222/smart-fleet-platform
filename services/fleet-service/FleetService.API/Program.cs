using FleetService.Application.Features.Vehicles.Commands;
using FleetService.Application.Interfaces;
using FleetService.Application.Services;
using FleetService.Infrastructure.Persistence;
using FleetService.Infrastructure.Messaging;
using FleetService.Infrastructure.Messaging.Interfaces;
using FleetService.Infrastructure.Messaging.BackgroundServices;
using FleetService.Infrastructure.Repositories;
using FleetService.Infrastructure.Services;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FleetService.API.Extensions;
using FleetService.API.Middleware;
using Serilog;

using System.Text;

var builder = WebApplication.CreateBuilder(args);

// =========================================
// Serilog
// =========================================
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// =========================================
// Controllers
// =========================================
builder.Services.AddControllers();

// =========================================
// Swagger
// =========================================
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Fleet Service API",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT token"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// =========================================
// Database
// =========================================
builder.Services.AddDbContext<FleetDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure();
        });
});

// =========================================
// MediatR
// =========================================
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(CreateVehicleCommand).Assembly);
});

// =========================================
// Dependency Injection
// =========================================
builder.Services.AddScoped<IVehicleRepository, VehicleRepository>();

builder.Services.AddScoped<IVehicleService, VehicleService>();
builder.Services.AddScoped<IAdministrativeVehicleService, AdministrativeVehicleService>();
builder.Services.AddScoped<IVehicleAssignmentService, VehicleAssignmentService>();
builder.Services.AddScoped<ITripService, TripService>();

builder.Services.AddScoped<IDriverRepository, DriverRepository>();

builder.Services.AddScoped<IDriverService, DriverService>();

builder.Services.AddScoped<IMaintenanceRecordRepository, MaintenanceRecordRepository>();

builder.Services.AddScoped<IMaintenanceRecordService, MaintenanceRecordService>();

builder.Services.AddScoped<IFuelRecordRepository, FuelRecordRepository>();

builder.Services.AddScoped<IFuelRecordService, FuelRecordService>();

builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();

// =========================================
// Kafka
// =========================================
builder.Services.AddSingleton<IKafkaProducer, KafkaProducerService>();

builder.Services.AddHostedService<VehicleCreatedConsumerService>();

// =========================================
// JWT Authentication
// =========================================
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme =
        JwtBearerDefaults.AuthenticationScheme;

    options.DefaultChallengeScheme =
        JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters =
        new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            ValidIssuer =
                builder.Configuration["Jwt:Issuer"],

            ValidAudience =
                builder.Configuration["Jwt:Audience"],

            IssuerSigningKey =
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(
                        builder.Configuration["Jwt:Key"]!))
        };
});

// =========================================
// Authorization
// =========================================
builder.Services.AddAuthorization();

// =========================================
// Build App
// =========================================
var app = builder.Build();

app.MigrateAndSeedDatabase();

// =========================================
// Middleware
// =========================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionMiddleware>();

app.UseHttpsRedirection();

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.Run();
