using AiService.Application.DTOs;
using AiService.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;

namespace AiService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiAssistantController : ControllerBase
{
    private readonly IAiAssistantService _assistantService;
    private readonly IFleetVehicleContextProvider _fleetVehicleContextProvider;

    public AiAssistantController(
        IAiAssistantService assistantService,
        IFleetVehicleContextProvider fleetVehicleContextProvider)
    {
        _assistantService = assistantService;
        _fleetVehicleContextProvider = fleetVehicleContextProvider;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat(
        [FromBody] AiChatRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var vehicleContext = await _fleetVehicleContextProvider.GetVehicleContextAsync(
                request.Message,
                Request.Headers.Authorization.ToString(),
                cancellationToken);

            if (!string.IsNullOrWhiteSpace(vehicleContext))
            {
                request.Context = string.Join(
                    Environment.NewLine,
                    new[] { request.Context, vehicleContext }
                        .Where(value => !string.IsNullOrWhiteSpace(value)));
            }
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new
            {
                success = false,
                message = ex.Message
            });
        }
        catch (HttpRequestException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                success = false,
                message = "Live fleet data is temporarily unavailable. Please try again."
            });
        }

        var response =
            await _assistantService.AskAsync(request, cancellationToken);

        return Ok(response);
    }

    [HttpPost("fleet-health")]
    public async Task<IActionResult> AnalyzeFleetHealth(
        [FromBody] FleetHealthAnalysisRequestDto request,
        CancellationToken cancellationToken)
    {
        var response =
            await _assistantService.AnalyzeFleetHealthAsync(
                request,
                cancellationToken);

        return Ok(response);
    }
}
