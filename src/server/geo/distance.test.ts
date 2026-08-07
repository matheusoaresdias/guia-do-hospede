import { describe, it, expect } from 'vitest';
import { haversineMeters } from '@/server/geo/distance';

describe('haversineMeters', () => {
  it('calcula distância zero para o mesmo ponto', () => {
    const point = { lat: -27.6, lon: -48.5 };
    expect(haversineMeters(point, point)).toBeCloseTo(0, 1);
  });

  it('calcula distância aproximada entre dois pontos conhecidos de Florianópolis', () => {
    // UFSC (-27.6007, -48.5191) → Ponte Hercílio Luz (-27.5936, -48.5657)
    // distância aproximada ~4.7 km
    const ufsc = { lat: -27.6007, lon: -48.5191 };
    const ponte = { lat: -27.5936, lon: -48.5657 };
    const d = haversineMeters(ufsc, ponte);
    expect(d).toBeGreaterThan(4000);
    expect(d).toBeLessThan(5500);
  });

  it('calcula distância maior que zero para dois pontos distintos no hemisfério sul', () => {
    const a = { lat: -23.5505, lon: -46.6333 }; // São Paulo
    const b = { lat: -22.9068, lon: -43.1729 }; // Rio de Janeiro
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(350_000); // ~360 km
    expect(d).toBeLessThan(400_000);
  });

  it('é simétrica', () => {
    const a = { lat: -27.6, lon: -48.5 };
    const b = { lat: -27.61, lon: -48.51 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 1);
  });
});
