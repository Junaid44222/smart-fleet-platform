using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using AiService.Application.DTOs;
using AiService.Application.Interfaces;
using AiService.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace AiService.Infrastructure.Services;

public class AzureOpenAiAssistantService : IAiAssistantService
{
    private const string SystemPrompt =
        "You are Smart Fleet AI Assistant. Provide concise, operationally useful logistics and fleet-management insights. Use verified FleetService context when supplied, answer specific vehicle questions directly from that data, and never claim you lack access when context is present. If context says a vehicle was not found, say so; do not invent specifications.";

    private const string AgentSystemPrompt = """
        You are Smart Fleet's action planner. Return exactly one JSON object matching this schema:
        {"action":"none|scheduleTrip|createMaintenance","assistantMessage":"string","trip":null|{"vehicleNumber":null,"driverEmail":null,"source":null,"destination":null,"startDate":null,"endDate":null},"maintenance":null|{"vehicleNumber":null,"serviceType":null,"description":null,"scheduledDate":null,"cost":null,"vendor":null}}
        The application has already selected the action and checked this user's role. Copy that action value exactly. For action=none, answer the user normally in assistantMessage. Extract only values the user supplied or that are present in verified context. Never invent identifiers, dates, vendor, or cost; leave unknown fields null. Dates must be ISO 8601 when the user supplied enough information to determine them. Do not claim that any action has been executed: the user must review and confirm the draft.
        """;

    private static readonly JsonSerializerOptions PlanJsonOptions =
        new(JsonSerializerDefaults.Web);

    private static readonly Regex TripActionRequest = new(
        @"\b(schedule|book|arrange|create|add)\w*\b.{0,80}\b(trips?|journeys?|routes?)\b|\b(trips?|journeys?|routes?)\b.{0,80}\b(schedule|book|arrange|create|add)\w*\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex MaintenanceActionRequest = new(
        @"\b(schedule|book|arrange|create|add)\w*\b.{0,80}\b(maintenance|service|repair|inspection)\b|\b(maintenance|service|repair|inspection)\b.{0,80}\b(schedule|book|arrange|create|add)\w*\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private readonly HttpClient _httpClient;

    private readonly AzureOpenAiOptions _options;

    private readonly AiProviderOptions _providerOptions;

    public AzureOpenAiAssistantService(
        HttpClient httpClient,
        IOptions<AzureOpenAiOptions> options,
        IOptions<AiProviderOptions> providerOptions)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _providerOptions = providerOptions.Value;
    }

    public async Task<AiResponseDto> AskAsync(
        AiChatRequestDto request,
        CancellationToken cancellationToken)
    {
        var prompt = string.IsNullOrWhiteSpace(request.Context)
            ? request.Message
            : $"Context:\n{request.Context}\n\nQuestion:\n{request.Message}";

        try
        {
            var answer = await SendChatAsync(prompt, cancellationToken);

            return new AiResponseDto
            {
                Success = true,
                Message = "AI assistant response generated successfully",
                Data = answer
            };
        }
        catch (InvalidOperationException ex)
        {
            return new AiResponseDto
            {
                Success = false,
                Message = ex.Message,
                Data = null
            };
        }
        catch (Exception ex)
        {
            return new AiResponseDto
            {
                Success = false,
                Message = $"AI assistant request failed: {ex.Message}",
                Data = null
            };
        }
    }

    public async Task<AiResponseDto> AnalyzeFleetHealthAsync(
        FleetHealthAnalysisRequestDto request,
        CancellationToken cancellationToken)
    {
        var prompt =
            "Analyze fleet health and return prioritized recommendations.\n\n" +
            $"Vehicle Summary:\n{request.VehicleSummary}\n\n" +
            $"Maintenance Summary:\n{request.MaintenanceSummary}\n\n" +
            $"Fuel Summary:\n{request.FuelSummary ?? "Not provided"}";

        try
        {
            var answer = await SendChatAsync(prompt, cancellationToken);

            return new AiResponseDto
            {
                Success = true,
                Message = "Fleet health analysis generated successfully",
                Data = answer
            };
        }
        catch (InvalidOperationException ex)
        {
            return new AiResponseDto
            {
                Success = false,
                Message = ex.Message,
                Data = null
            };
        }
        catch (Exception ex)
        {
            return new AiResponseDto
            {
                Success = false,
                Message = $"Fleet health request failed: {ex.Message}",
                Data = null
            };
        }
    }

