import 'server-only';
import { getLlmProvider, LlmError } from './provider';
import {
  buildExperienceGuideSystemPrompt,
  buildExperienceGuideUserPrompt,
  buildGroundedExperienceGuideSystemPrompt,
  buildGroundedExperienceGuideUserPrompt,
} from './prompts/experience-guide';
import {
  experienceGuideSchema,
  currentSeason,
  type ExperienceGuide,
} from '../../domain/experience-guide';
import type { Property } from '../../domain/property';
import {
  findGuideByPropertyId,
  insertGuideIfAbsent,
  replaceGuide,
} from '../repositories/guides';
import { getGroundedCandidates } from '../geo/poi-service';

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------

export type GuideSuccess = {
  ok: true;
  guide: ExperienceGuide;
  generated: boolean; // true se foi gerado agora
};

export type GuideError = {
  ok: false;
  error: {
    kind: LlmError['kind'];
    message: string;
  };
};

export type GuideResult = GuideSuccess | GuideError;

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

/**
 * Obtém ou cria o Guia de Experiências para um imóvel.
 * - Se já existir e a estação não mudou, retorna o guia persistido (generated=false).
 * - Caso contrário, gera via LLM, valida, persiste e retorna (generated=true).
 * - Em caso de JSON inválido, faz UMA retentativa acrescentando o erro de validação.
 * - Nunca lança: devolve resultado discriminado.
 */
export async function getOrCreateExperienceGuide(
  property: Property & { id: number },
): Promise<GuideResult> {
  const season = currentSeason();

  // 1. Verifica se já existe guia atualizado
  const existing = await findGuideByPropertyId(property.id);
  if (existing && existing.season === season) {
    return { ok: true, guide: existing.content, generated: false };
  }

  // 2. Busca candidatos grounded (OSM)
  const groundedCandidates = await getGroundedCandidates(property);
  const source = groundedCandidates ? 'osm' : 'llm';

  // 3. Monta prompts condicionais
  const systemPrompt = groundedCandidates
    ? buildGroundedExperienceGuideSystemPrompt()
    : buildExperienceGuideSystemPrompt();
  const userPrompt = groundedCandidates
    ? buildGroundedExperienceGuideUserPrompt(property, groundedCandidates)
    : buildExperienceGuideUserPrompt(property);

  // 4. Tenta gerar (com até 1 retry em caso de JSON inválido)
  const provider = getLlmProvider();

  let lastValidationError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let promptForLlm = userPrompt;
      if (attempt === 1 && lastValidationError) {
        promptForLlm = `${userPrompt}\n\nATENÇÃO: A resposta anterior foi rejeitada. Corrija os seguintes erros de validação e responda APENAS com o JSON corrigido:\n${lastValidationError}`;
      }

      const raw = await provider.generateJson<unknown>({
        systemPrompt,
        userPrompt: promptForLlm,
        schemaDescription: 'Guia de Experiências do Hóspede',
        timeoutMs: 45_000,
      });

      // Validação com Zod
      const parsed = experienceGuideSchema.safeParse(raw);

      if (parsed.success) {
        // Persiste ou atualiza
        const model =
          process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

        let record: Awaited<ReturnType<typeof insertGuideIfAbsent>>;
        if (existing) {
          record = await replaceGuide(property.id, parsed.data, model, season, source);
        } else {
          record = await insertGuideIfAbsent(property.id, parsed.data, model, season, source);
        }

        return { ok: true, guide: record.content, generated: true };
      }

      // Guarda erro de validação para o retry
      lastValidationError = parsed.error.issues
        .map(
          (issue) =>
            `Campo "${issue.path.join('.')}": ${issue.message}`,
        )
        .join('; ');
    } catch (err: unknown) {
      // Se for LlmError e não for invalid_output, não faz retry
      if (err instanceof LlmError) {
        if (err.kind !== 'invalid_output') {
          return {
            ok: false,
            error: { kind: err.kind, message: err.message },
          };
        }
        // invalid_output — trata como erro de validação e tenta retry
        lastValidationError = err.message;
      } else {
        return {
          ok: false,
          error: {
            kind: 'unknown',
            message:
              err instanceof Error
                ? err.message
                : 'Erro inesperado ao gerar o guia.',
          },
        };
      }
    }
  }

  // Esgotou as tentativas
  return {
    ok: false,
    error: {
      kind: 'invalid_output',
      message:
        'Não foi possível gerar um guia válido após duas tentativas. Por favor, tente novamente mais tarde.',
    },
  };
}
