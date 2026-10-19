import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  InputAdornment,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';

type SortValue = string | number | Date | null | undefined;

interface DataTableColumn<T> {
  id: string;
  label: string;
  render: (row: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  searchable?: boolean;
  sortable?: boolean;
  searchValue?: (row: T) => string;
  sortValue?: (row: T) => SortValue;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  initialSort?: { columnId: string; direction: 'asc' | 'desc' };
}

const getPropertyValue = <T,>(row: T, key: string): SortValue => {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
    ? value
    : undefined;
};

const asText = (value: SortValue) => value instanceof Date ? value.toISOString() : String(value ?? '');

const compareValues = (left: SortValue, right: SortValue) => {
  if (left instanceof Date || right instanceof Date) {
    const timestamp = (value: SortValue) => value instanceof Date
      ? value.getTime()
      : typeof value === 'number' ? value : Date.parse(value ?? '');
    return timestamp(left) - timestamp(right);
  }
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare(asText(left), asText(right));
};

function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  loading = false,
  emptyMessage = 'No records found.',
  searchPlaceholder = 'Quick search…',
  initialSort,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState(initialSort?.columnId ?? '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSort?.direction ?? 'asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rows;

    return rows.filter((row) => columns
      .filter((column) => column.searchable !== false)
      .some((column) => {
        const value = column.searchValue?.(row) ?? asText(getPropertyValue(row, column.id));
        return value.toLocaleLowerCase().includes(query);
      }));
  }, [columns, rows, search]);

  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.id === sortColumn);
    if (!column || column.sortable === false) return filteredRows;

    return [...filteredRows].sort((left, right) => {
      const leftValue = column.sortValue?.(left) ?? getPropertyValue(left, column.id);
      const rightValue = column.sortValue?.(right) ?? getPropertyValue(right, column.id);
      const comparison = compareValues(leftValue, rightValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [columns, filteredRows, sortColumn, sortDirection]);

  const pageCount = Math.ceil(sortedRows.length / rowsPerPage);
  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const pageRows = sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
    setPage(0);
  };

  if (loading) {
    return (
      <Paper sx={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)' }}>
        <Box sx={{ p: 2 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} height={40} sx={{ mb: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
        <TextField
          size="small"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          sx={{ width: { xs: '100%', sm: 340 }, bgcolor: 'background.paper' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}>
          {sortedRows.length} {sortedRows.length === 1 ? 'record' : 'records'}
        </Typography>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id} align={column.align} sx={{ width: column.width }} sortDirection={sortColumn === column.id ? sortDirection : false}>
                  {column.sortable === false ? column.label : (
                    <TableSortLabel
                      active={sortColumn === column.id}
                      direction={sortColumn === column.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4, color: '#434655' }}>
                  {search ? 'No records match your search.' : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} align={column.align}>{column.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={sortedRows.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Rows per page:"
        />
      </TableContainer>
    </Box>
  );
}

export default DataTable;
