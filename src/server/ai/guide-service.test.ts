import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOrCreateExperienceGuide } from '@/server/ai/guide-service';
import type { Property } from '@/domain/property';
import type { ExperienceGuide } from '@/domain/experience-guide';
import type { GroundedCandidates } from '@/server/geo/poi-service';

const propertyWithId: Property & { id: number } = {
  id: 1,
  code: 'FLN001',
  name: 'Apartamento Floripa',
  property_type: 'Apartamento',
  bedroom_quantity: 2,
  bathroom_quantity: 1,
  guest_capacity: 4,
  address: {
    street: 'Rua Lauro Linhares',
    number: '589',
    complement: null,
    neighborhood: 'Trindade',
    city: 'Florianópolis',
    state: 'SC',
    postal_code: '88036-001',
  },
  operational: {
    wifi_network: 'Zoe',
    wifi_password: 'floripa2024',
    is_self_checkin: true,
    property_access_type: 'portaria',
    property_access_instructions: 'Retire a chave na portaria.',
    property_password: '1234',
    has_parking_spot: false,
    parking_spot_identifier: null,
    parking_spot_instructions: null,
  },
  rules: {
    check_in_time: '14:00',
    check_out_time: '11:00',
    allow_pet: false,
    smoking_permitted: false,
    suitable_for_children: true,
    suitable_for_babies: false,
    events_permitted: false,
  },
  amenities: { wifi: true, ar_condicionado: true },
  images: ['https://example.com/img1.jpg'],
  host: { name: 'Matheus', phone: '+5548991234567' },
};

const validGuide: ExperienceGuide = {
  welcome_message: 'Bem-vindo!',
  restaurants: [
    { name: 'R1', distance: 'Aprox. 100 m', description: 'Bom' },
    { name: 'R2', distance: 'Aprox. 200 m', description: 'Ótimo' },
    { name: 'R3', distance: 'Aprox. 300 m', description: 'Excelente' },
    { name: 'R4', distance: 'Aprox. 400 m', description: 'Maravilhoso' },
  ],
  attractions: [
    { name: 'A1', distance: 'Aprox. 500 m', description: 'Legal' },
    { name: 'A2', distance: 'Aprox. 600 m', description: 'Bonito' },
    { name: 'A3', distance: 'Aprox. 700 m', description: 'Imperdível' },
  ],
  essentials: [
    { name: 'Farmácia', distance: 'Aprox. 50 m', description: '24h', type: 'pharmacy' },
  ],
  seasonal_tip: 'Use protetor solar.',
};

const groundedCandidates: GroundedCandidates = {
  restaurants: [
    { name: 'Real R1', category: 'restaurant', lat: -27.6, lon: -48.5, distance_m: 100 },
    { name: 'Real R2', category: 'restaurant', lat: -27.601, lon: -48.501, distance_m: 200 },
    { name: 'Real R3', category: 'restaurant', lat: -27.602, lon: -48.502, distance_m: 300 },
    { name: 'Real R4', category: 'restaurant', lat: -27.603, lon: -48.503, distance_m: 400 },
  ],
  attractions: [
    { name: 'Real A1', category: 'attraction', lat: -27.604, lon: -48.504, distance_m: 500 },
    { name: 'Real A2', category: 'attraction', lat: -27.605, lon: -48.505, distance_m: 600 },
    { name: 'Real A3', category: 'attraction', lat: -27.606, lon: -48.506, distance_m: 700 },
  ],
  pharmacies: [
    { name: 'Real F1', category: 'pharmacy', lat: -27.607, lon: -48.507, distance_m: 150 },
  ],
  supermarkets: [
    { name: 'Real S1', category: 'supermarket', lat: -27.608, lon: -48.508, distance_m: 250 },
  ],
  hospitals: [
    { name: 'Real H1', category: 'hospital', lat: -27.609, lon: -48.509, distance_m: 800 },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getOrCreateExperienceGuide', () => {
  it('guia persistido com source: "osm" quando getGroundedCandidates retorna candidatos suficientes', async () => {
    const poiServiceModule = await import('@/server/geo/poi-service');
    const providerModule = await import('@/server/ai/provider');
    const guidesRepo = await import('@/server/repositories/guides');
    const nominatim = await import('@/server/geo/nominatim');

    vi.spyOn(guidesRepo, 'findGuideByPropertyId').mockResolvedValue(null);
    vi.spyOn(poiServiceModule, 'getGroundedCandidates').mockResolvedValue(groundedCandidates);
    vi.spyOn(nominatim, 'geocodeAddress').mockResolvedValue({ lat: -27.6, lon: -48.5 });
    vi.spyOn(providerModule, 'getLlmProvider').mockReturnValue({
      generateJson: vi.fn().mockResolvedValue(validGuide),
      streamText: vi.fn(),
    });
    vi.spyOn(guidesRepo, 'insertGuideIfAbsent').mockResolvedValue({
      content: validGuide,
      model: 'deepseek-v4-flash',
      season: '2026-Q3',
      source: 'osm',
      generated_at: new Date(),
    });

    const result = await getOrCreateExperienceGuide(propertyWithId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.generated).toBe(true);
    }
    expect(guidesRepo.insertGuideIfAbsent).toHaveBeenCalledWith(
      expect.any(Number),
      expect.anything(),
      expect.any(String),
      expect.any(String),
      'osm',
    );
  });

  it('guia persistido com source: "llm" quando getGroundedCandidates retorna null', async () => {
    const poiServiceModule = await import('@/server/geo/poi-service');
    const providerModule = await import('@/server/ai/provider');
    const guidesRepo = await import('@/server/repositories/guides');

    vi.spyOn(guidesRepo, 'findGuideByPropertyId').mockResolvedValue(null);
    vi.spyOn(poiServiceModule, 'getGroundedCandidates').mockResolvedValue(null);
    vi.spyOn(providerModule, 'getLlmProvider').mockReturnValue({
      generateJson: vi.fn().mockResolvedValue(validGuide),
      streamText: vi.fn(),
    });
    vi.spyOn(guidesRepo, 'insertGuideIfAbsent').mockResolvedValue({
      content: validGuide,
      model: 'deepseek-v4-flash',
      season: '2026-Q3',
      source: 'llm',
      generated_at: new Date(),
    });

    const result = await getOrCreateExperienceGuide(propertyWithId);
    expect(result.ok).toBe(true);
    expect(guidesRepo.insertGuideIfAbsent).toHaveBeenCalledWith(
      expect.any(Number),
      expect.anything(),
      expect.any(String),
      expect.any(String),
      'llm',
    );
  });
});
