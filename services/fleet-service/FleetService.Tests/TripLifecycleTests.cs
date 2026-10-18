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
