using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FleetService.Infrastructure.Repositories;

public class DashboardRepository : IDashboardRepository
{
    private readonly FleetDbContext _context;

    public DashboardRepository(FleetDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardOverviewDto> GetOverviewAsync(
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var maintenanceDueCutoff = now.AddDays(30);

        var vehicles = await _context.Vehicles.AsNoTracking().ToListAsync(cancellationToken);
        var drivers = await _context.Drivers
            .AsNoTracking()
            .Where(d => !d.IsDeleted)
            .ToListAsync(cancellationToken);
        var maintenanceRecords = await _context.MaintenanceRecords
            .AsNoTracking()
            .Where(m => !m.IsDeleted)
            .ToListAsync(cancellationToken);
        var fuelRecords = await _context.FuelRecords
            .AsNoTracking()
            .Where(f => !f.IsDeleted)
            .ToListAsync(cancellationToken);
        var trips = await _context.Trips
            .AsNoTracking()
            .Where(trip => !trip.IsDeleted)
            .ToListAsync(cancellationToken);

        var availableDrivers = drivers.Count(d =>
            d.Status.Equals("Active", StringComparison.OrdinalIgnoreCase));

        var maintenanceDueCount = maintenanceRecords.Count(m =>
            !m.CompletedDate.HasValue &&
            m.ScheduledDate <= maintenanceDueCutoff &&
            !m.Status.Equals("Completed", StringComparison.OrdinalIgnoreCase));

        var monthlyFuelCost = fuelRecords
            .Where(f => f.FuelDate >= monthStart)
            .Sum(f => (double)f.Cost);

        var vehicleStatusBreakdown = vehicles
            .GroupBy(v => string.IsNullOrWhiteSpace(v.Status) ? "Unknown" : v.Status)
            .Select(g => new VehicleStatusCountDto
            {
                Status = g.Key,
                Count = g.Count()
            })
            .OrderByDescending(x => x.Count)
            .ToList();

        var monthlyFuelCosts = Enumerable.Range(0, 6)
            .Select(offset =>
            {
                var month = monthStart.AddMonths(-offset);
                var nextMonth = month.AddMonths(1);
                var cost = fuelRecords
                    .Where(f => f.FuelDate >= month && f.FuelDate < nextMonth)
                    .Sum(f => (double)f.Cost);

                return new MonthlyCostDto
                {
                    Month = month.ToString("MMM yyyy"),
                    Cost = Math.Round(cost, 2)
                };
            })
            .Reverse()
            .ToList();

        return new DashboardOverviewDto
        {
            Stats = new DashboardStatsDto
            {
                TotalVehicles = vehicles.Count,
                ActiveTrips = trips.Count(trip =>
                    trip.Status.Equals(Trip.InProgressStatus, StringComparison.OrdinalIgnoreCase)),
                AvailableDrivers = availableDrivers,
                MaintenanceDueCount = maintenanceDueCount,
                MonthlyFuelCost = Math.Round(monthlyFuelCost, 2),
                SafetyScore = CalculateSafetyScore(vehicles, maintenanceRecords)
            },
            VehicleStatusBreakdown = vehicleStatusBreakdown,
            MonthlyFuelCosts = monthlyFuelCosts,
            RecentActivities = BuildRecentActivities(vehicles, drivers, maintenanceRecords, trips)
        };
    }

    private static int CalculateSafetyScore(
        IReadOnlyCollection<Domain.Entities.Vehicle> vehicles,
        IReadOnlyCollection<Domain.Entities.MaintenanceRecord> maintenanceRecords)
    {
        if (vehicles.Count == 0)
        {
            return 100;
        }

        var overdueMaintenance = maintenanceRecords.Count(m =>
            !m.CompletedDate.HasValue &&
            m.ScheduledDate < DateTime.UtcNow &&
            !m.Status.Equals("Completed", StringComparison.OrdinalIgnoreCase));

        var inactiveVehicles = vehicles.Count(v =>
            !v.Status.Equals("Active", StringComparison.OrdinalIgnoreCase));

        var penalty = (overdueMaintenance * 3) + inactiveVehicles;
        return Math.Clamp(100 - penalty, 60, 100);
    }

    private static List<RecentActivityDto> BuildRecentActivities(
        IReadOnlyCollection<Domain.Entities.Vehicle> vehicles,
        IReadOnlyCollection<Domain.Entities.Driver> drivers,
        IReadOnlyCollection<Domain.Entities.MaintenanceRecord> maintenanceRecords,
        IReadOnlyCollection<Trip> trips)
    {
        var activities = new List<RecentActivityDto>();

        activities.AddRange(vehicles
            .OrderByDescending(v => v.CreatedAt)
            .Take(5)
            .Select(v => new RecentActivityDto
            {
                Id = v.Id.ToString(),
                Type = "VehicleCreated",
                Title = "Vehicle registered",
                Description = $"{v.VehicleNumber} ({v.Manufacturer} {v.Model})",
                OccurredAt = v.CreatedAt
            }));

        activities.AddRange(drivers
            .OrderByDescending(d => d.CreatedAt)
            .Take(5)
            .Select(d => new RecentActivityDto
            {
                Id = d.Id.ToString(),
                Type = "DriverCreated",
                Title = "Driver added",
                Description = $"{d.FirstName} {d.LastName}",
                OccurredAt = d.CreatedAt
            }));

        activities.AddRange(maintenanceRecords
            .OrderByDescending(m => m.CreatedAt)
            .Take(5)
            .Select(m => new RecentActivityDto
            {
                Id = m.Id.ToString(),
                Type = m.CompletedDate.HasValue ? "MaintenanceCompleted" : "MaintenanceScheduled",
                Title = m.CompletedDate.HasValue ? "Maintenance completed" : "Maintenance scheduled",
                Description = $"{m.ServiceType} - {m.Status}",
                OccurredAt = m.CompletedDate ?? m.ScheduledDate
            }));

        activities.AddRange(trips
            .OrderByDescending(trip => trip.UpdatedAt ?? trip.CreatedAt)
            .Take(5)
            .Select(trip => new RecentActivityDto
            {
                Id = trip.Id.ToString(),
                Type = $"Trip{trip.Status}",
                Title = trip.Status switch
                {
                    Trip.InProgressStatus => "Trip in progress",
                    Trip.CompletedStatus => "Trip completed",
                    Trip.CancelledStatus => "Trip cancelled",
                    _ => "Trip scheduled"
                },
                Description = $"{trip.TripNumber}: {trip.Source} to {trip.Destination}",
                OccurredAt = trip.ActualEndDate ?? trip.ActualStartDate ?? trip.UpdatedAt ?? trip.CreatedAt
            }));

        return activities
            .OrderByDescending(a => a.OccurredAt)
            .Take(8)
            .ToList();
    }
}
