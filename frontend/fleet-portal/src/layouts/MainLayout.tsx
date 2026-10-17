import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  AppBar,
  Drawer,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  IconButton,
  Container,
  CircularProgress,
  Divider,
  InputBase,
  Chip,
  Paper,
  Popover,
  Popper,
  Tooltip,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Dashboard as DashboardIcon,
  DirectionsCar as VehiclesIcon,
  People as DriversIcon,
  LocalGasStation as FuelIcon,
  Build as MaintenanceIcon,
  Route as TripsIcon,
  Analytics as AnalyticsIcon,
  SmartToy as AiIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Person as ProfileIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  WarningAmber,
} from '@mui/icons-material';
import { fetchDashboardStats, fetchDrivers, fetchVehicles } from '../api/fleetApi';
import type { DashboardOverview, Driver, Vehicle } from '../api/types';
import { setAuthToken } from '../api/apiClient';
import { logout } from '../features/auth/authSlice';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Vehicles', path: '/vehicles', icon: <VehiclesIcon /> },
  { label: 'Drivers', path: '/drivers', icon: <DriversIcon /> },
  { label: 'Trips', path: '/trips', icon: <TripsIcon />, disabled: true },
  { label: 'Maintenance', path: '/maintenance', icon: <MaintenanceIcon /> },
  { label: 'Fuel', path: '/fuel', icon: <FuelIcon /> },
  { label: 'Analytics', path: '/analytics', icon: <AnalyticsIcon />, disabled: true },
  { label: 'AI Assistant', path: '/ai-assistant', icon: <AiIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon />, disabled: true },
];

interface MainLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userInitials?: string;
}

interface SearchResult {
  label: string;
  detail: string;
  path: string;
  kind: 'vehicle' | 'driver';
}

