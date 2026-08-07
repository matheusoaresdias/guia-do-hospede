import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGroundedCandidates } from '@/server/geo/poi-service';
import type { Property } from '@/domain/property';
import type { RawPoiCandidate } from '@/server/geo/overpass';

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

function makePoi(
  name: string,
  category: RawPoiCandidate['category'],
  lat = -27.6,
  lon = -48.5,
): RawPoiCandidate {
  return { name, category, lat, lon };
}

const sufficientPois: RawPoiCandidate[] = [
  makePoi('R1', 'restaurant'),
  makePoi('R2', 'restaurant'),
  makePoi('R3', 'restaurant'),
  makePoi('R4', 'restaurant'),
  makePoi('A1', 'attraction'),
  makePoi('A2', 'attraction'),
  makePoi('A3', 'attraction'),
  makePoi('F1', 'pharmacy'),
  makePoi('S1', 'supermarket'),
  makePoi('H1', 'hospital'),
];

const insufficientRestaurants: RawPoiCandidate[] = [
  makePoi('R1', 'restaurant'),
  makePoi('R2', 'restaurant'),
  makePoi('R3', 'restaurant'), // só 3
  makePoi('A1', 'attraction'),
  makePoi('A2', 'attraction'),
  makePoi('A3', 'attraction'),
  makePoi('F1', 'pharmacy'),
  makePoi('S1', 'supermarket'),
  makePoi('H1', 'hospital'),
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getGroundedCandidates', () => {
  it('cache hit não rechama geocode nem overpass', async () => {
    const poisRepo = await import('@/server/repositories/pois');
    const nominatim = await import('@/server/geo/nominatim');
    const overpass = await import('@/server/geo/overpass');

    vi.spyOn(poisRepo, 'findPoisByPropertyId').mockResolvedValue({
      lat: -27.6,
      lon: -48.5,
      pois: sufficientPois,
      fetched_at: new Date(),
    });
    const geocodeSpy = vi.spyOn(nominatim, 'geocodeAddress');
    const overpassSpy = vi.spyOn(overpass, 'fetchNearbyPois');

    const result = await getGroundedCandidates(propertyWithId);
    expect(result).not.toBeNull();
    expect(result!.restaurants).toHaveLength(4);
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(overpassSpy).not.toHaveBeenCalled();
  });

  it('cache miss chama geocode e overpass e persiste', async () => {
    const poisRepo = await import('@/server/repositories/pois');
    const nominatim = await import('@/server/geo/nominatim');
    const overpass = await import('@/server/geo/overpass');

    vi.spyOn(poisRepo, 'findPoisByPropertyId').mockResolvedValue(null);
    vi.spyOn(nominatim, 'geocodeAddress').mockResolvedValue({ lat: -27.6, lon: -48.5 });
    vi.spyOn(overpass, 'fetchNearbyPois').mockResolvedValue(sufficientPois);
    vi.spyOn(poisRepo, 'insertPois').mockResolvedValue({
      lat: -27.6,
      lon: -48.5,
      pois: sufficientPois,
      fetched_at: new Date(),
    });

    const result = await getGroundedCandidates(propertyWithId);
    expect(result).not.toBeNull();
    expect(nominatim.geocodeAddress).toHaveBeenCalledOnce();
    expect(overpass.fetchNearbyPois).toHaveBeenCalledOnce();
    expect(poisRepo.insertPois).toHaveBeenCalledOnce();
  });

  it('geocode null → devolve null', async () => {
    const poisRepo = await import('@/server/repositories/pois');
    const nominatim = await import('@/server/geo/nominatim');

    vi.spyOn(poisRepo, 'findPoisByPropertyId').mockResolvedValue(null);
    vi.spyOn(nominatim, 'geocodeAddress').mockResolvedValue(null);

    const result = await getGroundedCandidates(propertyWithId);
    expect(result).toBeNull();
  });

  it('overpass null → devolve null', async () => {
    const poisRepo = await import('@/server/repositories/pois');
    const nominatim = await import('@/server/geo/nominatim');
    const overpass = await import('@/server/geo/overpass');

    vi.spyOn(poisRepo, 'findPoisByPropertyId').mockResolvedValue(null);
    vi.spyOn(nominatim, 'geocodeAddress').mockResolvedValue({ lat: -27.6, lon: -48.5 });
    vi.spyOn(overpass, 'fetchNearbyPois').mockResolvedValue(null);

    const result = await getGroundedCandidates(propertyWithId);
    expect(result).toBeNull();
  });

  it('cobertura insuficiente (só 3 restaurantes) → devolve null', async () => {
    const poisRepo = await import('@/server/repositories/pois');

    vi.spyOn(poisRepo, 'findPoisByPropertyId').mockResolvedValue({
      lat: -27.6,
      lon: -48.5,
      pois: insufficientRestaurants,
      fetched_at: new Date(),
    });

    const result = await getGroundedCandidates(propertyWithId);
    expect(result).toBeNull();
  });
});
