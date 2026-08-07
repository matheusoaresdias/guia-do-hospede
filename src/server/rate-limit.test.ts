import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIp } from './rate-limit';

describe('checkRateLimit', () => {
  it('permite a primeira chamada de uma chave nova', () => {
    const result = checkRateLimit('ip-1', 0);
    expect(result.allowed).toBe(true);
  });

  it('permite chamadas dentro do limite (até 10)', () => {
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit('ip-2', i * 1000);
      expect(result.allowed).toBe(true);
    }
  });

  it('nega a 11ª chamada na mesma janela com retryAfterSeconds positivo', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('ip-3', i * 1000);
    }
    const result = checkRateLimit('ip-3', 10_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('permite a mesma chave depois que a janela expira (60s)', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('ip-4', i * 1000);
    }
    // Ainda na mesma janela, 11ª deve ser negada
    const denied = checkRateLimit('ip-4', 10_000);
    expect(denied.allowed).toBe(false);

    // Avança 60s → nova janela
    const allowed = checkRateLimit('ip-4', 70_000);
    expect(allowed.allowed).toBe(true);
  });

  it('mantém contadores independentes para chaves diferentes', () => {
    // Esgota ip-a
    for (let i = 0; i < 10; i++) {
      checkRateLimit('ip-a', i * 1000);
    }
    const deniedA = checkRateLimit('ip-a', 10_000);
    expect(deniedA.allowed).toBe(false);

    // ip-b ainda deve ser permitido
    const allowedB = checkRateLimit('ip-b', 10_000);
    expect(allowedB.allowed).toBe(true);
  });
});

describe('getClientIp', () => {
  it('extrai o primeiro IP de x-forwarded-for', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  it('retorna "unknown" quando o header não existe', () => {
    const request = new Request('http://localhost');
    expect(getClientIp(request)).toBe('unknown');
  });
});
