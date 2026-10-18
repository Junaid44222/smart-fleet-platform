using FleetService.Application.DTOs;
using FleetService.API.Authorization;
using FleetService.Application.Features.MaintenanceRecords.Commands;
using FleetService.Application.Features.MaintenanceRecords.Queries;
using FleetService.Application.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FleetService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MaintenanceRecordsController : ControllerBase
{
    private readonly IMediator _mediator;

    public MaintenanceRecordsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(
            new GetAllMaintenanceRecordsQuery());

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Maintenance records fetched successfully",
            Data = result
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var maintenanceRecord = await _mediator.Send(
            new GetMaintenanceRecordByIdQuery(id));

        if (maintenanceRecord is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Maintenance record not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Maintenance record fetched successfully",
            Data = maintenanceRecord
        });
    }

    [HttpPost]
    [Authorize(Roles = FleetRoles.MaintenanceManagers)]
    public async Task<IActionResult> Create(
        [FromBody] CreateMaintenanceRecordDto dto)
    {
        var result = await _mediator.Send(
            new CreateMaintenanceRecordCommand(dto));

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Maintenance record created successfully",
            Data = result
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = FleetRoles.MaintenanceManagers)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateMaintenanceRecordDto dto)
    {
        var result = await _mediator.Send(
            new UpdateMaintenanceRecordCommand(id, dto));

        if (result is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Maintenance record not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Maintenance record updated successfully",
            Data = result
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = FleetRoles.Administrators)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _mediator.Send(
            new DeleteMaintenanceRecordCommand(id));

        if (!deleted)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Maintenance record not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Maintenance record deleted successfully"
        });
    }
}
