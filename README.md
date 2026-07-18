<div align="center">

# Nectar Core

Embeddable Postgres database-browser core

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.md)

</div>

## Overview

`@omnidotdev/nectar-core` is the framework-neutral, embeddable core behind
[Nectar](https://nectar.omni.dev). It ships the presentational database-browser
components (data grid, schema viewer, SQL query interface), the `NectarDataSource`
contract that decouples the UI from any backend, and a server-only Postgres
connection manager plus introspection layer.

It ships pre-built ESM + type declarations in `build/` (produced by `bun run build`
via [tsup](https://tsup.egoist.dev) and committed to the repo) and is consumed via
`github:omnidotdev/nectar-core#<sha>`, the same way `@omnidotdev/thornberry` and
`@omnidotdev/providers` are consumed.

## Entry points

Two entry points keep `postgres` out of client bundles:

- `@omnidotdev/nectar-core` (client-safe): `NectarProvider`, `useNectarDataSource`,
  the `DataGrid` / `SchemaViewer` / `QueryInterface` components, the
  `SchemaProvider` / `useSchema` context, the TanStack Query option factories
  (`tablesOptions`, `tableSchemaOptions`, `tableDataOptions`), and all of the
  `NectarDataSource` / database type definitions. This path never imports
  `postgres`.
- `@omnidotdev/nectar-core/server` (server-only): the connection manager
  (`createConnection`, `getConnection`, `closeConnection`, `hasConnection`,
  `getConnectionInfo`, `cleanupIdleConnections`) and the introspection functions
  (`listTables`, `describeTable`, `readTableData`, `runQuery`,
  `autocompleteSchema`, `insertRow`, `updateRow`, `deleteRow`) plus the
  `SerializableRow` helpers. This is the only path that imports `postgres`.

## Usage

Provide a concrete `NectarDataSource` (backed by the server helpers, or any other
implementation) and mount the browser components under a `NectarProvider`:

```tsx
import {
  NectarProvider,
  SchemaProvider,
  DataGrid,
  SchemaViewer,
  QueryInterface,
} from "@omnidotdev/nectar-core";

function Browser({ dataSource, schema, table, columns }) {
  return (
    <NectarProvider dataSource={dataSource}>
      <SchemaProvider>
        <SchemaViewer tableName={table} columns={columns} />
        <DataGrid schema={schema} tableName={table} columns={columns} />
        <QueryInterface />
      </SchemaProvider>
    </NectarProvider>
  );
}
```

On the server, open a connection and drive the introspection layer:

```ts
import {
  createConnection,
  getConnection,
  listTables,
} from "@omnidotdev/nectar-core/server";

const { sessionId } = await createConnection(connectionString, { readOnly: true });
const sql = getConnection(sessionId);
const tables = await listTables(sql);
```

## Peer dependencies

`react`, `react-dom`, and `@tanstack/react-query` are provided by the host.

## License

The code in this repository is licensed under Apache 2.0, &copy; [Omni LLC](https://omni.dev). See [LICENSE.md](LICENSE.md) for more information.
