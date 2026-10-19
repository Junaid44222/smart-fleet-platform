using FleetService.Application.Features.Vehicles.Commands;
using FleetService.Application.Services;
using FleetService.Domain.Entities;
using MediatR;

namespace FleetService.Application.Features.Vehicles.Handlers;

public class UpdateVehicleHandler : IRequestHandler<UpdateVehicleCommand, Vehicle?>
{
    private readonly IVehicleService _service;

    public UpdateVehicleHandler(IVehicleService service)
    {
        _service = service;
    }

    public Task<Vehicle?> Handle(UpdateVehicleCommand request, CancellationToken cancellationToken) =>
        _service.UpdateAsync(request.Id, request.VehicleDto);
}
