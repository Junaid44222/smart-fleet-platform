namespace IdentityService.API.Authorization;

public static class UserRoles
{
    public const string Admin = "Admin";
    public const string SuperAdmin = "SuperAdmin";
    public const string FleetManager = "FleetManager";
    public const string Dispatcher = "Dispatcher";
    public const string MaintenanceTechnician = "MaintenanceTechnician";
    public const string SafetyOfficer = "SafetyOfficer";
    public const string Viewer = "Viewer";
    public const string Driver = "Driver";

    public const string Administrators = Admin + "," + SuperAdmin;

    public static readonly string[] AssignableRoles =
    [
        Admin,
        FleetManager,
        Dispatcher,
        MaintenanceTechnician,
        SafetyOfficer,
        Viewer,
        Driver
    ];
}