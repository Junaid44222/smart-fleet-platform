import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { completeDriverTrip, fetchDriverTrips, startDriverTrip } from '../../../api/fleetApi';
import type { DriverTrip } from '../../../api/types';
import { setAuthToken } from '../../../api/apiClient';
import { logout } from '../../auth/authSlice';

type DriverTab = 'home' | 'trips' | 'profile';

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const statusColor = (status: string): 'success' | 'primary' | 'default' | 'error' => {
  if (status === 'InProgress') return 'primary';
  if (status === 'Completed') return 'success';
  if (status === 'Cancelled') return 'error';
  return 'default';
};

const DriverHomePage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userName = useSelector((state: { auth: { userName: string } }) => state.auth.userName);
  const [tab, setTab] = useState<DriverTab>('home');
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTripId, setBusyTripId] = useState('');
  const [error, setError] = useState('');
  const [completionTrip, setCompletionTrip] = useState<DriverTrip | null>(null);
  const [distance, setDistance] = useState('');
  const [fuelConsumed, setFuelConsumed] = useState('');

  const refreshTrips = async () => {
    setError('');
    setLoading(true);
    try {
      setTrips(await fetchDriverTrips());
    } catch {
      setError('We could not load your trips. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshTrips();
  }, []);

  const currentTrip = useMemo(() =>
    trips.find((trip) => trip.status === 'InProgress') ??
    trips.find((trip) => trip.status === 'Scheduled'), [trips]);
  const completedTrips = trips.filter((trip) => trip.status === 'Completed');
  const totalDistance = completedTrips.reduce((total, trip) => total + (trip.distance ?? 0), 0);

  const handleStart = async (trip: DriverTrip) => {
    setBusyTripId(trip.id);
    setError('');
    try {
      const updated = await startDriverTrip(trip.id);
      setTrips((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setError('This trip could not be started. Refresh your schedule and try again.');
    } finally {
      setBusyTripId('');
    }
  };

  const handleComplete = async () => {
    if (!completionTrip) return;
    const distanceValue = Number(distance);
    const fuelValue = Number(fuelConsumed);
    if (!Number.isFinite(distanceValue) || distanceValue < 0 || !Number.isFinite(fuelValue) || fuelValue < 0) return;

    setBusyTripId(completionTrip.id);
    setError('');
    try {
      const updated = await completeDriverTrip(completionTrip.id, distanceValue, fuelValue);
      setTrips((current) => current.map((item) => item.id === updated.id ? updated : item));
      setCompletionTrip(null);
      setDistance('');
      setFuelConsumed('');
    } catch {
      setError('This trip could not be completed. Review the trip status and try again.');
    } finally {
      setBusyTripId('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUserName');
    localStorage.removeItem('authUserRole');
    setAuthToken(null);
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const tripCard = (trip: DriverTrip, featured = false) => (
    <Card key={trip.id} variant="outlined" sx={{ borderRadius: 3, borderColor: 'divider', overflow: 'hidden' }}>
      {featured && <Box sx={{ height: 8, bgcolor: trip.status === 'InProgress' ? 'primary.main' : 'primary.light' }} />}
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography variant="overline" color="text.secondary">{trip.tripNumber}</Typography>
          <Chip size="small" label={trip.status === 'InProgress' ? 'In progress' : trip.status} color={statusColor(trip.status)} />
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
          <Stack sx={{ alignItems: 'center', pt: 0.25 }}>
            <MyLocationIcon color="primary" fontSize="small" />
            <Box sx={{ width: 2, height: 24, bgcolor: 'divider', my: 0.5 }} />
            <MyLocationIcon color="action" fontSize="small" />
          </Stack>
          <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">PICKUP</Typography>
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{trip.source}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">DROPOFF</Typography>
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{trip.destination}</Typography>
            </Box>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">SCHEDULED</Typography>
            <Typography variant="body2">{formatDate(trip.startDate)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">VEHICLE</Typography>
            <Typography variant="body2">
              {trip.vehicle ? `${trip.vehicle.vehicleNumber} · ${trip.vehicle.manufacturer} ${trip.vehicle.model}` : 'Vehicle details unavailable'}
            </Typography>
          </Box>
        </Stack>
        {trip.status === 'Scheduled' && (
          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={busyTripId === trip.id ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
            disabled={Boolean(busyTripId)}
            onClick={() => void handleStart(trip)}
            sx={{ mt: 2, minHeight: 48, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >Start trip</Button>
        )}
        {trip.status === 'InProgress' && (
          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            startIcon={<CheckCircleOutlineIcon />}
            disabled={Boolean(busyTripId)}
            onClick={() => setCompletionTrip(trip)}
            sx={{ mt: 2, minHeight: 48, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >Complete trip</Button>
        )}
        {trip.status === 'Completed' && trip.distance != null && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Recorded distance: {trip.distance} · fuel used: {trip.fuelConsumed ?? 0}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'D';

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#f5f7fb', pb: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', maxWidth: 760, mx: 'auto', px: 2, py: 1.25 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 42, height: 42 }}>{initials}</Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">Good day,</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{userName || 'Driver'}</Typography>
            </Box>
          </Stack>
          <Button aria-label="Refresh trips" onClick={() => void refreshTrips()} disabled={loading} sx={{ minWidth: 48, minHeight: 48 }}>
            <RefreshIcon />
          </Button>
        </Stack>
      </Box>

      <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: 2, py: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {tab === 'home' && <>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'end', mb: 1.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Today&apos;s route</Typography>
              <Typography variant="body2" color="text.secondary">Your assigned trips and progress</Typography>
            </Box>
            <Chip label={`${trips.filter((trip) => trip.status === 'Scheduled' || trip.status === 'InProgress').length} active`} size="small" />
          </Stack>
          {loading ? <Stack sx={{ alignItems: 'center', py: 8 }}><CircularProgress /></Stack> : currentTrip ? tripCard(currentTrip, true) : (
            <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ py: 4, textAlign: 'center' }}>
              <RouteOutlinedIcon color="disabled" sx={{ fontSize: 42, mb: 1 }} />
              <Typography sx={{ fontWeight: 700 }}>No active trip assigned</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Your next route will appear here when it is scheduled.</Typography>
            </CardContent></Card>
          )}
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}><CardContent>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{completedTrips.length}</Typography>
              <Typography variant="caption" color="text.secondary">TRIPS COMPLETED</Typography>
            </CardContent></Card>
            <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}><CardContent>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{totalDistance.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">DISTANCE RECORDED</Typography>
            </CardContent></Card>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button fullWidth variant="outlined" startIcon={<RouteOutlinedIcon />} onClick={() => setTab('trips')} sx={{ minHeight: 48, borderRadius: 2, textTransform: 'none' }}>All trips</Button>
            <Button fullWidth variant="outlined" startIcon={<PersonOutlineIcon />} onClick={() => setTab('profile')} sx={{ minHeight: 48, borderRadius: 2, textTransform: 'none' }}>My profile</Button>
          </Stack>
        </>}

        {tab === 'trips' && <>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>My trips</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Only trips assigned to your driver account are shown.</Typography>
          {loading ? <Stack sx={{ alignItems: 'center', py: 8 }}><CircularProgress /></Stack> : trips.length ? (
            <Stack spacing={1.5}>{trips.map((trip) => tripCard(trip))}</Stack>
          ) : <Alert severity="info">No trips are assigned to you yet.</Alert>}
        </>}

        {tab === 'profile' && <>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>My profile</Typography>
          <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>{initials}</Avatar>
              <Box><Typography sx={{ fontWeight: 700 }}>{userName || 'Driver'}</Typography><Typography variant="body2" color="text.secondary">Driver account</Typography></Box>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Button fullWidth color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout} sx={{ minHeight: 48, justifyContent: 'flex-start', textTransform: 'none' }}>Sign out</Button>
          </CardContent></Card>
        </>}
      </Box>

      <BottomNavigation
        showLabels
        value={tab}
        onChange={(_, value: DriverTab) => setTab(value)}
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 'calc(64px + env(safe-area-inset-bottom))', pb: 'env(safe-area-inset-bottom)', borderTop: 1, borderColor: 'divider', zIndex: 3 }}
      >
        <BottomNavigationAction label="Home" value="home" icon={<HomeOutlinedIcon />} />
        <BottomNavigationAction label="Trips" value="trips" icon={<RouteOutlinedIcon />} />
        <BottomNavigationAction label="Profile" value="profile" icon={<PersonOutlineIcon />} />
      </BottomNavigation>

      <Dialog open={Boolean(completionTrip)} onClose={() => setCompletionTrip(null)} fullWidth maxWidth="xs">
        <DialogTitle>Complete trip</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">Record the distance and fuel used for {completionTrip?.tripNumber}.</Typography>
          <TextField label="Distance traveled" type="number" value={distance} onChange={(event) => setDistance(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} required fullWidth />
          <TextField label="Fuel used" type="number" value={fuelConsumed} onChange={(event) => setFuelConsumed(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} required fullWidth />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompletionTrip(null)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleComplete()}
            disabled={Boolean(busyTripId) || distance === '' || fuelConsumed === '' || Number(distance) < 0 || Number(fuelConsumed) < 0}
          >Complete trip</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DriverHomePage;
