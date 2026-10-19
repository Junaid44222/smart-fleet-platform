using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using SmartFleet.Common.Configuration;
using SmartFleet.Common.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmartFleetSharedConfiguration(args);

builder.Configuration
    .AddJsonFile(
        "ocelot.json",
        optional: false,
        reloadOnChange: true);

builder.Services.AddOcelot();
builder.Services.AddSmartFleetDiagnostics(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseCorrelationId();

app.UseSwagger();

app.UseSwaggerUI();

await app.UseOcelot();

app.Run();