    public async Task<AiActionPlanDto> PlanActionAsync(
        AiActionPlanRequestDto request,
        IReadOnlyCollection<string> permittedActions,
        CancellationToken cancellationToken)
    {
        var allowedActions = permittedActions
            .Where(action => action is "scheduleTrip" or "createMaintenance")
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var requestedAction = DetectRequestedAction(request.Message);
        if (requestedAction is not null && !allowedActions.Contains(requestedAction, StringComparer.Ordinal))
        {
            return new AiActionPlanDto
            {
                AssistantMessage = "Your role isn't allowed to prepare that action. You can still ask me for fleet information or recommendations."
            };
        }

        var prompt = $"Action selected by the application: {requestedAction ?? "none"}. Return that action exactly; do not select a different action.\n" +
                     $"Permitted actions for this signed-in user's role: {JsonSerializer.Serialize(allowedActions)}.\n" +
                     $"Verified FleetService context (if any): {request.Context ?? "none"}\n" +
                     $"User request: {request.Message}";

        try
        {
            var content = await SendChatAsync(prompt, cancellationToken, AgentSystemPrompt);
            return ParseActionPlan(content, requestedAction);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested &&
            (ex is InvalidOperationException or HttpRequestException or TaskCanceledException or JsonException))
        {
            return CreateFallbackPlan(requestedAction);
        }
    }

    private static string? DetectRequestedAction(string message)
    {
        if (TripActionRequest.IsMatch(message)) return "scheduleTrip";
        if (MaintenanceActionRequest.IsMatch(message)) return "createMaintenance";
        return null;
    }

    private static AiActionPlanDto ParseActionPlan(
        string content,
        string? requestedAction)
    {
        var jsonStart = content.IndexOf('{');
        var jsonEnd = content.LastIndexOf('}');
        if (jsonStart < 0 || jsonEnd <= jsonStart)
        {
            return CreateFallbackPlan(requestedAction);
        }

        AiActionPlanDto? plan;
        try
        {
            plan = JsonSerializer.Deserialize<AiActionPlanDto>(
                content[jsonStart..(jsonEnd + 1)],
                PlanJsonOptions);
        }
        catch (JsonException)
        {
            plan = null;
        }

        if (plan is null || plan.Action is not ("none" or "scheduleTrip" or "createMaintenance"))
        {
            return CreateFallbackPlan(requestedAction);
        }

        plan.Action = requestedAction ?? "none";
        if (plan.Action == "scheduleTrip")
        {
            plan.Trip ??= new TripActionDraftDto();
            plan.Maintenance = null;
        }
        else if (plan.Action == "createMaintenance")
        {
            plan.Maintenance ??= new MaintenanceActionDraftDto();
            plan.Trip = null;
        }
        else
        {
            plan.Trip = null;
            plan.Maintenance = null;
        }
        if (string.IsNullOrWhiteSpace(plan.AssistantMessage))
        {
            plan.AssistantMessage = plan.Action == "none"
                ? "How can I help with fleet operations?"
                : "Review the draft below and confirm it to send it to Fleet Management.";
        }

        return plan;
    }

    private static AiActionPlanDto CreateFallbackPlan(string? requestedAction) => new()
    {
        Action = requestedAction ?? "none",
        AssistantMessage = requestedAction is null
            ? "I couldn't prepare a response right now. Please try again."
            : "I've opened a draft for your request. Complete any missing fields, review it, and confirm when it is correct.",
        Trip = requestedAction == "scheduleTrip" ? new TripActionDraftDto() : null,
        Maintenance = requestedAction == "createMaintenance" ? new MaintenanceActionDraftDto() : null
    };

