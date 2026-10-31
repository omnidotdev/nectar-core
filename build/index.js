// src/components/db/DataGrid.tsx
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
  X
} from "lucide-react";
import { useState } from "react";

// src/core/data/NectarProvider.tsx
import { createContext, useContext } from "react";
import { jsx } from "react/jsx-runtime";
var Ctx = createContext(null);
function NectarProvider({
  dataSource,
  children
}) {
  return /* @__PURE__ */ jsx(Ctx.Provider, { value: dataSource, children });
}
function useNectarDataSource() {
  const ds = useContext(Ctx);
  if (!ds) {
    throw new Error("useNectarDataSource must be used within a NectarProvider");
  }
  return ds;
}

// src/options/db.options.ts
import { queryOptions } from "@tanstack/react-query";
var tablesOptions = (ds) => queryOptions({
  queryKey: ["db", "tables"],
  queryFn: () => ds.getTables()
});
var tableSchemaOptions = (ds, schema, table) => queryOptions({
  queryKey: ["db", "schema", schema, table],
  queryFn: () => ds.getTableSchema(schema, table),
  enabled: !!schema && !!table
});
var tableDataOptions = (ds, {
  schema,
  table,
  page = 0,
  pageSize = 50,
  sortColumn,
  sortDirection,
  filters
}) => queryOptions({
  queryKey: [
    "db",
    "data",
    schema,
    table,
    page,
    pageSize,
    sortColumn,
    sortDirection,
    filters
  ],
  queryFn: () => ds.getTableData({
    schema,
    table,
    page,
    pageSize,
    sortColumn,
    sortDirection,
    filters
  }),
  enabled: !!schema && !!table
});

