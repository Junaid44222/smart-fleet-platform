import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AccountCircle, Email, Phone, Shield } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import { canManageUsers } from '../../../auth/rolePermissions';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { userName, userRole } = useSelector((state: { auth: { userName: string; userRole: string } }) => state.auth);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Profile"
        subtitle="Manage your account preferences and fleet access details."
        onBack={() => navigate(-1)}
      />

      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AccountCircle sx={{ fontSize: 52, color: 'primary.main' }} />
            <Box>
              <Typography variant="h3">{userName || 'Fleet user'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {userRole} • Smart Fleet Platform
              </Typography>
            </Box>
          </Box>
          <Chip label={userRole} color={canManageUsers(userRole) ? 'success' : 'default'} />
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Email color="action" />
            <Typography variant="body2">manager@smartfleet.example</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Phone color="action" />
            <Typography variant="body2">+1 (555) 014-2288</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Shield color="action" />
            <Typography variant="body2">Two-factor authentication enabled</Typography>
          </Box>
        </Box>
      </CardContent>
      </Card>
    </Box>
  );
};

export default ProfilePage;
