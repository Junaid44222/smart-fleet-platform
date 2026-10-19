using System.Security.Claims;
using FleetService.API.Authorization;
using FleetService.Application.DTOs;
using FleetService.Application.Interfaces;
using FleetService.Application.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FleetService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TripsController : ControllerBase
{
    private readonly ITripService _tripService;

    public TripsController(ITripService tripService)
    {
        _tripService = tripService;
    }

    /// <summary>Lists scheduled, active, and completed trips.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var trips = User.IsInRole("Driver")
            ? await _tripService.GetForDriverAsync(
                User.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty,
                cancellationToken)
            : await _tripService.GetAllAsync(cancellationToken);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Trips fetched successfully",
            Data = trips
        });
    }

    /// <summary>Lists only the authenticated driver's trips.</summary>
    [HttpGet("mine")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var trips = await _tripService.GetForDriverAsync(email, cancellationToken);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Driver trips fetched successfully",
            Data = trips
        });
    }

    /// <summary>Returns a trip by its identifier.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var trip = User.IsInRole("Driver")
            ? await _tripService.GetForDriverByIdAsync(
                id,
                User.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty,
                cancellationToken)
            : await _tripService.GetByIdAsync(id, cancellationToken);
        if (trip is null)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Trip not found" });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Trip fetched successfully",
            Data = trip
        });
    }

    /// <summary>Schedules a trip for an active vehicle and driver.</summary>
    [HttpPost]
    [Authorize(Roles = FleetRoles.TripManagers)]
    public async Task<IActionResult> Create([FromBody] CreateTripDto request, CancellationToken cancellationToken)
    {
        try
        {
            var trip = await _tripService.CreateAsync(
                request,
                User.FindFirst(ClaimTypes.Email)?.Value ?? "system",
                cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = trip.Id }, new ApiResponse<object>
            {
                Success = true,
                Message = "Trip scheduled successfully",
                Data = trip
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Updates a scheduled trip.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = FleetRoles.TripManagers)]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateTripDto request, CancellationToken cancellationToken)
    {
        try
        {
            var trip = await _tripService.UpdateAsync(
                id,
                request,
                User.FindFirst(ClaimTypes.Email)?.Value ?? "system",
                cancellationToken);
            return trip is null
                ? NotFound(new ApiResponse<object> { Success = false, Message = "Trip not found" })
                : Ok(new ApiResponse<object> { Success = true, Message = "Trip updated successfully", Data = trip });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Soft-deletes a scheduled or cancelled trip.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = FleetRoles.Administrators)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await _tripService.DeleteAsync(
                id,
                User.FindFirst(ClaimTypes.Email)?.Value ?? "system",
                cancellationToken);
            return deleted
                ? Ok(new ApiResponse<object> { Success = true, Message = "Trip deleted successfully" })
                : NotFound(new ApiResponse<object> { Success = false, Message = "Trip not found" });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Starts a scheduled trip.</summary>
    [HttpPost("{id:guid}/start")]
    [Authorize(Roles = FleetRoles.TripOperators)]
    public async Task<IActionResult> Start(Guid id, CancellationToken cancellationToken)
    {
        var driverEmail = User.IsInRole("Driver") ? User.FindFirst(ClaimTypes.Email)?.Value : null;
        if (User.IsInRole("Driver") && string.IsNullOrWhiteSpace(driverEmail)) return Forbid();

        try
        {
            var trip = await _tripService.StartAsync(
                id,
                User.FindFirst(ClaimTypes.Email)?.Value ?? "system",
                driverEmail,
                cancellationToken);
            return trip is null
                ? NotFound(new ApiResponse<object> { Success = false, Message = "Trip not found" })
                : Ok(new ApiResponse<object> { Success = true, Message = "Trip started successfully", Data = trip });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Completes an in-progress trip and records distance and fuel use.</summary>
    [HttpPost("{id:guid}/complete")]
    [Authorize(Roles = FleetRoles.TripOperators)]
    public async Task<IActionResult> Complete(
        Guid id,
        [FromBody] CompleteTripDto request,
        CancellationToken cancellationToken)
    {
        var driverEmail = User.IsInRole("Driver") ? User.FindFirst(ClaimTypes.Email)?.Value : null;
        if (User.IsInRole("Driver") && string.IsNullOrWhiteSpace(driverEmail)) return Forbid();

        try
        {
            var trip = await _tripService.CompleteAsync(
                id,
                request,
                User.FindFirst(ClaimTypes.Email)?.Value ?? "system",
                driverEmail,
                cancellationToken);
            return trip is null
                ? NotFound(new ApiResponse<object> { Success = false, Message = "Trip not found" })
                : Ok(new ApiResponse<object> { Success = true, Message = "Trip completed successfully", Data = trip });
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    /// <summary>Cancels a scheduled trip.</summary>
    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = FleetRoles.TripManagers)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var trip = await _tripService.CancelAsync(
                id,
                User.FindFirst(ClaimTypes.Email)?.Value ?? "system",
                cancellationToken);
            return trip is null
                ? NotFound(new ApiResponse<object> { Success = false, Message = "Trip not found" })
                : Ok(new ApiResponse<object> { Success = true, Message = "Trip cancelled successfully", Data = trip });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
