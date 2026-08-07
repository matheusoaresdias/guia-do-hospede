import 'server-only';
import type { Address } from '../../domain/property';

/**
 * Geocodifica um endereço usando Nominatim (OpenStreetMap).
 * Em qualquer erro (rede, timeout, resposta vazia) retorna `null`.
 * Nunca lança exceção.
 */
export async function geocodeAddress(
  address: Address,
): Promise<{ lat: number; lon: number } | null> {
  const queryParts = [
    address.street,
    address.number,
    address.neighborhood,
    address.city,
    address.state,
    address.postal_code,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ');

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(queryParts)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'guia-digital-hospede/1.0 (contato: matheus.soares.msd@gmail.com)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Nominatim: status inesperado', response.status);
      return null;
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.error('Nominatim: resposta vazia ou inválida');
      return null;
    }

    const first = data[0];
    if (
      typeof first !== 'object' ||
      first === null ||
      !('lat' in first) ||
      !('lon' in first) ||
      typeof first.lat !== 'string' ||
      typeof first.lon !== 'string'
    ) {
      console.error('Nominatim: formato inesperado', first);
      return null;
    }

    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);

    if (isNaN(lat) || isNaN(lon)) {
      console.error('Nominatim: coordenadas inválidas', { lat, lon });
      return null;
    }

    return { lat, lon };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Nominatim: timeout');
    } else {
      console.error('Nominatim: erro de rede ou parse', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
