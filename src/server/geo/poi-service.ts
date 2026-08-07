import 'server-only';
import { geocodeAddress } from './nominatim';
import { fetchNearbyPois, type RawPoiCandidate, type RawPoiCategory } from './overpass';
import { haversineMeters } from './distance';
import {
  findPoisByPropertyId,
  insertPois,
} from '../repositories/pois';
import type { Property } from '../../domain/property';

export type RankedPoiCandidate = RawPoiCandidate & { distance_m: number };

export type GroundedCandidates = {
  restaurants: RankedPoiCandidate[];
  attractions: RankedPoiCandidate[];
  pharmacies: RankedPoiCandidate[];
  supermarkets: RankedPoiCandidate[];
  hospitals: RankedPoiCandidate[];
};

const CATEGORY_KEYS: Record<RawPoiCategory, keyof GroundedCandidates> = {
  restaurant: 'restaurants',
  attraction: 'attractions',
  pharmacy: 'pharmacies',
  supermarket: 'supermarkets',
  hospital: 'hospitals',
};

/**
 * Obtém candidatos geográficos reais para o guia do imóvel.
 * Usa cache permanente (tabela property_pois).
 * Se a cobertura for insuficiente para o schema do guia, retorna null
 * para o sistema cair no caminho antigo (apenas LLM, source='llm').
 */
export async function getGroundedCandidates(
  property: Property & { id: number },
): Promise<GroundedCandidates | null> {
  // 1. Tenta cache
  const cached = await findPoisByPropertyId(property.id);
  if (cached) {
    return buildGroundedCandidates(cached.pois, cached);
  }

  // 2. Geocode
  const geo = await geocodeAddress(property.address);
  if (!geo) return null;

  // 3. Overpass
  const pois = await fetchNearbyPois(geo);
  if (!pois) return null;

  // 4. Persiste cache (todos os candidatos, sem corte)
  const inserted = await insertPois(property.id, geo.lat, geo.lon, pois);

  // 5. Monta GroundedCandidates e verifica suficiência
  return buildGroundedCandidates(inserted.pois, inserted);
}

/**
 * Agrupa, ordena e corta os candidatos.
 * Verifica suficiência mínima: pelo menos 4 restaurantes, 3 atrações,
 * 1 farmácia, 1 supermercado e 1 hospital.
 */
function buildGroundedCandidates(
  rawCandidates: RawPoiCandidate[],
  center: { lat: number; lon: number },
): GroundedCandidates | null {
  const rawGrouped: Record<keyof GroundedCandidates, RawPoiCandidate[]> = {
    restaurants: [],
    attractions: [],
    pharmacies: [],
    supermarkets: [],
    hospitals: [],
  };

  for (const c of rawCandidates) {
    const key = CATEGORY_KEYS[c.category];
    if (key) {
      rawGrouped[key].push(c);
    }
  }

  // Calcula distância, ordena e corta em 15
  const grouped: GroundedCandidates = {
    restaurants: [],
    attractions: [],
    pharmacies: [],
    supermarkets: [],
    hospitals: [],
  };
  for (const key of Object.keys(rawGrouped) as (keyof GroundedCandidates)[]) {
    grouped[key] = rawGrouped[key]
      .map((c) => ({
        ...c,
        distance_m: haversineMeters(center, { lat: c.lat, lon: c.lon }),
      }))
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 15);
  }

  // Verifica suficiência
  if (
    grouped.restaurants.length < 4 ||
    grouped.attractions.length < 3 ||
    grouped.pharmacies.length < 1 ||
    grouped.supermarkets.length < 1 ||
    grouped.hospitals.length < 1
  ) {
    return null;
  }

  return grouped;
}
