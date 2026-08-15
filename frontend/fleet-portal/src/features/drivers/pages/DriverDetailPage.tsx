import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import { Email, Phone, Badge, CalendarToday } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { fetchDriverById } from '../../../api/fleetApi';
import type { Driver } from '../../../api/types';

const DriverDetailPage: React.FC = () => {
  const { id } = useParams();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDriver = async () => {
      if (!id) return;

      try {
        const data = await fetchDriverById(id);
        setDriver(data ?? null);
      } catch {
        setError('Unable to load driver details.');
      } finally {
        setLoading(false);
      }
    };

    loadDriver();
  }, [id]);

  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        title="Driver Details"
        subtitle="View driver contact details, licence status, and compliance history."
        onBack={() => navigate(-1)}
      />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : driver ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="h6">{driver.firstName} {driver.lastName}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {driver.email} • {driver.phoneNumber}
                  </Typography>
                </Box>
                <Chip label={driver.status} color={driver.status.toLowerCase() === 'active' ? 'success' : 'default'} />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Badge color="primary" />
                    <Typography variant="caption" color="text.secondary">License number</Typography>
                  </Box>
                  <Typography variant="h6">{driver.licenseNumber}</Typography>
                </Box>
                <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <CalendarToday color="primary" />
                    <Typography variant="caption" color="text.secondary">Joined</Typography>
                  </Box>
                  <Typography variant="h6">{new Date(driver.joiningDate).toLocaleDateString()}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Contact & compliance</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Email color="action" />
                  <Typography variant="body2">{driver.email}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Phone color="action" />
                  <Typography variant="body2">{driver.phoneNumber}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Typography>No driver found.</Typography>
      )}
    </Box>
  );
};

export default DriverDetailPage;
