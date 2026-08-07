import { describe, it, expect, beforeEach, vi } from 'vitest';
import { geocodeAddress } from '@/server/geo/nominatim';
import type { Address } from '@/domain/property';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

const validAddress: Address = {
  street: 'Rua Lauro Linhares',
  number: '589',
  complement: null,
  neighborhood: 'Trindade',
  city: 'Florianópolis',
  state: 'SC',
  postal_code: '88036-001',
};

describe('geocodeAddress', () => {
  it('retorna {lat, lon} de uma resposta válida', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: '-27.6007', lon: '-48.5191' },
      ],
    });
    const result = await geocodeAddress(validAddress);
    expect(result).toEqual({ lat: -27.6007, lon: -48.5191 });
  });

  it('retorna null em resposta vazia', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    const result = await geocodeAddress(validAddress);
    expect(result).toBeNull();
  });

  it('retorna null em erro de rede', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await geocodeAddress(validAddress);
    expect(result).toBeNull();
  });

  it('retorna null em timeout', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const err = new DOMException('Aborted', 'AbortError');
          reject(err);
        }),
    );
    const result = await geocodeAddress(validAddress);
    expect(result).toBeNull();
  });

  it('retorna null em status não-2xx', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => [],
    });
    const result = await geocodeAddress(validAddress);
    expect(result).toBeNull();
  });

  it('retorna null para JSON mal formatado', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'shape' }),
    });
    const result = await geocodeAddress(validAddress);
    expect(result).toBeNull();
  });
});
