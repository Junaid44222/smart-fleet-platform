import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Build, CalendarToday, WarningAmber } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import KPIWidget from '../../../components/KPIWidget';
import { fetchMaintenanceRecords } from '../../../api/fleetApi';
import type { MaintenanceRecord } from '../../../api/types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const isOpenMaintenance = (record: MaintenanceRecord) =>
  !record.completedDate && record.status.toLowerCase() !== 'completed';

const MaintenanceDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRecords = async () => {
      try {
        const data = await fetchMaintenanceRecords();
        setRecords(data);
      } catch {
        setError('Unable to load maintenance records at this time.');
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, []);

  const summary = useMemo(() => {
    const now = new Date();
    const openRecords = records.filter(isOpenMaintenance);
    const overdueRecords = openRecords.filter((record) => new Date(record.scheduledDate) < now);
    const scheduledRecords = openRecords.filter((record) => new Date(record.scheduledDate) >= now);
    const totalCost = records.reduce((sum, record) => sum + Number(record.cost || 0), 0);

    return {
      openCount: openRecords.length,
      overdueCount: overdueRecords.length,
      scheduledCount: scheduledRecords.length,
      totalCost,
    };
  }, [records]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
    [records],
  );

  const columns = [
    {
      id: 'serviceType',
      label: 'Service',
      render: (row: MaintenanceRecord) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.serviceType}</Typography>
          <Typography variant="caption" color="text.secondary">{row.description || 'No description'}</Typography>
        </Box>
      ),
    },
    {
      id: 'scheduledDate',
      label: 'Scheduled',
      render: (row: MaintenanceRecord) => <Typography variant="body2">{formatDate(row.scheduledDate)}</Typography>,
    },
    {
      id: 'vendor',
      label: 'Vendor',
      render: (row: MaintenanceRecord) => <Typography variant="body2">{row.vendor || 'Unassigned'}</Typography>,
    },
    {
      id: 'cost',
      label: 'Cost',
      render: (row: MaintenanceRecord) => <Typography variant="body2">{currencyFormatter.format(Number(row.cost || 0))}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      render: (row: MaintenanceRecord) => (
        <Chip
          label={row.status}
          color={row.status.toLowerCase() === 'completed' ? 'success' : 'warning'}
          size="small"
        />
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Maintenance Dashboard"
        subtitle="Coordinate service readiness and avoid disruptions across the fleet."
        onBack={() => navigate(-1)}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <KPIWidget title="Open Work Orders" value={summary.openCount} subtitle="Active maintenance records" icon={<Build />} />
        <KPIWidget title="Scheduled Ahead" value={summary.scheduledCount} subtitle="Upcoming service windows" icon={<CalendarToday />} />
        <KPIWidget title="Maintenance Spend" value={currencyFormatter.format(summary.totalCost)} subtitle={`${summary.overdueCount} overdue`} icon={<WarningAmber />} />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <DataTable
        columns={columns}
        rows={sortedRecords}
        getRowId={(row) => row.id}
        loading={loading}
        emptyMessage="No maintenance records are available yet."
      />
    </Box>
  );
};

export default MaintenanceDashboardPage;
