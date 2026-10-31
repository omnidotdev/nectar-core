import { autocompletion } from "@codemirror/autocomplete";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { CodeEditor } from "@omnidotdev/thornberry/code-editor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useSchema } from "../../contexts/SchemaContext";
import { useNectarDataSource } from "../../core/data/NectarProvider";

import type { QueryResult } from "../../types/database";

// Custom theme for the editor
const nectarTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, monospace",
    overflow: "auto",
  },
  ".cm-content": {
    caretColor: "var(--color-primary)",
    padding: "8px 0",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-primary)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "oklch(0.828 0.189 75 / 0.35) !important",
  },
  ".cm-selectionLayer": {
    zIndex: "10 !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-line": {
    caretColor: "var(--color-primary)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-muted)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-card)",
    color: "var(--color-muted-foreground)",
    border: "none",
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 16px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "ui-monospace, monospace",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "4px 8px",
    color: "var(--color-foreground)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-primary-foreground)",
  },
  ".cm-completionLabel": {
    fontSize: "13px",
  },
  ".cm-completionDetail": {
    fontSize: "12px",
    opacity: 0.7,
    marginLeft: "8px",
  },
});

// Wrap selection with character (e.g., quotes)
function wrapSelection(char: string) {
  return (view: EditorView) => {
    const { state } = view;
    const selection = state.selection.main;

    if (selection.empty) return false;

    const selectedText = state.sliceDoc(selection.from, selection.to);
    const closingChar =
      char === "(" ? ")" : char === "[" ? "]" : char === "{" ? "}" : char;
    const wrapped = `${char}${selectedText}${closingChar}`;

    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: wrapped },
      selection: {
        anchor: selection.from + 1,
        head: selection.from + 1 + selectedText.length,
      },
    });

    return true;
  };
}

// Custom keymap for wrapping selections
const wrapKeymap = keymap.of([
  { key: '"', run: wrapSelection('"') },
  { key: "'", run: wrapSelection("'") },
  { key: "`", run: wrapSelection("`") },
  { key: "(", run: wrapSelection("(") },
  { key: "[", run: wrapSelection("[") },
  { key: "{", run: wrapSelection("{") },
]);

// Execute the query on Cmd/Ctrl+Enter, reading the latest handler through a ref
const executeKeymap = (run: () => void) =>
  keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        run();
        return true;
      },
    },
  ]);

// Autocompletion tuned to open while typing and cap the rendered option list
const nectarAutocompletion = autocompletion({
  activateOnTyping: true,
  maxRenderedOptions: 20,
});

/**
 * SQL query interface component with CodeMirror editor.
 */
export function QueryInterface() {
  const executeRef = useRef<() => void>(() => {});
  const [query, setQuery] = useState("SELECT * FROM ");
  const [result, setResult] = useState<QueryResult | null>(null);
  const { selectedSchema } = useSchema();
  const ds = useNectarDataSource();

  // Fetch schema for autocompletion
  const { data: schemaData } = useQuery({
    queryKey: ["db", "schema-autocompletion"],
    queryFn: () => ds.getSchemaForAutocompletion(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const executeMutation = useMutation({
    mutationFn: (sqlQuery: string) => ds.executeQuery(sqlQuery),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  // Keep executeRef in sync with current state so the stable Mod-Enter keymap
  // always runs the latest query
  executeRef.current = () => {
    const currentQuery = query;
    if (currentQuery.trim()) {
      executeMutation.mutate(currentQuery.trim());
    }
  };

  // Build the SQL language extension, scoping completions to the selected schema
  const language = useMemo(() => {
    if (!schemaData) return sql({ dialect: PostgreSQL });

    const tables: Record<string, string[]> = {};

    for (const table of schemaData.tables) {
      if (table.schema === selectedSchema) {
        const key = `${table.schema}.${table.name}`;
        tables[table.name] = schemaData.schemaMap[key] || [];
      }
    }

    return sql({
      dialect: PostgreSQL,
      schema: tables,
      defaultSchema: selectedSchema,
    });
  }, [schemaData, selectedSchema]);

  // Stable Nectar-specific extensions layered onto the shared editor's basicSetup
  const extensions = useMemo(
    () => [
      nectarAutocompletion,
      wrapKeymap,
      executeKeymap(() => executeRef.current()),
    ],
    [],
  );

  const exportToCsv = () => {
    if (!result || result.rows.length === 0) return;

    const headers = result.columns;
    const csvContent = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? "")).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Query Input */}
      <div className="border-border border-b bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground text-lg">SQL Query</h2>
            {!ds.capabilities.writable && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
                Read-only
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {result && result.rows.length > 0 && (
              <button
                type="button"
                onClick={exportToCsv}
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-foreground text-sm transition-colors hover:bg-muted/80"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={() => executeRef.current()}
              disabled={executeMutation.isPending || !query.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {executeMutation.isPending ? "Executing..." : "Execute"}
            </button>
          </div>
        </div>
        <CodeEditor
          value={query}
          onChange={setQuery}
          language={language}
          extensions={extensions}
          theme={nectarTheme}
          className="h-32 overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        />
        <div className="mt-2 flex items-center gap-4 text-muted-foreground text-xs">
          <span>Cmd/Ctrl + Enter to execute</span>
          <span>•</span>
          <span>Select text and press &quot; &apos; ` ( [ {"{"} to wrap</span>
        </div>
      </div>

      {/* Results */}
      <div className="scrollbar-thin flex-1 overflow-auto p-4">
        {/* Error */}
        {executeMutation.error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
            <div className="mb-1 font-semibold">Query Error</div>
            <div className="text-sm">
              {executeMutation.error instanceof Error
                ? executeMutation.error.message
                : "Failed to execute query"}
            </div>
          </div>
        )}

        {/* Execution Stats */}
        {result && (
          <div className="mb-4 text-muted-foreground text-sm">
            Query executed in {result.executionTime.toFixed(2)}ms &bull;{" "}
            {result.rowCount} row(s) returned
          </div>
        )}

        {/* Results Table */}
        {result && result.rows.length > 0 && (
          <div className="overflow-auto rounded-lg border border-border bg-card">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {result.columns.map((col) => (
                    <th
                      key={col}
                      className="border-border border-b-2 px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((row, index) => (
                  <tr
                    key={index}
                    className="transition-colors hover:bg-muted/50"
                  >
                    {result.columns.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-3 text-foreground text-sm"
                      >
                        {row[col] === null ? (
                          <span className="text-muted-foreground italic">
                            null
                          </span>
                        ) : typeof row[col] === "object" ? (
                          <code className="text-xs">
                            {JSON.stringify(row[col])}
                          </code>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty Results */}
        {result && result.rows.length === 0 && !executeMutation.error && (
          <div className="py-8 text-center text-muted-foreground">
            Query executed successfully. No rows returned.
          </div>
        )}

        {/* Initial State */}
        {!result && !executeMutation.error && !executeMutation.isPending && (
          <div className="py-8 text-center text-muted-foreground">
            Enter a SQL query and click Execute to see results
          </div>
        )}
      </div>
    </div>
  );
}
