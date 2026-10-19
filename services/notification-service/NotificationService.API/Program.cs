using Microsoft.OpenApi.Models;
using NotificationService.API.BackgroundServices;
using NotificationService.Infrastructure.Messaging;
using NotificationService.Infrastructure.Messaging.Interfaces;
using NotificationService.Infrastructure.Services;
using NotificationService.Domain.Port;
using SmartFleet.Common.Configuration;
using SmartFleet.Common.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmartFleetSharedConfiguration(args);

builder.Services.AddControllers();
builder.Services.AddSmartFleetDiagnostics(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Notification Service API", Version = "v1" });
});

builder.Services.AddSingleton<INotificationProducer, NotificationProducerService>();

var emailSettings = new EmailNotificationSettings();
builder.Configuration.GetSection("Notification:Email").Bind(emailSettings);
builder.Services.AddSingleton(emailSettings);

var smsSettings = new SmsNotificationSettings();
builder.Configuration.GetSection("Notification:Sms").Bind(smsSettings);
builder.Services.AddSingleton(smsSettings);

if (!NotificationSettingsValidator.ValidateEmail(emailSettings))
{
    throw new InvalidOperationException("Email notification settings are invalid or incomplete.");
}

if (!NotificationSettingsValidator.ValidateSms(smsSettings))
{
    throw new InvalidOperationException("SMS notification settings are invalid or incomplete.");
}

builder.Services.AddSingleton<INotificationSender, SmtpEmailNotificationSender>();
builder.Services.AddSingleton<INotificationSender, TwilioSmsNotificationSender>();
builder.Services.AddSingleton<NotificationDispatcher>();

builder.Services.AddHostedService<NotificationConsumerService>();

var app = builder.Build();
app.UseCorrelationId();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));
app.MapControllers();

app.Run();
