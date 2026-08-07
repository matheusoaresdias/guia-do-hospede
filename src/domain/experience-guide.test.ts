import { describe, it, expect } from 'vitest';
import { experienceGuideSchema, currentSeason } from '@/domain/experience-guide';
import type { ExperienceGuide } from '@/domain/experience-guide';

// ---------------------------------------------------------------------------
// Helpers locais para construir payloads sem repetir objetos gigantes
// ---------------------------------------------------------------------------

function makePlace(name?: string) {
  return {
    name: name ?? 'Lugar Exemplo',
    distance: 'Aprox. 500 m',
    description: 'Um lugar muito agradável para visitar.',
  };
}

function makeEssential(type?: 'pharmacy' | 'supermarket' | 'hospital' | 'other') {
  return {
    ...makePlace('Essencial Exemplo'),
    type: type ?? 'pharmacy',
  };
}

function makeValidGuide(overrides?: Partial<ExperienceGuide>): ExperienceGuide {
  return {
    welcome_message: 'Bem-vindo à cidade! Aproveite sua estadia.',
    restaurants: [
      makePlace('Restaurante 1'),
      makePlace('Restaurante 2'),
      makePlace('Restaurante 3'),
      makePlace('Restaurante 4'),
    ],
    attractions: [
      makePlace('Atração 1'),
      makePlace('Atração 2'),
      makePlace('Atração 3'),
    ],
    essentials: [makeEssential('pharmacy')],
    seasonal_tip: 'Leve guarda-chuva nesta época do ano.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// experienceGuideSchema
// ---------------------------------------------------------------------------

describe('experienceGuideSchema', () => {
  it('aceita um payload válido com 4 restaurantes e 3 atrações', () => {
    const guide = makeValidGuide();
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(true);
  });

  it('aceita payload com 5 restaurantes e 4 atrações', () => {
    const guide = makeValidGuide({
      restaurants: [
        makePlace('R1'),
        makePlace('R2'),
        makePlace('R3'),
        makePlace('R4'),
        makePlace('R5'),
      ],
      attractions: [
        makePlace('A1'),
        makePlace('A2'),
        makePlace('A3'),
        makePlace('A4'),
      ],
    });
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(true);
  });

  it('rejeita payload com 3 restaurantes', () => {
    const guide = makeValidGuide({
      restaurants: [makePlace('R1'), makePlace('R2'), makePlace('R3')],
    });
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(false);
  });

  it('rejeita payload com 6 restaurantes', () => {
    const guide = makeValidGuide({
      restaurants: [
        makePlace('R1'),
        makePlace('R2'),
        makePlace('R3'),
        makePlace('R4'),
        makePlace('R5'),
        makePlace('R6'),
      ],
    });
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(false);
  });

  it('rejeita payload com 2 atrações', () => {
    const guide = makeValidGuide({
      attractions: [makePlace('A1'), makePlace('A2')],
    });
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(false);
  });

  it('rejeita payload com 5 atrações', () => {
    const guide = makeValidGuide({
      attractions: [
        makePlace('A1'),
        makePlace('A2'),
        makePlace('A3'),
        makePlace('A4'),
        makePlace('A5'),
      ],
    });
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(false);
  });

  it('rejeita payload sem o campo welcome_message', () => {
    const guide = makeValidGuide();
    const withoutWelcome: Record<string, unknown> = { ...guide };
    delete withoutWelcome.welcome_message;
    const result = experienceGuideSchema.safeParse(withoutWelcome);
    expect(result.success).toBe(false);
  });

  it('rejeita payload com type de essencial inválido', () => {
    const guide = makeValidGuide({
      essentials: [{ ...makeEssential(), type: 'invalid_type' as never }],
    });
    const result = experienceGuideSchema.safeParse(guide);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// currentSeason
// ---------------------------------------------------------------------------

describe('currentSeason', () => {
  it('devolve 2026-Q1 para janeiro de 2026', () => {
    const date = new Date(2026, 0, 15);
    expect(currentSeason(date)).toBe('2026-Q1');
  });

  it('devolve 2026-Q3 para agosto de 2026', () => {
    const date = new Date(2026, 7, 5);
    expect(currentSeason(date)).toBe('2026-Q3');
  });

  it('devolve 2026-Q4 para dezembro de 2026', () => {
    const date = new Date(2026, 11, 25);
    expect(currentSeason(date)).toBe('2026-Q4');
  });
});
