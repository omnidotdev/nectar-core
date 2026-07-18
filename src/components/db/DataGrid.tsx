import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Filter,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { useNectarDataSource } from "@/core/data/NectarProvider";
import { tableDataOptions } from "@/options/db.options";

import type { TableFilter } from "@/options/db.options";
import type { ColumnInfo } from "@/types/database";

interface DataGridProps {
  schema: string;
  tableName: string;
  columns: ColumnInfo[];
}

type SortDirection = "asc" | "desc" | null;

interface ColumnFilter {
  column: string;
  value: string;
}

/**
 * Data grid component for viewing and editing table data.
 */
export function DataGrid({ schema, tableName, columns }: DataGridProps) {
  const ds = useNectarDataSource();
  const writable = ds.capabilities.writable;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filtering state
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

  const pageSize = 50;

  // Convert column filters to API format
  const apiFilters: TableFilter[] = columnFilters
    .filter((f) => f.value.trim() !== "")
    .map((f) => ({
      column: f.column,
      operator: "ilike" as const,
      value: f.value,
    }));

  const { data, isLoading } = useQuery(
    tableDataOptions(ds, {
      schema,
      table: tableName,
      page,
      pageSize,
      sortColumn: sortColumn ?? undefined,
      sortDirection: sortDirection ?? undefined,
      filters: apiFilters.length > 0 ? apiFilters : undefined,
    }),
  );

  const primaryKeyColumn = columns.find((col) => col.isPrimaryKey);

  const invalidateData = () => {
    queryClient.invalidateQueries({
      queryKey: ["db", "data", schema, tableName],
    });
    queryClient.invalidateQueries({ queryKey: ["db", "tables"] });
  };

  const insertMutation = useMutation({
    mutationFn: (rowData: Record<string, unknown>) =>
      ds.insertRow(schema, tableName, rowData),
    onSuccess: () => {
      setIsAddingRow(false);
      setNewRowData({});
      setError(null);
      invalidateData();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to insert row");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      pkValue,
      rowData,
    }: {
      pkValue: unknown;
      rowData: Record<string, unknown>;
    }) =>
      ds.updateRow(
        schema,
        tableName,
        { column: primaryKeyColumn?.name ?? "", value: pkValue },
        rowData,
      ),
    onSuccess: () => {
      setEditingRowIndex(null);
      setEditedData({});
      setError(null);
      invalidateData();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update row");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (pkValue: unknown) =>
      ds.deleteRow(schema, tableName, {
        column: primaryKeyColumn?.name ?? "",
        value: pkValue,
      }),
    onSuccess: () => {
      setError(null);
      invalidateData();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete row");
    },
  });

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnName);
      setSortDirection("asc");
    }
    setPage(0); // Reset to first page on sort change
  };

  const handleFilterChange = (columnName: string, value: string) => {
    setColumnFilters((prev) => {
      const existing = prev.find((f) => f.column === columnName);
      if (existing) {
        return prev.map((f) => (f.column === columnName ? { ...f, value } : f));
      }
      return [...prev, { column: columnName, value }];
    });
    setPage(0); // Reset to first page on filter change
  };

  const getFilterValue = (columnName: string): string => {
    return columnFilters.find((f) => f.column === columnName)?.value ?? "";
  };

  const clearFilters = () => {
    setColumnFilters([]);
    setPage(0);
  };

  const hasActiveFilters = columnFilters.some((f) => f.value.trim() !== "");

  const handleEdit = (index: number, row: Record<string, unknown>) => {
    setEditingRowIndex(index);
    setEditedData({ ...row });
    setError(null);
  };

  const handleSave = (index: number) => {
    if (!primaryKeyColumn) {
      setError("Cannot update: no primary key found");
      return;
    }

    const originalRow = data?.rows[index];
    if (!originalRow) return;

    const pkValue = originalRow[primaryKeyColumn.name];

    // Only include changed non-PK fields
    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(editedData)) {
      if (key !== primaryKeyColumn.name && value !== originalRow[key]) {
        changes[key] = value;
      }
    }

    if (Object.keys(changes).length === 0) {
      setEditingRowIndex(null);
      setEditedData({});
      return;
    }

    updateMutation.mutate({ pkValue, rowData: changes });
  };

  const handleCancelEdit = () => {
    setEditingRowIndex(null);
    setEditedData({});
    setError(null);
  };

  const handleDelete = (row: Record<string, unknown>) => {
    if (!primaryKeyColumn) {
      setError("Cannot delete: no primary key found");
      return;
    }

    if (!confirm("Are you sure you want to delete this row?")) return;

    const pkValue = row[primaryKeyColumn.name];
    deleteMutation.mutate(pkValue);
  };

  const handleAddRow = () => {
    setIsAddingRow(true);
    setError(null);
    const initial: Record<string, unknown> = {};
    for (const col of columns) {
      if (!col.isPrimaryKey) {
        initial[col.name] = "";
      }
    }
    setNewRowData(initial);
  };

  const handleSaveNewRow = () => {
    // Filter out empty values and prepare data
    const rowData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(newRowData)) {
      if (value !== "") {
        rowData[key] = value;
      }
    }

    if (Object.keys(rowData).length === 0) {
      setError("Please fill in at least one field");
      return;
    }

    insertMutation.mutate(rowData);
  };

  const handleCancelAdd = () => {
    setIsAddingRow(false);
    setNewRowData({});
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  const isMutating =
    insertMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="scrollbar-thin flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-muted">
            {/* Column Headers with Sort */}
            <tr>
              {writable && (
                <th className="w-24 border-border border-b px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Actions
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="border-border border-b px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.name)}
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {col.name}
                    {col.isPrimaryKey && (
                      <span className="text-[10px] text-primary">PK</span>
                    )}
                    {sortColumn === col.name ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3 text-primary" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </button>
                </th>
              ))}
            </tr>

            {/* Filter Row */}
            {showFilters && (
              <tr className="bg-muted/50">
                {writable && (
                  <th className="border-border border-b px-4 py-2">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-muted-foreground text-xs transition-colors hover:text-foreground"
                        title="Clear all filters"
                      >
                        Clear
                      </button>
                    )}
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className="border-border border-b px-4 py-2"
                  >
                    <input
                      type="text"
                      value={getFilterValue(col.name)}
                      onChange={(e) =>
                        handleFilterChange(col.name, e.target.value)
                      }
                      placeholder={`Filter ${col.name}...`}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-foreground text-xs placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {/* Add new row */}
            {writable && isAddingRow && (
              <tr className="bg-primary/10">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveNewRow}
                      disabled={isMutating}
                      className="text-green-600 transition-colors hover:text-green-800 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAdd}
                      disabled={isMutating}
                      className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                {columns.map((col) => (
                  <td key={col.name} className="px-4 py-3">
                    {col.isPrimaryKey ? (
                      <span className="text-muted-foreground text-sm italic">
                        auto
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={String(newRowData[col.name] ?? "")}
                        onChange={(e) =>
                          setNewRowData({
                            ...newRowData,
                            [col.name]: e.target.value,
                          })
                        }
                        className="w-full rounded border border-input bg-background px-2 py-1 text-foreground text-sm"
                        placeholder={col.type}
                      />
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* Data rows */}
            {data?.rows.map((row, index) => (
              <tr key={index} className="transition-colors hover:bg-muted/50">
                {writable && (
                  <td className="whitespace-nowrap px-4 py-3">
                    {editingRowIndex === index ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(index)}
                          disabled={isMutating}
                          className="text-green-600 transition-colors hover:text-green-800 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
                          title="Save"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isMutating}
                          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(index, row)}
                          disabled={isMutating || !primaryKeyColumn}
                          className="text-secondary transition-colors hover:text-secondary/80 disabled:opacity-50"
                          title={primaryKeyColumn ? "Edit" : "No primary key"}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={isMutating || !primaryKeyColumn}
                          className="text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                          title={primaryKeyColumn ? "Delete" : "No primary key"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.name} className="px-4 py-3">
                    {editingRowIndex === index ? (
                      <input
                        type="text"
                        value={String(editedData[col.name] ?? "")}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            [col.name]: e.target.value,
                          })
                        }
                        className="w-full rounded border border-input bg-background px-2 py-1 text-foreground text-sm disabled:bg-muted"
                        disabled={col.isPrimaryKey}
                      />
                    ) : (
                      <span className="text-foreground text-sm">
                        {row[col.name] === null ? (
                          <span className="text-muted-foreground italic">
                            null
                          </span>
                        ) : typeof row[col.name] === "object" ? (
                          JSON.stringify(row[col.name])
                        ) : (
                          String(row[col.name])
                        )}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {/* Empty state */}
            {data?.rows.length === 0 && !isAddingRow && (
              <tr>
                <td
                  colSpan={columns.length + (writable ? 1 : 0)}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {hasActiveFilters
                    ? "No rows match the current filters"
                    : "No data in this table"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-border border-t bg-background px-4 py-3">
        <div className="flex items-center gap-4">
          {writable && (
            <button
              type="button"
              onClick={handleAddRow}
              disabled={isAddingRow || isMutating}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-primary/20 text-primary"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filter
            {hasActiveFilters && (
              <span className="rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
                {columnFilters.filter((f) => f.value.trim() !== "").length}
              </span>
            )}
          </button>
          <div className="text-muted-foreground text-sm">
            {hasActiveFilters
              ? `${data?.totalCount ?? 0} matching rows`
              : `Total rows: ${data?.totalCount ?? 0}`}
          </div>
          {!writable && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="rounded p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-muted-foreground text-sm">
            Page {page + 1} of {totalPages || 1}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="rounded p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
