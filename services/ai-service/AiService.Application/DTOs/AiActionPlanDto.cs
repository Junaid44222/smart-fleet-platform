namespace AiService.Application.DTOs;

public sealed class AiActionPlanDto
{
    public string Action { get; set; } = "none";

    public string AssistantMessage { get; set; } = string.Empty;

    public TripActionDraftDto? Trip { get; set; }

    public MaintenanceActionDraftDto? Maintenance { get; set; }
}

public sealed class TripActionDraftDto
{
    public string? VehicleNumber { get; set; }

    public string? DriverEmail { get; set; }

    public string? Source { get; set; }

    public string? Destination { get; set; }

    public string? StartDate { get; set; }

    public string? EndDate { get; set; }
}

public sealed class MaintenanceActionDraftDto
{
    public string? VehicleNumber { get; set; }

    public string? ServiceType { get; set; }

    public string? Description { get; set; }

    public string? ScheduledDate { get; set; }

    public decimal? Cost { get; set; }

    public string? Vendor { get; set; }
}