// src/components/db/DataGrid.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function DataGrid({ schema, tableName, columns }) {
  const ds = useNectarDataSource();
  const writable = ds.capabilities.writable;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState([]);
  const pageSize = 50;
  const apiFilters = columnFilters.filter((f) => f.value.trim() !== "").map((f) => ({
    column: f.column,
    operator: "ilike",
    value: f.value
  }));
  const { data, isLoading } = useQuery(
    tableDataOptions(ds, {
      schema,
      table: tableName,
      page,
      pageSize,
      sortColumn: sortColumn ?? void 0,
      sortDirection: sortDirection ?? void 0,
      filters: apiFilters.length > 0 ? apiFilters : void 0
    })
  );
  const primaryKeyColumn = columns.find((col) => col.isPrimaryKey);
  const invalidateData = () => {
    queryClient.invalidateQueries({
      queryKey: ["db", "data", schema, tableName]
    });
    queryClient.invalidateQueries({ queryKey: ["db", "tables"] });
  };
  const insertMutation = useMutation({
    mutationFn: (rowData) => ds.insertRow(schema, tableName, rowData),
    onSuccess: () => {
      setIsAddingRow(false);
      setNewRowData({});
      setError(null);
      invalidateData();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to insert row");
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({
      pkValue,
      rowData
    }) => ds.updateRow(
      schema,
      tableName,
      { column: primaryKeyColumn?.name ?? "", value: pkValue },
      rowData
    ),
    onSuccess: () => {
      setEditingRowIndex(null);
      setEditedData({});
      setError(null);
      invalidateData();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update row");
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (pkValue) => ds.deleteRow(schema, tableName, {
      column: primaryKeyColumn?.name ?? "",
      value: pkValue
    }),
    onSuccess: () => {
      setError(null);
      invalidateData();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete row");
    }
  });
  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
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
    setPage(0);
  };
  const handleFilterChange = (columnName, value) => {
    setColumnFilters((prev) => {
      const existing = prev.find((f) => f.column === columnName);
      if (existing) {
        return prev.map((f) => f.column === columnName ? { ...f, value } : f);
      }
      return [...prev, { column: columnName, value }];
    });
    setPage(0);
  };
  const getFilterValue = (columnName) => {
    return columnFilters.find((f) => f.column === columnName)?.value ?? "";
  };
  const clearFilters = () => {
    setColumnFilters([]);
    setPage(0);
  };
  const hasActiveFilters = columnFilters.some((f) => f.value.trim() !== "");
  const handleEdit = (index, row) => {
    setEditingRowIndex(index);
    setEditedData({ ...row });
    setError(null);
  };
  const handleSave = (index) => {
    if (!primaryKeyColumn) {
      setError("Cannot update: no primary key found");
      return;
    }
    const originalRow = data?.rows[index];
    if (!originalRow) return;
    const pkValue = originalRow[primaryKeyColumn.name];
    const changes = {};
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
  const handleDelete = (row) => {
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
    const initial = {};
    for (const col of columns) {
      if (!col.isPrimaryKey) {
        initial[col.name] = "";
      }
    }
    setNewRowData(initial);
  };
  const handleSaveNewRow = () => {
    const rowData = {};
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
    return /* @__PURE__ */ jsx2("div", { className: "flex h-full items-center justify-center", children: /* @__PURE__ */ jsx2(Loader2, { className: "h-8 w-8 animate-spin text-muted-foreground" }) });
  }
  const totalPages = data?.totalPages ?? 1;
  const isMutating = insertMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  return /* @__PURE__ */ jsxs("div", { className: "flex h-full flex-col", children: [
    error && /* @__PURE__ */ jsx2("div", { className: "mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm", children: error }),
    /* @__PURE__ */ jsx2("div", { className: "scrollbar-thin flex-1 overflow-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full border-collapse", children: [
      /* @__PURE__ */ jsxs("thead", { className: "sticky top-0 z-10 bg-muted", children: [
        /* @__PURE__ */ jsxs("tr", { children: [
          writable && /* @__PURE__ */ jsx2("th", { className: "w-24 border-border border-b px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", children: "Actions" }),
          columns.map((col) => /* @__PURE__ */ jsx2(
            "th",
            {
              className: "border-border border-b px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider",
              children: /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => handleSort(col.name),
                  className: "flex items-center gap-1 transition-colors hover:text-foreground",
                  children: [
                    col.name,
                    col.isPrimaryKey && /* @__PURE__ */ jsx2("span", { className: "text-[10px] text-primary", children: "PK" }),
                    sortColumn === col.name ? sortDirection === "asc" ? /* @__PURE__ */ jsx2(ArrowUp, { className: "h-3 w-3 text-primary" }) : /* @__PURE__ */ jsx2(ArrowDown, { className: "h-3 w-3 text-primary" }) : /* @__PURE__ */ jsx2(ArrowUpDown, { className: "h-3 w-3 opacity-30" })
                  ]
                }
              )
            },
            col.name
          ))
        ] }),
        showFilters && /* @__PURE__ */ jsxs("tr", { className: "bg-muted/50", children: [
          writable && /* @__PURE__ */ jsx2("th", { className: "border-border border-b px-4 py-2", children: hasActiveFilters && /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              onClick: clearFilters,
              className: "text-muted-foreground text-xs transition-colors hover:text-foreground",
              title: "Clear all filters",
              children: "Clear"
            }
          ) }),
          columns.map((col) => /* @__PURE__ */ jsx2(
            "th",
            {
              className: "border-border border-b px-4 py-2",
              children: /* @__PURE__ */ jsx2(
                "input",
                {
                  type: "text",
                  value: getFilterValue(col.name),
                  onChange: (e) => handleFilterChange(col.name, e.target.value),
                  placeholder: `Filter ${col.name}...`,
                  className: "w-full rounded border border-input bg-background px-2 py-1 text-foreground text-xs placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                }
              )
            },
            col.name
          ))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-border bg-background", children: [
        writable && isAddingRow && /* @__PURE__ */ jsxs("tr", { className: "bg-primary/10", children: [
          /* @__PURE__ */ jsx2("td", { className: "whitespace-nowrap px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: handleSaveNewRow,
                disabled: isMutating,
                className: "text-green-600 transition-colors hover:text-green-800 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300",
                title: "Save",
                children: /* @__PURE__ */ jsx2(Save, { className: "h-4 w-4" })
              }
            ),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: handleCancelAdd,
                disabled: isMutating,
                className: "text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
                title: "Cancel",
                children: /* @__PURE__ */ jsx2(X, { className: "h-4 w-4" })
              }
            )
          ] }) }),
          columns.map((col) => /* @__PURE__ */ jsx2("td", { className: "px-4 py-3", children: col.isPrimaryKey ? /* @__PURE__ */ jsx2("span", { className: "text-muted-foreground text-sm italic", children: "auto" }) : /* @__PURE__ */ jsx2(
            "input",
            {
              type: "text",
              value: String(newRowData[col.name] ?? ""),
              onChange: (e) => setNewRowData({
                ...newRowData,
                [col.name]: e.target.value
              }),
              className: "w-full rounded border border-input bg-background px-2 py-1 text-foreground text-sm",
              placeholder: col.type
            }
          ) }, col.name))
        ] }),
        data?.rows.map((row, index) => /* @__PURE__ */ jsxs("tr", { className: "transition-colors hover:bg-muted/50", children: [
          writable && /* @__PURE__ */ jsx2("td", { className: "whitespace-nowrap px-4 py-3", children: editingRowIndex === index ? /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: () => handleSave(index),
                disabled: isMutating,
                className: "text-green-600 transition-colors hover:text-green-800 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300",
                title: "Save",
                children: /* @__PURE__ */ jsx2(Save, { className: "h-4 w-4" })
              }
            ),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: handleCancelEdit,
                disabled: isMutating,
                className: "text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
                title: "Cancel",
                children: /* @__PURE__ */ jsx2(X, { className: "h-4 w-4" })
              }
            )
          ] }) : /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: () => handleEdit(index, row),
                disabled: isMutating || !primaryKeyColumn,
                className: "text-secondary transition-colors hover:text-secondary/80 disabled:opacity-50",
                title: primaryKeyColumn ? "Edit" : "No primary key",
                children: /* @__PURE__ */ jsx2(Edit2, { className: "h-4 w-4" })
              }
            ),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: () => handleDelete(row),
                disabled: isMutating || !primaryKeyColumn,
                className: "text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50",
                title: primaryKeyColumn ? "Delete" : "No primary key",
                children: /* @__PURE__ */ jsx2(Trash2, { className: "h-4 w-4" })
              }
            )
          ] }) }),
          columns.map((col) => /* @__PURE__ */ jsx2("td", { className: "px-4 py-3", children: editingRowIndex === index ? /* @__PURE__ */ jsx2(
            "input",
            {
              type: "text",
              value: String(editedData[col.name] ?? ""),
              onChange: (e) => setEditedData({
                ...editedData,
                [col.name]: e.target.value
              }),
              className: "w-full rounded border border-input bg-background px-2 py-1 text-foreground text-sm disabled:bg-muted",
              disabled: col.isPrimaryKey
            }
          ) : /* @__PURE__ */ jsx2("span", { className: "text-foreground text-sm", children: row[col.name] === null ? /* @__PURE__ */ jsx2("span", { className: "text-muted-foreground italic", children: "null" }) : typeof row[col.name] === "object" ? JSON.stringify(row[col.name]) : String(row[col.name]) }) }, col.name))
        ] }, index)),
        data?.rows.length === 0 && !isAddingRow && /* @__PURE__ */ jsx2("tr", { children: /* @__PURE__ */ jsx2(
          "td",
          {
            colSpan: columns.length + (writable ? 1 : 0),
            className: "px-4 py-8 text-center text-muted-foreground",
            children: hasActiveFilters ? "No rows match the current filters" : "No data in this table"
          }
        ) })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-border border-t bg-background px-4 py-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        writable && /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: handleAddRow,
            disabled: isAddingRow || isMutating,
            className: "flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50",
            children: [
              /* @__PURE__ */ jsx2(Plus, { className: "h-4 w-4" }),
              "Add Row"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setShowFilters(!showFilters),
            className: `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${showFilters || hasActiveFilters ? "bg-primary/20 text-primary" : "bg-muted text-foreground hover:bg-muted/80"}`,
            children: [
              /* @__PURE__ */ jsx2(Filter, { className: "h-4 w-4" }),
              "Filter",
              hasActiveFilters && /* @__PURE__ */ jsx2("span", { className: "rounded-full bg-primary px-1.5 text-primary-foreground text-xs", children: columnFilters.filter((f) => f.value.trim() !== "").length })
            ]
          }
        ),
        /* @__PURE__ */ jsx2("div", { className: "text-muted-foreground text-sm", children: hasActiveFilters ? `${data?.totalCount ?? 0} matching rows` : `Total rows: ${data?.totalCount ?? 0}` }),
        !writable && /* @__PURE__ */ jsx2("span", { className: "rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs", children: "Read-only" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            onClick: () => setPage(Math.max(0, page - 1)),
            disabled: page === 0,
            className: "rounded p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
            children: /* @__PURE__ */ jsx2(ChevronLeft, { className: "h-5 w-5" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground text-sm", children: [
          "Page ",
          page + 1,
          " of ",
          totalPages || 1
        ] }),
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            onClick: () => setPage(Math.min(totalPages - 1, page + 1)),
            disabled: page >= totalPages - 1,
            className: "rounded p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
            children: /* @__PURE__ */ jsx2(ChevronRight, { className: "h-5 w-5" })
          }
        )
      ] })
    ] })
  ] });
}

