using FleetService.Domain.Entities;

namespace FleetService.Application.Interfaces;

public interface IVehicleRepository
{
    Task<IEnumerable<Vehicle>> GetAllAsync();

    Task<Vehicle?> GetByIdAsync(Guid id);

    Task AddAsync(Vehicle vehicle);

    Task UpdateAsync(Vehicle vehicle);

    Task DeleteAsync(Vehicle vehicle);

    Task<bool> HasRelatedRecordsAsync(Guid id);
}
