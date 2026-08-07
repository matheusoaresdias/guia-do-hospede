#!/usr/bin/env node
// Aplica no disco o envelope devolvido pelo DeepSeek. Parser em envelope.mjs.
//
// Por que existe (decisão D1/D2 de 06/08/2026): antes disto, quem fazia o find-and-replace
// era o Claude, na mão. Era ali que um `LOCALIZAR` ambíguo virava aplicação torta e
// silenciosa. Aqui, ambiguidade é ERRO — nada é escrito.
//
// Uso:
//   node envelope-applier.mjs [flags] < envelope.txt
//   node deepseek-client.mjs < req.json | node envelope-applier.mjs --response-json [flags]
//
// Flags:
//   --response-json      stdin é a saída JSON do deepseek-client.mjs; usa o campo .content
//   --allow <caminho>    (repetível) allowlist de caminhos editáveis. Sem nenhuma, qualquer
//                        caminho dentro do repo é aceito — passar sempre os mesmos de FILES.
//   --repo-root <path>   default: 3 níveis acima deste script
//   --task-hint <hint>   nomeia a pasta de snapshot
//   --dry-run            valida tudo e relata, sem escrever nada
//
// Garantias:
//   1. DUAS FASES — valida e calcula o conteúdo final de TODOS os arquivos em memória antes
//      de escrever qualquer um. Envelope meio certo não deixa o repo meio aplicado.
//   2. SNAPSHOT — o conteúdo anterior de todo arquivo tocado vai para snapshots/<hint>-<ts>/
//      antes da escrita. Undo não depende do git (o repo trabalha com mudança pendente por
//      fases, então exigir working tree limpa travaria o fluxo real).
//   3. FALHA DURA — LOCALIZAR sem match, com match múltiplo, caminho fora da allowlist ou
//      fora da raiz do repo: exit 1, nada escrito.
//
// Saída: JSON em stdout (sucesso) ou {"error": ...} em stderr + exit 1.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseEnvelope } from './envelope.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const SNAPSHOT_DIR = path.join(SCRIPT_DIR, 'snapshots');

function fail(message, extra = {}) {
  process.stderr.write(JSON.stringify({ error: message, ...extra }) + '\n');
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { allow: [], dryRun: false, responseJson: false, repoRoot: DEFAULT_REPO_ROOT, taskHint: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--response-json') opts.responseJson = true;
    else if (a === '--allow') opts.allow.push(argv[++i]);
    else if (a === '--repo-root') opts.repoRoot = path.resolve(argv[++i]);
    else if (a === '--task-hint') opts.taskHint = argv[++i];
    else fail(`Flag desconhecida: ${a}`);
  }
  return opts;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function existe(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function contarOcorrencias(haystack, needle) {
  if (needle === '') return 0;
  return haystack.split(needle).length - 1;
}

function resolverAlvo(repoRoot, alvo, allow) {
  const abs = path.resolve(repoRoot, alvo);
  const rel = path.relative(repoRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    fail(`Caminho "${alvo}" está fora da raiz do repo (${repoRoot}) — recusado.`);
  }
  if (allow.length > 0) {
    const permitido = allow.some((a) => path.resolve(repoRoot, a) === abs);
    if (!permitido) {
      fail(`Caminho "${alvo}" não está na allowlist (--allow). O modelo tentou editar um arquivo que não estava em FILES.`, {
        permitidos: allow,
      });
    }
  }
  return { abs, rel };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = await readStdin();
  if (!raw.trim()) fail('Nenhum input recebido via stdin.');

  let texto = raw;
  if (opts.responseJson) {
    let resp;
    try {
      resp = JSON.parse(raw);
    } catch (err) {
      fail(`--response-json foi passado mas stdin não é JSON válido: ${err.message}`);
    }
    if (typeof resp.content !== 'string') fail('Resposta JSON sem campo "content" em texto.');
    if (resp.finishReason && resp.finishReason !== 'stop') {
      fail(`finishReason="${resp.finishReason}" — resposta provavelmente truncada. Não vou aplicar; aumente maxTokens e refaça.`);
    }
    texto = resp.content;
  }

  let blocos;
  try {
    blocos = parseEnvelope(texto);
  } catch (err) {
    fail(`Envelope inválido — ${err.message}`);
  }

  // ---- Fase 1: validar e calcular tudo em memória (nada é escrito ainda) ----
  const planejado = [];
  for (const bloco of blocos) {
    const { abs, rel } = resolverAlvo(opts.repoRoot, bloco.path, opts.allow);
    const jaExiste = await existe(abs);
    const anterior = jaExiste ? await readFile(abs, 'utf8') : null;

    if (bloco.modo === 'COMPLETO') {
      planejado.push({ rel, abs, modo: 'COMPLETO', anterior, novo: bloco.conteudo, patches: 0, criado: !jaExiste });
      continue;
    }

    if (!jaExiste) fail(`PATCH em "${rel}", mas o arquivo não existe. Para criar arquivo use MODO=COMPLETO.`);

    let conteudo = anterior;
    bloco.pares.forEach((par, i) => {
      const n = contarOcorrencias(conteudo, par.localizar);
      if (n === 0) {
        fail(`PATCH ${i + 1}/${bloco.pares.length} de "${rel}": o trecho de LOCALIZAR não existe no arquivo. O modelo reescreveu em vez de copiar — nada foi aplicado.`, {
          localizar: par.localizar.slice(0, 300),
        });
      }
      if (n > 1) {
        fail(`PATCH ${i + 1}/${bloco.pares.length} de "${rel}": o trecho de LOCALIZAR aparece ${n} vezes — ambíguo, nada foi aplicado. Peça um trecho com mais linhas de contexto.`, {
          localizar: par.localizar.slice(0, 300),
        });
      }
      conteudo = conteudo.replace(par.localizar, () => par.substituir);
    });

    planejado.push({ rel, abs, modo: 'PATCH', anterior, novo: conteudo, patches: bloco.pares.length, criado: false });
  }

  const semMudanca = planejado.filter((p) => p.anterior !== null && p.anterior.trimEnd() === p.novo.trimEnd());

  if (opts.dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          arquivos: planejado.map((p) => ({
            path: p.rel,
            modo: p.modo,
            criado: p.criado,
            patches: p.patches,
            bytesAntes: p.anterior?.length ?? 0,
            bytesDepois: p.novo.length,
          })),
          semMudanca: semMudanca.map((p) => p.rel),
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  // ---- Fase 2: snapshot + escrita ----
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapDir = path.join(SNAPSHOT_DIR, `${opts.taskHint ?? 'sem-hint'}-${stamp}`);

  for (const p of planejado) {
    if (p.anterior === null) continue;
    const destino = path.join(snapDir, p.rel);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, p.anterior);
  }

  for (const p of planejado) {
    await mkdir(path.dirname(p.abs), { recursive: true });
    await writeFile(p.abs, p.novo.endsWith('\n') ? p.novo : p.novo + '\n');
  }

  process.stdout.write(
    JSON.stringify(
      {
        aplicados: planejado.map((p) => ({ path: p.rel, modo: p.modo, criado: p.criado, patches: p.patches })),
        semMudanca: semMudanca.map((p) => p.rel),
        snapshot: snapDir.startsWith(opts.repoRoot + path.sep) ? path.relative(opts.repoRoot, snapDir) : snapDir,
      },
      null,
      2,
    ) + '\n',
  );
}

main();
