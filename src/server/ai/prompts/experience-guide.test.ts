import { describe, it, expect } from 'vitest';
import {
  buildExperienceGuideSystemPrompt,
  buildExperienceGuideUserPrompt,
  buildGroundedExperienceGuideSystemPrompt,
  buildGroundedExperienceGuideUserPrompt,
} from '@/server/ai/prompts/experience-guide';
import { propertySchema, type Property } from '@/domain/property';
import seedData from '@/server/db/seed-data.json';
import type { GroundedCandidates } from '@/server/geo/poi-service';

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

// ---------------------------------------------------------------------------
// buildGroundedExperienceGuideSystemPrompt
// ---------------------------------------------------------------------------

describe('buildGroundedExperienceGuideSystemPrompt', () => {
  it('contém a instrução de restrição à lista de candidatos', () => {
    const prompt = buildGroundedExperienceGuideSystemPrompt();
    expect(prompt).toContain('CANDIDATOS REAIS');
    expect(prompt).toContain('PROIBIDO incluir qualquer nome');
  });

  it('mantém as cardinalidades 4/5 para restaurantes', () => {
    const prompt = buildGroundedExperienceGuideSystemPrompt();
    expect(prompt).toContain('MÍNIMO 4');
    expect(prompt).toContain('MÁXIMO 5');
  });
});

// ---------------------------------------------------------------------------
// buildGroundedExperienceGuideUserPrompt
// ---------------------------------------------------------------------------

describe('buildGroundedExperienceGuideUserPrompt', () => {
  const fakeCandidates: GroundedCandidates = {
    restaurants: [
      { name: 'Bistrô A', category: 'restaurant', lat: -27.6007, lon: -48.5191, distance_m: 150 },
      { name: 'Bistrô B', category: 'restaurant', lat: -27.6010, lon: -48.5200, distance_m: 200 },
      { name: 'Bistrô C', category: 'restaurant', lat: -27.6020, lon: -48.5180, distance_m: 300 },
      { name: 'Bistrô D', category: 'restaurant', lat: -27.5990, lon: -48.5170, distance_m: 400 },
    ],
    attractions: [
      { name: 'Museu X', category: 'attraction', lat: -27.6030, lon: -48.5160, distance_m: 500 },
      { name: 'Praça Y', category: 'attraction', lat: -27.6040, lon: -48.5150, distance_m: 600 },
      { name: 'Teatro Z', category: 'attraction', lat: -27.6050, lon: -48.5140, distance_m: 700 },
    ],
    pharmacies: [
      { name: 'Farmácia 24h', category: 'pharmacy', lat: -27.6015, lon: -48.5185, distance_m: 120 },
    ],
    supermarkets: [
      { name: 'Supermercado Bom', category: 'supermarket', lat: -27.6060, lon: -48.5130, distance_m: 450 },
    ],
    hospitals: [
      { name: 'Hospital Central', category: 'hospital', lat: -27.6070, lon: -48.5120, distance_m: 800 },
    ],
  };

  it('inclui apenas os nomes da lista de candidatos', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildGroundedExperienceGuideUserPrompt(fln001, fakeCandidates);
    expect(prompt).toContain('Bistrô A');
    expect(prompt).toContain('Museu X');
    expect(prompt).toContain('Farmácia 24h');
  });

  it('inclui distâncias em metros calculadas para cada candidato', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildGroundedExperienceGuideUserPrompt(fln001, fakeCandidates);
    // Deve conter alguma distância numérica entre parênteses
    expect(prompt).toMatch(/\(\d+ m\)/);
  });

  it('inclui cidade e estado do imóvel', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildGroundedExperienceGuideUserPrompt(fln001, fakeCandidates);
    expect(prompt).toContain('Florianópolis');
    expect(prompt).toContain('SC');
  });
});
