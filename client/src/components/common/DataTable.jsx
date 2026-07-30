import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

export default function DataTable({ columns, rows = [], loading, getRowKey = (row) => row.id, onRowClick }) {
  if (loading) return <LoadingSkeleton rows={6} />;
  if (!rows.length) return <EmptyState description="Thay đổi bộ lọc hoặc tạo bản ghi mới để bắt đầu." />;
  return (
    <TableContainer className="soft-scrollbar tw-overflow-auto tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white dark:tw-border-slate-700 dark:tw-bg-slate-900">
      <Table size="small">
        <TableHead>
          <TableRow className="tw-bg-[#f7f9f8] dark:tw-bg-slate-800">
            {columns.map((column) => (
              <TableCell key={column.key} align={column.align || "left"} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              hover={Boolean(onRowClick)}
              key={getRowKey(row)}
              onClick={() => onRowClick?.(row)}
              sx={{
                ...(onRowClick ? { cursor: "pointer" } : {}),
                "&:last-child td": { borderBottom: 0 },
                transition: "background-color 140ms ease",
              }}
            >
              {columns.map((column) => (
                <TableCell key={column.key} align={column.align || "left"}>
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
