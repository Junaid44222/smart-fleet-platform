namespace FleetService.Infrastructure.Messaging.Events;

public class VehicleDriverAssignmentChangedEvent
{
    public Guid VehicleId { get; set; }

    public Guid? DriverId { get; set; }

    public DateTime ChangedAt { get; set; }

    public string ChangedBy { get; set; } = string.Empty;
}
