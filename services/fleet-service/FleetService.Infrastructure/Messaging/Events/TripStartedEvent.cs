namespace FleetService.Infrastructure.Messaging.Events;

public class TripStartedEvent
{
    public Guid Id { get; set; }

    public string TripNumber { get; set; } = string.Empty;

    public DateTime ActualStartDate { get; set; }
}
