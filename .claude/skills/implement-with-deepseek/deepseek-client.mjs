#!/usr/bin/env node
// Cliente HTTP fino para a API oficial do DeepSeek (chat completions).
// Uma chamada, sem loop de execução de tools — quem invoca decide o que fazer
// com toolCalls. Zero dependências (usa fetch nativo do Node >=18).
//
// Uso: echo '<input JSON>' | node deepseek-client.mjs
//
// Input JSON (stdin):
//   messages       (obrigatório) array no formato OpenAI [{role, content}, ...]
//   model          "flash" | "pro" | id completo (default: "flash")
//   temperature    number 0-2 (default da API: 1)
//   topP           number 0-1
//   maxTokens      integer
//   stop           string | string[]
//   responseFormat { type: "text" | "json_object" }
//   thinking       boolean (true = enabled, false = disabled; default da API: enabled)
//   reasoningEffort "high" | "max"
//   tools          array no formato OpenAI [{type:"function", function:{...}}, ...]
//   toolChoice     "none" | "auto" | "required" | {type:"function", function:{name}}
//   userId         string
//   timeoutMs      integer (default: 120000) — aborta a chamada e conta como falha retentável
//   taskHint       string opcional — só usado no log local (usage.log), não vai pra API
//
// Montagem de contexto (adotado 06/08/2026 — quem chama passa CAMINHO, nunca conteúdo):
//   perfil         string | string[] — nome(s) de perfil em contexto/perfis.json. Cada perfil
//                  é uma lista de caminhos de FONTES VIVAS, lidas do disco a cada chamada.
//   files          [{path, nota?, novo?}] — arquivos da tarefa. O conteúdo ATUAL de cada um é
//                  lido do disco e colado integralmente. `novo: true` = arquivo ainda não
//                  existe. Caminho inexistente sem `novo` é erro duro (é typo, e typo vira
//                  alucinação: o modelo inventa o arquivo que não recebeu).
//   envelope       boolean — anexa a instrução de FORMATO_DE_SAIDA (envelope.mjs). Default:
//                  true quando `files` foi passado.
//   repoRoot       string — default: 3 níveis acima deste script (raiz do repo).
//   dryRun         boolean — monta tudo, imprime o payload e SAI SEM chamar a API.
//
// O conteúdo montado é injetado na ÚLTIMA mensagem `role: "user"`: perfis antes do texto de
// quem chamou, arquivos e instrução de envelope depois. Chamada sem `perfil`/`files` continua
// funcionando exatamente como antes (modo `messages` cru), para não quebrar outras skills.
//
// Output JSON (stdout, sucesso): { model, content, reasoningContent, toolCalls, finishReason, usage }
// Output JSON (stderr, erro): { error, ...detalhes }; exit code 1.
//
// Retry: em erro de rede/timeout ou HTTP 429/5xx, retenta até MAX_RETRIES vezes com
// backoff exponencial (1s, 2s). Erros HTTP 4xx que não sejam 429 falham na hora — são
// erro do chamador (input inválido, auth, etc.), retentar não ajuda.
//
// Log de uso: cada chamada bem-sucedida acrescenta uma linha JSON em usage.log (mesma
// pasta deste script) — timestamp, model, taskHint, usage, finishReason. Arquivo local,
// já coberto por *.log no .gitignore raiz.

import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { instrucaoEnvelope } from './envelope.mjs';

const API_URL = 'https://api.deepseek.com/chat/completions';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const USAGE_LOG_PATH = path.join(SCRIPT_DIR, 'usage.log');
const PERFIS_PATH = path.join(SCRIPT_DIR, 'contexto', 'perfis.json');
const RESPOSTAS_DIR = path.join(SCRIPT_DIR, 'respostas');
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

const MODEL_ALIASES = {
  flash: 'deepseek-v4-flash',
  pro: 'deepseek-v4-pro',
};

function resolveModel(model) {
  if (!model) return MODEL_ALIASES.flash;
  return MODEL_ALIASES[model] ?? model; // passthrough para ids completos
}

