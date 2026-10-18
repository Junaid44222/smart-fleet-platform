using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging.Events;
using FleetService.Infrastructure.Messaging.Interfaces;
using FleetService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FleetService.Infrastructure.Services;

public sealed class VehicleAssignmentService : IVehicleAssignmentService
{
    private readonly FleetDbContext _context;
    private readonly IKafkaProducer _producer;

    public VehicleAssignmentService(FleetDbContext context, IKafkaProducer producer)
    {
        _context = context;
        _producer = producer;
    }

    public async Task<VehicleAssignmentDto?> GetCurrentAssignmentAsync(
        Guid vehicleId,
        CancellationToken cancellationToken)
    {
        await EnsureVehicleExistsAsync(vehicleId, cancellationToken);
        var assignment = await _context.VehicleAssignments
            .AsNoTracking()
            .Include(item => item.Driver)
            .Where(item => item.VehicleId == vehicleId && item.ReleasedDate == null)
            .SingleOrDefaultAsync(cancellationToken);

        return assignment is null ? null : ToDto(assignment);
    }

    public async Task<IReadOnlyList<VehicleAssignmentDto>> GetAssignmentHistoryAsync(
        Guid vehicleId,
        CancellationToken cancellationToken)
    {
        await EnsureVehicleExistsAsync(vehicleId, cancellationToken);
        var assignments = await _context.VehicleAssignments
            .AsNoTracking()
            .Include(item => item.Driver)
            .Where(item => item.VehicleId == vehicleId)
            .OrderByDescending(item => item.AssignedDate)
            .ToListAsync(cancellationToken);

        return assignments.Select(ToDto).ToArray();
    }

    public async Task<VehicleAssignmentDto?> SetAssignmentAsync(
        Guid vehicleId,
        Guid? driverId,
        string changedBy,
        CancellationToken cancellationToken)
    {
        var vehicleExists = await _context.Vehicles
            .AnyAsync(vehicle => vehicle.Id == vehicleId, cancellationToken);
        if (!vehicleExists)
        {
            throw new KeyNotFoundException("Vehicle not found.");
        }

        var currentAssignment = await _context.VehicleAssignments
            .Include(item => item.Driver)
            .SingleOrDefaultAsync(
                item => item.VehicleId == vehicleId && item.ReleasedDate == null,
                cancellationToken);

        if (currentAssignment?.DriverId == driverId && driverId.HasValue)
        {
            return ToDto(currentAssignment!);
        }
        if (currentAssignment is null && !driverId.HasValue)
        {
            return null;
        }

        Driver? targetDriver = null;
        if (driverId.HasValue)
        {
            targetDriver = await _context.Drivers
                .SingleOrDefaultAsync(
                    driver => driver.Id == driverId.Value && !driver.IsDeleted,
                    cancellationToken);

            if (targetDriver is null)
            {
                throw new KeyNotFoundException("Driver not found.");
            }

            var assignedElsewhere = await _context.VehicleAssignments.AnyAsync(
                assignment => assignment.DriverId == driverId.Value &&
                    assignment.VehicleId != vehicleId &&
                    assignment.ReleasedDate == null,
                cancellationToken);
            if (assignedElsewhere)
            {
                throw new InvalidOperationException("This driver is already assigned to another vehicle.");
            }

            if (!string.Equals(targetDriver.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Only active drivers can be assigned to a vehicle.");
            }
        }

        var changedAt = DateTime.UtcNow;
        if (currentAssignment is not null)
        {
            currentAssignment.ReleasedDate = changedAt;
            if (currentAssignment.Driver is not null && !currentAssignment.Driver.IsDeleted)
            {
                currentAssignment.Driver.Status = "Active";
                currentAssignment.Driver.UpdatedAt = changedAt;
                currentAssignment.Driver.UpdatedBy = changedBy;
            }
        }

        VehicleAssignment? newAssignment = null;
        if (targetDriver is not null)
        {
            targetDriver.Status = "Assigned";
            targetDriver.UpdatedAt = changedAt;
            targetDriver.UpdatedBy = changedBy;
            newAssignment = new VehicleAssignment
            {
                Id = Guid.NewGuid(),
                VehicleId = vehicleId,
                DriverId = targetDriver.Id,
                AssignedDate = changedAt,
                Driver = targetDriver
            };
            _context.VehicleAssignments.Add(newAssignment);
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _producer.ProduceAsync("vehicle-driver-assignment-changed", new VehicleDriverAssignmentChangedEvent
        {
            VehicleId = vehicleId,
            DriverId = targetDriver?.Id,
            ChangedAt = changedAt,
            ChangedBy = changedBy
        });

        return newAssignment is null ? null : ToDto(newAssignment);
    }

    public async Task ReleaseDriverAsync(Guid driverId, string changedBy, CancellationToken cancellationToken)
    {
        var assignment = await _context.VehicleAssignments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.DriverId == driverId && item.ReleasedDate == null,
                cancellationToken);
        if (assignment is not null)
        {
            await SetAssignmentAsync(assignment.VehicleId, null, changedBy, cancellationToken);
        }
    }

    private async Task EnsureVehicleExistsAsync(Guid vehicleId, CancellationToken cancellationToken)
    {
        var exists = await _context.Vehicles.AnyAsync(vehicle => vehicle.Id == vehicleId, cancellationToken);
        if (!exists)
        {
            throw new KeyNotFoundException("Vehicle not found.");
        }
    }

    private static VehicleAssignmentDto ToDto(VehicleAssignment assignment) => new()
    {
        Id = assignment.Id,
        VehicleId = assignment.VehicleId,
        DriverId = assignment.DriverId,
        DriverName = assignment.Driver is null
            ? "Deleted driver"
            : $"{assignment.Driver.FirstName} {assignment.Driver.LastName}".Trim(),
        EmployeeCode = assignment.Driver?.EmployeeCode ?? string.Empty,
        AssignedDate = assignment.AssignedDate,
        ReleasedDate = assignment.ReleasedDate
    };
}
