namespace FleetService.Infrastructure.Messaging.Events;

public class TripCompletedEvent
{
    public Guid Id { get; set; }

    public string TripNumber { get; set; } = string.Empty;

    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public DateTime ActualEndDate { get; set; }

    public decimal Distance { get; set; }

    public decimal FuelConsumed { get; set; }
}
