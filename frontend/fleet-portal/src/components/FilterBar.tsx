import React from 'react';
import { Box, TextField, MenuItem } from '@mui/material';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchEnabled?: boolean;
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: FilterOption[];
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchEnabled = true,
  statusValue,
  onStatusChange,
  statusOptions = [],
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      gap: 2,
      mb: 2,
    }}
  >
    {searchEnabled && onSearchChange && (
      <TextField
        fullWidth
        size="small"
        placeholder={searchPlaceholder}
        value={searchValue ?? ''}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    )}
    {statusOptions.length > 0 && onStatusChange && (
      <TextField
        select
        size="small"
        label="Status"
        value={statusValue ?? 'all'}
        onChange={(event) => onStatusChange(event.target.value)}
        sx={{ minWidth: { md: 180 } }}
      >
        <MenuItem value="all">All statuses</MenuItem>
        {statusOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    )}
  </Box>
);

export default FilterBar;
