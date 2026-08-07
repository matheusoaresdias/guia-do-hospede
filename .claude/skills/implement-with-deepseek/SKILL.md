---
name: implement-with-deepseek
description: Chama a API oficial do DeepSeek (V4 Flash/Pro) para gerar código sob orquestração do Claude. Use quando o fluxo de trabalho define que a geração de código é feita pelo DeepSeek e o Claude só planeja, orquestra e revisa — nunca para decidir sozinho o que fazer com o resultado. Cliente desacoplado e reutilizável por outras skills (`deepseek-client.mjs`, sem dependência de Claude Code).
---

# implement-with-deepseek

Wrapper fino de UMA chamada à API de chat completions do DeepSeek. Não é um agente: não decide
próximos passos, não executa `tool_calls` sozinho, não age sobre o repositório. Quem invoca é
responsável por montar a mensagem e tratar a resposta.

## Quando usar

Neste repositório: Claude planeja a atividade e as decisões (com aprovação do usuário) → **o
código de implementação é gerado pelo DeepSeek via esta skill** → Claude revisa o resultado,
roda os critérios de aceite e traz de volta ao usuário o que merece atenção.

**Usar para:** funcionalidades novas, refatorações, testes, regras de negócio, migrations,
alterações em múltiplos arquivos.

**Não usar para** (continua sendo Claude + usuário): planejamento e escolha de contexto;
decisões de arquitetura e pontos de decisão de produto/UX; revisão do código gerado (não faz
sentido o DeepSeek revisar a si mesmo); comunicação com o usuário.

**Armadilha nº 1:** todo bloco cujo arquivo não foi visto pelo modelo volta alucinado — ele
inventa nomes de export, imports de bibliotecas que o projeto não usa, e campos que não
existem. O modo de falha é sempre inventar, nunca perguntar. Por isso a regra abaixo.

## Pré-requisito

`DEEPSEEK_API_KEY` exportada no ambiente. O script falha rápido com mensagem clara se faltar, e
**não lê de nenhum arquivo `.env`** — é credencial de ferramenta de desenvolvimento, não da
aplicação.

## Regra de ouro: passar CAMINHO, nunca CONTEÚDO

Nada de colar arquivo dentro do `content`. O cliente lê os campos `perfil` e `files` do disco e
injeta o conteúdo integral sozinho. Isso torna *impossível* — não apenas "proibido" — abreviar
contexto. Caminho errado é erro duro do cliente, porque caminho errado vira alucinação.

**Perfis** (`contexto/perfis.json`): `base`, `frontend`, `backend`, `ia`, `teste` — combináveis.
Cada perfil é uma lista de caminhos de fontes vivas lidas do disco a cada chamada, então nunca
ficam desatualizadas e não duplicam nada. Perfil enxuto: o risco não é custo, é diluir a
instrução da tarefa em boilerplate.

## Como invocar

A mensagem `system` é constante — copiar verbatim em toda chamada, para manter a instrução de
papel e formato consistente entre chamadas:

```
Você é um engenheiro de software sênior implementando código de produção para o
Guia Digital do Hóspede (Next.js 16 App Router + TypeScript strict + Tailwind v4 +
Drizzle + PostgreSQL). Gere apenas o código pedido, seguindo exatamente as seções
OBJECTIVE/CONTEXT_TAREFA/FILES/CONSTRAINTS/ACCEPTANCE_CRITERIA da mensagem do
usuário, sem explicações fora de comentários necessários no próprio código.
```

```bash
echo '{
  "model": "pro",
  "messages": [
    {"role": "system", "content": "<constante acima, verbatim>"},
    {"role": "user", "content": "<seções OBJECTIVE/CONTEXT_TAREFA/FILES/CONSTRAINTS/ACCEPTANCE_CRITERIA>"}
  ],
  "perfil": ["base", "backend"],
  "files": [
    {"path": "src/domain/property.ts", "nota": "tipos do domínio — não redeclarar"},
    {"path": "src/server/ai/guide-service.ts", "nota": "serviço novo", "novo": true}
  ],
  "temperature": 0.2,
  "thinking": true,
  "reasoningEffort": "high",
  "taskHint": "<fase>-<passo>-<slug-curto>"
}' | node .claude/skills/implement-with-deepseek/deepseek-client.mjs
```

`taskHint` é obrigatório — sem ele o `usage.log` não responde depois quais tarefas usaram `pro`
desnecessariamente. Retentativas recebem sufixo `-retryN`.

Antes de uma chamada cara, conferir a montagem com `"dryRun": true`: imprime o payload e o
total aproximado de tokens sem chamar a API.

Erro: JSON em stderr e exit code 1 — checar o exit code antes de tratar stdout como sucesso.

## Contrato de prompt

