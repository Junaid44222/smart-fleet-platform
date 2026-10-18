using FleetService.Application.DTOs;
using FleetService.API.Authorization;
using FleetService.Application.Features.Drivers.Commands;
using FleetService.Application.Features.Drivers.Queries;
using FleetService.Application.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FleetService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DriversController : ControllerBase
{
    private readonly IMediator _mediator;

    public DriversController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(
            new GetAllDriversQuery());

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Drivers fetched successfully",
            Data = result
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var driver = await _mediator.Send(
            new GetDriverByIdQuery(id));

        if (driver is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Driver not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Driver fetched successfully",
            Data = driver
        });
    }

    [HttpPost]
    [Authorize(Roles = FleetRoles.FleetManagers)]
    public async Task<IActionResult> Create(
        [FromBody] CreateDriverDto dto)
    {
        var result = await _mediator.Send(
            new CreateDriverCommand(dto));

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Driver created successfully",
            Data = result
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = FleetRoles.FleetManagers)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateDriverDto dto)
    {
        var result = await _mediator.Send(
            new UpdateDriverCommand(id, dto));

        if (result is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Driver not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Driver updated successfully",
            Data = result
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = FleetRoles.Administrators)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _mediator.Send(
            new DeleteDriverCommand(id));

        if (!deleted)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Driver not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Driver deleted successfully"
        });
    }
}
