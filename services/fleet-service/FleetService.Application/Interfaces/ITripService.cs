using FleetService.Application.DTOs;
using FleetService.Domain.Entities;

namespace FleetService.Application.Interfaces;

public interface ITripService
{
    Task<IReadOnlyList<Trip>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Trip>> GetForDriverAsync(string driverEmail, CancellationToken cancellationToken);

    Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Trip?> GetForDriverByIdAsync(Guid id, string driverEmail, CancellationToken cancellationToken);

    Task<Trip> CreateAsync(CreateTripDto request, string createdBy, CancellationToken cancellationToken);

    Task<Trip?> UpdateAsync(Guid id, CreateTripDto request, string changedBy, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid id, string changedBy, CancellationToken cancellationToken);

    Task<Trip?> StartAsync(Guid id, string changedBy, string? driverEmail, CancellationToken cancellationToken);

    Task<Trip?> CompleteAsync(Guid id, CompleteTripDto request, string changedBy, string? driverEmail, CancellationToken cancellationToken);

    Task<Trip?> CancelAsync(Guid id, string changedBy, CancellationToken cancellationToken);
}
