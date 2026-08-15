import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, TextField, Typography, Alert, Link } from '@mui/material';
import { apiClient } from '../../../api/apiClient';
import type { ApiResponse } from '../../../api/types';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await apiClient.post<ApiResponse<null>>('/identity/Auth/register', {
        fullName: name,
        email,
        password,
      });

      if (response.data.success) {
        setSuccess('Registration successful. Redirecting to login...');
        setTimeout(() => navigate('/login'), 1200);
      } else {
        setError(response.data.message ?? 'Registration failed');
      }
    } catch {
      setError('Registration failed. Please try again later.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 520, borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Create your Smart Fleet account
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <TextField label="Name" fullWidth required value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Email" type="email" fullWidth required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" fullWidth required value={password} onChange={(e) => setPassword(e.target.value)} />
            <TextField label="Confirm Password" type="password" fullWidth required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <Button type="submit" variant="contained" size="large">Create account</Button>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Already have an account? <Link href="/login">Sign in</Link></Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;
