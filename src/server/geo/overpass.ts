import 'server-only';

export type RawPoiCategory =
  | 'restaurant'
  | 'attraction'
  | 'pharmacy'
  | 'supermarket'
  | 'hospital';

export type RawPoiCandidate = {
  name: string;
  category: RawPoiCategory;
  lat: number;
  lon: number;
};

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const TAG_TO_CATEGORY: Record<string, RawPoiCategory> = {
  'amenity=restaurant': 'restaurant',
  // tourism=attraction sozinho é raro no OSM — a maioria dos pontos que um
  // hóspede reconheceria como atração usa uma destas tags mais específicas.
  'tourism=attraction': 'attraction',
  'tourism=viewpoint': 'attraction',
  'tourism=museum': 'attraction',
  'tourism=artwork': 'attraction',
  'leisure=park': 'attraction',
  'amenity=pharmacy': 'pharmacy',
  'shop=supermarket': 'supermarket',
  'amenity=hospital': 'hospital',
};

/**
 * Busca pontos de interesse via Overpass API em um raio ao redor do centro.
 * Em qualquer erro retorna `null`. Nunca lança exceção.
 */
export async function fetchNearbyPois(
  center: { lat: number; lon: number },
  radiusMeters: number = 2000,
): Promise<RawPoiCandidate[] | null> {
  const tagFilters = Object.keys(TAG_TO_CATEGORY)
    .map((t) => {
      const [key, value] = t.split('=');
      return `node["${key}"="${value}"](around:${radiusMeters},${center.lat},${center.lon});way["${key}"="${value}"](around:${radiusMeters},${center.lat},${center.lon});relation["${key}"="${value}"](around:${radiusMeters},${center.lat},${center.lon});`;
    })
    .join('\n');

  // [timeout:N] pede ao servidor Overpass para devolver o que tiver em N
  // segundos; o AbortController do cliente fica alguns segundos acima disso,
  // para dar tempo do servidor responder antes do cliente desistir. 9 filtros
  // de tag (27 cláusulas node/way/relation) — leisure=park em especial pode
  // casar polígonos grandes — tornam 8s apertado demais.
  const query = `[out:json][timeout:15];(\n${tagFilters}\n);out center;`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Sem User-Agent, o Apache do overpass-api.de devolve 406 (Node fetch,
        // ao contrário do curl, não envia um por padrão).
        'User-Agent':
          'guia-digital-hospede/1.0 (contato: matheus.soares.msd@gmail.com)',
      },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Overpass: status inesperado', response.status);
      return null;
    }

    const data: unknown = await response.json();

    if (
      typeof data !== 'object' ||
      data === null ||
      !('elements' in data) ||
      !Array.isArray((data as OverpassResponse).elements)
    ) {
      console.error('Overpass: resposta sem elementos');
      return null;
    }

    const elements = (data as OverpassResponse).elements;
    const candidates: RawPoiCandidate[] = [];

    for (const el of elements) {
      const name = el.tags?.name?.trim();
      if (!name) continue;

      // Determina a categoria a partir das tags
      let category: RawPoiCategory | null = null;
      if (el.tags) {
        for (const [tagKey, cat] of Object.entries(TAG_TO_CATEGORY)) {
          const [k, v] = tagKey.split('=');
          if (el.tags[k] === v) {
            category = cat;
            break;
          }
        }
      }
      if (!category) continue;

      // Coordenadas: nó usa lat/lon direto; way/relation usam center
      let lat: number;
      let lon: number;

      if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
        lat = el.lat;
        lon = el.lon;
      } else if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
        lat = el.center.lat;
        lon = el.center.lon;
      } else {
        continue; // sem coordenadas, ignora
      }

      candidates.push({ name, category, lat, lon });
    }

    return candidates;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Overpass: timeout');
    } else {
      console.error('Overpass: erro de rede ou parse', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
