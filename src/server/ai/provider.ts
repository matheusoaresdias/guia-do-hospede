import 'server-only';
import { DeepSeekProvider } from './providers/deepseek';

// ---------------------------------------------------------------------------
// Tipos de erro do domínio de IA
// ---------------------------------------------------------------------------

export class LlmError extends Error {
  public readonly kind: 'timeout' | 'rate_limit' | 'invalid_output' | 'network' | 'unknown';

  constructor(
    message: string,
    kind: 'timeout' | 'rate_limit' | 'invalid_output' | 'network' | 'unknown' = 'unknown',
  ) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
  }
}

// ---------------------------------------------------------------------------
// Interface do provedor de LLM
// ---------------------------------------------------------------------------

export interface LlmProvider {
  /** Gera uma resposta JSON estruturada a partir de um prompt. */
  generateJson<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    schemaDescription: string;
    timeoutMs?: number;
  }): Promise<T>;

  /** Gera texto em streaming. Retorna um ReadableStream de strings. */
  streamText(args: {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    timeoutMs?: number;
  }): Promise<ReadableStream<string>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let cachedProvider: LlmProvider | null = null;

/**
 * Retorna a instância singleton do provedor de LLM configurado.
 * Falha rápido se DEEPSEEK_API_KEY não estiver definida.
 */
export function getLlmProvider(): LlmProvider {
  if (cachedProvider) return cachedProvider;

  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      'DEEPSEEK_API_KEY não configurada. Verifique o arquivo .env.',
    );
  }

  // O ciclo provider <-> deepseek é seguro em ESM: o adapter só referencia
  // LlmError dentro de métodos, ou seja, depois que ambos os módulos foram
  // avaliados. Import estático mantém a checagem de tipos, que o require perdia.
  const provider = new DeepSeekProvider(
    process.env.DEEPSEEK_API_KEY,
    process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
  );
  cachedProvider = provider;
  return provider;
}
