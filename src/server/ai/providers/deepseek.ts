import { LlmProvider, LlmError } from '../provider';

/**
 * Adapter para a API do DeepSeek (compatível com OpenAI).
 * Documentação: https://api.deepseek.com/chat/completions
 */
export class DeepSeekProvider implements LlmProvider {
  private readonly baseUrl = 'https://api.deepseek.com/chat/completions';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateJson<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    schemaDescription: string;
    timeoutMs?: number;
  }): Promise<T> {
    const timeoutMs = args.timeoutMs ?? 45_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: args.systemPrompt },
            { role: 'user', content: args.userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          // O DeepSeek V4 vem com raciocínio ligado por padrão, o que mais que
          // dobra a latência. Para extração estruturada o ganho não compensa a
          // espera do hóspede — o schema já é a garantia de qualidade da saída.
          thinking: { type: 'disabled' },
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new LlmError(
          'Muitas requisições ao provedor de IA. Tente novamente em instantes.',
          'rate_limit',
        );
      }

      if (!response.ok) {
        throw new LlmError(
          `Erro do provedor de IA (${response.status})`,
          'unknown',
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || typeof content !== 'string') {
        throw new LlmError(
          'Resposta da IA sem conteúdo textual.',
          'invalid_output',
        );
      }

      // Tenta parsear o JSON retornado
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new LlmError(
          'A IA não retornou JSON válido.',
          'invalid_output',
        );
      }

      return parsed as T;
    } catch (err: unknown) {
      if (err instanceof LlmError) throw err;

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LlmError(
          'Tempo limite excedido ao chamar a IA.',
          'timeout',
        );
      }

      // Erro de rede (fetch falhou)
      if (err instanceof TypeError) {
        throw new LlmError(
          'Falha de rede ao chamar o provedor de IA.',
          'network',
        );
      }

      throw new LlmError(
        `Erro inesperado ao chamar a IA: ${String(err)}`,
        'unknown',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async streamText(args: {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    timeoutMs?: number;
  }): Promise<ReadableStream<string>> {
    const timeoutMs = args.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: args.systemPrompt },
          ...args.messages,
        ],
        stream: true,
        temperature: 0.7,
        // Sem raciocínio: no chat o que importa é o primeiro token chegar rápido.
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      clearTimeout(timer);
      throw new LlmError('Muitas requisições ao provedor de IA.', 'rate_limit');
    }

    if (!response.ok) {
      clearTimeout(timer);
      throw new LlmError(
        `Erro do provedor de IA (${response.status})`,
        'unknown',
      );
    }

    if (!response.body) {
      clearTimeout(timer);
      throw new LlmError('Resposta sem corpo.', 'invalid_output');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream<string>({
      start(streamController) {
        async function push() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                clearTimeout(timer);
                streamController.close();
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const payload = trimmed.slice(6);

                if (payload === '[DONE]') {
                  clearTimeout(timer);
                  streamController.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(payload);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    streamController.enqueue(delta);
                  }
                } catch {
                  // Linha malformada — ignora e segue
                }
              }
            }
          } catch (err: unknown) {
            clearTimeout(timer);
            if (err instanceof DOMException && err.name === 'AbortError') {
              streamController.error(
                new LlmError('Tempo limite excedido.', 'timeout'),
              );
            } else {
              streamController.error(
                new LlmError(
                  `Erro no streaming: ${String(err)}`,
                  'network',
                ),
              );
            }
          }
        }
        push();
      },
      cancel() {
        clearTimeout(timer);
        reader.cancel();
      },
    });
  }
}
