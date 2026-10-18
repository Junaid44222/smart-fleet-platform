using FleetService.Application.DTOs;
using FleetService.API.Authorization;
using FleetService.Application.Features.FuelRecords.Commands;
using FleetService.Application.Features.FuelRecords.Queries;
using FleetService.Application.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FleetService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FuelRecordsController : ControllerBase
{
    private readonly IMediator _mediator;

    public FuelRecordsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(
            new GetAllFuelRecordsQuery());

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Fuel records fetched successfully",
            Data = result
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var fuelRecord = await _mediator.Send(
            new GetFuelRecordByIdQuery(id));

        if (fuelRecord is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Fuel record not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Fuel record fetched successfully",
            Data = fuelRecord
        });
    }

    [HttpPost]
    [Authorize(Roles = FleetRoles.FleetManagers)]
    public async Task<IActionResult> Create(
        [FromBody] CreateFuelRecordDto dto)
    {
        var result = await _mediator.Send(
            new CreateFuelRecordCommand(dto));

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Fuel record created successfully",
            Data = result
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = FleetRoles.FleetManagers)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateFuelRecordDto dto)
    {
        var result = await _mediator.Send(
            new UpdateFuelRecordCommand(id, dto));

        if (result is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Fuel record not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Fuel record updated successfully",
            Data = result
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = FleetRoles.Administrators)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _mediator.Send(
            new DeleteFuelRecordCommand(id));

        if (!deleted)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Fuel record not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Fuel record deleted successfully"
        });
    }
}
