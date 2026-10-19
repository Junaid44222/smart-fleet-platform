namespace FleetService.Infrastructure.Messaging.Events;

public class TripDeletedEvent
{
    public Guid Id { get; set; }

    public string TripNumber { get; set; } = string.Empty;

    public DateTime DeletedAt { get; set; }
}
