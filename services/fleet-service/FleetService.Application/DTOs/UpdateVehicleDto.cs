namespace FleetService.Application.DTOs;

public class UpdateVehicleDto
{
    public string VehicleNumber { get; set; } = string.Empty;

    public string Manufacturer { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public int Year { get; set; }

    public double FuelCapacity { get; set; }
}
