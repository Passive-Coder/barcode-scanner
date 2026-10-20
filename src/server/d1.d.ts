// The parts of Cloudflare's D1 binding the server uses (see developers.cloudflare.com/d1).

interface D1Meta {
  changes: number;
  last_row_id?: number;
}

interface D1Result<T = Record<string, any>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, any>>(): Promise<T | null>;
  first<T = unknown>(column: string): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, any>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
