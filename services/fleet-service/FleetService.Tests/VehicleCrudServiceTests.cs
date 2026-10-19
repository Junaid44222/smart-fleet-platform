using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging.Interfaces;
using FleetService.Infrastructure.Services;
using Xunit;

namespace FleetService.Tests;

public class VehicleCrudServiceTests
{
    [Fact]
    public async Task UpdateAsync_UpdatesEditableVehicleDetails()
    {
        var vehicle = CreateVehicle("VAN-1");
        var repository = new FakeVehicleRepository(vehicle);
        var service = new VehicleService(repository, new FakeKafkaProducer());

        var result = await service.UpdateAsync(vehicle.Id, new UpdateVehicleDto
        {
            VehicleNumber = "VAN-2",
            Manufacturer = "Ford",
            Model = "Transit",
            Year = 2025,
            FuelCapacity = 80
        });

        Assert.Same(vehicle, result);
        Assert.Equal("VAN-2", vehicle.VehicleNumber);
        Assert.Equal("Transit", vehicle.Model);
        Assert.Equal("Active", vehicle.Status);
        Assert.Equal(1, repository.UpdateCount);
    }

    [Fact]
    public async Task CreateAsync_RejectsDuplicateRegistrationIgnoringCase()
    {
        var repository = new FakeVehicleRepository(CreateVehicle("VAN-1"));
        var service = new VehicleService(repository, new FakeKafkaProducer());

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(new CreateVehicleDto
        {
            VehicleNumber = " van-1 ",
            Manufacturer = "Ford",
            Model = "Transit",
            Year = 2025,
            FuelCapacity = 80
        }));
        Assert.Single(repository.Vehicles);
    }

    [Fact]
    public async Task DeleteAsync_RejectsVehicleWithRelatedHistory()
    {
        var vehicle = CreateVehicle("VAN-1");
        var repository = new FakeVehicleRepository(vehicle) { HasRelatedRecords = true };
        var service = new VehicleService(repository, new FakeKafkaProducer());

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAsync(vehicle.Id));

        Assert.Contains("history", exception.Message);
        Assert.Single(repository.Vehicles);
    }

    [Fact]
    public async Task DeleteAsync_RemovesVehicleWithoutRelatedHistory()
    {
        var vehicle = CreateVehicle("VAN-1");
        var repository = new FakeVehicleRepository(vehicle);
        var service = new VehicleService(repository, new FakeKafkaProducer());

        Assert.True(await service.DeleteAsync(vehicle.Id));
        Assert.Empty(repository.Vehicles);
    }

    private static Vehicle CreateVehicle(string vehicleNumber) => new() { Id = Guid.NewGuid(), VehicleNumber = vehicleNumber };

    private sealed class FakeVehicleRepository : IVehicleRepository
    {
        public List<Vehicle> Vehicles { get; }
        public int UpdateCount { get; private set; }
        public bool HasRelatedRecords { get; init; }

        public FakeVehicleRepository(params Vehicle[] vehicles) => Vehicles = [.. vehicles];
        public Task<IEnumerable<Vehicle>> GetAllAsync() => Task.FromResult<IEnumerable<Vehicle>>(Vehicles);
        public Task<Vehicle?> GetByIdAsync(Guid id) => Task.FromResult(Vehicles.FirstOrDefault(vehicle => vehicle.Id == id));
        public Task AddAsync(Vehicle vehicle) { Vehicles.Add(vehicle); return Task.CompletedTask; }
        public Task UpdateAsync(Vehicle vehicle) { UpdateCount++; return Task.CompletedTask; }
        public Task DeleteAsync(Vehicle vehicle) { Vehicles.Remove(vehicle); return Task.CompletedTask; }
        public Task<bool> HasRelatedRecordsAsync(Guid id) => Task.FromResult(HasRelatedRecords);
    }

    private sealed class FakeKafkaProducer : IKafkaProducer
    {
        public Task ProduceAsync<T>(string topic, T message) => Task.CompletedTask;
    }
}
