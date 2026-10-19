import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Snackbar, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Add, AttachMoney, DeleteOutlined, Edit, LocalGasStation, Speed } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import KPIWidget from '../../../components/KPIWidget';
import { createFuelRecord, deleteFuelRecord, fetchFuelRecords, fetchVehicles, updateFuelRecord } from '../../../api/fleetApi';
import type { FuelRecord, Vehicle } from '../../../api/types';
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

    loadRecords();
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
    {
      id: 'actions',
      label: 'Actions',
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

      {error && <Alert severity="error">{error}</Alert>}

      <DataTable
        columns={columns}
        rows={sortedRecords}
        getRowId={(row) => row.id}
        loading={loading}
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
