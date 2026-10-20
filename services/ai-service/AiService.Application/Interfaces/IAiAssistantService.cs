using AiService.Application.DTOs;

namespace AiService.Application.Interfaces;

public interface IAiAssistantService
{
    Task<AiResponseDto> AskAsync(
        AiChatRequestDto request,
        CancellationToken cancellationToken);

    Task<AiResponseDto> AnalyzeFleetHealthAsync(
        FleetHealthAnalysisRequestDto request,
        CancellationToken cancellationToken);

    Task<AiActionPlanDto> PlanActionAsync(
        AiActionPlanRequestDto request,
        IReadOnlyCollection<string> permittedActions,
        CancellationToken cancellationToken);
}
