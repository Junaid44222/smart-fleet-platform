using FleetService.Application.DTOs;
using FleetService.Domain.Entities;

namespace FleetService.Application.Services;

public interface IVehicleService
{
    Task<IEnumerable<Vehicle>> GetAllAsync();

    Task<Vehicle> CreateAsync(CreateVehicleDto dto);

    Task<Vehicle?> UpdateAsync(Guid id, UpdateVehicleDto dto);

    Task<bool> DeleteAsync(Guid id);
}
