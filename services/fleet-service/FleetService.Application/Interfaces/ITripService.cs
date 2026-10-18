using FleetService.Application.DTOs;
using FleetService.Domain.Entities;

namespace FleetService.Application.Interfaces;

public interface ITripService
{
    Task<IReadOnlyList<Trip>> GetAllAsync(CancellationToken cancellationToken);

    Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Trip> CreateAsync(CreateTripDto request, string createdBy, CancellationToken cancellationToken);

    Task<Trip?> StartAsync(Guid id, string changedBy, CancellationToken cancellationToken);

    Task<Trip?> CompleteAsync(Guid id, CompleteTripDto request, string changedBy, CancellationToken cancellationToken);

    Task<Trip?> CancelAsync(Guid id, string changedBy, CancellationToken cancellationToken);
}
