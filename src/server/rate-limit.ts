import 'server-only';

// ---------------------------------------------------------------------------
// Rate limiter em memória — janela fixa de 60s, 10 requisições por chave.
//
// ATENÇÃO: Este armazenamento em memória NÃO sobrevive a múltiplas instâncias
// serverless (Vercel, etc.). Em produção real seria necessário Redis/Upstash
// ou outro armazenamento compartilhado. Para o escopo deste teste, este
// limitador documenta honestamente essa limitação (mesmo espírito do README).
// ---------------------------------------------------------------------------

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const LIMIT = 10;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  // Sem bucket ou janela expirada → reset
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  // Dentro da janela e no limite → nega sem incrementar
  if (bucket.count >= LIMIT) {
    const retryAfterSeconds = Math.ceil(
      (bucket.windowStart + WINDOW_MS - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }

  // Dentro da janela, abaixo do limite → incrementa
  bucket.count += 1;
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}
