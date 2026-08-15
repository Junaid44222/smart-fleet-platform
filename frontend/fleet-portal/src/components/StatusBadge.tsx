import React from 'react';
import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';

interface StatusBadgeProps extends Omit<ChipProps, 'color'> {
  status: 'active' | 'inactive' | 'maintenance' | 'alert' | 'warning' | 'success' | 'error';
}

type StatusColor = NonNullable<ChipProps['color']>;

const statusConfig: Record<StatusBadgeProps['status'], { color: StatusColor }> = {
  active: { color: 'success' },
  inactive: { color: 'default' },
  maintenance: { color: 'warning' },
  alert: { color: 'error' },
  warning: { color: 'warning' },
  success: { color: 'success' },
  error: { color: 'error' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, ...props }) => {
  const config = statusConfig[status];

  return (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      size="small"
      {...props}
      color={config.color}
      variant="filled"
      sx={{
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        ...props.sx,
      }}
    />
  );
};

export default StatusBadge;