`OBJECTIVE`/`CONTEXT_TAREFA`/`FILES`/`CONSTRAINTS`/`ACCEPTANCE_CRITERIA` não são campos do JSON
de input — o cliente continua genérico. São seções que o Claude monta dentro do `content` da
mensagem `user`, sempre nesta ordem. Quanto mais previsível a entrada, melhor a saída; não
pular seção, mesmo que curta.

```
OBJECTIVE: <o que o código deve fazer, 1-2 frases>

CONTEXT_TAREFA: <decisões do plano já lapidadas pelo usuário, restrições vindas da conversa,
o porquê da mudança. NÃO colar código aqui — arquivo vai pelo campo `files`>

FILES: <o que muda em cada arquivo, em prosa. Os caminhos e o conteúdo atual vão no campo
`files` do JSON; esta seção explica a intenção, não repete o código>

CONSTRAINTS: <invariantes que não podem quebrar — ex.: "proibido any", "chave de API só em
src/server/ai/", "domain/ não importa de server/", proibições do CLAUDE.md>

ACCEPTANCE_CRITERIA: <como o Claude vai verificar antes de aplicar — testes que devem passar,
comportamento esperado, checagem estática>
```

## Aplicação do resultado

Quando a chamada tem `files`, o cliente anexa sozinho a instrução de `FORMATO_DE_SAIDA`: o
DeepSeek responde em blocos `<<<ARQUIVO caminho MODO=COMPLETO|PATCH>>>`, e quem aplica é o
`envelope-applier.mjs` — não o Claude na mão.

```bash
node deepseek-client.mjs < req.json > resp.json
node envelope-applier.mjs --response-json --task-hint <mesmo taskHint> \
  --allow src/server/ai/guide-service.ts < resp.json
```

- **`--allow` recebe exatamente os caminhos de `files`.** Editar outra coisa é recusado.
- **Falha dura**: `LOCALIZAR` que não bate ou que bate em mais de um lugar, caminho fora da
  allowlist, resposta truncada (`finishReason != stop`) ou bloco não fechado → nada é escrito.
  A validação roda em duas fases, então um envelope meio errado nunca deixa o repo meio aplicado.
- **Snapshot automático** do conteúdo anterior em `snapshots/` e resposta bruta em `respostas/`
  (ambos gitignored) — dá para desfazer sem pagar outra chamada.

**A revisão continua sendo do Claude.** O applier substituiu o find-and-replace manual, não a
revisão. Depois de aplicar: ler o `git diff` sempre, e ler o arquivo inteiro quando tocar
teste, regra de negócio ou concorrência — os erros que mais escapam são semânticos, e esses um
diff esconde.

## Escolha de modelo

- `flash` (`deepseek-v4-flash`) — mais rápido e barato. Bom para tarefas bem especificadas e de
  escopo pequeno.
- `pro` (`deepseek-v4-pro`) — mais profundo. Preferir quando a tarefa exige mais raciocínio:
  múltiplos arquivos interdependentes, refactor amplo, regra de negócio não trivial.

| Sinal da tarefa | Tier |
|---|---|
| 1 arquivo, mudança pontual, sem regra de negócio | `flash` |
| Múltiplos arquivos interdependentes, ou refactor amplo | `pro` |
| Dúvida sobre qual sinal se aplica | `pro` |

## Loop de verificação

Depois de aplicar, Claude roda o `ACCEPTANCE_CRITERIA` (testes, typecheck, build). Se falhar,
monta uma nova chamada reaproveitando o mesmo prompt — mesmo `system`, mesmo `perfil`, mesmos
`files` (relidos do disco, já refletindo o que foi aplicado) — e acrescenta ao final:

```
FAILURE_CONTEXT: <erro estruturado da tentativa anterior — saída de teste/typecheck/lint,
arquivo e linha quando disponível, o que foi tentado>
```

Orçamento: até 2 tentativas adicionais. Se ainda falhar, Claude para e reporta ao usuário, para
não mascarar um problema de plano ou arquitetura como se fosse só "código errado".

## O que esta skill NÃO faz (de propósito)

- Não executa `tool_calls` — o DeepSeek não roda teste nem age sobre o repositório. Quem roda os
  critérios e decide retentar é sempre o Claude.
- **O `envelope-applier.mjs` não é autonomia do DeepSeek.** Quem lê e escreve arquivo é um
  script local determinístico, sobre uma allowlist que **o Claude** declarou. O DeepSeek
  devolve texto, e o texto é validado antes de virar bytes.
- Não tem streaming — cada chamada é request/response completo.
- Não decide arquitetura nem regra de negócio — isso é do Claude + usuário, antes da chamada.
- Não vira uma família de skills "DeepSeek X" (Architect, Reviewer, Planner). O DeepSeek entra
  como coprocessador de implementação; skill nova que o envolva reusa este mesmo cliente.
