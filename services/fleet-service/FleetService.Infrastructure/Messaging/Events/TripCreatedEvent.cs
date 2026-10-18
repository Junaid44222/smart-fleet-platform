namespace FleetService.Infrastructure.Messaging.Events;

public class TripCreatedEvent
{
    public Guid Id { get; set; }

    public string TripNumber { get; set; } = string.Empty;

    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public string Source { get; set; } = string.Empty;

    public string Destination { get; set; } = string.Empty;

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }
}
