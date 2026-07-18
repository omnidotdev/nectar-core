import { Key, Link2 } from "lucide-react";

import type { ColumnInfo } from "@/types/database";

interface SchemaViewerProps {
  tableName: string;
  columns: ColumnInfo[];
}

/**
 * Schema viewer component displaying table structure.
 */
export function SchemaViewer({ tableName, columns }: SchemaViewerProps) {
  const nullableCount = columns.filter((col) => col.nullable).length;
  const primaryKeyCount = columns.filter((col) => col.isPrimaryKey).length;
  const foreignKeyCount = columns.filter((col) => col.foreignKey).length;

  return (
    <div className="bg-background p-6">
      <div className="mb-6">
        <h2 className="mb-2 font-bold text-2xl text-foreground">{tableName}</h2>
        <p className="text-muted-foreground">
          Table schema and column definitions
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Column Name
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Data Type
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Nullable
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Default
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Constraints
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {columns.map((col) => (
              <tr key={col.name} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {col.name}
                    </span>
                    {col.isPrimaryKey && (
                      <span className="inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 font-medium text-primary text-xs dark:bg-primary/30">
                        <Key className="h-3 w-3" />
                        PK
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="rounded bg-secondary/20 px-2 py-1 text-secondary text-sm dark:bg-secondary/30">
                    {col.type}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 font-medium text-xs ${
                      col.nullable
                        ? "bg-muted text-muted-foreground"
                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {col.nullable ? "Nullable" : "Not Null"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {col.default ? (
                    <code className="rounded bg-muted px-2 py-1 text-muted-foreground text-sm">
                      {col.default}
                    </code>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">
                      none
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {col.isUnique && (
                      <span className="inline-flex items-center rounded bg-secondary/20 px-2 py-0.5 font-medium text-secondary text-xs dark:bg-secondary/30">
                        Unique
                      </span>
                    )}
                    {col.foreignKey && (
                      <span className="inline-flex items-center gap-1 rounded bg-secondary/20 px-2 py-0.5 font-medium text-secondary text-xs dark:bg-secondary/30">
                        <Link2 className="h-3 w-3" />
                        FK: {col.foreignKey.table}.{col.foreignKey.column}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted p-4">
        <h3 className="mb-2 font-semibold text-foreground text-sm">
          Statistics
        </h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Columns:</span>
            <span className="ml-2 font-medium text-foreground">
              {columns.length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Nullable:</span>
            <span className="ml-2 font-medium text-foreground">
              {nullableCount}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Primary Keys:</span>
            <span className="ml-2 font-medium text-foreground">
              {primaryKeyCount}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Foreign Keys:</span>
            <span className="ml-2 font-medium text-foreground">
              {foreignKeyCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
