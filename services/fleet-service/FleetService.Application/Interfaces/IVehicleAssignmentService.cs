using FleetService.Application.DTOs;

namespace FleetService.Application.Interfaces;

public interface IVehicleAssignmentService
{
    Task<VehicleAssignmentDto?> GetCurrentAssignmentAsync(Guid vehicleId, CancellationToken cancellationToken);

    Task<IReadOnlyList<VehicleAssignmentDto>> GetAssignmentHistoryAsync(Guid vehicleId, CancellationToken cancellationToken);

    Task<VehicleAssignmentDto?> SetAssignmentAsync(
        Guid vehicleId,
        Guid? driverId,
        string changedBy,
        CancellationToken cancellationToken);

    Task ReleaseDriverAsync(Guid driverId, string changedBy, CancellationToken cancellationToken);
}
