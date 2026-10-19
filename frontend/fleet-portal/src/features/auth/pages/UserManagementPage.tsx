import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { DeleteOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import { assignableRoles, deleteManagedUser, fetchManagedUsers, updateUserRole } from '../../../api/identityApi';
import type { ManagedUser } from '../../../api/identityApi';
import { canDeleteUsers } from '../../../auth/rolePermissions';

const UserManagementPage: React.FC = () => {
  const userRole = useSelector((state: { auth: { userRole: string } }) => state.auth.userRole);
  const userCanDeleteUsers = canDeleteUsers(userRole);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setError('');
    try {
      const data = await fetchManagedUsers();
      setUsers(data);
      setSelectedRoles(Object.fromEntries(data.map((user) => [user.id, user.role])));
    } catch {
      setError('Unable to load users. Only administrators can manage roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const saveRole = async (user: ManagedUser) => {
    const role = selectedRoles[user.id];
    if (!role || role === user.role) return;

    setSavingUserId(user.id);
    setError('');
    setSuccess('');
    try {
      await updateUserRole(user.id, role);
      setUsers((currentUsers) => currentUsers.map((currentUser) =>
        currentUser.id === user.id ? { ...currentUser, role } : currentUser));
      setSuccess(`Updated ${user.fullName} to ${role}.`);
    } catch {
      setError(`Unable to update ${user.fullName}'s role.`);
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteUser = async () => {
    if (!deletingUser || !userCanDeleteUsers) return;
    setDeletingUserId(deletingUser.id);
    setError('');
    setSuccess('');
    try {
      await deleteManagedUser(deletingUser.id);
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== deletingUser.id));
      setSelectedRoles((currentRoles) => {
        const updatedRoles = { ...currentRoles };
        delete updatedRoles[deletingUser.id];
        return updatedRoles;
      });
      setSuccess(`Deleted ${deletingUser.fullName}.`);
      setDeletingUser(null);
    } catch (deleteError: unknown) {
      const apiMessage = (deleteError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(apiMessage || `Unable to delete ${deletingUser.fullName}.`);
    } finally {
      setDeletingUserId(null);
    }
  };

  const columns = [
    {
      id: 'fullName',
      label: 'Name',
      searchValue: (row: ManagedUser) => row.fullName,
      sortValue: (row: ManagedUser) => row.fullName,
      render: (row: ManagedUser) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.fullName}</Typography>,
    },
    {
      id: 'email',
      label: 'Email',
      searchValue: (row: ManagedUser) => row.email,
      sortValue: (row: ManagedUser) => row.email,
      render: (row: ManagedUser) => <Typography variant="body2">{row.email}</Typography>,
    },
    {
      id: 'role',
      label: 'Role',
      searchValue: (row: ManagedUser) => row.role,
      sortValue: (row: ManagedUser) => row.role,
      render: (row: ManagedUser) => {
        const roleCanBeAssigned = assignableRoles.includes(row.role as typeof assignableRoles[number]);
        return roleCanBeAssigned ? (
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <Select
              aria-label={`Role for ${row.fullName}`}
              value={selectedRoles[row.id] ?? row.role}
              onChange={(event) => setSelectedRoles((current) => ({
                ...current,
                [row.id]: event.target.value,
              }))}
            >
              {assignableRoles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
            </Select>
          </FormControl>
        ) : <Typography variant="body2">{row.role} (protected)</Typography>;
      },
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right' as const,
      width: 220,
      searchable: false,
      sortable: false,
      render: (row: ManagedUser) => {
        const roleCanBeAssigned = assignableRoles.includes(row.role as typeof assignableRoles[number]);
        const roleChanged = selectedRoles[row.id] !== row.role;
        return (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              disabled={!roleCanBeAssigned || !roleChanged || savingUserId === row.id}
              onClick={() => void saveRole(row)}
            >
              {savingUserId === row.id ? 'Saving…' : 'Save'}
            </Button>
            {userCanDeleteUsers && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteOutlined />}
                disabled={deletingUserId === row.id}
                onClick={() => setDeletingUser(row)}
              >
                Delete
              </Button>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <PageHeader title="User Management" subtitle="Assign fleet roles to registered users." />
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <DataTable
        columns={columns}
        rows={users}
        getRowId={(row) => row.id}
        loading={loading}
        searchPlaceholder="Quick search users..."
        emptyMessage="No registered users."
      />
      <Dialog open={Boolean(deletingUser)} onClose={() => !deletingUserId && setDeletingUser(null)}>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <Typography>Delete {deletingUser?.fullName} ({deletingUser?.email})? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingUser(null)} disabled={Boolean(deletingUserId)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void deleteUser()} disabled={Boolean(deletingUserId)}>
            {deletingUserId ? 'Deleting...' : 'Delete user'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagementPage;
