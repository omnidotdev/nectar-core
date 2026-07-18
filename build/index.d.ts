import * as react from 'react';
import { ReactNode } from 'react';
import { C as ColumnInfo, N as NectarDataSource, T as TableDataParams, a as TableDataResult, b as TableFilter, c as TableSchema, d as TableInfo } from './DataSource-DN5ZduHE.js';
export { A as AutocompleteSchema, e as ConnectionStatus, F as ForeignKeyInfo, f as NectarCapabilities, P as PrimaryKeyRef, Q as QueryResult } from './DataSource-DN5ZduHE.js';
import * as _tanstack_query_core from '@tanstack/query-core';
import * as _tanstack_react_query from '@tanstack/react-query';

interface DataGridProps {
    schema: string;
    tableName: string;
    columns: ColumnInfo[];
}
/**
 * Data grid component for viewing and editing table data.
 */
declare function DataGrid({ schema, tableName, columns }: DataGridProps): react.JSX.Element;

/**
 * SQL query interface component with CodeMirror editor.
 */
declare function QueryInterface(): react.JSX.Element;

interface SchemaViewerProps {
    tableName: string;
    columns: ColumnInfo[];
}
/**
 * Schema viewer component displaying table structure.
 */
declare function SchemaViewer({ tableName, columns }: SchemaViewerProps): react.JSX.Element;

interface SchemaContextValue {
    selectedSchema: string;
    setSelectedSchema: (schema: string) => void;
    schemas: string[];
    setSchemas: (schemas: string[]) => void;
}
declare function SchemaProvider({ children }: {
    children: ReactNode;
}): react.JSX.Element;
declare function useSchema(): SchemaContextValue;

declare function NectarProvider({ dataSource, children, }: {
    dataSource: NectarDataSource;
    children: ReactNode;
}): react.JSX.Element;
declare function useNectarDataSource(): NectarDataSource;

/**
 * Query options for fetching the list of tables.
 */
declare const tablesOptions: (ds: NectarDataSource) => _tanstack_query_core.OmitKeyof<_tanstack_react_query.UseQueryOptions<TableInfo[], Error, TableInfo[], string[]>, "queryFn"> & {
    queryFn?: _tanstack_query_core.QueryFunction<TableInfo[], string[], never> | undefined;
} & {
    queryKey: string[] & {
        [dataTagSymbol]: TableInfo[];
        [dataTagErrorSymbol]: Error;
    };
};
/**
 * Query options for fetching a table's schema.
 */
declare const tableSchemaOptions: (ds: NectarDataSource, schema: string, table: string) => _tanstack_query_core.OmitKeyof<_tanstack_react_query.UseQueryOptions<TableSchema, Error, TableSchema, string[]>, "queryFn"> & {
    queryFn?: _tanstack_query_core.QueryFunction<TableSchema, string[], never> | undefined;
} & {
    queryKey: string[] & {
        [dataTagSymbol]: TableSchema;
        [dataTagErrorSymbol]: Error;
    };
};
/**
 * Query options for fetching paginated table data with sorting and filtering.
 */
declare const tableDataOptions: (ds: NectarDataSource, { schema, table, page, pageSize, sortColumn, sortDirection, filters, }: TableDataParams) => _tanstack_query_core.OmitKeyof<_tanstack_react_query.UseQueryOptions<TableDataResult, Error, TableDataResult, (string | number | TableFilter[] | undefined)[]>, "queryFn"> & {
    queryFn?: _tanstack_query_core.QueryFunction<TableDataResult, (string | number | TableFilter[] | undefined)[], never> | undefined;
} & {
    queryKey: (string | number | TableFilter[] | undefined)[] & {
        [dataTagSymbol]: TableDataResult;
        [dataTagErrorSymbol]: Error;
    };
};

export { ColumnInfo, DataGrid, NectarDataSource, NectarProvider, QueryInterface, SchemaProvider, SchemaViewer, TableDataParams, TableDataResult, TableFilter, TableInfo, TableSchema, tableDataOptions, tableSchemaOptions, tablesOptions, useNectarDataSource, useSchema };
