import { apiClient } from './apiClient';
import type { ApiResponse, DashboardOverview, Driver, FuelRecord, MaintenanceRecord, Vehicle } from './types';

export const fetchDashboardStats = async () => {
  const response = await apiClient.get<ApiResponse<DashboardOverview>>('/fleet/Dashboard/stats');
  if (!response.data.data) {
    throw new Error(response.data.message || 'Dashboard data unavailable');
  }
  return response.data.data;
};

export const fetchVehicles = async () => {
  const response = await apiClient.get<ApiResponse<Vehicle[]>>('/fleet/vehicles');
  return response.data.data ?? [];
};

export const fetchVehicleById = async (id: string) => {
  const response = await apiClient.get<ApiResponse<Vehicle>>(`/fleet/vehicles/${id}`);
  return response.data.data;
};

export const createVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'status' | 'createdAt'>) => {
  const response = await apiClient.post<ApiResponse<Vehicle>>('/fleet/vehicles', vehicleData);
  return response.data.data;
};

export const fetchDrivers = async () => {
  const response = await apiClient.get<ApiResponse<Driver[]>>('/fleet/drivers');
  return response.data.data ?? [];
};

export const fetchDriverById = async (id: string) => {
  const response = await apiClient.get<ApiResponse<Driver>>(`/fleet/drivers/${id}`);
  return response.data.data;
};

export const createDriver = async (driverData: Omit<Driver, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'>) => {
  const response = await apiClient.post<ApiResponse<Driver>>('/fleet/drivers', driverData);
  return response.data.data;
};

export const updateDriver = async (
  id: string,
  driverData: Omit<Driver, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'>
) => {
  const response = await apiClient.put<ApiResponse<Driver>>(`/fleet/drivers/${id}`, driverData);
  return response.data.data;
};

export const fetchMaintenanceRecords = async () => {
  const response = await apiClient.get<ApiResponse<MaintenanceRecord[]>>('/fleet/MaintenanceRecords');
  return response.data.data ?? [];
};

export const fetchFuelRecords = async () => {
  const response = await apiClient.get<ApiResponse<FuelRecord[]>>('/fleet/FuelRecords');
  return response.data.data ?? [];
};
