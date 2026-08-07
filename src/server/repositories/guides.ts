import 'server-only';
import db from '../db/client';
import { experienceGuides } from '../db/schema';
import type { ExperienceGuide } from '../../domain/experience-guide';
import { eq } from 'drizzle-orm';

/** Linha retornada do repositório de guias */
export type GuideRecord = {
  content: ExperienceGuide;
  model: string;
  season: string;
  source: string;
  generated_at: Date;
};

/**
 * Busca o guia de um imóvel pelo id do banco.
 * Retorna null se não houver guia gerado.
 */
export async function findGuideByPropertyId(
  propertyId: number
): Promise<GuideRecord | null> {
  const rows = await db
    .select({
      content: experienceGuides.content,
      model: experienceGuides.model,
      season: experienceGuides.season,
      source: experienceGuides.source,
      generated_at: experienceGuides.generated_at,
    })
    .from(experienceGuides)
    .where(eq(experienceGuides.property_id, propertyId))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) return null;

  return {
    content: row.content as ExperienceGuide,
    model: row.model,
    season: row.season,
    source: row.source,
    generated_at: row.generated_at,
  };
}

/**
 * Tenta inserir um guia. Se já existir (conflito em property_id único),
 * retorna o guia existente.
 */
export async function insertGuideIfAbsent(
  propertyId: number,
  content: ExperienceGuide,
  model: string,
  season: string,
  source: string,
): Promise<GuideRecord> {
  const result = await db
    .insert(experienceGuides)
    .values({
      property_id: propertyId,
      content,
      model,
      season,
      source,
    })
    .onConflictDoNothing()
    .returning();

  if (result.length > 0) {
    const row = result[0];
    return {
      content: row.content as ExperienceGuide,
      model: row.model,
      season: row.season,
      source: row.source,
      generated_at: row.generated_at,
    };
  }

  // Conflito – reler o guia existente
  const existing = await findGuideByPropertyId(propertyId);
  if (!existing) {
    throw new Error(
      `Guia não encontrado após conflito para property_id=${propertyId}`
    );
  }
  return existing;
}

/**
 * Substitui o guia de um imóvel (usa delete + insert para garantir troca).
 */
export async function replaceGuide(
  propertyId: number,
  content: ExperienceGuide,
  model: string,
  season: string,
  source: string,
): Promise<GuideRecord> {
  await db
    .delete(experienceGuides)
    .where(eq(experienceGuides.property_id, propertyId));

  const inserted = await db
    .insert(experienceGuides)
    .values({
      property_id: propertyId,
      content,
      model,
      season,
      source,
    })
    .returning();

  const row = inserted[0];
  return {
    content: row.content as ExperienceGuide,
    model: row.model,
    season: row.season,
    source: row.source,
    generated_at: row.generated_at,
  };
}
