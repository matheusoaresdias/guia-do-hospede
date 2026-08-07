import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchNearbyPois } from '@/server/geo/overpass';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

function mockResponse(body: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}

function mockNetworkError() {
  mockFetch.mockRejectedValue(new Error('Network error'));
}

describe('fetchNearbyPois', () => {
  it('mapeia amenity=restaurant para category restaurant', async () => {
    mockResponse({
      elements: [
        {
          type: 'node',
          id: 1,
          lat: -27.6,
          lon: -48.5,
          tags: { name: 'Bistro Exemplo', amenity: 'restaurant' },
        },
      ],
    });
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: 'Bistro Exemplo',
      category: 'restaurant',
    });
  });

  it('mapeia tourism=attraction para category attraction', async () => {
    mockResponse({
      elements: [
        {
          type: 'node',
          id: 2,
          lat: -27.61,
          lon: -48.51,
          tags: { name: 'Museu Exemplo', tourism: 'attraction' },
        },
      ],
    });
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).not.toBeNull();
    expect(result![0].category).toBe('attraction');
  });

  it('descarta elemento sem tags.name', async () => {
    mockResponse({
      elements: [
        {
          type: 'node',
          id: 3,
          lat: -27.6,
          lon: -48.5,
          tags: { amenity: 'restaurant' },
        },
      ],
    });
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).toHaveLength(0);
  });

  it('usa center.lat/lon para way', async () => {
    mockResponse({
      elements: [
        {
          type: 'way',
          id: 4,
          center: { lat: -27.62, lon: -48.52 },
          tags: { name: 'Hospital Way', amenity: 'hospital' },
        },
      ],
    });
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).not.toBeNull();
    expect(result![0]).toMatchObject({
      name: 'Hospital Way',
      lat: -27.62,
      lon: -48.52,
    });
  });

  it('retorna null em timeout', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const err = new DOMException('Aborted', 'AbortError');
          reject(err);
        }),
    );
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).toBeNull();
  });

  it('retorna null em erro de rede', async () => {
    mockNetworkError();
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).toBeNull();
  });

  it('retorna null em status não-2xx', async () => {
    mockResponse({}, false, 500);
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).toBeNull();
  });

  it('retorna null para JSON inválido', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Parse error');
      },
    });
    const result = await fetchNearbyPois({ lat: -27.6, lon: -48.5 });
    expect(result).toBeNull();
  });
});
