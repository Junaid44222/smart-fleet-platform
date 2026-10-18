namespace FleetService.Application.DTOs;

public class VehicleAssignmentDto
{
    public Guid Id { get; set; }

    public Guid VehicleId { get; set; }

    public Guid DriverId { get; set; }

    public string DriverName { get; set; } = string.Empty;

    public string EmployeeCode { get; set; } = string.Empty;

    public DateTime AssignedDate { get; set; }

    public DateTime? ReleasedDate { get; set; }
}