const sidebarBackground = '#0f172a';
const sidebarText = '#cbd5e1';
const sidebarActiveText = '#ffffff';

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName = 'Fleet Manager',
  userInitials = 'FM',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchAnchorEl, setSearchAnchorEl] = useState<HTMLDivElement | null>(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<HTMLElement | null>(null);
  const [notificationsData, setNotificationsData] = useState<DashboardOverview | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUserName');
    localStorage.removeItem('authUserRole');
    setAuthToken(null);
    dispatch(logout());
    handleMenuClose();
    navigate('/login', { replace: true });
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) {
      setSearchResults(null);
      setSearchError('');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    setSearchResults(null);

    try {
      const [vehicles, drivers] = await Promise.all([fetchVehicles(), fetchDrivers()]);
      const vehicleResults: SearchResult[] = vehicles
        .filter((vehicle: Vehicle) =>
          [vehicle.vehicleNumber, vehicle.manufacturer, vehicle.model, String(vehicle.year)]
            .some((value) => value.toLocaleLowerCase().includes(query)))
        .map((vehicle) => ({
          label: vehicle.vehicleNumber,
          detail: `${vehicle.manufacturer} ${vehicle.model} · ${vehicle.year}`,
          path: `/vehicles/${vehicle.id}`,
          kind: 'vehicle',
        }));
      const driverResults: SearchResult[] = drivers
        .filter((driver: Driver) =>
          [driver.firstName, driver.lastName, driver.employeeCode, driver.email]
            .some((value) => value.toLocaleLowerCase().includes(query)))
        .map((driver) => ({
          label: `${driver.firstName} ${driver.lastName}`,
          detail: `${driver.employeeCode} · ${driver.email}`,
          path: `/drivers/${driver.id}`,
          kind: 'driver',
        }));

      setSearchResults([...vehicleResults, ...driverResults].slice(0, 8));
    } catch {
      setSearchError('Unable to search fleet records. Check your connection and try again.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleNotificationsOpen = async (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
    setNotificationsError('');
    setNotificationsLoading(true);
    try {
      setNotificationsData(await fetchDashboardStats());
    } catch {
      setNotificationsError('Unable to load current fleet alerts.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const maintenanceDueCount = notificationsData?.stats.maintenanceDueCount ?? 0;
  const safetyScore = notificationsData?.stats.safetyScore ?? 100;
  const notificationCount = maintenanceDueCount + (safetyScore < 80 ? 1 : 0);

  useEffect(() => {
    void fetchDashboardStats()
      .then(setNotificationsData)
      .catch(() => undefined);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: sidebarBackground }}>
      <Box sx={{ px: 2.5, py: 3, borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: sidebarActiveText }}>
          Smart Fleet
        </Typography>
        <Typography variant="caption" sx={{ color: sidebarText }}>
          Intelligence Platform
        </Typography>
      </Box>

      <List sx={{ flex: 1, px: 1.5, py: 2 }}>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  navigate(item.path);
                  setSidebarOpen(false);
                }
              }}
              selected={isActive(item.path)}
              sx={{
                borderRadius: '4px',
                minHeight: 44,
                color: isActive(item.path) ? sidebarActiveText : sidebarText,
                backgroundColor: isActive(item.path) ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                borderLeft: isActive(item.path) ? '4px solid #2563eb' : '4px solid transparent',
                pl: isActive(item.path) ? '12px' : '16px',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(37, 99, 235, 0.18)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(37, 99, 235, 0.24)',
                },
                '&:hover': {
                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                },
                '&.Mui-disabled': {
                  opacity: 0.45,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive(item.path) ? '#60a5fa' : sidebarText,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: { fontSize: '14px', fontWeight: isActive(item.path) ? 600 : 500 },
                  },
                }}
              />
              {item.disabled && (
                <Chip label="Soon" size="small" sx={{ height: 20, fontSize: '10px', bgcolor: 'rgba(148, 163, 184, 0.15)', color: sidebarText }} />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: 260,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 260,
              boxSizing: 'border-box',
              bgcolor: sidebarBackground,
              border: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {isMobile && (
        <Drawer
          anchor="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              bgcolor: sidebarBackground,
              border: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          sx={{
            backgroundColor: '#ffffff',
            color: 'text.primary',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
            borderBottom: '1px solid #e2e8f0',
            zIndex: 10,
          }}
        >
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: { xs: 2, md: 3 }, minHeight: 64 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              {isMobile && (
                <IconButton edge="start" color="inherit" aria-label="menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
                  {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
                </IconButton>
              )}
              <Box
                ref={setSearchAnchorEl}
                component="form"
                role="search"
                onSubmit={handleSearch}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  bgcolor: '#f8fafc',
                  maxWidth: 420,
                  flex: 1,
                }}
              >
                <SearchIcon sx={{ color: '#64748b', fontSize: 20 }} />
                <InputBase
                  placeholder="Search fleet, drivers, vehicles..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  inputProps={{ 'aria-label': 'Search fleet, drivers, vehicles' }}
                  sx={{ flex: 1, fontSize: '14px' }}
                />
                <Tooltip title="Search">
                  <span>
                    <IconButton type="submit" size="small" aria-label="Search" disabled={searchLoading || !searchQuery.trim()}>
                      {searchLoading ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <Popper
                open={searchLoading || Boolean(searchError) || searchResults !== null}
                anchorEl={searchAnchorEl}
                placement="bottom-start"
                sx={{ zIndex: 1300, width: { md: 420 }, maxWidth: 'calc(100vw - 32px)' }}
              >
                <Paper elevation={8} sx={{ mt: 1, maxHeight: 360, overflowY: 'auto' }}>
                  {searchLoading && <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>}
                  {searchError && <Alert severity="error" sx={{ m: 1 }}>{searchError}</Alert>}
                  {!searchLoading && !searchError && searchResults?.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No matching vehicles or drivers.
                    </Typography>
                  )}
                  {!searchLoading && searchResults?.map((result) => (
                    <ListItemButton
                      key={`${result.kind}-${result.path}`}
                      onClick={() => {
                        navigate(result.path);
                        setSearchResults(null);
                        setSearchQuery('');
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {result.kind === 'vehicle' ? <VehiclesIcon fontSize="small" /> : <DriversIcon fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText primary={result.label} secondary={result.detail} />
                    </ListItemButton>
                  ))}
                </Paper>
              </Popper>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Notifications">
              <IconButton aria-label="Notifications" onClick={handleNotificationsOpen} sx={{ color: 'text.secondary' }}>
                <Badge badgeContent={notificationCount} color="error" showZero={false}>
                  <NotificationsIcon />
                </Badge>
              </IconButton>
              </Tooltip>

              <Popover
                open={Boolean(notificationsAnchorEl)}
                anchorEl={notificationsAnchorEl}
                onClose={() => setNotificationsAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <Box sx={{ width: 340, maxWidth: 'calc(100vw - 32px)' }}>
                  <Typography variant="h6" sx={{ px: 2, py: 1.5 }}>Fleet alerts</Typography>
                  <Divider />
                  {notificationsLoading && <Box sx={{ display: 'grid', placeItems: 'center', p: 3 }}><CircularProgress size={24} /></Box>}
                  {notificationsError && <Alert severity="error" sx={{ m: 2 }}>{notificationsError}</Alert>}
                  {!notificationsLoading && !notificationsError && maintenanceDueCount === 0 && safetyScore >= 80 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
                      No active fleet alerts.
                    </Typography>
                  )}
                  {!notificationsLoading && !notificationsError && maintenanceDueCount > 0 && (
                    <List disablePadding>
                      <ListItemButton onClick={() => { navigate('/maintenance'); setNotificationsAnchorEl(null); }}>
                        <ListItemIcon><MaintenanceIcon color="warning" /></ListItemIcon>
                        <ListItemText
                          primary={`${maintenanceDueCount} maintenance item${maintenanceDueCount === 1 ? '' : 's'} due`}
                          secondary="Due within the next 30 days"
                        />
                      </ListItemButton>
                    </List>
                  )}
                  {!notificationsLoading && !notificationsError && safetyScore < 80 && (
                    <List disablePadding>
                      <ListItemButton onClick={() => { navigate('/dashboard'); setNotificationsAnchorEl(null); }}>
                        <ListItemIcon><WarningAmber color="error" /></ListItemIcon>
                        <ListItemText primary="Fleet safety score needs attention" secondary={`Current score: ${safetyScore}/100`} />
                      </ListItemButton>
                    </List>
                  )}
                </Box>
              </Popover>

              <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
                <Avatar sx={{ width: 36, height: 36, backgroundColor: 'primary.main', fontSize: '14px' }}>
                  {userInitials}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem disabled>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {userName}
                  </Typography>
                </MenuItem>
                <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
                  <ProfileIcon sx={{ mr: 1, fontSize: '20px' }} />
                  Profile
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1, fontSize: '20px' }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 3 } }}>
          <Container maxWidth="xl" disableGutters>
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
