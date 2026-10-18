namespace FleetService.Application.DTOs;

public class CreateTripDto
{
    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public string Source { get; set; } = string.Empty;

    public string Destination { get; set; } = string.Empty;

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }
}
