export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  token?: string;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  manufacturer: string;
  model: string;
  year: number;
  fuelCapacity: number;
  status: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  joiningDate: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  updatedBy?: string;
  isDeleted: boolean;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  serviceType: string;
  description: string;
  scheduledDate: string;
  completedDate?: string | null;
  cost: number;
  vendor: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  isDeleted: boolean;
  vehicle?: Vehicle | null;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  fuelDate: string;
  quantity: number;
  cost: number;
  odometerReading: number;
  createdAt: string;
  updatedAt?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  isDeleted: boolean;
  vehicle?: Vehicle | null;
}

export interface DashboardStats {
  totalVehicles: number;
  activeTrips: number;
  availableDrivers: number;
  maintenanceDueCount: number;
  monthlyFuelCost: number;
  safetyScore: number;
}

export interface VehicleStatusCount {
  status: string;
  count: number;
}

export interface MonthlyCost {
  month: string;
  cost: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
}

export interface DashboardOverview {
  stats: DashboardStats;
  vehicleStatusBreakdown: VehicleStatusCount[];
  monthlyFuelCosts: MonthlyCost[];
  recentActivities: RecentActivity[];
}
