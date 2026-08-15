import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, onBack, backLabel }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: { xs: 'flex-start', md: 'center' },
      flexDirection: { xs: 'column', md: 'row' },
      gap: 2,
      mb: 1,
    }}
  >
    <Box>
      <Typography variant="h1" sx={{ fontSize: '30px', fontWeight: 700, color: '#191b23' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: '#434655', mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {onBack && (
        <Button
          variant="text"
          startIcon={<ArrowBack />}
          onClick={onBack}
          sx={{ color: 'text.primary', textTransform: 'none' }}
        >
          {backLabel ?? 'Back'}
        </Button>
      )}
      {action}
    </Box>
  </Box>
);

export default PageHeader;
