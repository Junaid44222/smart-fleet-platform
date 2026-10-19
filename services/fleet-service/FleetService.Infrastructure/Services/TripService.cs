using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging.Events;
using FleetService.Infrastructure.Messaging.Interfaces;
using FleetService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FleetService.Infrastructure.Services;

public sealed class TripService : ITripService
{
    private readonly FleetDbContext _context;
    private readonly IKafkaProducer _producer;

    public TripService(FleetDbContext context, IKafkaProducer producer)
    {
        _context = context;
        _producer = producer;
    }

    public async Task<IReadOnlyList<Trip>> GetAllAsync(CancellationToken cancellationToken) =>
        await _context.Trips
            .AsNoTracking()
            .Include(trip => trip.Vehicle)
            .Where(trip => !trip.IsDeleted)
            .OrderByDescending(trip => trip.StartDate)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Trip>> GetForDriverAsync(string driverEmail, CancellationToken cancellationToken) =>
        await _context.Trips
            .AsNoTracking()
            .Include(trip => trip.Vehicle)
            .Where(trip => !trip.IsDeleted && trip.Driver != null && trip.Driver.Email == driverEmail)
            .OrderByDescending(trip => trip.StartDate)
            .ToListAsync(cancellationToken);

    public async Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        await _context.Trips
            .AsNoTracking()
            .Include(trip => trip.Vehicle)
            .FirstOrDefaultAsync(trip => trip.Id == id && !trip.IsDeleted, cancellationToken);

    public async Task<Trip?> GetForDriverByIdAsync(Guid id, string driverEmail, CancellationToken cancellationToken) =>
        await _context.Trips
            .AsNoTracking()
            .Include(trip => trip.Vehicle)
            .FirstOrDefaultAsync(trip => trip.Id == id && !trip.IsDeleted &&
                trip.Driver != null && trip.Driver.Email == driverEmail, cancellationToken);

