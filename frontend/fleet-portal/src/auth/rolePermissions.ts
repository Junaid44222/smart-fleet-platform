const administratorRoles = ['Admin', 'SuperAdmin'] as const;
const fleetManagerRoles = ['Admin', 'SuperAdmin', 'FleetManager'] as const;
const vehicleAssignerRoles = ['Admin', 'SuperAdmin', 'FleetManager', 'Dispatcher'] as const;
const maintenanceManagerRoles = ['Admin', 'SuperAdmin', 'FleetManager', 'MaintenanceTechnician'] as const;

const hasRole = (role: string, allowedRoles: readonly string[]) => allowedRoles.includes(role);

export const canManageUsers = (role: string) => hasRole(role, administratorRoles);
export const canCreateVehicle = (role: string) => hasRole(role, fleetManagerRoles);
export const canUpdateVehicle = (role: string) => hasRole(role, fleetManagerRoles);
export const canDeleteVehicle = (role: string) => hasRole(role, administratorRoles);
export const canCreateDriver = (role: string) => hasRole(role, fleetManagerRoles);
export const canUpdateDriver = (role: string) => hasRole(role, fleetManagerRoles);
export const canDeleteDriver = (role: string) => hasRole(role, administratorRoles);
export const canAssignVehicleDriver = (role: string) => hasRole(role, vehicleAssignerRoles);
export const canCreateMaintenance = (role: string) => hasRole(role, maintenanceManagerRoles);
export const canUpdateMaintenance = (role: string) => hasRole(role, maintenanceManagerRoles);
export const canDeleteMaintenance = (role: string) => hasRole(role, administratorRoles);
export const canManageMaintenance = (role: string) => hasRole(role, maintenanceManagerRoles);
export const canCreateFuel = (role: string) => hasRole(role, fleetManagerRoles);
export const canUpdateFuel = (role: string) => hasRole(role, fleetManagerRoles);
export const canDeleteFuel = (role: string) => hasRole(role, administratorRoles);
export const canManageFuel = (role: string) => hasRole(role, fleetManagerRoles);
export const canChangeVehicleStatus = (role: string) => role === 'Admin';
