namespace FleetService.Application.DTOs;

public class ChangeVehicleStatusDto
{
    public string Status { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
}