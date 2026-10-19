using FleetService.Application.DTOs;
using FleetService.Domain.Entities;
using MediatR;

namespace FleetService.Application.Features.Vehicles.Commands;

public record UpdateVehicleCommand(Guid Id, UpdateVehicleDto VehicleDto) : IRequest<Vehicle?>;
