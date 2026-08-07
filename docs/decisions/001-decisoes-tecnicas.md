# ADR 001 — Decisões técnicas do Guia Digital do Hóspede

**Data:** 07/08/2026 · **Status:** aceito · **Contexto:** teste técnico Seazone — AI Builder,
com orçamento de tempo fechado (~4h de execução).

Este documento registra as decisões que tinham mais de uma via de resolução, o trade-off de
cada uma e por que a alternativa foi descartada. Ele existe porque, num teste com prazo curto,
o que distingue uma escolha de um atalho é ter o motivo escrito.

---

## D1 — LLM do produto: DeepSeek V4

**Alternativas:** Claude (`claude-opus-5`); camada provider-agnostic com dois adapters ativos.

**Decisão:** DeepSeek V4, atrás de uma interface `LlmProvider` com exatamente dois métodos
(`generateJson`, `streamText`).

**Por quê:** a API é compatível com o formato OpenAI, tem streaming e modo JSON nativos, e a
credencial já estava disponível no ambiente de desenvolvimento — o que, num orçamento de 4h,
elimina um caminho crítico (criar conta, configurar billing) que não agrega ponto nenhum na
avaliação. Claude produz prompts de qualidade superior, mas exigiria provisionar uma chave
nova. Dois adapters simultâneos dobrariam a superfície de teste sem entregar requisito.

**Consequência:** trocar de provedor é escrever um arquivo em `src/server/ai/providers/`.
Nenhuma outra camada conhece o provedor.

---

## D2 — Veracidade dos lugares sugeridos: conhecimento do modelo + prompt restritivo

**Alternativas:** Google Places API; ferramenta de busca web do provedor.

**Decisão:** o guia é gerado a partir do conhecimento do modelo, com um system prompt que
proíbe explicitamente inventar estabelecimentos e instrui a preferir uma opção mais genérica
porém real a arriscar um nome inventado. A saída é validada por schema antes de persistir, e
as distâncias são declaradas como aproximadas.

**Por quê:** é a única opção sem dependência externa nova. Google Places daria dados
verificáveis, mas custa chave, billing, mais um ponto de falha e mais um segredo para proteger
num repositório público.

**Risco assumido, explicitamente:** um estabelecimento pode ter fechado ou ter o nome
ligeiramente errado. **É o principal débito técnico do projeto.** A evolução natural é validar
cada lugar gerado contra a Places API e descartar os que não resolverem — o schema de saída já
está desenhado para isso (cada lugar é um objeto isolado e substituível).

---

## D3 — Hospedagem: Vercel + Neon

**Alternativas:** Vercel + Supabase; VPS com Docker Compose.

**Decisão:** Vercel para a aplicação, Neon para o PostgreSQL. Desenvolvimento local usa
Postgres em Docker Compose na porta **55433**.

**Por quê:** deploy nativo de Next.js com streaming funcionando, free tier nos dois, URL
pública em minutos. VPS daria controle total ao custo de horas de infraestrutura que não são
avaliadas neste teste. Supabase traria painel e auth que o produto não usa.

---

## D4 — Persistência do guia: permanente, com invalidação por estação

**Alternativas:** persistir e nunca regenerar; TTL fixo em dias.

**Decisão:** uma linha por imóvel em `experience_guides`, com uma coluna `season` no formato
`YYYY-Qn`. O guia só é regenerado se não existir ou se a estação corrente for diferente da
armazenada.

**Por quê:** o enunciado exige duas coisas em tensão — "o guia não deve ser regenerado a cada
acesso" e "dica sazonal relevante para a época do ano atual". Persistir para sempre satisfaz a
primeira e viola a segunda em três meses. Um TTL em dias é arbitrário e regenera à toa.
Amarrar a invalidação à unidade de tempo que a informação realmente tem (o trimestre) resolve
as duas, e é determinístico — `currentSeason()` é função pura e testável.

---

## D5 — Geração do guia sem streaming; chat com streaming

**Alternativas:** streaming de objeto estruturado preenchendo o guia campo a campo.

**Decisão:** o guia é gerado inteiro no servidor, validado, persistido e então entregue; o
cliente mostra skeleton com a forma do conteúdo final. O streaming fica onde o enunciado o
exige: o chat.

**Por quê:** validar o objeto completo antes de persistir é o que permite tratar falha da IA
com honestidade — JSON truncado ou fora do schema nunca chega ao banco nem à tela. Streaming
de objeto complicaria validação, persistência e teste em troca de um ganho estético.
"Feedback visual claro durante a geração" é requisito e é atendido pelo skeleton com estado
de progresso.

---

## D6 — O processo de desenvolvimento é versionado junto

**Decisão:** `CLAUDE.md`, `ai/agents/` e `.claude/skills/` ficam no repositório.

**Por quê:** este projeto foi construído com uma separação deliberada de papéis — Claude
planeja, decide arquitetura com o humano e revisa; DeepSeek V4 gera o código de implementação
sob orquestração. Esconder isso tornaria a organização do repositório menos honesta e menos
informativa. Os artefatos de execução do fluxo (`usage.log`, respostas brutas, snapshots) são
ruído local e ficam fora do versionamento.

---

## D7 — Três imóveis no seed

**Decisão:** FLN001 (Florianópolis/SC) e GRM001 (Gramado/RS), do enunciado, mais UBA001
(Ubatuba/SP).

**Por quê:** com dois imóveis, um guia contextualizado corretamente ainda pode ser coincidência
ou condicional escondido no código. O terceiro, numa região de perfil diferente (litoral norte
paulista), é a evidência barata de que a personalização é real.

---

## D8 — Seed com conexão própria

**Decisão:** `src/server/db/seed.ts` abre a própria conexão em vez de importar
`src/server/db/client.ts`.

**Por quê:** `client.ts` importa `server-only`, um pacote que lança por design quando avaliado
fora do runtime React. O seed roda por `tsx`, fora do Next. Manter a guarda `server-only` no
client (que é o que protege a credencial de vazar para um bundle de cliente) vale mais do que
reaproveitar dez linhas de configuração de conexão.
