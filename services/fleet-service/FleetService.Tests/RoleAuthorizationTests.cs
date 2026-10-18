using System.Reflection;
using System.Security.Claims;
using FleetService.API.Authorization;
using FleetService.API.Controllers;
using IdentityService.API.Authorization;
using IdentityService.API.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FleetService.Tests;

public class RoleAuthorizationTests
{
    [Fact]
    public void VehicleStatusChange_IsRestrictedToAdminOnly()
    {
        var authorization = GetMethodAuthorization<VehiclesController>("ChangeStatus");

        Assert.Equal(FleetRoles.Admin, authorization.Roles);
    }

    [Theory]
    [InlineData(typeof(VehiclesController), "Create", FleetRoles.FleetManagers)]
    [InlineData(typeof(VehiclesController), "SetAssignment", FleetRoles.VehicleAssigners)]
    [InlineData(typeof(TripsController), "Create", FleetRoles.TripManagers)]
    [InlineData(typeof(TripsController), "Start", FleetRoles.TripManagers)]
    [InlineData(typeof(TripsController), "Complete", FleetRoles.TripManagers)]
    [InlineData(typeof(TripsController), "Cancel", FleetRoles.TripManagers)]
    [InlineData(typeof(DriversController), "Create", FleetRoles.FleetManagers)]
    [InlineData(typeof(DriversController), "Update", FleetRoles.FleetManagers)]
    [InlineData(typeof(DriversController), "Delete", FleetRoles.Administrators)]
    [InlineData(typeof(MaintenanceRecordsController), "Create", FleetRoles.MaintenanceManagers)]
    [InlineData(typeof(MaintenanceRecordsController), "Update", FleetRoles.MaintenanceManagers)]
    [InlineData(typeof(MaintenanceRecordsController), "Delete", FleetRoles.Administrators)]
    [InlineData(typeof(FuelRecordsController), "Create", FleetRoles.FleetManagers)]
    [InlineData(typeof(FuelRecordsController), "Update", FleetRoles.FleetManagers)]
    [InlineData(typeof(FuelRecordsController), "Delete", FleetRoles.Administrators)]
    public void FleetWriteEndpoint_HasExpectedRolePolicy(Type controller, string action, string roles)
    {
        var authorization = controller.GetMethod(action)!.GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorization);
        Assert.Equal(roles, authorization.Roles);
    }

    [Fact]
    public void FleetControllers_RequireAuthenticationByDefault()
    {
        var controllers = new[]
        {
            typeof(VehiclesController),
            typeof(DriversController),
            typeof(MaintenanceRecordsController),
            typeof(FuelRecordsController)
        };

        Assert.All(controllers, controller =>
            Assert.NotNull(controller.GetCustomAttribute<AuthorizeAttribute>()));
    }

    [Fact]
    public void IdentityRoleManagement_IsAdministratorOnly_AndRegistrationRemainsPublic()
    {
        var expectedRoles = UserRoles.Administrators;
        Assert.Equal(expectedRoles, GetMethodAuthorization<AuthController>("GetUsers").Roles);
        Assert.Equal(expectedRoles, GetMethodAuthorization<AuthController>("UpdateUserRole").Roles);
        Assert.Null(typeof(AuthController).GetMethod("Register")!.GetCustomAttribute<AuthorizeAttribute>());
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("SuperAdmin", false)]
    [InlineData("FleetManager", false)]
    [InlineData("Dispatcher", false)]
    [InlineData("Viewer", false)]
    public async Task VehicleIncidentPolicy_AllowsOnlyAdmin(string role, bool expected)
    {
        var authorization = CreateAuthorizationService();
        var user = CreatePrincipal(role);

        var result = await authorization.AuthorizeAsync(
            user,
            resource: null,
            new RolesAuthorizationRequirement([FleetRoles.Admin]));

        Assert.Equal(expected, result.Succeeded);
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("SuperAdmin", true)]
    [InlineData("FleetManager", true)]
    [InlineData("MaintenanceTechnician", false)]
    [InlineData("Dispatcher", false)]
    [InlineData("Viewer", false)]
    [InlineData("Driver", false)]
    public async Task FleetManagerPolicy_UsesConfiguredRoleSet(string role, bool expected)
    {
        var authorization = CreateAuthorizationService();
        var user = CreatePrincipal(role);

        var result = await authorization.AuthorizeAsync(
            user,
            resource: null,
            new RolesAuthorizationRequirement(FleetRoles.FleetManagers.Split(',')));

        Assert.Equal(expected, result.Succeeded);
    }

    [Theory]
    [InlineData("Dispatcher", true)]
    [InlineData("FleetManager", true)]
    [InlineData("Viewer", false)]
    public async Task VehicleAssignmentPolicy_AllowsDispatchAndFleetManagementRoles(string role, bool expected)
    {
        var authorization = CreateAuthorizationService();
        var user = CreatePrincipal(role);

        var result = await authorization.AuthorizeAsync(
            user,
            resource: null,
            new RolesAuthorizationRequirement(FleetRoles.VehicleAssigners.Split(',')));

        Assert.Equal(expected, result.Succeeded);
    }

    private static AuthorizeAttribute GetMethodAuthorization<TController>(string action)
    {
        var method = typeof(TController).GetMethod(action, BindingFlags.Instance | BindingFlags.Public);
        Assert.NotNull(method);
        var authorization = method!.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorization);
        return authorization!;
    }

    private static IAuthorizationService CreateAuthorizationService()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization();
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static ClaimsPrincipal CreatePrincipal(string role) => new(
        new ClaimsIdentity([new Claim(ClaimTypes.Role, role)], authenticationType: "test"));
}
