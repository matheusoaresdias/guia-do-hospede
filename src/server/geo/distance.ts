/**
 * Função pura — sem I/O, sem efeitos colaterais.
 * Calcula a distância em metros entre dois pontos geográficos
 * usando a fórmula de Haversine.
 */
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6_371_000; // raio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);

  const aHav =
    sinDlat * sinDlat + Math.cos(latA) * Math.cos(latB) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav));

  return R * c;
}
