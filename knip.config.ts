import type { KnipConfig } from "knip";

/**
 * Knip configuration.
 * @see https://knip.dev/overview/configuration
 */
const knipConfig: KnipConfig = {
  entry: ["src/index.ts", "src/server.ts", "src/**/*.test.{ts,tsx}"],
  project: ["src/**/*.{ts,tsx}"],
  ignoreExportsUsedInFile: true,
  // build/ is generated library output (committed for github: consumption);
  // its declarations reference transitive deps knip cannot see from src
  ignore: ["**/*.gen.*", "build/**"],
  tags: ["-knipignore"],
};

export default knipConfig;
