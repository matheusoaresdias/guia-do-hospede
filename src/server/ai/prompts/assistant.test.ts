import { describe, it, expect } from 'vitest';
import { buildAssistantSystemPrompt } from '@/server/ai/prompts/assistant';
import { propertySchema, type Property } from '@/domain/property';
import type { ExperienceGuide } from '@/domain/experience-guide';
import seedData from '@/server/db/seed-data.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProperty(code: string): Property {
  const data = seedData.find((p) => p.code === code);
  if (!data) throw new Error(`Imóvel ${code} não encontrado no seed`);
  // Valida em vez de castear: o teste também prova que o seed casa com o schema.
  return propertySchema.parse(data);
}

const fakeGuide: ExperienceGuide = {
  welcome_message: 'Bem-vindo a Florianópolis!',
  restaurants: [
    { name: 'Restaurante A', distance: 'Aprox. 1 km', description: 'Comida italiana.' },
    { name: 'Restaurante B', distance: 'Aprox. 2 km', description: 'Frutos do mar.' },
    { name: 'Restaurante C', distance: 'Aprox. 3 km', description: 'Comida brasileira.' },
    { name: 'Restaurante D', distance: 'Aprox. 4 km', description: 'Café colonial.' },
  ],
  attractions: [
    { name: 'Praia A', distance: 'Aprox. 5 km', description: 'Praia bonita.' },
    { name: 'Mirante B', distance: 'Aprox. 6 km', description: 'Vista panorâmica.' },
    { name: 'Parque C', distance: 'Aprox. 7 km', description: 'Natureza.' },
  ],
  essentials: [
    {
      name: 'Farmácia 24h',
      distance: 'Aprox. 500 m',
      description: 'Farmácia.',
      type: 'pharmacy',
    },
  ],
  seasonal_tip: 'Protetor solar é essencial.',
};

// ---------------------------------------------------------------------------
// buildAssistantSystemPrompt
// ---------------------------------------------------------------------------

describe('buildAssistantSystemPrompt', () => {
  it('contém a senha do WiFi do imóvel FLN001', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildAssistantSystemPrompt(fln001, fakeGuide);
    expect(prompt).toContain('senha "floripa2024"');
  });

  it('contém o telefone do anfitrião do FLN001', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildAssistantSystemPrompt(fln001, fakeGuide);
    expect(prompt).toContain('Telefone: +5548991234567');
  });

  it('indica que animais NÃO são permitidos no FLN001', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildAssistantSystemPrompt(fln001, fakeGuide);
    expect(prompt).toContain('Animais de estimação: NÃO PERMITIDO');
  });

  it('indica que animais SÃO permitidos no GRM001', () => {
    const grm001 = getProperty('GRM001');
    const prompt = buildAssistantSystemPrompt(grm001, fakeGuide);
    expect(prompt).toContain('Animais de estimação: PERMITIDO');
  });

  it('contém check-in às 14:00 para GRM001', () => {
    const grm001 = getProperty('GRM001');
    const prompt = buildAssistantSystemPrompt(grm001, fakeGuide);
    expect(prompt).toContain('Check-in: 14:00');
  });

  it('gera prompt mesmo com guide null e ainda contém dados operacionais', () => {
    const fln001 = getProperty('FLN001');
    const prompt = buildAssistantSystemPrompt(fln001, null);
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('senha "floripa2024"');
    expect(prompt).toContain('ainda não foi gerado');
  });

  it('gera prompts diferentes para FLN001 e GRM001', () => {
    const fln001 = getProperty('FLN001');
    const grm001 = getProperty('GRM001');
    const promptFln = buildAssistantSystemPrompt(fln001, fakeGuide);
    const promptGrm = buildAssistantSystemPrompt(grm001, fakeGuide);
    expect(promptFln).not.toBe(promptGrm);
  });
});
