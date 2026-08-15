import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AttachMoney, LocalGasStation, Speed } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import KPIWidget from '../../../components/KPIWidget';
import { fetchFuelRecords } from '../../../api/fleetApi';
import type { FuelRecord } from '../../../api/types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const FuelDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRecords = async () => {
      try {
        const data = await fetchFuelRecords();
        setRecords(data);
      } catch {
        setError('Unable to load fuel records at this time.');
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, []);

  const summary = useMemo(() => {
    const totalCost = records.reduce((sum, record) => sum + Number(record.cost || 0), 0);
    const totalQuantity = records.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
    const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    return {
      totalCost,
      totalQuantity,
      averageCost,
    };
  }, [records]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.fuelDate).getTime() - new Date(a.fuelDate).getTime()),
    [records],
  );

  const columns = [
    {
      id: 'fuelDate',
      label: 'Date',
      render: (row: FuelRecord) => <Typography variant="body2">{formatDate(row.fuelDate)}</Typography>,
    },
    {
      id: 'vehicleId',
      label: 'Vehicle',
      render: (row: FuelRecord) => (
        <Typography variant="body2">
          {row.vehicle?.vehicleNumber ?? row.vehicleId.slice(0, 8)}
        </Typography>
      ),
    },
    {
      id: 'quantity',
      label: 'Quantity',
      render: (row: FuelRecord) => <Typography variant="body2">{numberFormatter.format(Number(row.quantity || 0))} L</Typography>,
    },
    {
      id: 'cost',
      label: 'Cost',
      render: (row: FuelRecord) => <Typography variant="body2">{currencyFormatter.format(Number(row.cost || 0))}</Typography>,
    },
    {
      id: 'odometerReading',
      label: 'Odometer',
      render: (row: FuelRecord) => <Typography variant="body2">{numberFormatter.format(Number(row.odometerReading || 0))} km</Typography>,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Fuel Dashboard"
        subtitle="Monitor efficiency, highlight anomalies, and contain rising fuel costs."
        onBack={() => navigate(-1)}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <KPIWidget title="Fuel Spend" value={currencyFormatter.format(summary.totalCost)} subtitle="Across recorded refuels" icon={<AttachMoney />} />
        <KPIWidget title="Fuel Volume" value={numberFormatter.format(summary.totalQuantity)} unit="L" subtitle={`${records.length} fuel records`} icon={<LocalGasStation />} />
        <KPIWidget title="Avg Cost" value={currencyFormatter.format(summary.averageCost)} unit="/ L" subtitle="Based on current records" icon={<Speed />} />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <DataTable
        columns={columns}
        rows={sortedRecords}
        getRowId={(row) => row.id}
        loading={loading}
        emptyMessage="No fuel records are available yet."
      />
    </Box>
  );
};

export default FuelDashboardPage;
