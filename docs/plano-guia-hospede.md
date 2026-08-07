# Plano de atividade — Guia Digital do Hóspede (teste técnico Seazone)

> Status: **aguardando lapidação do usuário**. Nada implementado ainda.
> Data: 07/08/2026.

## Objetivo

Construir uma versão do Guia Digital do Hóspede em que cada imóvel tem um link único
(`/FLN001`) com conteúdo personalizado: dados operacionais do imóvel, um Guia de
Experiências gerado por IA e contextualizado pelo endereço real (persistido, não
regenerado a cada acesso) e um assistente virtual em chat com streaming que responde
apenas com base nos dados do imóvel + guia gerado. Entrega: repositório **público** no
GitHub + URL pública funcional.

## Contexto mínimo

**O que o PDF exige (não negociável):**
- Stack: Next.js, TypeScript, Tailwind, banco de dados (ex.: PostgreSQL).
- LLM para geração dinâmica de conteúdo.
- Atomic Design / clean code; padrões de commit.
- RF1 — `/[codigo]`: fotos, nome/tipo/localização, capacidade (quartos/banheiros/hóspedes),
  amenidades, WiFi (rede+senha), instruções de acesso, estacionamento, check-in/out,
  políticas (pet/fumo/crianças/bebês/eventos), anfitrião (nome+telefone), endereço completo.
  Código inexistente → tela de erro amigável. Mobile-first.
- RF2 — Guia de Experiências por IA: boas-vindas personalizada, **4–5 restaurantes reais**,
  **3–4 atrações reais**, serviços essenciais (farmácia/mercado/hospital), dica sazonal do
  período atual. Contextualizado pelo endereço real. **Persistido.** Feedback visual durante
  geração.
- RF3 — Chat: **streaming obrigatório** (texto progressivo), contexto = dados do imóvel +
  guia gerado, não inventar. Deve acertar as 4 perguntas de exemplo do PDF.
- Avaliação: Produto, Integração com IA (qualidade do prompt/system prompt, coerência com o
  endereço real, tratamento de falhas da IA), Responsividade, Qualidade do Código (testes,
  TS correto, separação de responsabilidades, erros e edge cases), Organização (README,
  decisões documentadas), Testes (diferencial).

**Referência de estrutura/navegação** (guia-do-hospede.seazone.com.br — hoje estático e igual
para todos): seções em acordeão — Informações Essenciais · Sobre a Reserva · Pré Check-in e
Acesso · Check-in e Check-out · Regras e Convivência · Limpeza, Taxas e Serviços · Durante a
Estadia · Outras Dúvidas. Vamos cobrir as mesmas necessidades, **sem replicar visualmente**, e
com o diferencial de ser por imóvel.

**Modelo de trabalho:** usuário pede plano → lapida → **geração de
código passa pela skill `implement-with-deepseek`** (Claude orquestra/planeja/revisa, DeepSeek
gera; Claude passa CAMINHO de arquivo, nunca CONTEÚDO; `envelope-applier.mjs` aplica com falha
dura) → Claude revisa → usuário valida. Este repo ainda não tem essa infra: a Fase 0 monta.

## Pontos de decisão

Cada ponto tem opções, trade-offs e recomendação. **Você decide.**

### D1 — Qual LLM o *produto* usa (guia + chat)?

| Opção | Trade-off |
|---|---|
| **A. DeepSeek V4** (recomendado) | Chave já no ambiente, API compatível com OpenAI, streaming e `response_format: json_object` nativos, custo baixo. Reusa o mesmo provedor que já orquestramos. Menos "vitrine" que Claude para o avaliador. |
| B. Claude (`claude-opus-5`) | Melhor qualidade de prompt/instrução e é o que o PDF cita primeiro. **Exige uma `ANTHROPIC_API_KEY` que hoje não existe no ambiente** — precisa criar e custear. |
| C. Camada provider-agnostic + 2 adapters | Demonstra arquitetura, mas dobra superfície de teste em 48h. |

