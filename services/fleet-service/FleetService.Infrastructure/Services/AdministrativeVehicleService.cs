using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FleetService.Infrastructure.Services;

public sealed class AdministrativeVehicleService : IAdministrativeVehicleService
{
    private static readonly string[] AllowedStatuses = ["Active", "Inactive", "Maintenance"];

    private readonly FleetDbContext _context;

    public AdministrativeVehicleService(FleetDbContext context)
    {
        _context = context;
    }

    public async Task<VehicleStatusChangeResultDto?> ChangeStatusAsync(
        Guid vehicleId,
        ChangeVehicleStatusDto request,
        string changedBy,
        CancellationToken cancellationToken)
    {
        var requestedStatus = AllowedStatuses.FirstOrDefault(status =>
            string.Equals(status, request.Status, StringComparison.OrdinalIgnoreCase));
        if (requestedStatus is null)
        {
            throw new ArgumentException(
                "Status must be Active, Inactive, or Maintenance.",
                nameof(request));
        }

        if (requestedStatus == "Maintenance" && string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ArgumentException(
                "A reason is required when placing a vehicle into maintenance.",
                nameof(request));
        }

        var vehicle = await _context.Vehicles
            .SingleOrDefaultAsync(item => item.Id == vehicleId, cancellationToken);
        if (vehicle is null)
        {
            return null;
        }

        if (requestedStatus == "Active" && vehicle.Status == "Maintenance")
        {
            var hasOpenIncidentOrder = await _context.MaintenanceRecords.AnyAsync(
                record => record.VehicleId == vehicleId &&
                    !record.IsDeleted &&
                    record.ServiceType == "Unplanned Maintenance" &&
                    record.Status != "Completed",
                cancellationToken);

            if (hasOpenIncidentOrder)
            {
                throw new InvalidOperationException(
                    "Complete the unplanned maintenance work order before returning this vehicle to service.");
            }
        }

        if (requestedStatus == "Maintenance" && vehicle.Status == "Maintenance")
        {
            var hasOpenIncidentOrder = await _context.MaintenanceRecords.AnyAsync(
                record => record.VehicleId == vehicleId &&
                    !record.IsDeleted &&
                    record.ServiceType == "Unplanned Maintenance" &&
                    record.Status != "Completed",
                cancellationToken);

            if (hasOpenIncidentOrder)
            {
                throw new InvalidOperationException(
                    "This vehicle already has an open unplanned maintenance work order.");
            }
        }

        vehicle.Status = requestedStatus;
        MaintenanceRecord? workOrder = null;
        if (requestedStatus == "Maintenance")
        {
            workOrder = new MaintenanceRecord
            {
                Id = Guid.NewGuid(),
                VehicleId = vehicle.Id,
                ServiceType = "Unplanned Maintenance",
                Description = request.Reason.Trim(),
                ScheduledDate = DateTime.UtcNow,
                Cost = 0,
                Vendor = "Pending assignment",
                Status = "Scheduled",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = changedBy
            };
            _context.MaintenanceRecords.Add(workOrder);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new VehicleStatusChangeResultDto
        {
            Vehicle = vehicle,
            WorkOrder = workOrder
        };
    }
}