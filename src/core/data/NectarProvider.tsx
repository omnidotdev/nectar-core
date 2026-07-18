import { createContext, useContext } from "react";

import type { ReactNode } from "react";
import type { NectarDataSource } from "./DataSource";

const Ctx = createContext<NectarDataSource | null>(null);

export function NectarProvider({
  dataSource,
  children,
}: {
  dataSource: NectarDataSource;
  children: ReactNode;
}) {
  return <Ctx.Provider value={dataSource}>{children}</Ctx.Provider>;
}

export function useNectarDataSource(): NectarDataSource {
  const ds = useContext(Ctx);
  if (!ds) {
    throw new Error("useNectarDataSource must be used within a NectarProvider");
  }
  return ds;
}
