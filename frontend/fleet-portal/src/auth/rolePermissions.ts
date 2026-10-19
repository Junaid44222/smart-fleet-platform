const administratorRoles = ['Admin', 'SuperAdmin'] as const;
const fleetManagerRoles = ['Admin', 'SuperAdmin', 'FleetManager'] as const;
const vehicleAssignerRoles = ['Admin', 'SuperAdmin', 'FleetManager', 'Dispatcher'] as const;
const maintenanceManagerRoles = ['Admin', 'SuperAdmin', 'FleetManager', 'MaintenanceTechnician'] as const;

const hasRole = (role: string, allowedRoles: readonly string[]) => allowedRoles.includes(role);

export const canManageUsers = (role: string) => hasRole(role, administratorRoles);
export const canCreateVehicle = (role: string) => hasRole(role, fleetManagerRoles);
export const canCreateDriver = (role: string) => hasRole(role, fleetManagerRoles);
export const canAssignVehicleDriver = (role: string) => hasRole(role, vehicleAssignerRoles);
export const canManageMaintenance = (role: string) => hasRole(role, maintenanceManagerRoles);
export const canManageFuel = (role: string) => hasRole(role, fleetManagerRoles);
export const canChangeVehicleStatus = (role: string) => role === 'Admin';
