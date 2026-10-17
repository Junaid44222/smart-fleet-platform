using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiService.Application.Interfaces;

namespace AiService.Infrastructure.Clients;

public sealed class FleetVehicleContextProvider : IFleetVehicleContextProvider
{
    private static readonly Regex RegistrationPattern = new(
        @"\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{1,4}\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;

    public FleetVehicleContextProvider(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string?> GetVehicleContextAsync(
        string question,
        string? authorizationHeader,
        CancellationToken cancellationToken)
    {
        var registrationMatch = RegistrationPattern.Match(question);
        if (!registrationMatch.Success)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(authorizationHeader))
        {
            throw new UnauthorizedAccessException(
                "Sign in to look up live fleet vehicle details.");
        }

        var registration = Regex.Replace(
            registrationMatch.Value,
            @"\s+",
            string.Empty).ToUpperInvariant();

        using var request = new HttpRequestMessage(HttpMethod.Get, "fleet/Vehicles");
        request.Headers.TryAddWithoutValidation("Authorization", authorizationHeader);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var fleetResponse = await response.Content.ReadFromJsonAsync<
            FleetApiResponse<List<FleetVehicle>>>(JsonOptions, cancellationToken);

        var vehicle = fleetResponse?.Data?.FirstOrDefault(candidate =>
            string.Equals(
                candidate.VehicleNumber,
                registration,
                StringComparison.OrdinalIgnoreCase));

        if (vehicle is null)
        {
            return $"FleetService lookup found no vehicle registered as {registration}. " +
                   "Tell the user that no matching vehicle was found; do not guess its specifications.";
        }

        return $"Verified FleetService record for {vehicle.VehicleNumber}: " +
               $"manufacturer {vehicle.Manufacturer}, model {vehicle.Model}, " +
               $"year {vehicle.Year}, fuel capacity {vehicle.FuelCapacity} litres, " +
               $"status {vehicle.Status}. Use these verified values to answer the user's question directly.";
    }

    private sealed class FleetApiResponse<T>
    {
        public bool Success { get; init; }

        public T? Data { get; init; }
    }

    private sealed class FleetVehicle
    {
        public string VehicleNumber { get; init; } = string.Empty;

        public string Manufacturer { get; init; } = string.Empty;

        public string Model { get; init; } = string.Empty;

        public int Year { get; init; }

        public decimal FuelCapacity { get; init; }

        public string Status { get; init; } = string.Empty;
    }
}