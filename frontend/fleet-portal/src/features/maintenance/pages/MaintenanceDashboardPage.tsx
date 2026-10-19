import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Snackbar, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Add, Build, CalendarToday, DeleteOutlined, Edit, WarningAmber } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import KPIWidget from '../../../components/KPIWidget';
import { createMaintenanceRecord, deleteMaintenanceRecord, fetchMaintenanceRecords, fetchVehicles, updateMaintenanceRecord } from '../../../api/fleetApi';
import type { MaintenanceRecord, Vehicle } from '../../../api/types';
import { canCreateMaintenance, canDeleteMaintenance, canUpdateMaintenance } from '../../../auth/rolePermissions';

type MaintenanceForm = {
  vehicleId: string;
  serviceType: string;
  description: string;
  scheduledDate: string;
  completedDate: string;
  cost: string;
  vendor: string;
  status: string;
};

const newMaintenanceForm = (vehicleId = ''): MaintenanceForm => ({
  vehicleId,
  serviceType: '',
  description: '',
  scheduledDate: new Date().toISOString().slice(0, 10),
  completedDate: '',
  cost: '0',
  vendor: '',
  status: 'Scheduled',
});

type ApiError = { response?: { data?: { message?: string } } };

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
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);
  const userCanCreate = canCreateMaintenance(userRole);
  const userCanUpdate = canUpdateMaintenance(userRole);
  const userCanDelete = canDeleteMaintenance(userRole);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState<MaintenanceForm>(newMaintenanceForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

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
    void fetchVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  const openCreateForm = () => {
    if (!userCanCreate) return;
    setEditingRecord(null);
    setForm(newMaintenanceForm(vehicles[0]?.id ?? ''));
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (record: MaintenanceRecord) => {
    if (!userCanUpdate) return;
    setEditingRecord(record);
    setForm({
      vehicleId: record.vehicleId,
      serviceType: record.serviceType,
      description: record.description,
      scheduledDate: record.scheduledDate.slice(0, 10),
      completedDate: record.completedDate?.slice(0, 10) ?? '',
      cost: String(record.cost),
      vendor: record.vendor,
      status: record.status,
    });
    setFormError('');
    setFormOpen(true);
  };

  const saveRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(editingRecord ? userCanUpdate : userCanCreate)) return;
    if (!form.vehicleId) {
      setFormError('Select a vehicle.');
      return;
    }
    if (form.status === 'Completed' && !form.completedDate) {
      setFormError('Enter the completion date for a completed work order.');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      vehicleId: form.vehicleId,
      serviceType: form.serviceType.trim(),
      description: form.description.trim(),
      scheduledDate: new Date(form.scheduledDate).toISOString(),
      completedDate: form.completedDate ? new Date(form.completedDate).toISOString() : null,
      cost: Number(form.cost),
      vendor: form.vendor.trim(),
      status: form.status,
    };
    try {
      if (editingRecord) {
        await updateMaintenanceRecord(editingRecord.id, payload);
        setToast('Work order updated.');
      } else {
        await createMaintenanceRecord({
          vehicleId: payload.vehicleId,
          serviceType: payload.serviceType,
          description: payload.description,
          scheduledDate: payload.scheduledDate,
          cost: payload.cost,
          vendor: payload.vendor,
          status: payload.status,
        });
        setToast('Work order added.');
      }
      setFormOpen(false);
      setEditingRecord(null);
      setRecords(await fetchMaintenanceRecords());
    } catch (saveError) {
      setFormError((saveError as ApiError).response?.data?.message || 'Unable to save the work order.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingRecord || !userCanDelete) return;
    setSaving(true);
    try {
      await deleteMaintenanceRecord(deletingRecord.id);
      setDeletingRecord(null);
      setToast('Work order deleted.');
      setRecords(await fetchMaintenanceRecords());
    } catch (deleteError) {
      setError((deleteError as ApiError).response?.data?.message || 'Unable to delete the work order.');
    } finally {
      setSaving(false);
    }
  };

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

  const columns = [
    {
      id: 'serviceType',
      label: 'Service',
      searchValue: (row: MaintenanceRecord) => `${row.serviceType} ${row.description}`,
      sortValue: (row: MaintenanceRecord) => row.serviceType,
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
      searchValue: (row: MaintenanceRecord) => `${row.scheduledDate} ${formatDate(row.scheduledDate)}`,
      sortValue: (row: MaintenanceRecord) => new Date(row.scheduledDate),
      render: (row: MaintenanceRecord) => <Typography variant="body2">{formatDate(row.scheduledDate)}</Typography>,
    },
    {
      id: 'vendor',
      label: 'Vendor',
      searchValue: (row: MaintenanceRecord) => row.vendor,
      sortValue: (row: MaintenanceRecord) => row.vendor,
      render: (row: MaintenanceRecord) => <Typography variant="body2">{row.vendor || 'Unassigned'}</Typography>,
    },
    {
      id: 'cost',
      label: 'Cost',
      searchValue: (row: MaintenanceRecord) => currencyFormatter.format(Number(row.cost || 0)),
      sortValue: (row: MaintenanceRecord) => Number(row.cost || 0),
      render: (row: MaintenanceRecord) => <Typography variant="body2">{currencyFormatter.format(Number(row.cost || 0))}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      searchValue: (row: MaintenanceRecord) => row.status,
      sortValue: (row: MaintenanceRecord) => row.status,
      render: (row: MaintenanceRecord) => (
        <Chip
          label={row.status}
          color={row.status.toLowerCase() === 'completed' ? 'success' : 'warning'}
          size="small"
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      searchable: false,
      sortable: false,
      render: (row: MaintenanceRecord) => (
        <Box sx={{ display: 'flex' }}>
          {userCanUpdate && <Button size="small" startIcon={<Edit />} onClick={() => openEditForm(row)}>Edit</Button>}
          {userCanDelete && <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => setDeletingRecord(row)}>Delete</Button>}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Maintenance Dashboard"
        subtitle="Coordinate service readiness and avoid disruptions across the fleet."
        onBack={() => navigate(-1)}
        action={userCanCreate ? <Button variant="contained" startIcon={<Add />} onClick={openCreateForm}>Add Work Order</Button> : null}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <KPIWidget title="Open Work Orders" value={summary.openCount} subtitle="Active maintenance records" icon={<Build />} />
        <KPIWidget title="Scheduled Ahead" value={summary.scheduledCount} subtitle="Upcoming service windows" icon={<CalendarToday />} />
        <KPIWidget title="Maintenance Spend" value={currencyFormatter.format(summary.totalCost)} subtitle={`${summary.overdueCount} overdue`} icon={<WarningAmber />} />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <DataTable
        columns={columns}
        rows={records}
        getRowId={(row) => row.id}
        loading={loading}
        initialSort={{ columnId: 'scheduledDate', direction: 'asc' }}
        searchPlaceholder="Quick search maintenance records..."
        emptyMessage="No maintenance records are available yet."
      />

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingRecord ? 'Edit Work Order' : 'Add Work Order'}</DialogTitle>
        <form onSubmit={(event) => void saveRecord(event)}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField select label="Vehicle" value={form.vehicleId} required onChange={(event) => setForm({ ...form, vehicleId: event.target.value })} disabled={saving}>
              {vehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNumber}</MenuItem>)}
            </TextField>
            <TextField label="Service type" value={form.serviceType} required onChange={(event) => setForm({ ...form, serviceType: event.target.value })} disabled={saving} />
            <TextField label="Description" value={form.description} multiline minRows={2} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={saving} />
            <TextField label="Scheduled date" type="date" value={form.scheduledDate} required slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })} disabled={saving} />
            <TextField label="Vendor" value={form.vendor} required onChange={(event) => setForm({ ...form, vendor: event.target.value })} disabled={saving} />
            <TextField label="Cost" type="number" value={form.cost} required slotProps={{ htmlInput: { min: 0, step: '0.01' } }} onChange={(event) => setForm({ ...form, cost: event.target.value })} disabled={saving} />
            <TextField select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={saving}>
              {(editingRecord ? ['Scheduled', 'InProgress', 'Completed'] : ['Scheduled', 'InProgress']).map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </TextField>
            {form.status === 'Completed' && <TextField label="Completed date" type="date" value={form.completedDate} required slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setForm({ ...form, completedDate: event.target.value })} disabled={saving} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || vehicles.length === 0}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(deletingRecord)} onClose={() => !saving && setDeletingRecord(null)}>
        <DialogTitle>Delete work order?</DialogTitle>
        <DialogContent><Typography>Delete the {deletingRecord?.serviceType} work order?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingRecord(null)} disabled={saving}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void confirmDelete()} disabled={saving}>{saving ? 'Deleting…' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} message={toast} onClose={() => setToast('')} />
    </Box>
  );
};

export default MaintenanceDashboardPage;
