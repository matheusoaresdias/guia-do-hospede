import { describe, it, expect } from 'vitest';
import { propertySchema, normalizePropertyCode } from '@/domain/property';
import seedData from '@/server/db/seed-data.json';

describe('propertySchema', () => {
  it('aceita o imóvel FLN001 do seed', () => {
    const fln001 = seedData.find((p) => p.code === 'FLN001');
    expect(fln001).toBeDefined();
    const result = propertySchema.safeParse(fln001);
    expect(result.success).toBe(true);
  });

  it('aceita o imóvel GRM001 do seed', () => {
    const grm001 = seedData.find((p) => p.code === 'GRM001');
    expect(grm001).toBeDefined();
    const result = propertySchema.safeParse(grm001);
    expect(result.success).toBe(true);
  });

  it('aceita o imóvel UBA001 do seed', () => {
    const uba001 = seedData.find((p) => p.code === 'UBA001');
    expect(uba001).toBeDefined();
    const result = propertySchema.safeParse(uba001);
    expect(result.success).toBe(true);
  });

  it('aceita complement null', () => {
    const grm001 = seedData.find((p) => p.code === 'GRM001');
    expect(grm001?.address.complement).toBeNull();
    const result = propertySchema.safeParse(grm001);
    expect(result.success).toBe(true);
  });

  it('aceita parking_spot_identifier null', () => {
    const grm001 = seedData.find((p) => p.code === 'GRM001');
    expect(grm001?.operational.parking_spot_identifier).toBeNull();
    const result = propertySchema.safeParse(grm001);
    expect(result.success).toBe(true);
  });

  it('rejeita guest_capacity negativo', () => {
    const fln001 = seedData.find((p) => p.code === 'FLN001');
    expect(fln001).toBeDefined();
    const invalid = { ...fln001!, guest_capacity: -1 };
    const result = propertySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejeita code vazio', () => {
    const fln001 = seedData.find((p) => p.code === 'FLN001');
    expect(fln001).toBeDefined();
    const invalid = { ...fln001!, code: '' };
    const result = propertySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('normalizePropertyCode', () => {
  it("converte 'fln001' para 'FLN001'", () => {
    expect(normalizePropertyCode('fln001')).toBe('FLN001');
  });

  it("converte '  grm001  ' para 'GRM001'", () => {
    expect(normalizePropertyCode('  grm001  ')).toBe('GRM001');
  });
});
