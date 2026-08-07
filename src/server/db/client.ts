import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var __db: ReturnType<typeof drizzle> | undefined;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL não está definida no ambiente. Verifique o arquivo .env.'
    );
  }
  const client = postgres(url);
  return drizzle(client, { schema });
}

const db = globalThis.__db ?? createDb();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db;
}

export default db;
