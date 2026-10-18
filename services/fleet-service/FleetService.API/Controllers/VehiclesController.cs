using FleetService.Application.DTOs;
using FleetService.Application.Features.Vehicles.Commands;
using FleetService.Application.Features.Vehicles.Queries;
using FleetService.Application.Interfaces;
using FleetService.Application.Responses;
using FleetService.API.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;


namespace FleetService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAdministrativeVehicleService _administrativeVehicleService;
    private readonly IVehicleAssignmentService _vehicleAssignmentService;

    public VehiclesController(
        IMediator mediator,
        IAdministrativeVehicleService administrativeVehicleService,
        IVehicleAssignmentService vehicleAssignmentService)
    {
        _mediator = mediator;
        _administrativeVehicleService = administrativeVehicleService;
        _vehicleAssignmentService = vehicleAssignmentService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(
            new GetAllVehiclesQuery());

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Vehicles fetched successfully",
            Data = result
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var vehicles = await _mediator.Send(
            new GetAllVehiclesQuery());

        var vehicle = vehicles.FirstOrDefault(x => x.Id == id);

        if (vehicle == null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Vehicle not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Vehicle fetched successfully",
            Data = vehicle
        });
    }

    [HttpPost]
    [Authorize(Roles = FleetRoles.FleetManagers)]
    public async Task<IActionResult> Create(
        [FromBody] CreateVehicleDto dto)
    {
        var result = await _mediator.Send(
            new CreateVehicleCommand(dto));

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Vehicle created successfully",
            Data = result
        });
    }

    /// <summary>Returns the vehicle's current driver assignment, or null if the vehicle is unassigned.</summary>
    [HttpGet("{id:guid}/assignment")]
    public async Task<IActionResult> GetCurrentAssignment(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var assignment = await _vehicleAssignmentService.GetCurrentAssignmentAsync(id, cancellationToken);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = assignment is null ? "Vehicle has no assigned driver" : "Current assignment fetched successfully",
                Data = assignment
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Returns the assignment history for a vehicle.</summary>
    [HttpGet("{id:guid}/assignments")]
    public async Task<IActionResult> GetAssignmentHistory(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var assignments = await _vehicleAssignmentService.GetAssignmentHistoryAsync(id, cancellationToken);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Vehicle assignment history fetched successfully",
                Data = assignments
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Assigns a driver to a vehicle; pass a null driverId to release the current driver.</summary>
    [HttpPut("{id:guid}/assignment")]
    [Authorize(Roles = FleetRoles.VehicleAssigners)]
    public async Task<IActionResult> SetAssignment(
        Guid id,
        [FromBody] AssignVehicleDriverDto request,
        CancellationToken cancellationToken)
    {
        var changedBy = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "system";
        try
        {
            var assignment = await _vehicleAssignmentService.SetAssignmentAsync(
                id,
                request.DriverId,
                changedBy,
                cancellationToken);

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = assignment is null ? "Driver unassigned successfully" : "Driver assignment updated successfully",
                Data = assignment
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (DbUpdateException)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = "The assignment changed concurrently. Refresh the vehicle and try again."
            });
        }
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = FleetRoles.Admin)]
    public async Task<IActionResult> ChangeStatus(
        Guid id,
        [FromBody] ChangeVehicleStatusDto request,
        CancellationToken cancellationToken)
    {
        if (request.Status.Equals("Maintenance", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "A reason is required when placing a vehicle into maintenance."
            });
        }

        try
        {
            var result = await _administrativeVehicleService.ChangeStatusAsync(
                id,
                request,
                User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "admin",
                cancellationToken);

            if (result is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Vehicle not found"
                });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = result.WorkOrder is null
                    ? "Vehicle status updated successfully"
                    : "Vehicle placed into maintenance and unplanned work order created",
                Data = result
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("test-error")]
    public IActionResult TestError()
    {
        throw new Exception("Test Exception");
    }
}
