import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Typography,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import { fetchVehicles, createVehicle } from '../../../api/fleetApi';
import type { Vehicle } from '../../../api/types';
import PageHeader from '../../../components/PageHeader';
import FilterBar from '../../../components/FilterBar';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Maintenance', value: 'maintenance' },
];

type VehicleStatusBadge = 'active' | 'inactive' | 'maintenance';

const toVehicleStatus = (status: string): VehicleStatusBadge => {
  const normalized = status.toLowerCase();
  return normalized === 'inactive' || normalized === 'maintenance' ? normalized : 'active';
};

const VehicleListPage: React.FC = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog state
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicleNumber: '',
    manufacturer: '',
    model: '',
    year: new Date().getFullYear(),
    fuelCapacity: 60,
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Snackbar notification
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await fetchVehicles();
      setVehicles(data);
    } catch {
      setError('Unable to load vehicles at this time.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleOpenAddDialog = () => {
    setNewVehicle({
      vehicleNumber: '',
      manufacturer: '',
      model: '',
      year: new Date().getFullYear(),
      fuelCapacity: 60,
    });
    setFormError('');
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    if (!submitting) {
      setOpenAddDialog(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setNewVehicle((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!newVehicle.vehicleNumber.trim()) {
      setFormError('Registration number is required.');
      return;
    }
    if (!newVehicle.manufacturer.trim()) {
      setFormError('Manufacturer is required.');
      return;
    }
    if (!newVehicle.model.trim()) {
      setFormError('Model is required.');
      return;
    }
    if (!newVehicle.year || newVehicle.year < 1900 || newVehicle.year > new Date().getFullYear() + 2) {
      setFormError('Please enter a valid year.');
      return;
    }
    if (!newVehicle.fuelCapacity || newVehicle.fuelCapacity <= 0) {
      setFormError('Fuel capacity must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await createVehicle({
        vehicleNumber: newVehicle.vehicleNumber,
        manufacturer: newVehicle.manufacturer,
        model: newVehicle.model,
        year: Number(newVehicle.year),
        fuelCapacity: Number(newVehicle.fuelCapacity),
      });
      setToast({
        open: true,
        message: 'Vehicle added successfully!',
        severity: 'success',
      });
      setOpenAddDialog(false);
      loadVehicles(); // Refresh table
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setFormError(apiError.response?.data?.message || 'Failed to create vehicle.');
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side filtering logic
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
      vehicle.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || vehicle.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      id: 'vehicleNumber',
      label: 'Registration Number',
      render: (row: Vehicle) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
          {row.vehicleNumber}
        </Typography>
      ),
    },
    {
      id: 'makeModel',
      label: 'Make & Model',
      render: (row: Vehicle) => (
        <Typography variant="body2">
          {row.manufacturer} {row.model}
        </Typography>
      ),
    },
    {
      id: 'year',
      label: 'Year',
      render: (row: Vehicle) => <Typography variant="body2">{row.year}</Typography>,
    },
    {
      id: 'fuelCapacity',
      label: 'Fuel Capacity',
      render: (row: Vehicle) => <Typography variant="body2">{row.fuelCapacity} L</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      render: (row: Vehicle) => (
        <StatusBadge status={toVehicleStatus(row.status)} />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (row: Vehicle) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/vehicles/${row.id}`);
              }}
            >
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Vehicle Inventory"
        subtitle="Manage and track details of your fleet vehicles"
        onBack={() => navigate(-1)}
        action={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleOpenAddDialog}
          >
            Add Vehicle
          </Button>
        }
      />

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by number, make, model..."
            statusValue={statusFilter}
            onStatusChange={setStatusFilter}
            statusOptions={statusOptions}
          />
          <DataTable
            columns={columns}
            rows={filteredVehicles}
            getRowId={(row) => row.id}
            onRowClick={(row) => navigate(`/vehicles/${row.id}`)}
            loading={loading}
            emptyMessage="No vehicles match your filter criteria."
          />
        </>
      )}

      {/* Add Vehicle Dialog */}
      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Vehicle</DialogTitle>
        <form onSubmit={handleAddVehicle}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Registration Number"
              fullWidth
              required
              value={newVehicle.vehicleNumber}
              onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
              placeholder="e.g., MH-12-AB-1234"
              disabled={submitting}
            />
            <TextField
              label="Manufacturer"
              fullWidth
              required
              value={newVehicle.manufacturer}
              onChange={(e) => handleInputChange('manufacturer', e.target.value)}
              placeholder="e.g., Ford, Toyota"
              disabled={submitting}
            />
            <TextField
              label="Model"
              fullWidth
              required
              value={newVehicle.model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              placeholder="e.g., Transit, Camry"
              disabled={submitting}
            />
            <TextField
              label="Year"
              type="number"
              fullWidth
              required
              value={newVehicle.year}
              onChange={(e) => handleInputChange('year', Number(e.target.value))}
              disabled={submitting}
            />
            <TextField
              label="Fuel Capacity (Liters)"
              type="number"
              fullWidth
              required
              value={newVehicle.fuelCapacity}
              onChange={(e) => handleInputChange('fuelCapacity', Number(e.target.value))}
              disabled={submitting}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddDialog} color="secondary" disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Vehicle'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={toast.severity} onClose={() => setToast((prev) => ({ ...prev, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VehicleListPage;

