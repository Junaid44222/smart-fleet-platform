import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Alert,
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
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  TextField,
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
import { changeVehicleStatus, fetchVehicleAssignment, fetchVehicleById, fetchDrivers, setVehicleAssignment } from '../../../api/fleetApi';
import type { Driver, Vehicle } from '../../../api/types';

const VehicleDetailPage: React.FC = () => {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>(null);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
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
    const loadAssignment = async () => {
      if (!id) return;
      setAssignmentLoading(true);
      setAssignmentError('');
      try {
        const assignment = await fetchVehicleAssignment(id);
        setAssignedDriverId(assignment?.driverId ?? null);
      } catch {
        setAssignmentError('Unable to load the current driver assignment.');
      } finally {
        setAssignmentLoading(false);
      }
    };

    void loadAssignment();
  }, [id]);

  useEffect(() => {
    if (assignedDriverId && drivers.length > 0) {
      setAssignedDriver(drivers.find((driver) => driver.id === assignedDriverId) ?? null);
    } else {
      setAssignedDriver(null);
    }
  }, [assignedDriverId, drivers]);

  const navigate = useNavigate();
  const canManageVehicleStatus = userRole === 'Admin';
  const canAssignDriver = ['Admin', 'SuperAdmin', 'FleetManager', 'Dispatcher'].includes(userRole);

  const handleAssignmentSave = async () => {
    if (!id) return;
    setAssignmentSaving(true);
    setAssignmentError('');
    setAssignmentMessage('');
    try {
      const assignment = await setVehicleAssignment(id, selectedDriverId || null);
      setAssignedDriverId(assignment?.driverId ?? null);
      setDrivers((currentDrivers) => currentDrivers.map((driver) => {
        if (driver.id === assignedDriverId && driver.id !== assignment?.driverId) {
          return { ...driver, status: 'Active' };
        }
        if (driver.id === assignment?.driverId) {
          return { ...driver, status: 'Assigned' };
        }
        return driver;
      }));
      setAssignmentMessage(assignment
        ? `Assigned ${assignment.driverName} to this vehicle.`
        : 'Driver unassigned from this vehicle.');
      setIsAssignOpen(false);
    } catch (saveError) {
      setAssignmentError(saveError instanceof Error ? saveError.message : 'Unable to save the driver assignment.');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleStatusDialogOpen = () => {
    if (!vehicle) return;
    setSelectedStatus(vehicle.status);
    setStatusReason('');
    setStatusError('');
    setIsStatusDialogOpen(true);
  };

  const handleStatusSave = async () => {
    if (!id || !vehicle) return;
    setSavingStatus(true);
    setStatusError('');
    setStatusMessage('');
    try {
      const result = await changeVehicleStatus(id, selectedStatus, statusReason);
      setVehicle(result.vehicle);
      setStatusMessage(result.workOrder
        ? `Vehicle placed into maintenance. Work order ${result.workOrder.id} created.`
        : `Vehicle status changed to ${result.vehicle.status}.`);
      setIsStatusDialogOpen(false);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Unable to change vehicle status.');
    } finally {
      setSavingStatus(false);
    }
  };

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
          {statusMessage && <Alert severity="success" onClose={() => setStatusMessage('')}>{statusMessage}</Alert>}
          {assignmentMessage && <Alert severity="success" onClose={() => setAssignmentMessage('')}>{assignmentMessage}</Alert>}
          {assignmentError && <Alert severity="error" onClose={() => setAssignmentError('')}>{assignmentError}</Alert>}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="h6">Assigned Driver</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {assignmentLoading ? 'Loading assignment…' : assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : 'No driver assigned to this vehicle.'}
                  </Typography>
                </Box>
                {canAssignDriver && (
                  <Button variant="contained" disabled={assignmentLoading} onClick={() => {
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
                    {drivers.filter((driver) =>
                      driver.status.toLowerCase() === 'active' || driver.id === assignedDriverId
                    ).map((driver) => (
                      <MenuItem key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName} • {driver.employeeCode}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsAssignOpen(false)} color="secondary" disabled={assignmentSaving}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleAssignmentSave()}
                variant="contained"
                disabled={loadingDrivers || assignmentSaving}
              >
                {assignmentSaving ? 'Saving…' : 'Save'}
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
                {canManageVehicleStatus && (
                  <Button variant="outlined" onClick={handleStatusDialogOpen}>
                    Change Status
                  </Button>
                )}
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
          <Dialog
            open={isStatusDialogOpen}
            onClose={() => !savingStatus && setIsStatusDialogOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Change vehicle status</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
              {statusError && <Alert severity="error">{statusError}</Alert>}
              <FormControl fullWidth>
                <InputLabel id="vehicle-status-label">Status</InputLabel>
                <Select
                  labelId="vehicle-status-label"
                  value={selectedStatus}
                  label="Status"
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Maintenance">Maintenance</MenuItem>
                </Select>
              </FormControl>
              {selectedStatus === 'Maintenance' && (
                <TextField
                  label="Incident / maintenance reason"
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  required
                  multiline
                  minRows={3}
                  helperText="Saving creates an unplanned work order and removes the vehicle from service."
                />
              )}
              {vehicle?.status === 'Maintenance' && selectedStatus === 'Active' && (
                <FormHelperText>
                  The vehicle cannot return to service until its unplanned maintenance work order is completed.
                </FormHelperText>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsStatusDialogOpen(false)} disabled={savingStatus}>Cancel</Button>
              <Button
                variant="contained"
                onClick={() => void handleStatusSave()}
                disabled={savingStatus || !selectedStatus || (selectedStatus === 'Maintenance' && !statusReason.trim())}
              >
                {savingStatus ? 'Saving…' : 'Save status'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      ) : (
        <Typography>No vehicle found.</Typography>
      )}
    </Box>
  );
};

export default VehicleDetailPage;