    private async Task<string> SendChatAsync(
        string userPrompt,
        CancellationToken cancellationToken,
        string? systemPrompt = null)
    {
        var useOllama = _providerOptions.Provider.Equals(
            "Ollama",
            StringComparison.OrdinalIgnoreCase);
        var requestUri = useOllama
            ? GetOllamaRequestUri()
            : GetAzureOpenAiRequestUri();

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);

        if (useOllama)
        {
            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "ollama");
        }
        else
        {
            request.Headers.Add("api-key", _options.ApiKey);
        }

        request.Content = JsonContent.Create(new AzureOpenAiChatRequest
        {
            Model = useOllama ? _providerOptions.Model : null,
            Messages =
            [
                new AzureOpenAiMessage("system", systemPrompt ?? SystemPrompt),
                new AzureOpenAiMessage("user", userPrompt)
            ],
            Temperature = 0.2m,
            MaxTokens = 800
        });

        using var response =
            await _httpClient.SendAsync(request, cancellationToken);

        response.EnsureSuccessStatusCode();

        var chatResponse =
            await response.Content.ReadFromJsonAsync<AzureOpenAiChatResponse>(
                cancellationToken);

        return chatResponse?.Choices.FirstOrDefault()?.Message.Content
            ?? string.Empty;
    }

    private string GetOllamaRequestUri()
    {
        if (string.IsNullOrWhiteSpace(_providerOptions.Endpoint) ||
            string.IsNullOrWhiteSpace(_providerOptions.Model))
        {
            throw new InvalidOperationException(
                "Ollama configuration is missing. Configure AI:Endpoint and AI:Model.");
        }

        return $"{_providerOptions.Endpoint.TrimEnd('/')}/chat/completions";
    }

    private string GetAzureOpenAiRequestUri()
    {
        if (!_providerOptions.Provider.Equals(
                "AzureOpenAI",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Unsupported AI provider '{_providerOptions.Provider}'. Supported providers are Ollama and AzureOpenAI.");
        }

        if (string.IsNullOrWhiteSpace(_options.Endpoint) ||
            string.IsNullOrWhiteSpace(_options.ApiKey) ||
            string.IsNullOrWhiteSpace(_options.DeploymentName))
        {
            throw new InvalidOperationException(
                "Azure OpenAI configuration is missing. Configure AzureOpenAI:Endpoint, AzureOpenAI:ApiKey, and AzureOpenAI:DeploymentName.");
        }

        return $"{_options.Endpoint.TrimEnd('/')}/openai/deployments/{_options.DeploymentName}/chat/completions?api-version={_options.ApiVersion}";
    }

    private sealed class AzureOpenAiChatRequest
    {
        [JsonPropertyName("model")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Model { get; init; }

        [JsonPropertyName("messages")]
        public IReadOnlyCollection<AzureOpenAiMessage> Messages { get; init; } =
            Array.Empty<AzureOpenAiMessage>();

        [JsonPropertyName("temperature")]
        public decimal Temperature { get; init; }

        [JsonPropertyName("max_tokens")]
        public int MaxTokens { get; init; }
    }

    private sealed record AzureOpenAiMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private sealed class AzureOpenAiChatResponse
    {
        [JsonPropertyName("choices")]
        public IReadOnlyCollection<AzureOpenAiChoice> Choices { get; init; } =
            Array.Empty<AzureOpenAiChoice>();
    }

    private sealed class AzureOpenAiChoice
    {
        [JsonPropertyName("message")]
        public AzureOpenAiMessageResponse Message { get; init; } = new();
    }

    private sealed class AzureOpenAiMessageResponse
    {
        [JsonPropertyName("content")]
        public string Content { get; init; } = string.Empty;
    }
}