    public async Task<Trip> CreateAsync(
        CreateTripDto request,
        string createdBy,
        CancellationToken cancellationToken)
    {
        if (request.VehicleId == Guid.Empty || request.DriverId == Guid.Empty)
        {
            throw new ArgumentException("A vehicle and driver are required for a trip.");
        }
        if (string.IsNullOrWhiteSpace(request.Source) || string.IsNullOrWhiteSpace(request.Destination))
        {
            throw new ArgumentException("A source and destination are required for a trip.");
        }
        if (request.Source.Trim().Length > 500 || request.Destination.Trim().Length > 500)
        {
            throw new ArgumentException("Trip locations cannot exceed 500 characters.");
        }
        if (request.StartDate >= request.EndDate)
        {
            throw new ArgumentException("The trip end date must be after its start date.");
        }

        var vehicle = await _context.Vehicles
            .SingleOrDefaultAsync(item => item.Id == request.VehicleId, cancellationToken);
        if (vehicle is null)
        {
            throw new KeyNotFoundException("Vehicle not found.");
        }
        if (!string.Equals(vehicle.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only active vehicles can be scheduled for a trip.");
        }

        var driver = await _context.Drivers
            .SingleOrDefaultAsync(item => item.Id == request.DriverId && !item.IsDeleted, cancellationToken);
        if (driver is null)
        {
            throw new KeyNotFoundException("Driver not found.");
        }
        if (!string.Equals(driver.Status, "Active", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(driver.Status, "Assigned", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only active drivers can be scheduled for a trip.");
        }

        var currentAssignment = await _context.VehicleAssignments
            .AsNoTracking()
            .FirstOrDefaultAsync(assignment =>
                assignment.DriverId == request.DriverId && assignment.ReleasedDate == null,
                cancellationToken);
        if (currentAssignment is not null && currentAssignment.VehicleId != request.VehicleId)
        {
            throw new InvalidOperationException("The driver is assigned to a different vehicle.");
        }

        var tripNumber = $"TRP-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8]}";
        var trip = new Trip
        {
            Id = Guid.NewGuid(),
            TripNumber = tripNumber,
            VehicleId = request.VehicleId,
            DriverId = request.DriverId,
            Source = request.Source.Trim(),
            Destination = request.Destination.Trim(),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };

        _context.Trips.Add(trip);
        await _context.SaveChangesAsync(cancellationToken);
        await _producer.ProduceAsync("trip-created", new TripCreatedEvent
        {
            Id = trip.Id,
            TripNumber = trip.TripNumber,
            VehicleId = trip.VehicleId,
            DriverId = trip.DriverId,
            Source = trip.Source,
            Destination = trip.Destination,
            StartDate = trip.StartDate,
            EndDate = trip.EndDate
        });

        return trip;
    }

    public async Task<Trip?> UpdateAsync(
        Guid id,
        CreateTripDto request,
        string changedBy,
        CancellationToken cancellationToken)
    {
        var trip = await _context.Trips
            .Include(item => item.Vehicle)
            .FirstOrDefaultAsync(
            item => item.Id == id && !item.IsDeleted,
            cancellationToken);
        if (trip is null) return null;

        var vehicle = await _context.Vehicles.SingleOrDefaultAsync(
            item => item.Id == request.VehicleId,
            cancellationToken);
        if (vehicle is null) throw new KeyNotFoundException("Vehicle not found.");
        if (!string.Equals(vehicle.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only active vehicles can be scheduled for a trip.");
        }

        var driver = await _context.Drivers.SingleOrDefaultAsync(
            item => item.Id == request.DriverId && !item.IsDeleted,
            cancellationToken);
        if (driver is null) throw new KeyNotFoundException("Driver not found.");
        if (!string.Equals(driver.Status, "Active", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(driver.Status, "Assigned", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only active drivers can be scheduled for a trip.");
        }

        var currentAssignment = await _context.VehicleAssignments
            .AsNoTracking()
            .FirstOrDefaultAsync(assignment =>
                assignment.DriverId == request.DriverId && assignment.ReleasedDate == null,
                cancellationToken);
        if (currentAssignment is not null && currentAssignment.VehicleId != request.VehicleId)
        {
            throw new InvalidOperationException("The driver is assigned to a different vehicle.");
        }

        trip.UpdateSchedule(
            request.VehicleId,
            request.DriverId,
            request.Source,
            request.Destination,
            request.StartDate,
            request.EndDate,
            DateTime.UtcNow,
            changedBy);
        await _context.SaveChangesAsync(cancellationToken);
        await _producer.ProduceAsync("trip-updated", new TripUpdatedEvent
        {
            Id = trip.Id,
            TripNumber = trip.TripNumber,
            VehicleId = trip.VehicleId,
            DriverId = trip.DriverId,
            Source = trip.Source,
            Destination = trip.Destination,
            StartDate = trip.StartDate,
            EndDate = trip.EndDate
        });
        return trip;
    }

    public async Task<bool> DeleteAsync(Guid id, string changedBy, CancellationToken cancellationToken)
    {
        var trip = await _context.Trips.FirstOrDefaultAsync(
            item => item.Id == id && !item.IsDeleted,
            cancellationToken);
        if (trip is null) return false;

        var deletedAt = DateTime.UtcNow;
        trip.SoftDelete(deletedAt, changedBy);
        await _context.SaveChangesAsync(cancellationToken);
        await _producer.ProduceAsync("trip-deleted", new TripDeletedEvent
        {
            Id = trip.Id,
            TripNumber = trip.TripNumber,
            DeletedAt = deletedAt
        });
        return true;
    }

    public async Task<Trip?> StartAsync(Guid id, string changedBy, string? driverEmail, CancellationToken cancellationToken)
    {
        var trip = await GetTrackedTripAsync(id, driverEmail, cancellationToken);
        if (trip is null) return null;

        var startedAt = DateTime.UtcNow;
        trip.Start(startedAt, changedBy);
        await _context.SaveChangesAsync(cancellationToken);
        await _producer.ProduceAsync("trip-started", new TripStartedEvent
        {
            Id = trip.Id,
            TripNumber = trip.TripNumber,
            ActualStartDate = startedAt
        });
        return trip;
    }

    public async Task<Trip?> CompleteAsync(
        Guid id,
        CompleteTripDto request,
        string changedBy,
        string? driverEmail,
        CancellationToken cancellationToken)
    {
        var trip = await GetTrackedTripAsync(id, driverEmail, cancellationToken);
        if (trip is null) return null;

        var completedAt = DateTime.UtcNow;
        trip.Complete(completedAt, request.Distance, request.FuelConsumed, changedBy);
        await _context.SaveChangesAsync(cancellationToken);
        await _producer.ProduceAsync("trip-completed", new TripCompletedEvent
        {
            Id = trip.Id,
            TripNumber = trip.TripNumber,
            VehicleId = trip.VehicleId,
            DriverId = trip.DriverId,
            ActualEndDate = completedAt,
            Distance = request.Distance,
            FuelConsumed = request.FuelConsumed
        });
        return trip;
    }

    public async Task<Trip?> CancelAsync(Guid id, string changedBy, CancellationToken cancellationToken)
    {
        var trip = await GetTrackedTripAsync(id, null, cancellationToken);
        if (trip is null) return null;

        var cancelledAt = DateTime.UtcNow;
        trip.Cancel(cancelledAt, changedBy);
        await _context.SaveChangesAsync(cancellationToken);
        await _producer.ProduceAsync("trip-cancelled", new TripCancelledEvent
        {
            Id = trip.Id,
            TripNumber = trip.TripNumber,
            VehicleId = trip.VehicleId,
            DriverId = trip.DriverId,
            CancelledAt = cancelledAt
        });
        return trip;
    }

    private Task<Trip?> GetTrackedTripAsync(Guid id, string? driverEmail, CancellationToken cancellationToken) =>
        _context.Trips
            .Include(trip => trip.Vehicle)
            .FirstOrDefaultAsync(trip => trip.Id == id && !trip.IsDeleted &&
                (driverEmail == null || (trip.Driver != null && trip.Driver.Email == driverEmail)), cancellationToken);
}