Recomendação: **A**, com a integração isolada atrás de uma interface (`LlmProvider`) para que
trocar seja um arquivo, sem virar escopo. Independente da escolha: chave só no servidor,
nunca em `NEXT_PUBLIC_*`.

### D2 — Como garantir que restaurantes/atrações são **reais**?

O PDF exige "opções reais" e o avaliador vai conferir Florianópolis e Gramado.

| Opção | Trade-off |
|---|---|
| **A. Conhecimento do LLM + prompt restritivo + seed curado** (recomendado) | Zero dependência externa. Risco: nome inventado ou lugar fechado. Mitigação: prompt exige estabelecimentos consolidados/conhecidos e proíbe inventar; validação de schema; distâncias marcadas como "Aprox." |
| B. Google Places API | Dados reais e verificáveis. Exige chave + billing + mais um ponto de falha; a chave também precisa não vazar. |
| C. Web search do provedor | DeepSeek não expõe isso; ficaria acoplado a outro provedor. |

Recomendação: **A** para o MVP, e o README documenta explicitamente o trade-off e como
evoluiria para grounding via Places (isso pontua no critério "decisões documentadas").

### D3 — Onde hospedar (URL pública + Postgres)?

| Opção | Trade-off |
|---|---|
| **A. Vercel + Neon (Postgres serverless)** (recomendado) | Deploy nativo Next.js, free tier, ambos com URL pública em minutos, streaming funciona. |
| B. VPS + Docker Compose | Você já domina, mas gasta horas de infra que não são avaliadas aqui. |
| C. Vercel + Supabase | Equivalente a A; Neon é mais direto para Drizzle. |

Recomendação: **A**. Dev local com Postgres em Docker Compose (porta **55433**, para não colidir
com outras instâncias de Postgres já em uso nesta máquina).

### D4 — Política de regeneração do guia persistido

O PDF diz "não deve ser regenerado a cada acesso" **e** pede "dica sazonal relevante para a
época do ano atual" — que envelhece.

| Opção | Trade-off |
|---|---|
| **A. Persistir para sempre + campo `season` (ano-trimestre); regenera se a estação mudou** (recomendado) | Cumpre as duas exigências; determinístico e testável. |
| B. Persistir para sempre, nunca regenerar | Mais simples, mas em 3 meses a dica sazonal está errada — e é um detalhe que o avaliador pode cutucar. |
| C. TTL fixo (ex.: 30 dias) | Arbitrário e regenera à toa. |

Recomendação: **A**.

### D5 — O guia é gerado com streaming ou "gera e mostra"?

| Opção | Trade-off |
|---|---|
| **A. Gerar completo no servidor + skeleton/shimmer no cliente** (recomendado) | O PDF exige JSON estruturado e persistido; validar o objeto inteiro antes de salvar é o que permite tratamento de falha decente. "Feedback visual claro" é atendido pelo skeleton + estado de progresso. Streaming fica onde é obrigatório (chat). |
| B. `streamObject` preenchendo campo a campo | Mais bonito, mas complica validação, persistência e teste — em 48h é risco. |

Recomendação: **A**.

### D6 — O repo público mostra o fluxo Claude+DeepSeek (`.claude/`, `ai/agents/`)?

O repo vai para avaliação da Seazone.

| Opção | Trade-off |
|---|---|
| **A. Versionar tudo, e o README explicar o processo** (recomendado) | Demonstra maturidade de processo (orquestração, ADRs, revisão) — bate direto no critério "Organização / decisões técnicas documentadas". Assume explicitamente o uso de IA, que o próprio teste valoriza. |
| B. Manter `.claude/` fora do git | Repo mais "neutro", mas perde o diferencial e esconde algo que não precisa ser escondido. |

Recomendação: **A**. Em qualquer caso: `usage.log`, `respostas/` e `snapshots/` ficam
gitignored (são ruído local, e `usage.log` registra volume de uso).

### D7 — Quantos imóveis no seed?

