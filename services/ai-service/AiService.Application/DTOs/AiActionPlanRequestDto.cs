using System.ComponentModel.DataAnnotations;

namespace AiService.Application.DTOs;

public sealed class AiActionPlanRequestDto
{
    [Required]
    [StringLength(2000, MinimumLength = 1)]
    public string Message { get; set; } = string.Empty;

    public string? Context { get; set; }
}
