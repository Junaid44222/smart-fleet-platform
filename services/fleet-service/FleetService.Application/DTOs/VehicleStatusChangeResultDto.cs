using FleetService.Domain.Entities;

namespace FleetService.Application.DTOs;

public class VehicleStatusChangeResultDto
{
    public Vehicle Vehicle { get; set; } = null!;

    public MaintenanceRecord? WorkOrder { get; set; }
}