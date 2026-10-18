namespace FleetService.Domain.Entities;

public class VehicleAssignment
{
    public Guid Id { get; set; }

    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public DateTime AssignedDate { get; set; }

    public DateTime? ReleasedDate { get; set; }

    public Vehicle? Vehicle { get; set; }

    public Driver? Driver { get; set; }
}