function fail(message, extra = {}) {
  process.stderr.write(JSON.stringify({ error: message, ...extra }) + '\n');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

// Faz o POST com timeout (AbortController) e retry com backoff exponencial em erro de
// rede/timeout ou HTTP 429/5xx. Devolve a Response assim que o HTTP responder (mesmo
// que status != 2xx, se não for retentável) ou chama fail() diretamente se esgotar as
// tentativas.
async function postWithRetry(body, timeoutMs) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok && isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        lastError = `HTTP ${response.status}`;
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError';
      lastError = isTimeout ? `timeout após ${timeoutMs}ms` : err.message;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      fail(`Falha de rede ao chamar a API do DeepSeek após ${attempt + 1} tentativa(s): ${lastError}`);
    }
  }
  fail(`API do DeepSeek falhou repetidamente após ${MAX_RETRIES + 1} tentativas: ${lastError}`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Resolve um caminho relativo contra a raiz do repo e recusa qualquer coisa que escape
// dela. O applier faz a mesma checagem — aqui é só para falhar cedo, na montagem.
function resolverDentroDoRepo(repoRoot, alvo, rotulo) {
  const abs = path.resolve(repoRoot, alvo);
  const rel = path.relative(repoRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    fail(`${rotulo}: caminho "${alvo}" está fora da raiz do repo (${repoRoot}).`);
  }
  return abs;
}

async function lerArquivo(abs, rotulo, alvo) {
  try {
    return await readFile(abs, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      fail(`${rotulo}: arquivo "${alvo}" não existe. Corrija o caminho — caminho errado vira alucinação, porque o modelo inventa o arquivo que não recebeu.`);
    }
    fail(`${rotulo}: falha ao ler "${alvo}": ${err.message}`);
  }
}

// Perfis = listas de caminhos de fontes vivas (contexto/perfis.json). Nome desconhecido e
// arquivo sumido são erro duro: perfil vazio silencioso é exatamente o cenário que
// produz código sem as convenções do repo.
async function montarPerfis(perfilInput, repoRoot) {
  const nomes = Array.isArray(perfilInput) ? perfilInput : [perfilInput];
  let perfis;
  try {
    perfis = JSON.parse(await readFile(PERFIS_PATH, 'utf8')).perfis;
  } catch (err) {
    fail(`Não consegui ler ${PERFIS_PATH}: ${err.message}`);
  }

  const caminhos = [];
  for (const nome of nomes) {
    const lista = perfis[nome];
    if (!lista) fail(`Perfil "${nome}" não existe em contexto/perfis.json. Disponíveis: ${Object.keys(perfis).join(', ')}.`);
    for (const p of lista) if (!caminhos.includes(p)) caminhos.push(p);
  }

  const partes = [];
  for (const rel of caminhos) {
    const abs = resolverDentroDoRepo(repoRoot, rel, `perfil "${nomes.join('+')}"`);
    const conteudo = await lerArquivo(abs, `perfil "${nomes.join('+')}"`, rel);
    partes.push(`=== FONTE: ${rel} ===\n${conteudo.trimEnd()}`);
  }

  // O terminador não é decoração: sem ele, a última linha da última fonte encosta no
  // OBJECTIVE da tarefa. Numa montagem real isso deixou o "Anti-escopo — recusar e devolver
  // ao cto" da skill de domínio colado no enunciado, sem fronteira nenhuma.
  return [
    `CONTEXTO_DO_REPO (perfis: ${nomes.join(', ')} — fontes vivas lidas do disco em ${new Date().toISOString().slice(0, 10)}; são a verdade atual, não um resumo):`,
    partes.join('\n\n'),
    '=== FIM DO CONTEXTO_DO_REPO — daqui para baixo é a tarefa desta chamada ===',
  ].join('\n\n');
}

// Conteúdo ATUAL dos arquivos da tarefa, sempre integral. É isto que torna impossível
// abreviar contexto — o modo de falha nº 1 registrado nesta skill.
async function montarArquivos(files, repoRoot) {
  const partes = [];
  for (const item of files) {
    const spec = typeof item === 'string' ? { path: item } : item;
    if (!spec?.path) fail('Cada entrada de "files" precisa de "path".');
    const nota = spec.nota ? `\n(o que muda: ${spec.nota})` : '';

    if (spec.novo) {
      partes.push(`=== ARQUIVO NOVO: ${spec.path} ===${nota}\n(ainda não existe no repo — gerar do zero)`);
      continue;
    }

    const abs = resolverDentroDoRepo(repoRoot, spec.path, 'files');
    const conteudo = await lerArquivo(abs, 'files', spec.path);
    partes.push(`=== ARQUIVO ATUAL: ${spec.path} ===${nota}\n${conteudo.trimEnd()}`);
  }

  return `ARQUIVOS_ATUAIS (conteúdo integral, lido do disco agora — não presuma nada sobre eles, não abrevie ao devolver):\n\n${partes.join('\n\n')}`;
}

// Injeta os blocos montados na última mensagem `user`, preservando o texto de quem chamou.
function injetar(messages, { antes, depois }) {
  const idx = messages.map((m) => m.role).lastIndexOf('user');
  if (idx === -1) fail('Para usar "perfil"/"files" é preciso ter pelo menos uma mensagem com role "user".');
  const copia = messages.map((m) => ({ ...m }));
  copia[idx].content = [...antes, copia[idx].content, ...depois].filter(Boolean).join('\n\n');
  return copia;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    fail('Nenhum input recebido via stdin. Envie um JSON com pelo menos { messages: [...] }.');
    return;
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (err) {
    fail(`Input inválido: não é JSON válido (${err.message}).`);
    return;
  }

  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    fail('Campo "messages" é obrigatório e precisa ser um array não vazio.');
    return;
  }

  const repoRoot = input.repoRoot ? path.resolve(input.repoRoot) : DEFAULT_REPO_ROOT;
  const usarEnvelope = input.envelope !== undefined ? input.envelope : Boolean(input.files);

  let messages = input.messages;
  if (input.perfil || input.files) {
    const antes = input.perfil ? [await montarPerfis(input.perfil, repoRoot)] : [];
    const depois = [];
    if (input.files) depois.push(await montarArquivos(input.files, repoRoot));
    if (usarEnvelope) depois.push(instrucaoEnvelope());
    messages = injetar(input.messages, { antes, depois });
  } else if (usarEnvelope) {
    messages = injetar(input.messages, { antes: [], depois: [instrucaoEnvelope()] });
  }

  const body = {
    model: resolveModel(input.model),
    messages,
  };

  if (input.temperature !== undefined) body.temperature = input.temperature;
  if (input.topP !== undefined) body.top_p = input.topP;
  if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens;
  if (input.stop !== undefined) body.stop = input.stop;
  if (input.responseFormat !== undefined) body.response_format = input.responseFormat;
  if (input.userId !== undefined) body.user_id = input.userId;

  if (input.thinking !== undefined) {
    const enabled = input.thinking === true || input.thinking === 'enabled';
    body.thinking = { type: enabled ? 'enabled' : 'disabled' };
  }
  if (input.reasoningEffort !== undefined) body.reasoning_effort = input.reasoningEffort;

  if (input.tools !== undefined) body.tools = input.tools;
  if (input.toolChoice !== undefined) body.tool_choice = input.toolChoice;

  if (input.dryRun) {
    const chars = body.messages.reduce((acc, m) => acc + (m.content?.length ?? 0), 0);
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          model: body.model,
          repoRoot,
          envelope: usarEnvelope,
          aproxTokens: Math.round(chars / 3.5), // estimativa grosseira, só pra dimensionar
          messages: body.messages,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    fail('DEEPSEEK_API_KEY não está definida no ambiente. Exporte a variável antes de chamar esta skill.');
    return;
  }

  const timeoutMs = input.timeoutMs !== undefined ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
  const response = await postWithRetry(body, timeoutMs);

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`Resposta da API não é JSON válido (status ${response.status}): ${text.slice(0, 500)}`);
    return;
  }

  if (!response.ok) {
    fail(`API do DeepSeek retornou erro HTTP ${response.status}`, { apiError: parsed });
    return;
  }

  const choice = parsed.choices?.[0];
  if (!choice) {
    fail('Resposta da API sem "choices" — payload inesperado.', { apiResponse: parsed });
    return;
  }

  const result = {
    model: parsed.model,
    content: choice.message?.content ?? null,
    reasoningContent: choice.message?.reasoning_content ?? null,
    toolCalls: choice.message?.tool_calls ?? null,
    finishReason: choice.finish_reason ?? null,
    usage: parsed.usage ?? null,
  };

  // A resposta bruta vai pro disco ANTES de qualquer tentativa de aplicar. Se o applier
  // recusar o envelope, a geração não se perde e dá pra reaplicar sem pagar outra chamada.
  await salvarResposta(input.taskHint, result);

  await logUsage({
    timestamp: new Date().toISOString(),
    model: result.model,
    taskHint: input.taskHint ?? null,
    usage: result.usage,
    finishReason: result.finishReason,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

// Best-effort, mesmo motivo do log de uso.
async function salvarResposta(taskHint, result) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nome = `${(taskHint ?? 'sem-hint').replace(/[^\w.-]/g, '_')}-${stamp}.txt`;
    await mkdir(RESPOSTAS_DIR, { recursive: true });
    await writeFile(path.join(RESPOSTAS_DIR, nome), result.content ?? '');
  } catch {
    // silencioso de propósito — ver comentário acima.
  }
}

// Log é best-effort: se falhar (ex.: disco cheio, permissão), não deve derrubar a
// chamada — a resposta da API já foi obtida e é o que importa pra quem chamou.
async function logUsage(entry) {
  try {
    await appendFile(USAGE_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // silencioso de propósito — ver comentário acima.
  }
}

main();
