namespace SmartFleet.Common.Diagnostics;

public sealed class CorrelationIdOptions
{
    public string HeaderName { get; set; } = "X-Correlation-ID";

    public int MaxLength { get; set; } = 128;
}
