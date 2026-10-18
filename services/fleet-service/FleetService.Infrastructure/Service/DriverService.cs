using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Application.Services;
using FleetService.Domain.Entities;
using FleetService.Infrastructure.Messaging.Events;
using FleetService.Infrastructure.Messaging.Interfaces;

namespace FleetService.Infrastructure.Services;

public class DriverService : IDriverService
{
    private readonly IDriverRepository _repository;

    private readonly IKafkaProducer _producer;
    private readonly IVehicleAssignmentService _vehicleAssignmentService;

    public DriverService(
        IDriverRepository repository,
        IKafkaProducer producer,
        IVehicleAssignmentService vehicleAssignmentService)
    {
        _repository = repository;
        _producer = producer;
        _vehicleAssignmentService = vehicleAssignmentService;
    }

    public async Task<IEnumerable<Driver>> GetAllAsync()
    {
        return await _repository.GetAllAsync();
    }

    public async Task<Driver?> GetByIdAsync(Guid id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<Driver> CreateAsync(CreateDriverDto dto)
    {
        var existingDriver =
            await _repository.GetByLicenseNumberAsync(dto.LicenseNumber);

        if (existingDriver is not null)
        {
            throw new InvalidOperationException(
                "A driver with the same license number already exists.");
        }

        var driver = new Driver
        {
            Id = Guid.NewGuid(),
            EmployeeCode = dto.EmployeeCode,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            PhoneNumber = dto.PhoneNumber,
            Email = dto.Email,
            LicenseNumber = dto.LicenseNumber,
            LicenseExpiryDate = dto.LicenseExpiryDate,
            JoiningDate = dto.JoiningDate,
            Status = dto.Status,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(driver);

        await _producer.ProduceAsync(
            "driver.created",
            new DriverCreatedEvent
            {
                Id = driver.Id,
                EmployeeCode = driver.EmployeeCode,
                FirstName = driver.FirstName,
                LastName = driver.LastName,
                LicenseNumber = driver.LicenseNumber,
                Status = driver.Status,
                CreatedAt = driver.CreatedAt
            });

        return driver;
    }

    public async Task<Driver?> UpdateAsync(Guid id, UpdateDriverDto dto)
    {
        var driver = await _repository.GetByIdAsync(id);

        if (driver is null)
        {
            return null;
        }

        var existingDriver =
            await _repository.GetByLicenseNumberAsync(dto.LicenseNumber);

        if (existingDriver is not null &&
            existingDriver.Id != id)
        {
            throw new InvalidOperationException(
                "A driver with the same license number already exists.");
        }

        if (string.Equals(dto.Status, "Inactive", StringComparison.OrdinalIgnoreCase))
        {
            await _vehicleAssignmentService.ReleaseDriverAsync(id, "system", CancellationToken.None);
        }

        driver.EmployeeCode = dto.EmployeeCode;
        driver.FirstName = dto.FirstName;
        driver.LastName = dto.LastName;
        driver.PhoneNumber = dto.PhoneNumber;
        driver.Email = dto.Email;
        driver.LicenseNumber = dto.LicenseNumber;
        driver.LicenseExpiryDate = dto.LicenseExpiryDate;
        driver.JoiningDate = dto.JoiningDate;
        driver.Status = dto.Status;
        driver.UpdatedAt = DateTime.UtcNow;
        driver.UpdatedBy = "system";

        await _repository.UpdateAsync(driver);

        await _producer.ProduceAsync(
            "driver.updated",
            new DriverUpdatedEvent
            {
                Id = driver.Id,
                EmployeeCode = driver.EmployeeCode,
                Status = driver.Status,
                UpdatedAt = driver.UpdatedAt.Value
            });

        return driver;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var driver = await _repository.GetByIdAsync(id);

        if (driver is null)
        {
            return false;
        }

        await _vehicleAssignmentService.ReleaseDriverAsync(id, "system", CancellationToken.None);

        driver.IsDeleted = true;
        driver.Status = "Inactive";
        driver.UpdatedAt = DateTime.UtcNow;
        driver.UpdatedBy = "system";

        await _repository.UpdateAsync(driver);

        await _producer.ProduceAsync(
            "driver.deleted",
            new DriverDeletedEvent
            {
                Id = driver.Id,
                EmployeeCode = driver.EmployeeCode,
                DeletedAt = driver.UpdatedAt.Value
            });

        return true;
    }
}
