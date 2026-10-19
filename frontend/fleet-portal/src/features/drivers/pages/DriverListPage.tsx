import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  Typography,
  IconButton,
  Tooltip,
  MenuItem,
} from '@mui/material';
import { DeleteOutlined, Edit } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import { fetchDrivers, createDriver, updateDriver, deleteDriver } from '../../../api/fleetApi';
import type { Driver } from '../../../api/types';
import { canCreateDriver, canDeleteDriver, canUpdateDriver } from '../../../auth/rolePermissions';

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
  const userCanCreateDriver = canCreateDriver(userRole);
  const userCanUpdateDriver = canUpdateDriver(userRole);
  const userCanDeleteDriver = canDeleteDriver(userRole);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
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
    if (!userCanCreateDriver) return;
    setEditingDriver(null);
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

  const handleOpenEditDialog = (driver: Driver) => {
    if (!userCanUpdateDriver) return;
    setEditingDriver(driver);
    setFormError('');
    setNewDriver({
      employeeCode: driver.employeeCode,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phoneNumber: driver.phoneNumber,
      licenseNumber: driver.licenseNumber,
      licenseExpiryDate: driver.licenseExpiryDate.slice(0, 10),
      joiningDate: driver.joiningDate.slice(0, 10),
      status: driver.status,
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
      const payload = {
        employeeCode: newDriver.employeeCode ?? `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
        firstName: newDriver.firstName?.trim() ?? '',
        lastName: newDriver.lastName?.trim() ?? '',
        email: newDriver.email?.trim() ?? '',
        phoneNumber: newDriver.phoneNumber?.trim() ?? '',
        licenseNumber: newDriver.licenseNumber?.trim() ?? '',
        licenseExpiryDate: new Date(newDriver.licenseExpiryDate ?? '').toISOString(),
        joiningDate: new Date(newDriver.joiningDate ?? '').toISOString(),
        status: newDriver.status ?? 'Active',
      };
      if (editingDriver) {
        await updateDriver(editingDriver.id, payload);
      } else {
        await createDriver(payload);
      }

      setToast({
        open: true,
        message: editingDriver ? 'Driver updated successfully.' : 'Driver added successfully.',
        severity: 'success',
      });
      setOpenAddDialog(false);
      setEditingDriver(null);
      const refreshed = await fetchDrivers();
      setDrivers(refreshed);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setFormError(apiError.response?.data?.message || 'Failed to add driver.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDriver = async () => {
    if (!driverToDelete || !userCanDeleteDriver) return;
    setSubmitting(true);
    try {
      await deleteDriver(driverToDelete.id);
      setDriverToDelete(null);
      setToast({ open: true, message: 'Driver deleted successfully.', severity: 'success' });
      setDrivers(await fetchDrivers());
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setToast({
        open: true,
        message: apiError.response?.data?.message || 'Failed to delete driver.',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      id: 'fullName',
      label: 'Driver',
      searchValue: (row: Driver) => `${row.firstName} ${row.lastName} ${row.employeeCode}`,
      sortValue: (row: Driver) => `${row.firstName} ${row.lastName}`,
      render: (row: Driver) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.firstName} {row.lastName}</Typography>,
    },
    {
      id: 'email',
      label: 'Email',
      searchValue: (row: Driver) => row.email,
      sortValue: (row: Driver) => row.email,
      render: (row: Driver) => <Typography variant="body2">{row.email}</Typography>,
    },
    {
      id: 'phoneNumber',
      label: 'Phone',
      searchValue: (row: Driver) => row.phoneNumber,
      sortValue: (row: Driver) => row.phoneNumber,
      render: (row: Driver) => <Typography variant="body2">{row.phoneNumber}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      searchValue: (row: Driver) => row.status,
      sortValue: (row: Driver) => row.status,
      render: (row: Driver) => <Typography variant="body2">{row.status}</Typography>,
    },
    {
      id: 'actions',
      label: 'Actions',
      searchable: false,
      sortable: false,
      render: (row: Driver) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          {userCanUpdateDriver && (
            <Tooltip title="Edit driver">
              <IconButton aria-label={`Edit ${row.firstName} ${row.lastName}`} onClick={(event) => {
                event.stopPropagation();
                handleOpenEditDialog(row);
              }}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {userCanDeleteDriver && (
            <Tooltip title="Delete driver">
              <IconButton color="error" aria-label={`Delete ${row.firstName} ${row.lastName}`} onClick={(event) => {
                event.stopPropagation();
                setDriverToDelete(row);
              }}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Driver Roster"
        subtitle="Browse current drivers and view profiles."
        onBack={() => navigate(-1)}
        action={
          userCanCreateDriver ? (
            <Button variant="contained" color="primary" onClick={handleOpenAddDialog}>
              Add Driver
            </Button>
          ) : null
        }
      />
      {loading ? (
        <DataTable columns={columns} rows={drivers} getRowId={(row) => row.id} loading />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <DataTable
          columns={columns}
          rows={drivers}
          getRowId={(row) => row.id}
          onRowClick={(row) => navigate(`/drivers/${row.id}`)}
          searchPlaceholder="Quick search drivers..."
          emptyMessage="No drivers are available yet."
        />
      )}

      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
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
            <TextField
              select
              label="Status"
              value={newDriver.status ?? 'Active'}
              onChange={(event) => handleFieldChange('status', event.target.value)}
              disabled={submitting}
            >
              {['Active', 'Inactive', 'OnLeave'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddDialog} color="secondary" disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Saving...' : editingDriver ? 'Save Changes' : 'Add Driver'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(driverToDelete)} onClose={() => !submitting && setDriverToDelete(null)}>
        <DialogTitle>Delete driver?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete {driverToDelete?.firstName} {driverToDelete?.lastName}? This also releases any active vehicle assignment.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDriverToDelete(null)} disabled={submitting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteDriver()} disabled={submitting}>
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
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
