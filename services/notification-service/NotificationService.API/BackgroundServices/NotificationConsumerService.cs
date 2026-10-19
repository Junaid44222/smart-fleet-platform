using Confluent.Kafka;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NotificationService.Infrastructure.Services;
using NotificationService.Domain.Events;

namespace NotificationService.API.BackgroundServices;

public class NotificationConsumerService : BackgroundService
{
    private readonly ILogger<NotificationConsumerService> _logger;
    private readonly IConfiguration _configuration;
    private readonly NotificationDispatcher _dispatcher;

    public NotificationConsumerService(
        IConfiguration configuration,
        NotificationDispatcher dispatcher,
        ILogger<NotificationConsumerService> logger)
    {
        _configuration = configuration;
        _dispatcher = dispatcher;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = new ConsumerConfig
        {
            BootstrapServers = _configuration["Kafka:BootstrapServers"],
            GroupId = _configuration["Kafka:GroupId"] ?? "notification-group",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            AllowAutoCreateTopics = true
        };

        using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();

        consumer.Subscribe(new[]
        {
            _configuration["Kafka:Topics:VehicleCreated"] ?? "vehicle-created",
            _configuration["Kafka:Topics:MaintenanceCreated"] ?? "maintenance-created",
            _configuration["Kafka:Topics:MaintenanceCompleted"] ?? "maintenance-completed"
        });

        _logger.LogInformation("Notification Kafka consumer started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var consumeResult = consumer.Consume(TimeSpan.FromSeconds(1));

                if (consumeResult != null)
                {
                    _logger.LogInformation("Notification event received from topic {Topic}: {EventValue}", consumeResult.Topic, consumeResult.Message.Value);
                    await ProcessEventAsync(consumeResult.Topic, consumeResult.Message.Value, stoppingToken);
                }
            }
            catch (ConsumeException ex)
            {
                _logger.LogError(ex, "Kafka consume error");
                await Task.Delay(5000, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected Kafka error");
                await Task.Delay(5000, stoppingToken);
            }
        }
    }

    private async Task ProcessEventAsync(string topic, string payload, CancellationToken stoppingToken)
    {
        _logger.LogInformation("Dispatching notification for topic {Topic}", topic);

        NotificationMessage message;

        try
        {
            message = NotificationMapper.ToNotificationMessage(GetEventType(topic), payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to map Kafka event to notification message for topic {Topic}", topic);
            return;
        }

        try
        {
            await _dispatcher.DispatchAsync(message);
            _logger.LogInformation("Notification dispatched successfully for topic {Topic}", topic);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch notification for topic {Topic}", topic);
        }
    }

    private string GetEventType(string topic)
    {
        if (topic == (_configuration["Kafka:Topics:VehicleCreated"] ?? "vehicle-created"))
        {
            return "vehicle-created";
        }

        if (topic == (_configuration["Kafka:Topics:MaintenanceCreated"] ?? "maintenance-created"))
        {
            return "maintenance.created";
        }

        if (topic == (_configuration["Kafka:Topics:MaintenanceCompleted"] ?? "maintenance-completed"))
        {
            return "maintenance.completed";
        }

        return topic;
    }
}
