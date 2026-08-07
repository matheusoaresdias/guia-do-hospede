import { z } from 'zod';
import { NextResponse } from 'next/server';
import { findPropertyByCode } from '@/server/repositories/properties';
import { findGuideByPropertyId } from '@/server/repositories/guides';
import { buildAssistantSystemPrompt } from '@/server/ai/prompts/assistant';
import { getLlmProvider, LlmError } from '@/server/ai/provider';
import { checkRateLimit, getClientIp } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema de validação do corpo da requisição
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  // Rate limit: 10 mensagens/minuto por IP (antes de tocar o banco)
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(clientIp);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message:
            'Muitas mensagens em pouco tempo. Aguarde um instante antes de enviar outra.',
        },
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      },
    );
  }

  // 1. Busca o imóvel
  const property = await findPropertyByCode(code);
  if (!property) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Imóvel não encontrado.' } },
      { status: 404 },
    );
  }

  // 2. Valida o corpo da requisição
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message: 'Corpo da requisição deve ser JSON válido.',
        },
      },
      { status: 400 },
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message:
            'Corpo inválido. Envie um array de mensagens (máx. 20) com role ("user" ou "assistant") e content.',
        },
      },
      { status: 400 },
    );
  }

  const { messages } = parsed.data;

  // 3. Lê o guia persistido (sem gerar um novo)
  const guideRecord = await findGuideByPropertyId(property.id);
  const guide = guideRecord?.content ?? null;

  // 4. Monta o system prompt
  const systemPrompt = buildAssistantSystemPrompt(property, guide);

  // 5. Chama o provider com streaming
  const provider = getLlmProvider();

  let stream: ReadableStream<string>;
  try {
    stream = await provider.streamText({
      systemPrompt,
      messages,
    });
  } catch (err: unknown) {
    // Erro ANTES de iniciar o stream — retorna JSON de erro
    console.error(`[Chat] Erro ao iniciar stream para ${code}:`, err);

    if (err instanceof LlmError) {
      const statusMap: Record<string, number> = {
        rate_limit: 429,
        timeout: 503,
        network: 503,
        invalid_output: 503,
        unknown: 503,
      };
      const status = statusMap[err.kind] ?? 503;

      const userMessages: Record<string, string> = {
        rate_limit:
          'Muitas solicitações no momento. Aguarde um pouco e tente novamente.',
        timeout:
          'O serviço está demorando para responder. Tente novamente em alguns instantes.',
        network:
          'Erro de conexão com o serviço de IA. Verifique sua rede e tente novamente.',
        invalid_output:
          'Erro ao processar a resposta. Tente novamente.',
        unknown:
          'Ocorreu um erro inesperado. Tente novamente mais tarde.',
      };

      return NextResponse.json(
        {
          error: {
            code: err.kind.toUpperCase(),
            message: userMessages[err.kind] ?? err.message,
          },
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'UNKNOWN',
          message: 'Erro inesperado. Tente novamente mais tarde.',
        },
      },
      { status: 503 },
    );
  }

  // 6. Converte o ReadableStream<string> em ReadableStream<Uint8Array>
  //    para a Response Web. Deixa o erro do provider propagar — quando o
  //    stream interno falha, o start() rejeita e o ReadableStream externo
  //    entra em estado de erro, o que o cliente detecta e trata mantendo
  //    o texto já recebido.
  const encoder = new TextEncoder();
  const webStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
      }
    },
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
