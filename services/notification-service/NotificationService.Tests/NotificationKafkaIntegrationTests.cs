using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NotificationService.API.BackgroundServices;
using NotificationService.Domain.Events;
using NotificationService.Domain.Port;
using NotificationService.Infrastructure.Messaging;
using NotificationService.Infrastructure.Services;
using Xunit;

namespace NotificationService.Tests;

public class NotificationKafkaIntegrationTests
{
    [KafkaIntegrationFact]
    [Trait("Category", "KafkaIntegration")]
    public async Task VehicleCreatedEvent_IsConsumedAndDispatched_WhenKafkaIntegrationEnabled()
    {
        var bootstrap = Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP") ?? "localhost:9092";
        var suffix = Guid.NewGuid().ToString("N");
        var topic = $"vehicle-created-integration-{suffix}";
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                ["Kafka:BootstrapServers"] = bootstrap,
                ["Kafka:GroupId"] = $"notification-integration-{suffix}",
                ["Kafka:Topics:VehicleCreated"] = topic,
                ["Kafka:Topics:MaintenanceCreated"] = $"maintenance-created-integration-{suffix}",
                ["Kafka:Topics:MaintenanceCompleted"] = $"maintenance-completed-integration-{suffix}"
            })
            .Build();

        var sender = new CapturingNotificationSender();
        var dispatcher = new NotificationDispatcher(new[] { sender });
        using var loggerFactory = LoggerFactory.Create(_ => { });
        var consumer = new NotificationConsumerService(
            configuration,
            dispatcher,
            loggerFactory.CreateLogger<NotificationConsumerService>());

        await consumer.StartAsync(CancellationToken.None);
        try
        {
            var producer = new NotificationProducerService(configuration);
            var vehicleNumber = $"INT-{suffix[..8]}";
            await producer.ProduceAsync(topic, new VehicleCreatedEvent
            {
                Id = Guid.NewGuid(),
                VehicleNumber = vehicleNumber,
                Manufacturer = "Integration Test",
                Model = "Kafka",
                Year = 2026,
                CreatedAt = DateTime.UtcNow
            });

            var received = await sender.Message.WaitAsync(TimeSpan.FromSeconds(30));

            Assert.Equal("email", received.Channel);
            Assert.Contains(vehicleNumber, received.Subject);
            Assert.Equal("ops@smartfleet.com", received.RecipientEmail);
        }
        finally
        {
            await consumer.StopAsync(CancellationToken.None);
        }
    }

    private sealed class KafkaIntegrationFactAttribute : FactAttribute
    {
        public KafkaIntegrationFactAttribute()
        {
            if (Environment.GetEnvironmentVariable("RUN_KAFKA_INTEGRATION") != "1")
            {
                Skip = "Set RUN_KAFKA_INTEGRATION=1 to run the Kafka integration test.";
            }
        }
    }

    private sealed class CapturingNotificationSender : INotificationSender
    {
        private readonly TaskCompletionSource<NotificationMessage> _completion =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public string Channel => "email";

        public Task<NotificationMessage> Message => _completion.Task;

        public Task SendAsync(NotificationMessage message)
        {
            _completion.TrySetResult(message);
            return Task.CompletedTask;
        }
    }
}
