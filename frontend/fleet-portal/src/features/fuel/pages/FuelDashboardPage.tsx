import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Snackbar, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Add, AttachMoney, DeleteOutlined, Edit, LocalGasStation, Speed } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import KPIWidget from '../../../components/KPIWidget';
import { createFuelRecord, deleteFuelRecord, fetchFuelRecords, fetchTrips, fetchVehicles, updateFuelRecord } from '../../../api/fleetApi';
import type { DriverTrip, FuelRecord, Vehicle } from '../../../api/types';
import { canCreateFuel, canDeleteFuel, canUpdateFuel } from '../../../auth/rolePermissions';

type FuelForm = { vehicleId: string; fuelDate: string; quantity: string; cost: string; odometerReading: string };
const newFuelForm = (vehicleId = ''): FuelForm => ({ vehicleId, fuelDate: new Date().toISOString().slice(0, 10), quantity: '', cost: '', odometerReading: '' });
type ApiError = { response?: { data?: { message?: string } } };

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
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);
  const userCanCreate = canCreateFuel(userRole);
  const userCanUpdate = canUpdateFuel(userRole);
  const userCanDelete = canDeleteFuel(userRole);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [completedTrips, setCompletedTrips] = useState<DriverTrip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tripsError, setTripsError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<FuelRecord | null>(null);
  const [form, setForm] = useState<FuelForm>(newFuelForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

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

    const loadTripUsage = async () => {
      try {
        const trips = await fetchTrips();
        setCompletedTrips(trips.filter((trip) => trip.status.toLowerCase() === 'completed' && Number(trip.fuelConsumed || 0) > 0));
      } catch {
        setTripsError('Unable to load completed trip fuel usage at this time.');
      } finally {
        setTripsLoading(false);
      }
    };

    loadRecords();
    loadTripUsage();
    void fetchVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  const openCreateForm = () => {
    if (!userCanCreate) return;
    setEditingRecord(null);
    setForm(newFuelForm(vehicles[0]?.id ?? ''));
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (record: FuelRecord) => {
    if (!userCanUpdate) return;
    setEditingRecord(record);
    setForm({ vehicleId: record.vehicleId, fuelDate: record.fuelDate.slice(0, 10), quantity: String(record.quantity), cost: String(record.cost), odometerReading: String(record.odometerReading) });
    setFormError('');
    setFormOpen(true);
  };

  const saveRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(editingRecord ? userCanUpdate : userCanCreate)) return;
    const quantity = Number(form.quantity);
    const cost = Number(form.cost);
    const odometerReading = Number(form.odometerReading);
    if (!form.vehicleId || quantity <= 0 || cost < 0 || odometerReading < 0) {
      setFormError('Select a vehicle and enter valid quantity, cost, and odometer values.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = { vehicleId: form.vehicleId, fuelDate: new Date(form.fuelDate).toISOString(), quantity, cost, odometerReading };
      if (editingRecord) {
        await updateFuelRecord(editingRecord.id, payload);
        setToast('Fuel record updated.');
      } else {
        await createFuelRecord(payload);
        setToast('Fuel record added.');
      }
      setFormOpen(false);
      setEditingRecord(null);
      setRecords(await fetchFuelRecords());
    } catch (saveError) {
      setFormError((saveError as ApiError).response?.data?.message || 'Unable to save the fuel record.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingRecord || !userCanDelete) return;
    setSaving(true);
    try {
      await deleteFuelRecord(deletingRecord.id);
      setDeletingRecord(null);
      setToast('Fuel record deleted.');
      setRecords(await fetchFuelRecords());
    } catch (deleteError) {
      setError((deleteError as ApiError).response?.data?.message || 'Unable to delete the fuel record.');
    } finally {
      setSaving(false);
    }
  };

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

  const tripUsageSummary = useMemo(() => ({
    fuelConsumed: completedTrips.reduce((sum, trip) => sum + Number(trip.fuelConsumed || 0), 0),
    distance: completedTrips.reduce((sum, trip) => sum + Number(trip.distance || 0), 0),
  }), [completedTrips]);

  const tripColumns = [
    {
      id: 'actualEndDate',
      label: 'Completed',
      searchValue: (row: DriverTrip) => `${row.actualEndDate ?? row.endDate} ${formatDate(row.actualEndDate ?? row.endDate)}`,
      sortValue: (row: DriverTrip) => new Date(row.actualEndDate ?? row.endDate),
      render: (row: DriverTrip) => <Typography variant="body2">{formatDate(row.actualEndDate ?? row.endDate)}</Typography>,
    },
    {
      id: 'tripNumber',
      label: 'Trip',
      searchValue: (row: DriverTrip) => row.tripNumber,
      sortValue: (row: DriverTrip) => row.tripNumber,
      render: (row: DriverTrip) => <Typography variant="body2">{row.tripNumber}</Typography>,
    },
    {
      id: 'vehicleId',
      label: 'Vehicle',
      searchValue: (row: DriverTrip) => row.vehicle?.vehicleNumber ?? row.vehicleId,
      sortValue: (row: DriverTrip) => row.vehicle?.vehicleNumber ?? row.vehicleId,
      render: (row: DriverTrip) => <Typography variant="body2">{row.vehicle?.vehicleNumber ?? row.vehicleId.slice(0, 8)}</Typography>,
    },
    {
      id: 'distance',
      label: 'Distance',
      searchValue: (row: DriverTrip) => `${row.distance ?? 0} km`,
      sortValue: (row: DriverTrip) => Number(row.distance || 0),
      render: (row: DriverTrip) => <Typography variant="body2">{numberFormatter.format(Number(row.distance || 0))} km</Typography>,
    },
    {
      id: 'fuelConsumed',
      label: 'Fuel consumed',
      searchValue: (row: DriverTrip) => `${row.fuelConsumed ?? 0} L`,
      sortValue: (row: DriverTrip) => Number(row.fuelConsumed || 0),
      render: (row: DriverTrip) => <Typography variant="body2">{numberFormatter.format(Number(row.fuelConsumed || 0))} L</Typography>,
    },
  ];

  const columns = [
    {
      id: 'fuelDate',
      label: 'Date',
      searchValue: (row: FuelRecord) => `${row.fuelDate} ${formatDate(row.fuelDate)}`,
      sortValue: (row: FuelRecord) => new Date(row.fuelDate),
      render: (row: FuelRecord) => <Typography variant="body2">{formatDate(row.fuelDate)}</Typography>,
    },
    {
      id: 'vehicleId',
      label: 'Vehicle',
      searchValue: (row: FuelRecord) => row.vehicle?.vehicleNumber ?? row.vehicleId,
      sortValue: (row: FuelRecord) => row.vehicle?.vehicleNumber ?? row.vehicleId,
      render: (row: FuelRecord) => (
        <Typography variant="body2">
          {row.vehicle?.vehicleNumber ?? row.vehicleId.slice(0, 8)}
        </Typography>
      ),
    },
    {
      id: 'quantity',
      label: 'Quantity',
      searchValue: (row: FuelRecord) => `${row.quantity} L`,
      sortValue: (row: FuelRecord) => Number(row.quantity || 0),
      render: (row: FuelRecord) => <Typography variant="body2">{numberFormatter.format(Number(row.quantity || 0))} L</Typography>,
    },
    {
      id: 'cost',
      label: 'Cost',
      searchValue: (row: FuelRecord) => currencyFormatter.format(Number(row.cost || 0)),
      sortValue: (row: FuelRecord) => Number(row.cost || 0),
      render: (row: FuelRecord) => <Typography variant="body2">{currencyFormatter.format(Number(row.cost || 0))}</Typography>,
    },
    {
      id: 'odometerReading',
      label: 'Odometer',
      searchValue: (row: FuelRecord) => `${row.odometerReading} km`,
      sortValue: (row: FuelRecord) => Number(row.odometerReading || 0),
      render: (row: FuelRecord) => <Typography variant="body2">{numberFormatter.format(Number(row.odometerReading || 0))} km</Typography>,
    },
    {
      id: 'actions',
      label: 'Actions',
      searchable: false,
      sortable: false,
      render: (row: FuelRecord) => <Box sx={{ display: 'flex' }}>
        {userCanUpdate && <Button size="small" startIcon={<Edit />} onClick={() => openEditForm(row)}>Edit</Button>}
        {userCanDelete && <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => setDeletingRecord(row)}>Delete</Button>}
      </Box>,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Fuel Dashboard"
        subtitle="Monitor efficiency, highlight anomalies, and contain rising fuel costs."
        onBack={() => navigate(-1)}
        action={userCanCreate ? <Button variant="contained" startIcon={<Add />} onClick={openCreateForm}>Add Fuel Record</Button> : null}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <KPIWidget title="Fuel Spend" value={currencyFormatter.format(summary.totalCost)} subtitle="Across recorded refuels" icon={<AttachMoney />} />
        <KPIWidget title="Fuel Volume" value={numberFormatter.format(summary.totalQuantity)} unit="L" subtitle={`${records.length} fuel records`} icon={<LocalGasStation />} />
        <KPIWidget title="Avg Cost" value={currencyFormatter.format(summary.averageCost)} unit="/ L" subtitle="Based on current records" icon={<Speed />} />
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>Completed Trip Fuel Usage</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fuel consumed and distance from completed trips. These usage figures are separate from refueling spend.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
          <KPIWidget title="Trip Fuel Consumed" value={numberFormatter.format(tripUsageSummary.fuelConsumed)} unit="L" subtitle={`${completedTrips.length} completed trips`} icon={<LocalGasStation />} />
          <KPIWidget title="Trip Distance" value={numberFormatter.format(tripUsageSummary.distance)} unit="km" subtitle="Across completed trips with fuel usage" icon={<Speed />} />
        </Box>
        {tripsError && <Alert severity="error" sx={{ mb: 2 }}>{tripsError}</Alert>}
        <DataTable
          columns={tripColumns}
          rows={completedTrips}
          getRowId={(row) => row.id}
          loading={tripsLoading}
          initialSort={{ columnId: 'actualEndDate', direction: 'desc' }}
          searchPlaceholder="Quick search trip fuel usage..."
          emptyMessage="No completed trips with fuel usage are available yet."
        />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <DataTable
        columns={columns}
        rows={records}
        getRowId={(row) => row.id}
        loading={loading}
        initialSort={{ columnId: 'fuelDate', direction: 'desc' }}
        searchPlaceholder="Quick search fuel records..."
        emptyMessage="No fuel records are available yet."
      />

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingRecord ? 'Edit Fuel Record' : 'Add Fuel Record'}</DialogTitle>
        <form onSubmit={(event) => void saveRecord(event)}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField select label="Vehicle" value={form.vehicleId} required onChange={(event) => setForm({ ...form, vehicleId: event.target.value })} disabled={saving}>
              {vehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNumber}</MenuItem>)}
            </TextField>
            <TextField label="Fuel date" type="date" value={form.fuelDate} required slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setForm({ ...form, fuelDate: event.target.value })} disabled={saving} />
            <TextField label="Quantity (L)" type="number" value={form.quantity} required slotProps={{ htmlInput: { min: 0.01, step: '0.01' } }} onChange={(event) => setForm({ ...form, quantity: event.target.value })} disabled={saving} />
            <TextField label="Cost" type="number" value={form.cost} required slotProps={{ htmlInput: { min: 0, step: '0.01' } }} onChange={(event) => setForm({ ...form, cost: event.target.value })} disabled={saving} />
            <TextField label="Odometer (km)" type="number" value={form.odometerReading} required slotProps={{ htmlInput: { min: 0, step: '0.1' } }} onChange={(event) => setForm({ ...form, odometerReading: event.target.value })} disabled={saving} />
          </DialogContent>
          <DialogActions><Button onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving || vehicles.length === 0}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
        </form>
      </Dialog>
      <Dialog open={Boolean(deletingRecord)} onClose={() => !saving && setDeletingRecord(null)}>
        <DialogTitle>Delete fuel record?</DialogTitle>
        <DialogContent><Typography>Delete this fuel record for {deletingRecord?.vehicle?.vehicleNumber ?? 'the selected vehicle'}?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeletingRecord(null)} disabled={saving}>Cancel</Button><Button color="error" variant="contained" onClick={() => void confirmDelete()} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} message={toast} onClose={() => setToast('')} />
    </Box>
  );
};

export default FuelDashboardPage;
