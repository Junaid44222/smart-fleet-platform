using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AiService.Application.DTOs;
using AiService.Application.Interfaces;
using AiService.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace AiService.Infrastructure.Services;

public class AzureOpenAiAssistantService : IAiAssistantService
{
    private const string SystemPrompt =
        "You are Smart Fleet AI Assistant. Provide concise, operationally useful logistics and fleet-management insights. Use verified FleetService context when supplied, answer specific vehicle questions directly from that data, and never claim you lack access when context is present. If context says a vehicle was not found, say so; do not invent specifications.";

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

    private async Task<string> SendChatAsync(
        string userPrompt,
        CancellationToken cancellationToken)
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
                new AzureOpenAiMessage("system", SystemPrompt),
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