O PDF dá 2 (FLN001, GRM001). Recomendo **4**: os 2 obrigatórios + 2 de outras cidades
(ex.: Ubatuba/SP e Campos do Jordão/SP) para provar que a personalização não é hardcode de
duas cidades. Alternativa: só os 2, se o tempo apertar.

### D8 — Prazo real

O PDF dá **48h a partir do recebimento**; o arquivo está na pasta desde 05/08 e hoje é 07/08.
**Preciso saber quantas horas úteis ainda existem**, porque isso decide se cortamos D7 (4→2
imóveis), testes E2E e polimento visual. As Fases abaixo estão ordenadas por prioridade de
avaliação, então dá para cortar do fim.

## Fases / Tarefas

Cada fase termina em algo verificável. Ponto de teste manual marcado com 🧪.

### F0 — Fundação do repo e do fluxo de trabalho *(Claude + usuário, sem DeepSeek)*
1. `git init`, branch `main`, `.gitignore` (node_modules, `.env*` exceto `.env.example`,
   `.next`, `respostas/`, `snapshots/`, `*.log`), commit inicial vazio.
2. Montar `.claude/skills/implement-with-deepseek/` (`deepseek-client.mjs`,
   `envelope.mjs`, `envelope-applier.mjs`, `SKILL.md`) e **reescrever `contexto/perfis.json`**
   para os perfis deste repo (`base`, `frontend`, `backend`, `dominio`, `teste`).
3. `CLAUDE.md` raiz: roteamento de contexto, fluxo de 5 passos, pontos de decisão,
   regra de segredos.
4. `ai/agents/`: `cto.md`, `frontend-engineer.md`, `backend-engineer.md`, `ai-engineer.md`
   (prompts, anti-alucinação, tratamento de falha), `qa.md`, `code-reviewer.md`.
5. `.claude/skills/plano-atividade/SKILL.md` adaptada.
6. `docs/decisions/`: ADRs 001–00N registrando D1–D8 conforme você decidir.
   **Verificação:** `node .claude/skills/implement-with-deepseek/deepseek-client.mjs` com
   `"dryRun": true` monta payload sem chamar a API.

### F1 — Esqueleto Next.js + camada de dados
1. `create-next-app` (App Router, TS strict, Tailwind, ESLint), `docker-compose.yml` com
   Postgres na 55433, `.env.example` **com placeholders**.
2. Drizzle: schema `properties` (+ campos aninhados como `jsonb` tipado: `address`,
   `operational`, `rules`, `amenities`, `images`, `host`) e `experience_guides`
   (`property_id`, `content jsonb`, `model`, `season`, `generated_at`, `status`).
3. Zod como fonte de verdade dos tipos de domínio (`src/domain/property/`), com
   `drizzle-kit` migrations e seed dos imóveis de D7.
   **Verificação:** `npm run db:migrate && npm run db:seed`; teste de integração lendo FLN001.

### F2 — Página do guia `/[code]` (Atomic Design)
1. Server Component busca o imóvel; `notFound()` → `app/[code]/not-found.tsx` amigável.
2. Componentes: `atoms/` (Badge, Icon, Skeleton, Button, CopyableField) →
   `molecules/` (AmenityItem, RuleItem, PolicyRow, HostCard, WifiCard) →
   `organisms/` (PropertyHero, AccessSection, RulesSection, ContactSection) →
   `templates/GuidebookTemplate`.
3. Galeria de fotos, `next/image` com `remotePatterns` para `images.unsplash.com`.
4. Mobile-first; navegação por seções (âncoras/tabs) espelhando a IA do guia atual.
   🧪 **Verificação:** `/FLN001` e `/GRM001` corretos, `/XXX999` mostra erro amigável,
   layout OK em 375px e desktop. Testes RTL nos organisms.

### F3 — Guia de Experiências por IA
1. `src/server/ai/`: `provider.ts` (interface + adapter do D1), `prompts/experience-guide.ts`
   (system prompt + user prompt com endereço real, bairro, cidade, estado, tipo de imóvel,
   perfil de capacidade e mês atual), `schema.ts` (Zod do JSON esperado).
