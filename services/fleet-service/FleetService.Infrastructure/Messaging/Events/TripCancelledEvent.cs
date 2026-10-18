namespace FleetService.Infrastructure.Messaging.Events;

public class TripCancelledEvent
{
    public Guid Id { get; set; }

    public string TripNumber { get; set; } = string.Empty;

    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public DateTime CancelledAt { get; set; }
}
