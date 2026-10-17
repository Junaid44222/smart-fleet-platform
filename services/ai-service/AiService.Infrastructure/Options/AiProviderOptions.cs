namespace AiService.Infrastructure.Options;

public class AiProviderOptions
{
    public const string SectionName = "AI";

    public string Provider { get; set; } = "AzureOpenAI";

    public string Endpoint { get; set; } = "http://localhost:11434/v1";

    public string Model { get; set; } = "qwen3:0.6b";
}