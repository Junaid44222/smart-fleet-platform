using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Application.Services;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging.Events;
using FleetService.Infrastructure.Messaging.Interfaces;

namespace FleetService.Infrastructure.Services;

public class VehicleService : IVehicleService
{
    private readonly IVehicleRepository _repository;

    private readonly IKafkaProducer _producer;

    public VehicleService(
        IVehicleRepository repository,
        IKafkaProducer producer)
    {
        _repository = repository;
        _producer = producer;
    }

    public async Task<IEnumerable<Vehicle>> GetAllAsync()
    {
        return await _repository.GetAllAsync();
    }

    public async Task<Vehicle> CreateAsync(
        CreateVehicleDto dto)
    {
        await EnsureVehicleNumberIsUniqueAsync(dto.VehicleNumber, Guid.Empty);
        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            VehicleNumber = dto.VehicleNumber.Trim(),
            Manufacturer = dto.Manufacturer.Trim(),
            Model = dto.Model.Trim(),
            Year = dto.Year,
            FuelCapacity = dto.FuelCapacity,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(vehicle);

        var vehicleCreatedEvent =
            new VehicleCreatedEvent
            {
                Id = vehicle.Id,
                VehicleNumber = vehicle.VehicleNumber,
                Manufacturer = vehicle.Manufacturer,
                Model = vehicle.Model,
                Year = vehicle.Year,
                CreatedAt = vehicle.CreatedAt
            };

        await _producer.ProduceAsync(
            "vehicle-created",
            vehicleCreatedEvent);

        return vehicle;
    }

    public async Task<Vehicle?> UpdateAsync(Guid id, UpdateVehicleDto dto)
    {
        var vehicle = await _repository.GetByIdAsync(id);
        if (vehicle is null)
        {
            return null;
        }

        await EnsureVehicleNumberIsUniqueAsync(dto.VehicleNumber, id);
        vehicle.VehicleNumber = dto.VehicleNumber.Trim();
        vehicle.Manufacturer = dto.Manufacturer.Trim();
        vehicle.Model = dto.Model.Trim();
        vehicle.Year = dto.Year;
        vehicle.FuelCapacity = dto.FuelCapacity;
        await _repository.UpdateAsync(vehicle);
        return vehicle;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var vehicle = await _repository.GetByIdAsync(id);
        if (vehicle is null)
        {
            return false;
        }

        if (await _repository.HasRelatedRecordsAsync(id))
        {
            throw new InvalidOperationException(
                "This vehicle has assignment, trip, maintenance, or fuel history and cannot be deleted.");
        }

        await _repository.DeleteAsync(vehicle);
        return true;
    }

    private async Task EnsureVehicleNumberIsUniqueAsync(string vehicleNumber, Guid excludedVehicleId)
    {
        if (string.IsNullOrWhiteSpace(vehicleNumber))
        {
            throw new ArgumentException("Registration number is required.", nameof(vehicleNumber));
        }

        var duplicate = (await _repository.GetAllAsync()).Any(vehicle =>
            vehicle.Id != excludedVehicleId &&
            string.Equals(vehicle.VehicleNumber, vehicleNumber.Trim(), StringComparison.OrdinalIgnoreCase));
        if (duplicate)
        {
            throw new InvalidOperationException("A vehicle with this registration number already exists.");
        }
    }
}
