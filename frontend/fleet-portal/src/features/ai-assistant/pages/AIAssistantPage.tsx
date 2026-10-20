import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  AutoAwesome,
  Route as RouteIcon,
  TrendingUp,
  WarningAmber,
} from '@mui/icons-material';
import { isAxiosError } from 'axios';
import PageHeader from '../../../components/PageHeader';
import { createMaintenanceRecord, createTrip, fetchDrivers, fetchVehicles } from '../../../api/fleetApi';
import { planAiAction, type AiActionPlan } from '../../../api/aiApi';
import type { Driver, Vehicle } from '../../../api/types';
import { canCreateMaintenance, canCreateTrip } from '../../../auth/rolePermissions';

const insightCards = [
  {
    title: 'Incident triage',
    description: 'Surface high-risk vehicles and overdue maintenance before they impact operations.',
    icon: <WarningAmber color="error" />,
  },
  {
    title: 'Route optimisation',
    description: 'Recommend efficient dispatch changes based on live fleet density and service windows.',
    icon: <RouteIcon color="primary" />,
  },
  {
    title: 'Consumption insights',
    description: 'Identify fuel anomalies and suggest corrective actions for underperforming units.',
    icon: <TrendingUp color="success" />,
  },
];

const prompts = [
  'Summarise urgent maintenance issues for the next 24 hours.',
  'Which vehicles are likely to exceed fuel budgets this month?',
  'Suggest the best dispatch plan for today’s active routes.',
];

type ApiError = { response?: { data?: { message?: string; title?: string } }; message?: string };
type TripDraft = { vehicleNumber: string; driverEmail: string; source: string; destination: string; startDate: string; endDate: string };
type MaintenanceDraft = { vehicleNumber: string; serviceType: string; description: string; scheduledDate: string; cost: string; vendor: string };

