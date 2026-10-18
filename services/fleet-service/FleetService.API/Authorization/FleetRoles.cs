namespace FleetService.API.Authorization;

public static class FleetRoles
{
    public const string Admin = "Admin";
    public const string Administrators = "Admin,SuperAdmin";
    public const string FleetManagers = "Admin,SuperAdmin,FleetManager";
    public const string VehicleAssigners = "Admin,SuperAdmin,FleetManager,Dispatcher";
    public const string TripManagers = "Admin,SuperAdmin,FleetManager,Dispatcher";
    public const string MaintenanceManagers = "Admin,SuperAdmin,FleetManager,MaintenanceTechnician";
}
