import 'server-only';
import db from '../db/client';
import { propertyPois } from '../db/schema';
import type { RawPoiCandidate } from '../geo/overpass';
import { eq } from 'drizzle-orm';

export type PoiRecord = {
  lat: number;
  lon: number;
  pois: RawPoiCandidate[];
  fetched_at: Date;
};

/**
 * Busca os POIs cacheados de um imóvel.
 */
export async function findPoisByPropertyId(
  propertyId: number,
): Promise<PoiRecord | null> {
  const rows = await db
    .select({
      lat: propertyPois.lat,
      lon: propertyPois.lon,
      pois: propertyPois.pois,
      fetched_at: propertyPois.fetched_at,
    })
    .from(propertyPois)
    .where(eq(propertyPois.property_id, propertyId))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) return null;

  return {
    lat: row.lat,
    lon: row.lon,
    pois: row.pois as RawPoiCandidate[],
    fetched_at: row.fetched_at,
  };
}

/**
 * Insere um registro de POIs para o imóvel.
 * Se já existir (concorrência), faz onConflictDoNothing e relê.
 */
export async function insertPois(
  propertyId: number,
  lat: number,
  lon: number,
  pois: RawPoiCandidate[],
): Promise<PoiRecord> {
  const result = await db
    .insert(propertyPois)
    .values({
      property_id: propertyId,
      lat,
      lon,
      pois,
    })
    .onConflictDoNothing()
    .returning();

  if (result.length > 0) {
    const row = result[0];
    return {
      lat: row.lat,
      lon: row.lon,
      pois: row.pois as RawPoiCandidate[],
      fetched_at: row.fetched_at,
    };
  }

  // Conflito — reler
  const existing = await findPoisByPropertyId(propertyId);
  if (!existing) {
    throw new Error(
      `POIs não encontrados após conflito para property_id=${propertyId}`,
    );
  }
  return existing;
}
