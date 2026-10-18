using FleetService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FleetService.Infrastructure.Persistence;

public class FleetDbContext : DbContext
{
    public FleetDbContext(DbContextOptions<FleetDbContext> options)
        : base(options)
    {
    }

    public DbSet<Vehicle> Vehicles => Set<Vehicle>();

    public DbSet<Driver> Drivers => Set<Driver>();

    public DbSet<VehicleAssignment> VehicleAssignments => Set<VehicleAssignment>();

    public DbSet<Trip> Trips => Set<Trip>();

    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();

    public DbSet<FuelRecord> FuelRecords => Set<FuelRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.VehicleNumber)
                  .IsRequired()
                  .HasMaxLength(50);

            entity.Property(x => x.Manufacturer)
                  .HasMaxLength(100);

            entity.Property(x => x.Model)
                  .HasMaxLength(100);
        });

        modelBuilder.Entity<Driver>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.EmployeeCode)
                  .IsRequired()
                  .HasMaxLength(50);

            entity.Property(x => x.FirstName)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.LastName)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.PhoneNumber)
                  .IsRequired()
                  .HasMaxLength(20);

            entity.Property(x => x.Email)
                  .IsRequired()
                  .HasMaxLength(255);

            entity.Property(x => x.LicenseNumber)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.Status)
                  .IsRequired()
                  .HasMaxLength(50);

            entity.Property(x => x.CreatedBy)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.UpdatedBy)
                  .HasMaxLength(100);

            entity.HasIndex(x => x.LicenseNumber)
                  .IsUnique();

            entity.HasIndex(x => x.Status);
        });

        modelBuilder.Entity<VehicleAssignment>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.HasOne(x => x.Vehicle)
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Driver)
                .WithMany()
                .HasForeignKey(x => x.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => new { x.VehicleId, x.AssignedDate });
            entity.HasIndex(x => new { x.VehicleId, x.ReleasedDate })
                .IsUnique()
                .HasFilter("[ReleasedDate] IS NULL");
            entity.HasIndex(x => new { x.DriverId, x.ReleasedDate })
                .IsUnique()
                .HasFilter("[ReleasedDate] IS NULL");
        });

        modelBuilder.Entity<Trip>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.TripNumber).IsRequired().HasMaxLength(50);
            entity.Property(x => x.Source).IsRequired().HasMaxLength(500);
            entity.Property(x => x.Destination).IsRequired().HasMaxLength(500);
            entity.Property(x => x.Status).IsRequired().HasMaxLength(50);
            entity.Property(x => x.Distance).HasPrecision(18, 2);
            entity.Property(x => x.FuelConsumed).HasPrecision(18, 2);
            entity.Property(x => x.CreatedBy).IsRequired().HasMaxLength(100);
            entity.Property(x => x.UpdatedBy).HasMaxLength(100);

            entity.HasOne(x => x.Vehicle)
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Driver)
                .WithMany()
                .HasForeignKey(x => x.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.TripNumber).IsUnique();
            entity.HasIndex(x => new { x.Status, x.StartDate });
            entity.HasIndex(x => x.VehicleId);
            entity.HasIndex(x => x.DriverId);
        });

        modelBuilder.Entity<MaintenanceRecord>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.ServiceType)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.Description)
                  .HasMaxLength(2000);

            entity.Property(x => x.Cost)
                  .HasPrecision(18, 2);

            entity.Property(x => x.Vendor)
                  .IsRequired()
                  .HasMaxLength(255);

            entity.Property(x => x.Status)
                  .IsRequired()
                  .HasMaxLength(50);

            entity.Property(x => x.CreatedBy)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.UpdatedBy)
                  .HasMaxLength(100);

            entity.HasOne(x => x.Vehicle)
                  .WithMany()
                  .HasForeignKey(x => x.VehicleId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.Status);

            entity.HasIndex(x => x.ScheduledDate);

            entity.HasIndex(x => x.VehicleId);
        });

        modelBuilder.Entity<FuelRecord>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Quantity)
                  .HasPrecision(18, 2);

            entity.Property(x => x.Cost)
                  .HasPrecision(18, 2);

            entity.Property(x => x.OdometerReading)
                  .HasPrecision(18, 2);

            entity.Property(x => x.CreatedBy)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(x => x.UpdatedBy)
                  .HasMaxLength(100);

            entity.HasOne(x => x.Vehicle)
                  .WithMany()
                  .HasForeignKey(x => x.VehicleId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.VehicleId);

            entity.HasIndex(x => x.FuelDate);
        });
    }
}
