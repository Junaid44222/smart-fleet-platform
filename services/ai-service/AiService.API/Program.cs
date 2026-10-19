using AiService.Infrastructure;
using SmartFleet.Common.Configuration;
using SmartFleet.Common.Diagnostics;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmartFleetSharedConfiguration(args);

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddSmartFleetDiagnostics(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen();

builder.Services.AddHealthChecks();

builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();
app.UseCorrelationId();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.MapControllers();

app.MapHealthChecks("/health");

app.MapGet("/health/live", () => Results.Ok(new
{
    status = "Healthy",
    service = "AiService"
}));

app.Run();
