import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

/**
 * Library build for github: consumption (the omni metarepo pattern).
 *
 * Emits build/index.js (client-safe) and build/server.js (server-only, the
 * only entry that pulls in postgres) as ESM with co-located declarations.
 * Every runtime dependency and peer dependency stays a bare import resolved by
 * the consumer; nothing is bundled into the output, so react/postgres/codemirror
 * resolve to the consuming app's single installed copy.
 */
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
  },
  format: ["esm"],
  dts: true,
  outDir: "build",
  external,
  splitting: false,
  clean: true,
  sourcemap: false,
});