// src/components/db/QueryInterface.tsx
import { autocompletion } from "@codemirror/autocomplete";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { CodeEditor } from "@omnidotdev/thornberry/code-editor";
import { useMutation as useMutation2, useQuery as useQuery2 } from "@tanstack/react-query";
import { Download, Loader2 as Loader22, Play } from "lucide-react";
import { useMemo as useMemo2, useRef, useState as useState3 } from "react";

// src/contexts/SchemaContext.tsx
import { createContext as createContext2, useContext as useContext2, useMemo, useState as useState2 } from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
var SchemaContext = createContext2(null);
function SchemaProvider({ children }) {
  const [selectedSchema, setSelectedSchema] = useState2("public");
  const [schemas, setSchemas] = useState2(["public"]);
  const value = useMemo(
    () => ({
      selectedSchema,
      setSelectedSchema,
      schemas,
      setSchemas
    }),
    [selectedSchema, schemas]
  );
  return /* @__PURE__ */ jsx3(SchemaContext.Provider, { value, children });
}
function useSchema() {
  const context = useContext2(SchemaContext);
  if (!context) {
    throw new Error("useSchema must be used within a SchemaProvider");
  }
  return context;
}

// src/components/db/QueryInterface.tsx
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var nectarTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px"
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, monospace",
    overflow: "auto"
  },
  ".cm-content": {
    caretColor: "var(--color-primary)",
    padding: "8px 0"
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-primary)"
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "oklch(0.828 0.189 75 / 0.35) !important"
  },
  ".cm-selectionLayer": {
    zIndex: "10 !important"
  },
  ".cm-activeLine": {
    backgroundColor: "transparent"
  },
  ".cm-line": {
    caretColor: "var(--color-primary)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-muted)"
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-card)",
    color: "var(--color-muted-foreground)",
    border: "none",
    borderRight: "1px solid var(--color-border)"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 16px"
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "ui-monospace, monospace"
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "4px 8px",
    color: "var(--color-foreground)"
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-primary-foreground)"
  },
  ".cm-completionLabel": {
    fontSize: "13px"
  },
  ".cm-completionDetail": {
    fontSize: "12px",
    opacity: 0.7,
    marginLeft: "8px"
  }
});
function wrapSelection(char) {
  return (view) => {
    const { state } = view;
    const selection = state.selection.main;
    if (selection.empty) return false;
    const selectedText = state.sliceDoc(selection.from, selection.to);
    const closingChar = char === "(" ? ")" : char === "[" ? "]" : char === "{" ? "}" : char;
    const wrapped = `${char}${selectedText}${closingChar}`;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: wrapped },
      selection: {
        anchor: selection.from + 1,
        head: selection.from + 1 + selectedText.length
      }
    });
    return true;
  };
}
var wrapKeymap = keymap.of([
  { key: '"', run: wrapSelection('"') },
  { key: "'", run: wrapSelection("'") },
  { key: "`", run: wrapSelection("`") },
  { key: "(", run: wrapSelection("(") },
  { key: "[", run: wrapSelection("[") },
  { key: "{", run: wrapSelection("{") }
]);
var executeKeymap = (run) => keymap.of([
  {
    key: "Mod-Enter",
    run: () => {
      run();
      return true;
    }
  }
]);
var nectarAutocompletion = autocompletion({
  activateOnTyping: true,
  maxRenderedOptions: 20
});
function QueryInterface() {
  const executeRef = useRef(() => {
  });
  const [query, setQuery] = useState3("SELECT * FROM ");
  const [result, setResult] = useState3(null);
  const { selectedSchema } = useSchema();
  const ds = useNectarDataSource();
  const { data: schemaData } = useQuery2({
    queryKey: ["db", "schema-autocompletion"],
    queryFn: () => ds.getSchemaForAutocompletion(),
    staleTime: 5 * 60 * 1e3
    // Cache for 5 minutes
  });
  const executeMutation = useMutation2({
    mutationFn: (sqlQuery) => ds.executeQuery(sqlQuery),
    onSuccess: (data) => {
      setResult(data);
    }
  });
  executeRef.current = () => {
    const currentQuery = query;
    if (currentQuery.trim()) {
      executeMutation.mutate(currentQuery.trim());
    }
  };
  const language = useMemo2(() => {
    if (!schemaData) return sql({ dialect: PostgreSQL });
    const tables = {};
    for (const table of schemaData.tables) {
      if (table.schema === selectedSchema) {
        const key = `${table.schema}.${table.name}`;
        tables[table.name] = schemaData.schemaMap[key] || [];
      }
    }
    return sql({
      dialect: PostgreSQL,
      schema: tables,
      defaultSchema: selectedSchema
    });
  }, [schemaData, selectedSchema]);
  const extensions = useMemo2(
    () => [
      nectarAutocompletion,
      wrapKeymap,
      executeKeymap(() => executeRef.current())
    ],
    []
  );
  const exportToCsv = () => {
    if (!result || result.rows.length === 0) return;
    const headers = result.columns;
    const csvContent = [
      headers.join(","),
      ...result.rows.map(
        (row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
      )
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return /* @__PURE__ */ jsxs2("div", { className: "flex h-full flex-col bg-background", children: [
    /* @__PURE__ */ jsxs2("div", { className: "border-border border-b bg-card p-4", children: [
      /* @__PURE__ */ jsxs2("div", { className: "mb-2 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx4("h2", { className: "font-semibold text-foreground text-lg", children: "SQL Query" }),
          !ds.capabilities.writable && /* @__PURE__ */ jsx4("span", { className: "rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs", children: "Read-only" })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
          result && result.rows.length > 0 && /* @__PURE__ */ jsxs2(
            "button",
            {
              type: "button",
              onClick: exportToCsv,
              className: "flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-foreground text-sm transition-colors hover:bg-muted/80",
              children: [
                /* @__PURE__ */ jsx4(Download, { className: "h-4 w-4" }),
                "Export CSV"
              ]
            }
          ),
          /* @__PURE__ */ jsxs2(
            "button",
            {
              type: "button",
              onClick: () => executeRef.current(),
              disabled: executeMutation.isPending || !query.trim(),
              className: "flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
              children: [
                executeMutation.isPending ? /* @__PURE__ */ jsx4(Loader22, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx4(Play, { className: "h-4 w-4" }),
                executeMutation.isPending ? "Executing..." : "Execute"
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx4(
        CodeEditor,
        {
          value: query,
          onChange: setQuery,
          language,
          extensions,
          theme: nectarTheme,
          className: "h-32 overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        }
      ),
      /* @__PURE__ */ jsxs2("div", { className: "mt-2 flex items-center gap-4 text-muted-foreground text-xs", children: [
        /* @__PURE__ */ jsx4("span", { children: "Cmd/Ctrl + Enter to execute" }),
        /* @__PURE__ */ jsx4("span", { children: "\u2022" }),
        /* @__PURE__ */ jsxs2("span", { children: [
          "Select text and press \" ' ` ( [ ",
          "{",
          " to wrap"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "scrollbar-thin flex-1 overflow-auto p-4", children: [
      executeMutation.error && /* @__PURE__ */ jsxs2("div", { className: "mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive", children: [
        /* @__PURE__ */ jsx4("div", { className: "mb-1 font-semibold", children: "Query Error" }),
        /* @__PURE__ */ jsx4("div", { className: "text-sm", children: executeMutation.error instanceof Error ? executeMutation.error.message : "Failed to execute query" })
      ] }),
      result && /* @__PURE__ */ jsxs2("div", { className: "mb-4 text-muted-foreground text-sm", children: [
        "Query executed in ",
        result.executionTime.toFixed(2),
        "ms \u2022",
        " ",
        result.rowCount,
        " row(s) returned"
      ] }),
      result && result.rows.length > 0 && /* @__PURE__ */ jsx4("div", { className: "overflow-auto rounded-lg border border-border bg-card", children: /* @__PURE__ */ jsxs2("table", { className: "w-full border-collapse", children: [
        /* @__PURE__ */ jsx4("thead", { className: "sticky top-0 bg-muted", children: /* @__PURE__ */ jsx4("tr", { children: result.columns.map((col) => /* @__PURE__ */ jsx4(
          "th",
          {
            className: "border-border border-b-2 px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider",
            children: col
          },
          col
        )) }) }),
        /* @__PURE__ */ jsx4("tbody", { className: "divide-y divide-border", children: result.rows.map((row, index) => /* @__PURE__ */ jsx4(
          "tr",
          {
            className: "transition-colors hover:bg-muted/50",
            children: result.columns.map((col) => /* @__PURE__ */ jsx4(
              "td",
              {
                className: "px-4 py-3 text-foreground text-sm",
                children: row[col] === null ? /* @__PURE__ */ jsx4("span", { className: "text-muted-foreground italic", children: "null" }) : typeof row[col] === "object" ? /* @__PURE__ */ jsx4("code", { className: "text-xs", children: JSON.stringify(row[col]) }) : String(row[col])
              },
              col
            ))
          },
          index
        )) })
      ] }) }),
      result && result.rows.length === 0 && !executeMutation.error && /* @__PURE__ */ jsx4("div", { className: "py-8 text-center text-muted-foreground", children: "Query executed successfully. No rows returned." }),
      !result && !executeMutation.error && !executeMutation.isPending && /* @__PURE__ */ jsx4("div", { className: "py-8 text-center text-muted-foreground", children: "Enter a SQL query and click Execute to see results" })
    ] })
  ] });
}

// src/components/db/SchemaViewer.tsx
import { Key, Link2 } from "lucide-react";
import { jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
function SchemaViewer({ tableName, columns }) {
  const nullableCount = columns.filter((col) => col.nullable).length;
  const primaryKeyCount = columns.filter((col) => col.isPrimaryKey).length;
  const foreignKeyCount = columns.filter((col) => col.foreignKey).length;
  return /* @__PURE__ */ jsxs3("div", { className: "bg-background p-6", children: [
    /* @__PURE__ */ jsxs3("div", { className: "mb-6", children: [
      /* @__PURE__ */ jsx5("h2", { className: "mb-2 font-bold text-2xl text-foreground", children: tableName }),
      /* @__PURE__ */ jsx5("p", { className: "text-muted-foreground", children: "Table schema and column definitions" })
    ] }),
    /* @__PURE__ */ jsx5("div", { className: "overflow-hidden rounded-lg border border-border bg-card", children: /* @__PURE__ */ jsxs3("table", { className: "w-full", children: [
      /* @__PURE__ */ jsx5("thead", { className: "bg-muted", children: /* @__PURE__ */ jsxs3("tr", { children: [
        /* @__PURE__ */ jsx5("th", { className: "px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", children: "Column Name" }),
        /* @__PURE__ */ jsx5("th", { className: "px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", children: "Data Type" }),
        /* @__PURE__ */ jsx5("th", { className: "px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", children: "Nullable" }),
        /* @__PURE__ */ jsx5("th", { className: "px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", children: "Default" }),
        /* @__PURE__ */ jsx5("th", { className: "px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", children: "Constraints" })
      ] }) }),
      /* @__PURE__ */ jsx5("tbody", { className: "divide-y divide-border", children: columns.map((col) => /* @__PURE__ */ jsxs3("tr", { className: "hover:bg-muted/50", children: [
        /* @__PURE__ */ jsx5("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx5("span", { className: "font-medium text-foreground", children: col.name }),
          col.isPrimaryKey && /* @__PURE__ */ jsxs3("span", { className: "inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 font-medium text-primary text-xs dark:bg-primary/30", children: [
            /* @__PURE__ */ jsx5(Key, { className: "h-3 w-3" }),
            "PK"
          ] })
        ] }) }),
        /* @__PURE__ */ jsx5("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx5("code", { className: "rounded bg-secondary/20 px-2 py-1 text-secondary text-sm dark:bg-secondary/30", children: col.type }) }),
        /* @__PURE__ */ jsx5("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx5(
          "span",
          {
            className: `inline-flex items-center rounded px-2 py-0.5 font-medium text-xs ${col.nullable ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`,
            children: col.nullable ? "Nullable" : "Not Null"
          }
        ) }),
        /* @__PURE__ */ jsx5("td", { className: "px-4 py-3", children: col.default ? /* @__PURE__ */ jsx5("code", { className: "rounded bg-muted px-2 py-1 text-muted-foreground text-sm", children: col.default }) : /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground text-sm italic", children: "none" }) }),
        /* @__PURE__ */ jsx5("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-1", children: [
          col.isUnique && /* @__PURE__ */ jsx5("span", { className: "inline-flex items-center rounded bg-secondary/20 px-2 py-0.5 font-medium text-secondary text-xs dark:bg-secondary/30", children: "Unique" }),
          col.foreignKey && /* @__PURE__ */ jsxs3("span", { className: "inline-flex items-center gap-1 rounded bg-secondary/20 px-2 py-0.5 font-medium text-secondary text-xs dark:bg-secondary/30", children: [
            /* @__PURE__ */ jsx5(Link2, { className: "h-3 w-3" }),
            "FK: ",
            col.foreignKey.table,
            ".",
            col.foreignKey.column
          ] })
        ] }) })
      ] }, col.name)) })
    ] }) }),
    /* @__PURE__ */ jsxs3("div", { className: "mt-6 rounded-lg border border-border bg-muted p-4", children: [
      /* @__PURE__ */ jsx5("h3", { className: "mb-2 font-semibold text-foreground text-sm", children: "Statistics" }),
      /* @__PURE__ */ jsxs3("div", { className: "grid grid-cols-4 gap-4 text-sm", children: [
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: "Total Columns:" }),
          /* @__PURE__ */ jsx5("span", { className: "ml-2 font-medium text-foreground", children: columns.length })
        ] }),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: "Nullable:" }),
          /* @__PURE__ */ jsx5("span", { className: "ml-2 font-medium text-foreground", children: nullableCount })
        ] }),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: "Primary Keys:" }),
          /* @__PURE__ */ jsx5("span", { className: "ml-2 font-medium text-foreground", children: primaryKeyCount })
        ] }),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: "Foreign Keys:" }),
          /* @__PURE__ */ jsx5("span", { className: "ml-2 font-medium text-foreground", children: foreignKeyCount })
        ] })
      ] })
    ] })
  ] });
}
export {
  DataGrid,
  NectarProvider,
  QueryInterface,
  SchemaProvider,
  SchemaViewer,
  tableDataOptions,
  tableSchemaOptions,
  tablesOptions,
  useNectarDataSource,
  useSchema
};
