using FleetService.Application.DTOs;

namespace FleetService.Application.Interfaces;

public interface IAdministrativeVehicleService
{
    Task<VehicleStatusChangeResultDto?> ChangeStatusAsync(
        Guid vehicleId,
        ChangeVehicleStatusDto request,
        string changedBy,
        CancellationToken cancellationToken);
}