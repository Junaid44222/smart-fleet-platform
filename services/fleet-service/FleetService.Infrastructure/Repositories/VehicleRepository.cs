using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FleetService.Infrastructure.Repositories;

public class VehicleRepository : IVehicleRepository
{
    private readonly FleetDbContext _context;

    public VehicleRepository(FleetDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Vehicle>> GetAllAsync()
    {
        return await _context.Vehicles.ToListAsync();
    }

    public async Task<Vehicle?> GetByIdAsync(Guid id)
    {
        return await _context.Vehicles.FindAsync(id);
    }

    public async Task AddAsync(Vehicle vehicle)
    {
        await _context.Vehicles.AddAsync(vehicle);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Vehicle vehicle)
    {
        _context.Vehicles.Update(vehicle);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Vehicle vehicle)
    {
        _context.Vehicles.Remove(vehicle);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> HasRelatedRecordsAsync(Guid id) =>
        await _context.VehicleAssignments.AnyAsync(item => item.VehicleId == id) ||
        await _context.Trips.AnyAsync(item => item.VehicleId == id) ||
        await _context.MaintenanceRecords.AnyAsync(item => item.VehicleId == id) ||
        await _context.FuelRecords.AnyAsync(item => item.VehicleId == id);
}
