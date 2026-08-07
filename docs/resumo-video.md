# Resumo técnico — roteiro para vídeo (~3 min)

> Pontos de apoio para narrar, não um texto pra ler palavra por palavra.

## 1. O produto (20s)

Guia Digital do Hóspede: cada imóvel tem um link único (`/FLN001`) com dados operacionais,
um Guia de Experiências gerado por IA e persistido, e um assistente virtual em chat. Resolve
o problema real do folheto impresso — manual, igual pra todo mundo, sujeito a erro.

## 2. Stack (20s)

Next.js 16 (App Router, Server Components), TypeScript `strict`, Tailwind v4, PostgreSQL
(Neon em produção, Docker local) via Drizzle ORM, Zod como fonte de verdade dos tipos de
domínio, DeepSeek V4 como LLM. Deploy na Vercel.

## 3. Arquitetura (30s)

- **Atomic Design** de verdade: atom não conhece domínio, organism monta uma seção inteira.
- **`domain/` é a fonte única da forma dos dados** — Zod valida em runtime e gera o tipo
  TypeScript; o schema Drizzle referencia esses tipos, nunca duplica a forma.
- **Fronteiras claras**: `server-only` em tudo que toca banco ou chave de API; nenhum
  componente React importa direto de `server/ai` ou `server/db` — sempre via route handler.

## 4. Integração com IA — o critério de maior peso (50s)

Duas peças, cada uma resolvendo uma falha específica do "LLM solto":

- **Guia de Experiências com grounding real.** Em vez de confiar só no conhecimento do
  modelo pra restaurantes/atrações (que às vezes inventa nome plausível), o sistema
  geocodifica o endereço (Nominatim) e busca lugares reais num raio de 2 km (Overpass/
  OpenStreetMap) **antes** de chamar o LLM. O modelo passa a **selecionar e descrever**, nunca
  inventar. Se a cobertura do OSM não for suficiente, cai automaticamente num prompt
  alternativo com teste de notoriedade — nunca quebra, sempre entrega algo coerente.
- **Chat com streaming real e anti-alucinação.** Contexto = dados do imóvel + guia já
  gerado, montado por função pura testável. Instrução explícita pra nunca inventar preço,
  disponibilidade ou política — e dizer claramente quando não sabe.
- Toda falha de IA (timeout, JSON inválido, rate limit, serviço externo fora do ar) tem
  comportamento definido e testado — nunca um erro genérico ou página quebrada.

## 5. Qualidade e resiliência (30s)

- 74+ testes (Vitest) cobrindo domínio, prompts, geração do guia, grounding, chat, rate
  limit — sempre com rede/LLM mockados, nunca chamada real em teste.
- `error.tsx`/`global-error.tsx`/`loading.tsx` cobrindo os estados que faltavam: erro
  inesperado do servidor e cold start do banco.
- Rate limit próprio no chat (10 msg/min por IP) além do da própria API do LLM.
- CI no GitHub Actions rodando `typecheck` + `lint` + testes + build a cada push/PR, com
  Postgres real como service container.

## 6. Como foi construído (30s) — o diferencial do processo

O fluxo de trabalho em si foi parte do desafio: Claude planeja e apresenta pontos de decisão
explícitos, o humano decide, e a geração de código de implementação passa por uma skill que
orquestra chamadas à API do DeepSeek — nunca o Claude escrevendo a implementação direto.
Decisões de arquitetura ficam documentadas em ADRs (`docs/decisions/`), com a alternativa
descartada e o porquê. Esse processo está versionado no próprio repositório (`CLAUDE.md`,
`ai/agents/`) porque é mais honesto do que esconder como o código nasceu.

## 7. Debito técnico e roadmap, se sobrar tempo (20s)

Grounding cobre bem quando o endereço geocodifica e o OSM tem dados na categoria — dois dos
três imóveis do seed usam endereço fictício e caem no fallback (documentado no README).
Roadmap real: integração com o motor de reservas (saber a data da estadia), envio automático
do link por WhatsApp, multilíngue.