2. Route handler `POST /api/properties/[code]/guide`: gera-se-ausente (ou se `season` mudou),
   valida com Zod, persiste, retorna. Concorrência: lock otimista para não gerar 2x.
3. Cliente: componente que dispara a geração e mostra skeleton + mensagem de progresso;
   estado de erro com botão "tentar novamente".
4. **Tratamento de falha da IA** (critério explícito de avaliação): timeout, retry com backoff,
   JSON inválido → 1 retry com feedback do erro, fallback para conteúdo mínimo + aviso honesto
   ao hóspede; nunca quebrar a página do imóvel.
   🧪 **Verificação:** FLN001 sugere Florianópolis, GRM001 sugere Gramado; segundo acesso não
   chama o LLM (log/contador). Testes unitários do parser/validador e do route handler com
   provider mockado (sucesso, JSON inválido, timeout).

### F4 — Assistente virtual (chat com streaming)
1. `POST /api/properties/[code]/chat` com streaming (Web Streams / SSE). System prompt monta
   contexto a partir do imóvel + guia persistido, com regras anti-alucinação explícitas
   ("responda apenas com os dados fornecidos; se não souber, oriente a falar com o anfitrião").
2. UI de chat: bolhas, texto aparecendo progressivamente, sugestões rápidas com as 4 perguntas
   do PDF, estado de erro, limite de histórico.
3. Guardas: rate limit simples por IP, tamanho máximo de mensagem.
   🧪 **Verificação:** as 4 perguntas do PDF respondidas corretamente em FLN001 **e** GRM001
   (respostas devem divergir — pet proibido em FLN001, permitido em GRM001); pergunta fora do
   escopo ("qual o preço da diária?") não inventa. Teste do builder de contexto e do handler.

### F5 — Testes, README e higiene de segredos
1. Suíte Vitest verde; cobertura nos pontos que o PDF cita (validações, edge cases).
2. README: o que é, como rodar local, variáveis de ambiente, arquitetura e o porquê,
   decisões técnicas (link para `docs/decisions/`), o que faria com mais tempo.
3. **Auditoria de segredos antes de tornar público**: varredura de todo o histórico
   (`git log -p | grep -E 'sk-|ghp_|AIza|api[_-]?key'`), confirmar `.env` fora do git,
   confirmar que nenhuma chave está em `NEXT_PUBLIC_*`, `.env.example` só com placeholders.
4. Padrão de commits: Conventional Commits desde o primeiro commit.

### F6 — Deploy
1. Neon: banco + migrations + seed. Vercel: import do repo, env vars pela dashboard
   (nunca no código), deploy.
2. Repo GitHub público (só depois da F5.3).
   🧪 **Verificação:** URL pública abre `/FLN001`, gera guia, chat streama.

## Riscos

1. **Prazo (D8) é o risco nº 1.** Se sobrarem <12h úteis, corto D7 para 2 imóveis, os testes
   RTL de componentes e o polimento visual — mantendo F3/F4 completos, que valem mais pontos.
2. **Alucinação de lugares reais (D2).** O avaliador é de Florianópolis. Mitigação: prompt
   restritivo + revisão manual do guia gerado nos 2 imóveis principais antes de entregar.
3. **Streaming em serverless.** Vercel suporta, mas exige runtime e headers corretos; testar
   em produção cedo (F4 e F6 não podem ficar ambos para o fim).
4. **Segredo vazado em repo público.** Mitigação: F5.3 é bloqueante para F6.2, e o histórico
   começa limpo (F0.1 antes de qualquer `.env`).
5. **Custo de revisão do código de teste gerado pelo DeepSeek** — código de teste gerado por
   LLM costuma precisar de correção antes de rodar. Orçar tempo de revisão em F5, não assumir
   que passa de primeira.
6. **Cold start do Neon** pode fazer o primeiro acesso parecer lento na demo. Mitigação:
   aquecer antes de enviar o link.
