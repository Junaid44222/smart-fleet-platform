using System.Security.Claims;

namespace AiService.API.Authorization;

public static class AiActionPermissions
{
    public const string ScheduleTrip = "scheduleTrip";
    public const string CreateMaintenance = "createMaintenance";

    public static IReadOnlyCollection<string> GetPermittedActions(ClaimsPrincipal user)
    {
        var actions = new List<string>();
        if (IsInAnyRole(user, "Admin", "SuperAdmin", "FleetManager", "Dispatcher"))
        {
            actions.Add(ScheduleTrip);
        }
        if (IsInAnyRole(user, "Admin", "SuperAdmin", "FleetManager", "MaintenanceTechnician"))
        {
            actions.Add(CreateMaintenance);
        }

        return actions;
    }

    private static bool IsInAnyRole(ClaimsPrincipal user, params string[] roles) =>
        roles.Any(user.IsInRole);
}
