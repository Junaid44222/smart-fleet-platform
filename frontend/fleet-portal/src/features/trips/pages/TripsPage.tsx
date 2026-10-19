import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, CheckCircleOutlined, Close, DeleteOutlined, Edit, PlayArrow } from '@mui/icons-material';
import {
  cancelTrip,
  completeDriverTrip,
  createTrip,
  deleteTrip,
  fetchDrivers,
  fetchTrips,
  fetchVehicles,
  startDriverTrip,
  updateTrip,
} from '../../../api/fleetApi';
import type { Driver, DriverTrip, Vehicle } from '../../../api/types';
import { canCreateTrip, canDeleteTrip, canUpdateTrip } from '../../../auth/rolePermissions';
import DataTable from '../../../components/DataTable';
import PageHeader from '../../../components/PageHeader';

type ScheduleForm = {
  vehicleId: string;
  driverId: string;
  source: string;
  destination: string;
  startDate: string;
  endDate: string;
};

const emptyForm = (): ScheduleForm => ({ vehicleId: '', driverId: '', source: '', destination: '', startDate: '', endDate: '' });

const toDateTimeInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const tripStatusColor = (status: string): 'success' | 'primary' | 'default' | 'error' => {
  if (status === 'InProgress') return 'primary';
  if (status === 'Completed') return 'success';
  if (status === 'Cancelled') return 'error';
  return 'default';
};

type ApiError = { response?: { data?: { message?: string } } };
const apiMessage = (error: unknown, fallback: string) => (error as ApiError)?.response?.data?.message || fallback;

