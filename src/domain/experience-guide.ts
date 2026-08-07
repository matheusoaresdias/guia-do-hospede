import { z } from 'zod';

/** Item de lugar comum (restaurante, atração) */
export const placeSchema = z.object({
  name: z.string().min(1),
  distance: z.string().min(1),
  description: z.string().min(1),
});

/** Item de essencial (extensão de lugar com tipo) */
export const essentialSchema = placeSchema.extend({
  type: z.enum(['pharmacy', 'supermarket', 'hospital', 'other']),
});

/** Guia de experiências gerado pela IA */
export const experienceGuideSchema = z.object({
  welcome_message: z.string().min(1),
  restaurants: z.array(placeSchema).min(4).max(5),
  attractions: z.array(placeSchema).min(3).max(4),
  essentials: z.array(essentialSchema).min(1),
  seasonal_tip: z.string().min(1),
});

export type Place = z.infer<typeof placeSchema>;
export type Essential = z.infer<typeof essentialSchema>;
export type ExperienceGuide = z.infer<typeof experienceGuideSchema>;

/**
 * Calcula a estação no formato YYYY-Qn para um determinado momento.
 * O trimestre é determinado pelo mês civil:
 * Q1 = jan-mar, Q2 = abr-jun, Q3 = jul-set, Q4 = out-dez.
 */
export function currentSeason(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = janeiro)
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
}
