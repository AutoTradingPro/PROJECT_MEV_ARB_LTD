import { Pool, type QueryResultRow } from "pg";

type GlobalPool = typeof globalThis & { __mevVaultPool?: Pool };

export function vaultPool(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  const g = globalThis as GlobalPool;
  if (!g.__mevVaultPool) {
    g.__mevVaultPool = new Pool({ connectionString: url, max: 4 });
  }
  return g.__mevVaultPool;
}

export async function queryVault<T extends QueryResultRow>(text: string, values: unknown[]): Promise<T[]> {
  const pool = vaultPool();
  if (!pool) return [];
  const result = await pool.query<T>(text, values);
  return result.rows;
}
