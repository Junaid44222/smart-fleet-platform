namespace AiService.Application.Interfaces;

public interface IFleetVehicleContextProvider
{
    Task<string?> GetVehicleContextAsync(
        string question,
        string? authorizationHeader,
        CancellationToken cancellationToken);
}