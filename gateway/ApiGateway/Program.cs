using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using SmartFleet.Common.Configuration;
using SmartFleet.Common.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmartFleetSharedConfiguration(args);

// Configure Ocelot
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);
builder.Services.AddOcelot(builder.Configuration);
builder.Services.AddSmartFleetDiagnostics(builder.Configuration);

// Enable CORS for React Frontend
builder.Services.AddCors(options => {
    options.AddPolicy("CorsPolicy", b => b.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();
app.UseCorrelationId();

app.UseCors("CorsPolicy");

app.Map("/health", healthApp => healthApp.Run(async context =>
{
    await context.Response.WriteAsJsonAsync(new
    {
        status = "Healthy",
        service = "ApiGateway"
    });
}));

await app.UseOcelot();

app.Run();
