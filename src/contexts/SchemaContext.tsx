import { createContext, useContext, useMemo, useState } from "react";

import type { ReactNode } from "react";

interface SchemaContextValue {
  selectedSchema: string;
  setSelectedSchema: (schema: string) => void;
  schemas: string[];
  setSchemas: (schemas: string[]) => void;
}

const SchemaContext = createContext<SchemaContextValue | null>(null);

export function SchemaProvider({ children }: { children: ReactNode }) {
  const [selectedSchema, setSelectedSchema] = useState("public");
  const [schemas, setSchemas] = useState<string[]>(["public"]);

  const value = useMemo(
    () => ({
      selectedSchema,
      setSelectedSchema,
      schemas,
      setSchemas,
    }),
    [selectedSchema, schemas],
  );

  return (
    <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>
  );
}

export function useSchema() {
  const context = useContext(SchemaContext);
  if (!context) {
    throw new Error("useSchema must be used within a SchemaProvider");
  }
  return context;
}
