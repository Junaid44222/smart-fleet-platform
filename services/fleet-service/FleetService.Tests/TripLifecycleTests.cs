using FleetService.Domain.Entities;
using Xunit;

namespace FleetService.Tests;

public class TripLifecycleTests
{
    [Fact]
    public void ScheduledTrip_CanStartAndCompleteOnce()
    {
        var trip = new Trip();
        var start = DateTime.UtcNow;
        var end = start.AddHours(2);

        trip.Start(start, "dispatcher@example.com");
        trip.Complete(end, 125.5m, 24.2m, "dispatcher@example.com");

        Assert.Equal(Trip.CompletedStatus, trip.Status);
        Assert.Equal(start, trip.ActualStartDate);
        Assert.Equal(end, trip.ActualEndDate);
        Assert.Equal(125.5m, trip.Distance);
        Assert.Equal(24.2m, trip.FuelConsumed);
    }

    [Fact]
    public void ScheduledTrip_CannotCompleteBeforeStarting()
    {
        var trip = new Trip();

        Assert.Throws<InvalidOperationException>(() =>
            trip.Complete(DateTime.UtcNow, 1, 1, "dispatcher@example.com"));
    }

    [Fact]
    public void InProgressTrip_CannotBeCancelled()
    {
        var trip = new Trip();
        trip.Start(DateTime.UtcNow, "dispatcher@example.com");

        Assert.Throws<InvalidOperationException>(() =>
            trip.Cancel(DateTime.UtcNow, "dispatcher@example.com"));
    }

    [Fact]
    public void ScheduledTrip_CanUpdateSchedule()
    {
        var trip = new Trip();
        var start = DateTime.UtcNow.AddDays(1);
        var vehicleId = Guid.NewGuid();
        var driverId = Guid.NewGuid();

        trip.UpdateSchedule(vehicleId, driverId, " Depot A ", " Depot B ", start, start.AddHours(2), start, "dispatcher@example.com");

        Assert.Equal(vehicleId, trip.VehicleId);
        Assert.Equal(driverId, trip.DriverId);
        Assert.Equal("Depot A", trip.Source);
        Assert.Equal("Depot B", trip.Destination);
        Assert.Equal(start, trip.StartDate);
        Assert.Equal(start.AddHours(2), trip.EndDate);
    }

    [Fact]
    public void InProgressTrip_CannotUpdateOrDelete()
    {
        var trip = new Trip();
        trip.Start(DateTime.UtcNow, "driver@example.com");
        var start = DateTime.UtcNow.AddDays(1);

        Assert.Throws<InvalidOperationException>(() =>
            trip.UpdateSchedule(Guid.NewGuid(), Guid.NewGuid(), "A", "B", start, start.AddHours(1), start, "driver@example.com"));
        Assert.Throws<InvalidOperationException>(() => trip.SoftDelete(DateTime.UtcNow, "admin@example.com"));
    }

    [Fact]
    public void ScheduledOrCancelledTrip_CanBeSoftDeleted()
    {
        var scheduledTrip = new Trip();
        scheduledTrip.SoftDelete(DateTime.UtcNow, "admin@example.com");

        var cancelledTrip = new Trip();
        cancelledTrip.Cancel(DateTime.UtcNow, "dispatcher@example.com");
        cancelledTrip.SoftDelete(DateTime.UtcNow, "admin@example.com");

        Assert.True(scheduledTrip.IsDeleted);
        Assert.True(cancelledTrip.IsDeleted);
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(0, -1)]
    public void Complete_RejectsNegativeDistanceOrFuel(decimal distance, decimal fuelConsumed)
    {
        var trip = new Trip();
        trip.Start(DateTime.UtcNow, "dispatcher@example.com");

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            trip.Complete(DateTime.UtcNow, distance, fuelConsumed, "dispatcher@example.com"));
        Assert.Equal(Trip.InProgressStatus, trip.Status);
    }
}