const toDateTimeInput = (value?: string | null) => {
  if (!value) return '';
  if (!/(?:z|[+-]\d{2}:?\d{2})$/i.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const toDateInput = (value?: string | null) => value ? value.slice(0, 10) : '';

const AIAssistantPage: React.FC = () => {
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);
  const userCanScheduleTrips = canCreateTrip(userRole);
  const userCanCreateMaintenance = canCreateMaintenance(userRole);
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<AiActionPlan | null>(null);
  const [notice, setNotice] = useState<{ severity: 'warning' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tripDraft, setTripDraft] = useState<TripDraft>({ vehicleNumber: '', driverEmail: '', source: '', destination: '', startDate: '', endDate: '' });
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceDraft>({ vehicleNumber: '', serviceType: '', description: '', scheduledDate: '', cost: '', vendor: '' });
  const [actionError, setActionError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!userCanScheduleTrips && !userCanCreateMaintenance) return;
    void Promise.all([fetchVehicles(), fetchDrivers()])
      .then(([vehicleData, driverData]) => {
        setVehicles(vehicleData.filter((vehicle) => vehicle.status.toLowerCase() === 'active'));
        setDrivers(driverData.filter((driver) => ['active', 'assigned'].includes(driver.status.toLowerCase())));
      })
      .catch(() => setOptionsError('Fleet options could not be loaded. Refresh the page before creating an action.'));
  }, [userCanScheduleTrips, userCanCreateMaintenance]);

  const handlePromptSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setPlan(null);
    setActionError('');
    setNotice(null);

    try {
      const result = await planAiAction({ message: prompt.trim() });
      setPlan(result);
      setActionError('');
      setNotice(null);
      setTripDraft({
        vehicleNumber: result.trip?.vehicleNumber ?? '',
        driverEmail: result.trip?.driverEmail ?? '',
        source: result.trip?.source ?? '',
        destination: result.trip?.destination ?? '',
        startDate: toDateTimeInput(result.trip?.startDate),
        endDate: toDateTimeInput(result.trip?.endDate),
      });
      setMaintenanceDraft({
        vehicleNumber: result.maintenance?.vehicleNumber ?? '',
        serviceType: result.maintenance?.serviceType ?? '',
        description: result.maintenance?.description ?? '',
        scheduledDate: toDateInput(result.maintenance?.scheduledDate),
        cost: result.maintenance?.cost == null ? '' : String(result.maintenance.cost),
        vendor: result.maintenance?.vendor ?? '',
      });
    } catch (error) {
      const serverMessage = isAxiosError<{ message?: string; title?: string }>(error)
        ? error.response?.data?.message ?? error.response?.data?.title
        : undefined;
      setNotice({
        severity: 'error',
        message: serverMessage || 'Unable to reach the AI assistant. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmTrip = async () => {
    if (!plan || plan.action !== 'scheduleTrip' || !userCanScheduleTrips) return;
    const vehicle = vehicles.find((item) => item.vehicleNumber === tripDraft.vehicleNumber);
    const driver = drivers.find((item) => item.email.toLowerCase() === tripDraft.driverEmail.toLowerCase());
    if (!vehicle || !driver || !tripDraft.source.trim() || !tripDraft.destination.trim() || !tripDraft.startDate || !tripDraft.endDate) {
      setActionError('Choose an active vehicle and driver and complete every trip field before confirming.');
      return;
    }
    if (new Date(tripDraft.startDate) >= new Date(tripDraft.endDate)) {
      setActionError('Trip end time must be after its start time.');
      return;
    }

    setIsCreatingAction(true);
    setActionError('');
    try {
      const trip = await createTrip({
        vehicleId: vehicle.id,
        driverId: driver.id,
        source: tripDraft.source.trim(),
        destination: tripDraft.destination.trim(),
        startDate: new Date(tripDraft.startDate).toISOString(),
        endDate: new Date(tripDraft.endDate).toISOString(),
      });
      setPlan({ action: 'none', assistantMessage: `Trip ${trip.tripNumber} was scheduled successfully.` });
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to schedule the trip. Fleet API permissions or trip rules may have rejected it.'));
    } finally {
      setIsCreatingAction(false);
    }
  };

  const confirmMaintenance = async () => {
    if (!plan || plan.action !== 'createMaintenance' || !userCanCreateMaintenance) return;
    const vehicle = vehicles.find((item) => item.vehicleNumber === maintenanceDraft.vehicleNumber);
    const cost = Number(maintenanceDraft.cost);
    if (!vehicle || !maintenanceDraft.serviceType.trim() || !maintenanceDraft.scheduledDate ||
      !maintenanceDraft.vendor.trim() || maintenanceDraft.cost.trim() === '' || !Number.isFinite(cost) || cost < 0) {
      setActionError('Choose a vehicle and complete the service type, scheduled date, vendor, and non-negative cost before confirming.');
      return;
    }

    setIsCreatingAction(true);
    setActionError('');
    try {
      await createMaintenanceRecord({
        vehicleId: vehicle.id,
        serviceType: maintenanceDraft.serviceType.trim(),
        description: maintenanceDraft.description.trim(),
        scheduledDate: new Date(`${maintenanceDraft.scheduledDate}T00:00:00`).toISOString(),
        cost,
        vendor: maintenanceDraft.vendor.trim(),
        status: 'Scheduled',
      });
      setPlan({ action: 'none', assistantMessage: `Maintenance for ${vehicle.vehicleNumber} was scheduled successfully.` });
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to schedule maintenance. Fleet API permissions or validation may have rejected it.'));
    } finally {
      setIsCreatingAction(false);
    }
  };

  const getErrorMessage = (error: unknown, fallback: string) => isAxiosError<{ message?: string; title?: string }>(error)
    ? error.response?.data?.message ?? error.response?.data?.title ?? fallback
    : (error as ApiError).message ?? fallback;

  const handlePromptChip = (value: string) => {
    setPrompt(value);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="AI Assistant"
        subtitle="Ask for fleet insights or prepare trip and maintenance actions for your role."
        onBack={() => navigate(-1)}
      />

      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h3">Fleet copilot</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                The assistant can draft eligible fleet actions. Review every detail and confirm before it is sent to Fleet Management.
              </Typography>
            </Box>
            <Chip icon={<AutoAwesome />} label={[
              userCanScheduleTrips && 'Trip scheduling',
              userCanCreateMaintenance && 'Maintenance',
            ].filter(Boolean).join(' · ') || 'Read-only assistant'} color="primary" />
          </Box>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Type a prompt or choose a quick example
            </Typography>

            <Box component="form" onSubmit={handlePromptSubmit} sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Ask the AI assistant"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                fullWidth
                helperText="Ask a question, or request an action such as scheduling a trip or maintenance."
              />
              <Button type="submit" variant="contained" disabled={isLoading || !prompt.trim()}>
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              {prompts.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  variant="outlined"
                  onClick={() => handlePromptChip(option)}
                  clickable
                />
              ))}
            </Box>
          </Paper>

          {notice && (
            <Alert severity={notice.severity}>{notice.message}</Alert>
          )}

          {optionsError && <Alert severity="error">{optionsError}</Alert>}

          {plan && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Assistant
              </Typography>
              <Typography>{plan.assistantMessage}</Typography>
            </Paper>
          )}

          {plan?.action === 'scheduleTrip' && plan.trip && userCanScheduleTrips && (
            <Card variant="outlined">
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h3">Review trip draft</Typography>
                <Typography variant="body2" color="text.secondary">This is only a draft. Confirm to create the trip using your Fleet API permissions.</Typography>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField select required label="Vehicle" value={tripDraft.vehicleNumber} onChange={(event) => setTripDraft({ ...tripDraft, vehicleNumber: event.target.value })}>
                    <MenuItem value="">Choose an active vehicle</MenuItem>
                    {vehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber} · {vehicle.manufacturer} {vehicle.model}</MenuItem>)}
                  </TextField>
                  <TextField select required label="Driver" value={tripDraft.driverEmail} onChange={(event) => setTripDraft({ ...tripDraft, driverEmail: event.target.value })}>
                    <MenuItem value="">Choose an available driver</MenuItem>
                    {drivers.map((driver) => <MenuItem key={driver.id} value={driver.email}>{driver.firstName} {driver.lastName} · {driver.email}</MenuItem>)}
                  </TextField>
                  <TextField required label="Source" value={tripDraft.source} onChange={(event) => setTripDraft({ ...tripDraft, source: event.target.value })} />
                  <TextField required label="Destination" value={tripDraft.destination} onChange={(event) => setTripDraft({ ...tripDraft, destination: event.target.value })} />
                  <TextField required type="datetime-local" label="Start" value={tripDraft.startDate} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setTripDraft({ ...tripDraft, startDate: event.target.value })} />
                  <TextField required type="datetime-local" label="End" value={tripDraft.endDate} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setTripDraft({ ...tripDraft, endDate: event.target.value })} />
                </Box>
                <Box><Button variant="contained" onClick={() => void confirmTrip()} disabled={isCreatingAction || vehicles.length === 0 || drivers.length === 0}>{isCreatingAction ? 'Scheduling...' : 'Confirm and schedule trip'}</Button></Box>
              </CardContent>
            </Card>
          )}

          {plan?.action === 'createMaintenance' && plan.maintenance && userCanCreateMaintenance && (
            <Card variant="outlined">
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h3">Review maintenance draft</Typography>
                <Typography variant="body2" color="text.secondary">This is only a draft. Confirm to create the scheduled maintenance record.</Typography>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField select required label="Vehicle" value={maintenanceDraft.vehicleNumber} onChange={(event) => setMaintenanceDraft({ ...maintenanceDraft, vehicleNumber: event.target.value })}>
                    <MenuItem value="">Choose an active vehicle</MenuItem>
                    {vehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber} · {vehicle.manufacturer} {vehicle.model}</MenuItem>)}
                  </TextField>
                  <TextField required label="Service type" value={maintenanceDraft.serviceType} onChange={(event) => setMaintenanceDraft({ ...maintenanceDraft, serviceType: event.target.value })} />
                  <TextField required type="date" label="Scheduled date" value={maintenanceDraft.scheduledDate} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setMaintenanceDraft({ ...maintenanceDraft, scheduledDate: event.target.value })} />
                  <TextField required type="number" label="Estimated cost" value={maintenanceDraft.cost} slotProps={{ htmlInput: { min: 0, step: '0.01' } }} onChange={(event) => setMaintenanceDraft({ ...maintenanceDraft, cost: event.target.value })} />
                  <TextField required label="Vendor" value={maintenanceDraft.vendor} onChange={(event) => setMaintenanceDraft({ ...maintenanceDraft, vendor: event.target.value })} />
                  <TextField label="Description" multiline minRows={2} value={maintenanceDraft.description} onChange={(event) => setMaintenanceDraft({ ...maintenanceDraft, description: event.target.value })} />
                </Box>
                <Box><Button variant="contained" onClick={() => void confirmMaintenance()} disabled={isCreatingAction || vehicles.length === 0}>{isCreatingAction ? 'Scheduling...' : 'Confirm maintenance'}</Button></Box>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {insightCards.map((card) => (
          <Card key={card.title}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                {card.icon}
                <Typography variant="h3">{card.title}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {card.description}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default AIAssistantPage;
