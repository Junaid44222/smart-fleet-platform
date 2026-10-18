import { apiClient } from './apiClient';
import type { ApiResponse } from './types';

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export const assignableRoles = [
  'Admin',
  'FleetManager',
  'Dispatcher',
  'MaintenanceTechnician',
  'SafetyOfficer',
  'Viewer',
  'Driver',
] as const;

export const fetchManagedUsers = async () => {
  const response = await apiClient.get<ApiResponse<ManagedUser[]>>('/identity/Auth/users');
  return response.data.data ?? [];
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await apiClient.put<ApiResponse<null>>(`/identity/Auth/users/${userId}/role`, { role });
  return response.data;
};