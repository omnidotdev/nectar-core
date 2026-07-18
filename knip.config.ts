import type { KnipConfig } from "knip";

/**
 * Knip configuration.
 * @see https://knip.dev/overview/configuration
 */
const knipConfig: KnipConfig = {
  entry: ["src/index.ts", "src/server.ts", "src/**/*.test.{ts,tsx}"],
  project: ["src/**/*.{ts,tsx}"],
  ignoreExportsUsedInFile: true,
  ignore: ["**/*.gen.*"],
  tags: ["-knipignore"],
};

export default knipConfig;
