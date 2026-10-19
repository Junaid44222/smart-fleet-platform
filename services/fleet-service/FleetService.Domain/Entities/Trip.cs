namespace FleetService.Domain.Entities;

public class Trip
{
    public const string ScheduledStatus = "Scheduled";
    public const string InProgressStatus = "InProgress";
    public const string CompletedStatus = "Completed";
    public const string CancelledStatus = "Cancelled";

    public Guid Id { get; set; }

    public string TripNumber { get; set; } = string.Empty;

    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public string Source { get; set; } = string.Empty;

    public string Destination { get; set; } = string.Empty;

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public DateTime? ActualStartDate { get; private set; }

    public DateTime? ActualEndDate { get; private set; }

    public decimal? Distance { get; private set; }

    public decimal? FuelConsumed { get; private set; }

    public string Status { get; private set; } = ScheduledStatus;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string CreatedBy { get; set; } = "system";

    public DateTime? UpdatedAt { get; private set; }

    public string? UpdatedBy { get; private set; }

    public bool IsDeleted { get; set; }

    public Vehicle? Vehicle { get; set; }

    public Driver? Driver { get; set; }

    public void Start(DateTime startedAt, string changedBy)
    {
        EnsureStatus(ScheduledStatus, "Only scheduled trips can be started.");
        ActualStartDate = startedAt;
        Status = InProgressStatus;
        Touch(startedAt, changedBy);
    }

    public void Complete(DateTime completedAt, decimal distance, decimal fuelConsumed, string changedBy)
    {
        EnsureStatus(InProgressStatus, "Only in-progress trips can be completed.");
        if (distance < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(distance), "Distance cannot be negative.");
        }
        if (fuelConsumed < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(fuelConsumed), "Fuel consumed cannot be negative.");
        }

        ActualEndDate = completedAt;
        Distance = distance;
        FuelConsumed = fuelConsumed;
        Status = CompletedStatus;
        Touch(completedAt, changedBy);
    }

    public void Cancel(DateTime cancelledAt, string changedBy)
    {
        EnsureStatus(ScheduledStatus, "Only scheduled trips can be cancelled.");
        Status = CancelledStatus;
        Touch(cancelledAt, changedBy);
    }

    public void UpdateSchedule(
        Guid vehicleId,
        Guid driverId,
        string source,
        string destination,
        DateTime startDate,
        DateTime endDate,
        DateTime changedAt,
        string changedBy)
    {
        EnsureStatus(ScheduledStatus, "Only scheduled trips can be updated.");
        if (vehicleId == Guid.Empty || driverId == Guid.Empty)
        {
            throw new ArgumentException("A vehicle and driver are required for a trip.");
        }
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(destination))
        {
            throw new ArgumentException("A source and destination are required for a trip.");
        }
        if (source.Trim().Length > 500 || destination.Trim().Length > 500)
        {
            throw new ArgumentException("Trip locations cannot exceed 500 characters.");
        }
        if (startDate >= endDate)
        {
            throw new ArgumentException("The trip end date must be after its start date.");
        }

        VehicleId = vehicleId;
        DriverId = driverId;
        Source = source.Trim();
        Destination = destination.Trim();
        StartDate = startDate;
        EndDate = endDate;
        Touch(changedAt, changedBy);
    }

    public void SoftDelete(DateTime deletedAt, string changedBy)
    {
        if (!string.Equals(Status, ScheduledStatus, StringComparison.Ordinal) &&
            !string.Equals(Status, CancelledStatus, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Only scheduled or cancelled trips can be deleted.");
        }

        IsDeleted = true;
        Touch(deletedAt, changedBy);
    }

    private void EnsureStatus(string expected, string message)
    {
        if (!string.Equals(Status, expected, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(message);
        }
    }

    private void Touch(DateTime changedAt, string changedBy)
    {
        UpdatedAt = changedAt;
        UpdatedBy = changedBy;
    }
}
