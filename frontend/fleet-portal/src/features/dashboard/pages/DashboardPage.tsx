import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
} from '@mui/material';
import {
  DirectionsCar as VehicleIcon,
  People as DriverIcon,
  Route as TripIcon,
  Build as MaintenanceIcon,
  LocalGasStation as FuelIcon,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../../../components/PageHeader';
import KPIWidget from '../../../components/KPIWidget';
import SkeletonLoader from '../../../components/SkeletonLoader';
import EmptyState from '../../../components/EmptyState';
import { fetchDashboardStats } from '../../../api/fleetApi';
import type { DashboardOverview } from '../../../api/types';

const chartColors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#64748b'];

const kpiGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    lg: 'repeat(5, 1fr)',
  },
  gap: 2,
};

const chartGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    md: 'repeat(3, 1fr)',
  },
  gap: 2,
};

const DashboardPage: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await fetchDashboardStats();
        setOverview(data);
      } catch {
        setError('Unable to load dashboard data. Ensure the API gateway and fleet service are running.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <PageHeader title="Fleet Overview" subtitle="Operational summary across vehicles, drivers, and maintenance." />
        <SkeletonLoader rows={6} />
      </Box>
    );
  }

  if (error || !overview) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <PageHeader title="Fleet Overview" subtitle="Operational summary across vehicles, drivers, and maintenance." />
        {error && <Alert severity="error">{error}</Alert>}
        <EmptyState
          title="Dashboard unavailable"
          description="Start the backend services using run-all.ps1, then refresh this page."
        />
      </Box>
    );
  }

  const { stats, vehicleStatusBreakdown, monthlyFuelCosts, recentActivities } = overview;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Fleet Overview"
        subtitle={`${stats.totalVehicles} vehicles tracked • ${stats.availableDrivers} active drivers • Safety score ${stats.safetyScore}`}
      />

      <Box sx={kpiGridSx}>
        <KPIWidget title="Total Vehicles" value={stats.totalVehicles} icon={<VehicleIcon />} />
        <KPIWidget
          title="Active Vehicles"
          value={vehicleStatusBreakdown.find((item) => item.status.toLowerCase() === 'active')?.count ?? 0}
          icon={<VehicleIcon />}
        />
        <KPIWidget title="Active Trips" value={stats.activeTrips} icon={<TripIcon />} subtitle="Currently in progress" />
        <KPIWidget title="Drivers Available" value={stats.availableDrivers} icon={<DriverIcon />} />
        <KPIWidget
          title="Maintenance Due"
          value={stats.maintenanceDueCount}
          icon={<MaintenanceIcon />}
          subtitle="within 30 days"
        />
      </Box>

      <Box sx={chartGridSx}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h3" sx={{ mb: 2 }}>
              Vehicle Status
            </Typography>
            {vehicleStatusBreakdown.length === 0 ? (
              <EmptyState title="No vehicle data" description="Add vehicles to see status distribution." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={vehicleStatusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {vehicleStatusBreakdown.map((entry, index) => (
                      <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h3" sx={{ mb: 2 }}>
              Monthly Fuel Cost
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyFuelCosts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => {
                    const amount = typeof value === 'number' ? value : Number(value ?? 0);
                    return [`$${amount.toFixed(2)}`, 'Cost'];
                  }}
                />
                <Bar dataKey="cost" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Monthly Spend Snapshot
            </Typography>
            <KPIWidget
              title="Fuel Cost (MTD)"
              value={`$${stats.monthlyFuelCost.toFixed(2)}`}
              icon={<FuelIcon />}
              subtitle="Current month total"
            />
            <Box sx={{ mt: 2 }}>
              <KPIWidget
                title="Fleet Safety Score"
                value={stats.safetyScore}
                unit="/100"
                subtitle="Derived from maintenance and vehicle status"
              />
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Recent Activity
          </Typography>
          {recentActivities.length === 0 ? (
            <EmptyState title="No recent activity" description="Fleet events will appear here as data is created." />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {recentActivities.map((activity) => (
                <Box
                  key={`${activity.type}-${activity.id}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 2,
                    p: 1.5,
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{activity.title}</Typography>
                    <Typography variant="body2" sx={{ color: '#434655' }}>
                      {activity.description}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(activity.occurredAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardPage;
