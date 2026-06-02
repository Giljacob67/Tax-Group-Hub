/**
 * Drizzle custom type for `pgvector` `vector` columns WITHOUT a fixed
 * dimension. The default drizzle-orm `vector(N)` builder pins the dim at
 * schema-creation time; this custom type lets one column hold embeddings
 * from any provider (Google 768, OpenAI 1536, Ollama 768/1024).
 *
 * The trade-off: this disables some query-builder type inference in
 * drizzle. The driver `data` is `number[]`; the underlying DB type is
 * unconstrained `vector`. pgvector-specific operators (`<=>`, `<->`, …)
 * still work via `sql` templates.
 */
import { customType } from "drizzle-orm/pg-core";

export const dimAgnosticVector = customType<{
  data: number[];
  driverData: string | number[];
}>({
  dataType() {
    return "vector";
  },
  toDriver(value: number[]): string {
    if (!Array.isArray(value)) {
      throw new TypeError("dimAgnosticVector: expected number[]");
    }
    // pgvector accepts a text representation '[1,2,3]'.
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value as number[];
    if (typeof value === "string") {
      // pgvector may return either '[1,2,3]' or '{1,2,3}'.
      const trimmed = value.replace(/^[\[{]/, "").replace(/[\]}]$/, "");
      if (trimmed === "") return [];
      return trimmed.split(",").map((n) => Number(n));
    }
    return [];
  },
});
