import { apiClient } from './apiClient';
import type { ApiResponse, DashboardOverview, Driver, FuelRecord, MaintenanceRecord, Vehicle, VehicleAssignment, VehicleStatusChangeResult } from './types';

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

export const fetchVehicleAssignment = async (vehicleId: string) => {
  const response = await apiClient.get<ApiResponse<VehicleAssignment | null>>(
    `/fleet/vehicles/${vehicleId}/assignment`,
  );
  return response.data.data ?? null;
};

export const setVehicleAssignment = async (vehicleId: string, driverId: string | null) => {
  const response = await apiClient.put<ApiResponse<VehicleAssignment | null>>(
    `/fleet/vehicles/${vehicleId}/assignment`,
    { driverId },
  );
  return response.data.data ?? null;
};

export const createVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'status' | 'createdAt'>) => {
  const response = await apiClient.post<ApiResponse<Vehicle>>('/fleet/vehicles', vehicleData);
  return response.data.data;
};

export const updateVehicle = async (id: string, vehicleData: Omit<Vehicle, 'id' | 'status' | 'createdAt'>) => {
  const response = await apiClient.put<ApiResponse<Vehicle>>(`/fleet/vehicles/${id}`, vehicleData);
  return response.data.data;
};

export const deleteVehicle = async (id: string) => {
  await apiClient.delete<ApiResponse<null>>(`/fleet/vehicles/${id}`);
};

export const changeVehicleStatus = async (
  vehicleId: string,
  status: string,
  reason: string,
) => {
  const response = await apiClient.put<ApiResponse<VehicleStatusChangeResult>>(
    `/fleet/Vehicles/${vehicleId}/status`,
    { status, reason },
  );
  if (!response.data.data) {
    throw new Error(response.data.message || 'Vehicle status update failed.');
  }
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

export const deleteDriver = async (id: string) => {
  await apiClient.delete<ApiResponse<null>>(`/fleet/drivers/${id}`);
};

export const fetchMaintenanceRecords = async () => {
  const response = await apiClient.get<ApiResponse<MaintenanceRecord[]>>('/fleet/MaintenanceRecords');
  return response.data.data ?? [];
};

export type MaintenanceRecordInput = Pick<MaintenanceRecord,
  'vehicleId' | 'serviceType' | 'description' | 'scheduledDate' | 'cost' | 'vendor' | 'status'> & {
    completedDate?: string | null;
  };

export const createMaintenanceRecord = async (record: Omit<MaintenanceRecordInput, 'completedDate'>) => {
  const response = await apiClient.post<ApiResponse<MaintenanceRecord>>('/fleet/MaintenanceRecords', record);
  return response.data.data;
};

export const updateMaintenanceRecord = async (id: string, record: MaintenanceRecordInput) => {
  const response = await apiClient.put<ApiResponse<MaintenanceRecord>>(`/fleet/MaintenanceRecords/${id}`, record);
  return response.data.data;
};

export const deleteMaintenanceRecord = async (id: string) => {
  await apiClient.delete<ApiResponse<null>>(`/fleet/MaintenanceRecords/${id}`);
};

export const fetchFuelRecords = async () => {
  const response = await apiClient.get<ApiResponse<FuelRecord[]>>('/fleet/FuelRecords');
  return response.data.data ?? [];
};

export type FuelRecordInput = Pick<FuelRecord,
  'vehicleId' | 'fuelDate' | 'quantity' | 'cost' | 'odometerReading'>;

export const createFuelRecord = async (record: FuelRecordInput) => {
  const response = await apiClient.post<ApiResponse<FuelRecord>>('/fleet/FuelRecords', record);
  return response.data.data;
};

export const updateFuelRecord = async (id: string, record: FuelRecordInput) => {
  const response = await apiClient.put<ApiResponse<FuelRecord>>(`/fleet/FuelRecords/${id}`, record);
  return response.data.data;
};

export const deleteFuelRecord = async (id: string) => {
  await apiClient.delete<ApiResponse<null>>(`/fleet/FuelRecords/${id}`);
};
