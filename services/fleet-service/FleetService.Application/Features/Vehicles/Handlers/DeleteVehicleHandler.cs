using FleetService.Application.Features.Vehicles.Commands;
using FleetService.Application.Services;
using MediatR;

namespace FleetService.Application.Features.Vehicles.Handlers;

public class DeleteVehicleHandler : IRequestHandler<DeleteVehicleCommand, bool>
{
    private readonly IVehicleService _service;

    public DeleteVehicleHandler(IVehicleService service)
    {
        _service = service;
    }

    public Task<bool> Handle(DeleteVehicleCommand request, CancellationToken cancellationToken) =>
        _service.DeleteAsync(request.Id);
}
