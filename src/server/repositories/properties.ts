import 'server-only';
import db from '../db/client';
import { properties } from '../db/schema';
import {
  propertySchema,
  normalizePropertyCode,
  type Property,
} from '../../domain/property';
import { eq } from 'drizzle-orm';

/** Registro completo do imóvel incluindo o id do banco */
export type PropertyRecord = Property & { id: number };

/**
 * Busca imóvel pelo código normalizado (trim + uppercase).
 * Retorna null se não existir.
 */
export async function findPropertyByCode(
  code: string
): Promise<PropertyRecord | null> {
  const normalized = normalizePropertyCode(code);
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.code, normalized))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) return null;

  // Separa o id para validar o corpo do imóvel com o schema Zod
  const { id, ...rest } = row;
  const validated = propertySchema.parse(rest);
  return { id, ...validated };
}

/**
 * Lista todos os códigos de imóveis cadastrados.
 */
export async function listPropertyCodes(): Promise<string[]> {
  const rows = await db
    .select({ code: properties.code })
    .from(properties);
  return rows.map((r) => r.code);
}
