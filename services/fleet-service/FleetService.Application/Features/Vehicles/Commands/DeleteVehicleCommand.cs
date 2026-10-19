using MediatR;

namespace FleetService.Application.Features.Vehicles.Commands;

public record DeleteVehicleCommand(Guid Id) : IRequest<bool>;
