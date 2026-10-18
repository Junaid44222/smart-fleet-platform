import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, TextField, Typography, Alert } from '@mui/material';
import { Link } from '@mui/material';
import { login } from '../authSlice';
import { apiClient, setAuthToken } from '../../../api/apiClient';
import type { ApiResponse } from '../../../api/types';

const LoginPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      const response = await apiClient.post<ApiResponse<null>>('/identity/Auth/login', {
        email,
        password,
      });

      if (response.data.success && response.data.token) {
        const token = response.data.token;
        const userName = response.data.fullName || email;
        const userRole = response.data.role || 'Dispatcher';
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUserName', userName);
        localStorage.setItem('authUserRole', userRole);
        setAuthToken(token);
        dispatch(login({ userName, userRole }));
        navigate('/dashboard');
      } else {
        setError(response.data.message ?? 'Invalid login attempt');
      }
    } catch {
      setError('Login failed. Please check your credentials and try again.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Sign in to Smart Fleet
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" variant="contained" size="large">
              Sign In
            </Button>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Don't have an account? <Link href="/register">Register</Link></Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