const TripsPage: React.FC = () => {
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);
  const userCanCreate = canCreateTrip(userRole);
  const userCanUpdate = canUpdateTrip(userRole);
  const userCanDelete = canDeleteTrip(userRole);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTripId, setBusyTripId] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<DriverTrip | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DriverTrip | null>(null);
  const [completionTarget, setCompletionTarget] = useState<DriverTrip | null>(null);
  const [distance, setDistance] = useState('');
  const [fuelConsumed, setFuelConsumed] = useState('');
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const loadTrips = async () => {
    setLoading(true);
    setError('');
    try {
      const [tripData, vehicleData, driverData] = await Promise.all([fetchTrips(), fetchVehicles(), fetchDrivers()]);
      setTrips(tripData);
      setVehicles(vehicleData);
      setDrivers(driverData);
    } catch {
      setError('Unable to load trips and assignment options. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrips();
  }, []);

  const driversById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status.toLowerCase() === 'active');
  const availableDrivers = drivers.filter((driver) => ['active', 'assigned'].includes(driver.status.toLowerCase()));

  const openCreate = () => {
    setEditingTrip(null);
    setForm(emptyForm());
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (trip: DriverTrip) => {
    setEditingTrip(trip);
    setForm({
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      source: trip.source,
      destination: trip.destination,
      startDate: toDateTimeInput(trip.startDate),
      endDate: toDateTimeInput(trip.endDate),
    });
    setFormError('');
    setFormOpen(true);
  };

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      setFormError('End date must be later than start date.');
      return;
    }

    const payload = {
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
    };
    setBusyTripId(editingTrip?.id ?? 'new');
    try {
      if (editingTrip) {
        await updateTrip(editingTrip.id, payload);
        setToast({ message: 'Trip schedule updated.', severity: 'success' });
      } else {
        await createTrip(payload);
        setToast({ message: 'Trip scheduled.', severity: 'success' });
      }
      setFormOpen(false);
      await loadTrips();
    } catch (saveError) {
      setFormError(apiMessage(saveError, 'Unable to save this trip. Check its dates, vehicle, and driver.'));
    } finally {
      setBusyTripId('');
    }
  };

  const runTripAction = async (trip: DriverTrip, action: 'start' | 'cancel' | 'delete') => {
    setBusyTripId(trip.id);
    try {
      if (action === 'start') {
        const updated = await startDriverTrip(trip.id);
        setTrips((current) => current.map((item) => item.id === trip.id ? { ...item, ...updated, vehicle: updated.vehicle ?? item.vehicle } : item));
      } else if (action === 'cancel') {
        const updated = await cancelTrip(trip.id);
        setTrips((current) => current.map((item) => item.id === trip.id ? { ...item, ...updated, vehicle: updated.vehicle ?? item.vehicle } : item));
      } else {
        await deleteTrip(trip.id);
        setTrips((current) => current.filter((item) => item.id !== trip.id));
        setDeleteTarget(null);
      }
      setToast({ message: action === 'start' ? 'Trip started.' : action === 'cancel' ? 'Trip cancelled.' : 'Trip deleted.', severity: 'success' });
    } catch (actionError) {
      setToast({ message: apiMessage(actionError, 'Unable to update this trip.'), severity: 'error' });
    } finally {
      setBusyTripId('');
    }
  };

  const completeSelectedTrip = async () => {
    if (!completionTarget) return;
    const distanceValue = Number(distance);
    const fuelValue = Number(fuelConsumed);
    if (!Number.isFinite(distanceValue) || distanceValue < 0 || !Number.isFinite(fuelValue) || fuelValue < 0) return;

    setBusyTripId(completionTarget.id);
    try {
      const updated = await completeDriverTrip(completionTarget.id, distanceValue, fuelValue);
      setTrips((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated, vehicle: updated.vehicle ?? item.vehicle } : item));
      setToast({ message: 'Trip completed and trip metrics recorded.', severity: 'success' });
      setCompletionTarget(null);
      setDistance('');
      setFuelConsumed('');
    } catch (completionError) {
      setToast({ message: apiMessage(completionError, 'Unable to complete this trip.'), severity: 'error' });
    } finally {
      setBusyTripId('');
    }
  };

  const columns = [
    {
      id: 'tripNumber', label: 'Trip', render: (trip: DriverTrip) => <Typography variant="body2" sx={{ fontWeight: 700 }}>{trip.tripNumber}</Typography>,
      searchValue: (trip: DriverTrip) => trip.tripNumber,
    },
    {
      id: 'route', label: 'Route', render: (trip: DriverTrip) => <Box><Typography variant="body2">{trip.source} → {trip.destination}</Typography><Typography variant="caption" color="text.secondary">{formatDate(trip.startDate)}</Typography></Box>,
      searchValue: (trip: DriverTrip) => `${trip.source} ${trip.destination}`,
      sortValue: (trip: DriverTrip) => new Date(trip.startDate),
    },
    {
      id: 'vehicle', label: 'Vehicle', render: (trip: DriverTrip) => {
        const vehicle = trip.vehicle ?? vehiclesById.get(trip.vehicleId);
        return vehicle ? `${vehicle.vehicleNumber} · ${vehicle.manufacturer} ${vehicle.model}` : trip.vehicleId;
      },
      searchValue: (trip: DriverTrip) => {
        const vehicle = trip.vehicle ?? vehiclesById.get(trip.vehicleId);
        return vehicle ? `${vehicle.vehicleNumber} ${vehicle.manufacturer} ${vehicle.model}` : trip.vehicleId;
      },
    },
    {
      id: 'driver', label: 'Driver', render: (trip: DriverTrip) => {
        const driver = trip.driver ?? driversById.get(trip.driverId);
        return driver ? `${driver.firstName} ${driver.lastName}` : trip.driverId;
      },
      searchValue: (trip: DriverTrip) => {
        const driver = trip.driver ?? driversById.get(trip.driverId);
        return driver ? `${driver.firstName} ${driver.lastName} ${driver.employeeCode}` : trip.driverId;
      },
    },
    { id: 'status', label: 'Status', render: (trip: DriverTrip) => <Chip size="small" label={trip.status === 'InProgress' ? 'In progress' : trip.status} color={tripStatusColor(trip.status)} />, sortValue: (trip: DriverTrip) => trip.status },
    {
      id: 'actions', label: 'Actions', sortable: false, searchable: false, align: 'right' as const,
      render: (trip: DriverTrip) => (
        <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end' }} onClick={(event) => event.stopPropagation()}>
          {userCanUpdate && trip.status === 'Scheduled' && <>
            <Tooltip title="Edit schedule"><IconButton aria-label={`Edit ${trip.tripNumber}`} size="small" onClick={() => openEdit(trip)}><Edit fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Start trip"><IconButton aria-label={`Start ${trip.tripNumber}`} size="small" disabled={Boolean(busyTripId)} onClick={() => void runTripAction(trip, 'start')}><PlayArrow fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Cancel trip"><IconButton aria-label={`Cancel ${trip.tripNumber}`} size="small" disabled={Boolean(busyTripId)} onClick={() => void runTripAction(trip, 'cancel')}><Close fontSize="small" /></IconButton></Tooltip>
          </>}
          {userCanUpdate && trip.status === 'InProgress' && <Tooltip title="Complete trip"><IconButton aria-label={`Complete ${trip.tripNumber}`} size="small" disabled={Boolean(busyTripId)} onClick={() => setCompletionTarget(trip)}><CheckCircleOutlined fontSize="small" /></IconButton></Tooltip>}
          {userCanDelete && ['Scheduled', 'Cancelled'].includes(trip.status) && <Tooltip title="Delete trip"><IconButton aria-label={`Delete ${trip.tripNumber}`} size="small" disabled={Boolean(busyTripId)} onClick={() => setDeleteTarget(trip)}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>}
          {!userCanUpdate && !userCanDelete && <Typography variant="caption" color="text.secondary">View only</Typography>}
        </Stack>
      ),
    },
  ];

  const scheduledCount = trips.filter((trip) => trip.status === 'Scheduled').length;
  const inProgressCount = trips.filter((trip) => trip.status === 'InProgress').length;

  return (
    <Box>
      <PageHeader
        title="Trip Management"
        subtitle="Schedule routes, assign drivers, and monitor trip progress."
        action={userCanCreate ? <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Schedule trip</Button> : undefined}
      />
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ my: 2 }}>
        <Chip label={`${scheduledCount} scheduled`} />
        <Chip label={`${inProgressCount} in progress`} color="primary" />
        <Chip label={`${trips.filter((trip) => trip.status === 'Completed').length} completed`} color="success" />
      </Stack>
      <DataTable
        rows={trips}
        columns={columns}
        getRowId={(trip) => trip.id}
        loading={loading}
        emptyMessage="No trips scheduled yet."
        searchPlaceholder="Search trips, route, vehicle, or driver…"
        initialSort={{ columnId: 'route', direction: 'desc' }}
      />

      <Dialog open={formOpen} onClose={() => !busyTripId && setFormOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveSchedule}>
          <DialogTitle>{editingTrip ? 'Edit trip schedule' : 'Schedule a trip'}</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <FormControl fullWidth required>
              <InputLabel id="trip-vehicle-label">Vehicle</InputLabel>
              <Select labelId="trip-vehicle-label" label="Vehicle" value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>
                {availableVehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNumber} · {vehicle.manufacturer} {vehicle.model}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel id="trip-driver-label">Driver</InputLabel>
              <Select labelId="trip-driver-label" label="Driver" value={form.driverId} onChange={(event) => setForm({ ...form, driverId: event.target.value })}>
                {availableDrivers.map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName} · {driver.employeeCode}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Pickup location" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required fullWidth slotProps={{ htmlInput: { maxLength: 500 } }} />
            <TextField label="Dropoff location" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} required fullWidth slotProps={{ htmlInput: { maxLength: 500 } }} />
            <TextField label="Start date and time" type="datetime-local" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="End date and time" type="datetime-local" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button color="inherit" onClick={() => setFormOpen(false)} disabled={Boolean(busyTripId)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={Boolean(busyTripId)}>{editingTrip ? 'Save changes' : 'Schedule trip'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(completionTarget)} onClose={() => setCompletionTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Complete trip</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">Record distance and fuel used for {completionTarget?.tripNumber}.</Typography>
          <TextField label="Distance traveled" type="number" value={distance} onChange={(event) => setDistance(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} required fullWidth />
          <TextField label="Fuel used" type="number" value={fuelConsumed} onChange={(event) => setFuelConsumed(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} required fullWidth />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setCompletionTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void completeSelectedTrip()} disabled={Boolean(busyTripId) || distance === '' || fuelConsumed === '' || Number(distance) < 0 || Number(fuelConsumed) < 0}>Complete trip</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete trip?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Delete {deleteTarget?.tripNumber}? It will be removed from the active trip list.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setDeleteTarget(null)}>Keep trip</Button>
          <Button color="error" variant="contained" disabled={Boolean(busyTripId)} onClick={() => deleteTarget && void runTripAction(deleteTarget, 'delete')}>Delete trip</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={4500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};

export default TripsPage;
