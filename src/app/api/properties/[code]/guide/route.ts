import { NextResponse } from 'next/server';
import { findPropertyByCode } from '@/server/repositories/properties';
import { getOrCreateExperienceGuide } from '@/server/ai/guide-service';
import type { LlmError } from '@/server/ai/provider';

/**
 * POST /api/properties/[code]/guide
 * Gera (se necessário) e retorna o Guia de Experiências do imóvel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  // 1. Busca o imóvel
  const property = await findPropertyByCode(code);
  if (!property) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Imóvel não encontrado.' } },
      { status: 404 },
    );
  }

  // 2. Obtém ou gera o guia
  const result = await getOrCreateExperienceGuide(property);

  if (result.ok) {
    return NextResponse.json({
      guide: result.guide,
      generated: result.generated,
    });
  }

  // 3. Mapeia erros do domínio de IA para status HTTP
  const { kind, message } = result.error;

  // Loga o erro real no servidor para diagnóstico (nunca vazar para o cliente)
  console.error(`[Guide] Falha ao gerar guia para ${code}:`, result.error);

  const userMessages: Record<LlmError['kind'], string> = {
    timeout:
      'O serviço de IA está demorando mais do que o esperado. Tente novamente em alguns instantes.',
    rate_limit:
      'Estamos com muitas solicitações no momento. Aguarde um pouco e tente novamente.',
    invalid_output:
      'Não foi possível gerar um guia de qualidade. Nossa equipe foi notificada. Por favor, tente novamente mais tarde.',
    network:
      'Erro de conexão com o serviço de IA. Verifique sua rede e tente novamente.',
    unknown:
      'Ocorreu um erro inesperado ao gerar o guia. Tente novamente mais tarde.',
  };

  const statuses: Record<LlmError['kind'], number> = {
    rate_limit: 429,
    timeout: 503,
    network: 503,
    invalid_output: 503,
    unknown: 503,
  };

  return NextResponse.json(
    {
      error: {
        code: kind.toUpperCase(),
        message: userMessages[kind] || message,
      },
    },
    { status: statuses[kind] || 503 },
  );
}
