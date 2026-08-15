import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Build,
  LocalGasStation,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PageHeader from '../../../components/PageHeader';
import { fetchVehicleById, fetchDrivers } from '../../../api/fleetApi';
import type { Driver, Vehicle } from '../../../api/types';

const VehicleDetailPage: React.FC = () => {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>(null);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [error, setError] = useState('');
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);

  useEffect(() => {
    const loadVehicle = async () => {
      if (!id) return;

      try {
        const data = await fetchVehicleById(id);
        setVehicle(data ?? null);
      } catch {
        setError('Unable to load vehicle details.');
      } finally {
        setLoading(false);
      }
    };

    loadVehicle();
  }, [id]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const data = await fetchDrivers();
        setDrivers(data);
      } catch {
        setDrivers([]);
      } finally {
        setLoadingDrivers(false);
      }
    };

    loadDrivers();
  }, []);

  useEffect(() => {
    if (!id) return;
    const stored = localStorage.getItem(`assignedDriver_${id}`);
    if (stored) {
      setAssignedDriverId(stored);
    }
  }, [id]);

  useEffect(() => {
    if (assignedDriverId && drivers.length > 0) {
      setAssignedDriver(drivers.find((driver) => driver.id === assignedDriverId) ?? null);
    } else {
      setAssignedDriver(null);
    }
  }, [assignedDriverId, drivers]);

  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        title="Vehicle Details"
        subtitle="Review vehicle metrics, fuel status, and maintenance readiness."
        onBack={() => navigate(-1)}
      />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : vehicle ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="h6">Assigned Driver</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : 'No driver assigned to this vehicle.'}
                  </Typography>
                </Box>
                {userRole === 'Admin' && (
                  <Button variant="contained" onClick={() => {
                    setSelectedDriverId(assignedDriverId ?? '');
                    setIsAssignOpen(true);
                  }}>
                    {assignedDriver ? 'Reassign Driver' : 'Assign Driver'}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          <Dialog open={isAssignOpen} onClose={() => setIsAssignOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>{assignedDriver ? 'Reassign Driver' : 'Assign Driver'}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
              {loadingDrivers ? (
                <Typography>Loading drivers…</Typography>
              ) : (
                <FormControl fullWidth>
                  <InputLabel id="driver-select-label">Driver</InputLabel>
                  <Select
                    labelId="driver-select-label"
                    value={selectedDriverId}
                    label="Driver"
                    onChange={(event: SelectChangeEvent<string>) => setSelectedDriverId(event.target.value)}
                  >
                    <MenuItem value="">Unassign</MenuItem>
                    {drivers.map((driver) => (
                      <MenuItem key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName} • {driver.employeeCode}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsAssignOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (id) {
                    const value = selectedDriverId || '';
                    if (value) {
                      localStorage.setItem(`assignedDriver_${id}`, value);
                      setAssignedDriverId(value);
                    } else {
                      localStorage.removeItem(`assignedDriver_${id}`);
                      setAssignedDriverId(null);
                    }
                  }
                  setIsAssignOpen(false);
                }}
                variant="contained"
                disabled={loadingDrivers}
              >
                Save
              </Button>
            </DialogActions>
          </Dialog>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="h6">{vehicle.vehicleNumber}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {vehicle.manufacturer} {vehicle.model} • {vehicle.year}
                  </Typography>
                </Box>
                <Chip label={vehicle.status} color={vehicle.status.toLowerCase() === 'active' ? 'success' : 'default'} />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Fuel capacity</Typography>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>{vehicle.fuelCapacity} L</Typography>
                </Box>
                <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Operating status</Typography>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>{vehicle.status}</Typography>
                </Box>
                <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Last updated</Typography>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>{new Date(vehicle.createdAt).toLocaleDateString()}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocalGasStation color="primary" />
                  <Typography variant="h6">Fuel efficiency</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Consumption trends and refill intervals will surface here as sensor and telematics data is connected.
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Build color="primary" />
                  <Typography variant="h6">Maintenance readiness</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Scheduled service milestones and work order history can be tracked directly from this panel.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      ) : (
        <Typography>No vehicle found.</Typography>
      )}
    </Box>
  );
};

export default VehicleDetailPage;
