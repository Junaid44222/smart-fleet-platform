import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  Typography,
} from '@mui/material';
import PageHeader from '../../../components/PageHeader';
import { fetchDrivers, createDriver } from '../../../api/fleetApi';
import type { Driver } from '../../../api/types';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const DriverListPage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [newDriver, setNewDriver] = useState<Partial<Omit<Driver, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'>>>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    licenseNumber: '',
    licenseExpiryDate: '',
    joiningDate: '',
    status: 'Active',
  });

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const data = await fetchDrivers();
        setDrivers(data);
      } catch {
        setError('Unable to load drivers at this time.');
      } finally {
        setLoading(false);
      }
    };

    loadDrivers();
  }, []);

  const handleOpenAddDialog = () => {
    setFormError('');
    setNewDriver({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      licenseNumber: '',
      licenseExpiryDate: '',
      joiningDate: '',
      status: 'Active',
    });
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    if (!submitting) {
      setOpenAddDialog(false);
    }
  };

  const handleFieldChange = (field: keyof typeof newDriver, value: string) => {
    setNewDriver((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddDriver = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (!newDriver.firstName?.trim() || !newDriver.lastName?.trim()) {
      setFormError('First and last name are required.');
      return;
    }

    if (!newDriver.email?.trim() || !newDriver.phoneNumber?.trim()) {
      setFormError('Email and phone number are required.');
      return;
    }

    if (!newDriver.licenseNumber?.trim() || !newDriver.licenseExpiryDate || !newDriver.joiningDate) {
      setFormError('License details and joining date are required.');
      return;
    }

    setSubmitting(true);

    try {
      await createDriver({
        employeeCode: newDriver.employeeCode ?? `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
        firstName: newDriver.firstName?.trim() ?? '',
        lastName: newDriver.lastName?.trim() ?? '',
        email: newDriver.email?.trim() ?? '',
        phoneNumber: newDriver.phoneNumber?.trim() ?? '',
        licenseNumber: newDriver.licenseNumber?.trim() ?? '',
        licenseExpiryDate: new Date(newDriver.licenseExpiryDate ?? '').toISOString(),
        joiningDate: new Date(newDriver.joiningDate ?? '').toISOString(),
        status: newDriver.status ?? 'Active',
      });

      setToast({ open: true, message: 'Driver added successfully!', severity: 'success' });
      setOpenAddDialog(false);
      const refreshed = await fetchDrivers();
      setDrivers(refreshed);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setFormError(apiError.response?.data?.message || 'Failed to add driver.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Driver Roster"
        subtitle="Browse current drivers and view profiles."
        onBack={() => navigate(-1)}
        action={
          userRole === 'Admin' ? (
            <Button variant="contained" color="primary" onClick={handleOpenAddDialog}>
              Add Driver
            </Button>
          ) : null
        }
      />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
          {drivers.map((driver) => (
            <Card
              key={driver.id}
              onClick={() => navigate(`/drivers/${driver.id}`)}
              sx={{
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Typography variant="h6">{driver.firstName} {driver.lastName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {driver.email}
                </Typography>
                <Typography variant="subtitle2" sx={{ mt: 1 }}>
                  Status: {driver.status}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Driver</DialogTitle>
        <form onSubmit={handleAddDriver}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Employee Code"
              fullWidth
              value={newDriver.employeeCode ?? ''}
              onChange={(event) => handleFieldChange('employeeCode', event.target.value)}
              placeholder="DRV-1234"
              disabled={submitting}
            />
            <TextField
              label="First Name"
              fullWidth
              required
              value={newDriver.firstName ?? ''}
              onChange={(event) => handleFieldChange('firstName', event.target.value)}
              disabled={submitting}
            />
            <TextField
              label="Last Name"
              fullWidth
              required
              value={newDriver.lastName ?? ''}
              onChange={(event) => handleFieldChange('lastName', event.target.value)}
              disabled={submitting}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={newDriver.email ?? ''}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              disabled={submitting}
            />
            <TextField
              label="Phone Number"
              fullWidth
              required
              value={newDriver.phoneNumber ?? ''}
              onChange={(event) => handleFieldChange('phoneNumber', event.target.value)}
              disabled={submitting}
            />
            <TextField
              label="License Number"
              fullWidth
              required
              value={newDriver.licenseNumber ?? ''}
              onChange={(event) => handleFieldChange('licenseNumber', event.target.value)}
              disabled={submitting}
            />
            <TextField
              label="License Expiry"
              type="date"
              fullWidth
              required
              value={newDriver.licenseExpiryDate ?? ''}
              onChange={(event) => handleFieldChange('licenseExpiryDate', event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled={submitting}
            />
            <TextField
              label="Joining Date"
              type="date"
              fullWidth
              required
              value={newDriver.joiningDate ?? ''}
              onChange={(event) => handleFieldChange('joiningDate', event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled={submitting}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddDialog} color="secondary" disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Driver'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast((prev) => ({ ...prev, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DriverListPage;
