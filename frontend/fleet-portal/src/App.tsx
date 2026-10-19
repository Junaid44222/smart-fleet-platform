import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import { theme } from './theme';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import VehicleListPage from './features/vehicles/pages/VehicleListPage';
import VehicleDetailPage from './features/vehicles/pages/VehicleDetailPage';
import DriverListPage from './features/drivers/pages/DriverListPage';
import DriverDetailPage from './features/drivers/pages/DriverDetailPage';
import MaintenanceDashboardPage from './features/maintenance/pages/MaintenanceDashboardPage';
import FuelDashboardPage from './features/fuel/pages/FuelDashboardPage';
import AIAssistantPage from './features/ai-assistant/pages/AIAssistantPage';
import ProfilePage from './features/profile/pages/ProfilePage';
import UserManagementPage from './features/auth/pages/UserManagementPage';
import { canManageUsers } from './auth/rolePermissions';

const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userName, userRole } = useSelector((state: { auth: { userName: string; userRole: string } }) => state.auth);
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'FM';

  return (
    <MainLayout userName={userName || 'Fleet Manager'} userInitials={initials} userRole={userRole}>
      {children}
    </MainLayout>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, userRole } = useSelector((state: { auth: { isAuthenticated: boolean; userRole: string } }) => state.auth);
  const userCanManageUsers = canManageUsers(userRole);

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={isAuthenticated ? <AuthenticatedLayout><DashboardPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/vehicles" element={isAuthenticated ? <AuthenticatedLayout><VehicleListPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/vehicles/:id" element={isAuthenticated ? <AuthenticatedLayout><VehicleDetailPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/drivers" element={isAuthenticated ? <AuthenticatedLayout><DriverListPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/drivers/:id" element={isAuthenticated ? <AuthenticatedLayout><DriverDetailPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/maintenance" element={isAuthenticated ? <AuthenticatedLayout><MaintenanceDashboardPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/fuel" element={isAuthenticated ? <AuthenticatedLayout><FuelDashboardPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/ai-assistant" element={isAuthenticated ? <AuthenticatedLayout><AIAssistantPage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/profile" element={isAuthenticated ? <AuthenticatedLayout><ProfilePage /></AuthenticatedLayout> : <Navigate to="/login" />} />
      <Route path="/users" element={isAuthenticated && userCanManageUsers ? <AuthenticatedLayout><UserManagementPage /></AuthenticatedLayout> : <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <Provider store={store}>
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  </Provider>
);

export default App;
