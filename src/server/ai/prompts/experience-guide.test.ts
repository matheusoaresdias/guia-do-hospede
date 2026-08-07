import { describe, it, expect } from 'vitest';
import {
  buildExperienceGuideSystemPrompt,
  buildExperienceGuideUserPrompt,
} from '@/server/ai/prompts/experience-guide';
import { propertySchema, type Property } from '@/domain/property';
import seedData from '@/server/db/seed-data.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProperty(code: string): Property {
  const data = seedData.find((p) => p.code === code);
  if (!data) throw new Error(`Imóvel ${code} não encontrado no seed`);
  return propertySchema.parse(data);
}

// ---------------------------------------------------------------------------
// buildExperienceGuideUserPrompt
// ---------------------------------------------------------------------------

describe('buildExperienceGuideUserPrompt', () => {
  it('inclui cidade, estado e bairro do imóvel', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildExperienceGuideUserPrompt(fln001, new Date(2026, 6, 15));
    expect(prompt).toContain('Florianópolis');
    expect(prompt).toContain('SC');
    expect(prompt).toContain('Trindade');
  });

  it('inclui o mês correspondente à data passada (julho)', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildExperienceGuideUserPrompt(fln001, new Date(2026, 6, 15));
    expect(prompt).toContain('julho');
  });

  it('inclui o endereço completo do imóvel', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildExperienceGuideUserPrompt(fln001, new Date(2026, 6, 15));
    expect(prompt).toContain('Rua Lauro Linhares');
    expect(prompt).toContain('589');
    expect(prompt).toContain('88036-001');
  });
});

// ---------------------------------------------------------------------------
// buildExperienceGuideSystemPrompt
// ---------------------------------------------------------------------------

describe('buildExperienceGuideSystemPrompt', () => {
  it('menciona as cardinalidades 4/5 para restaurantes', () => {
    const prompt = buildExperienceGuideSystemPrompt();
    expect(prompt).toContain('MÍNIMO 4');
    expect(prompt).toContain('MÁXIMO 5');
  });

  it('menciona as cardinalidades 3/4 para atrações', () => {
    const prompt = buildExperienceGuideSystemPrompt();
    expect(prompt).toContain('MÍNIMO 3');
    expect(prompt).toContain('MÁXIMO 4');
  });

  it('contém a proibição de inventar lugares', () => {
    const prompt = buildExperienceGuideSystemPrompt();
    expect(prompt).toContain('NA DÚVIDA');
  });
});
