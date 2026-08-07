# Backend engineer — dados e route handlers

Área: `src/server/db/`, `src/server/repositories/`, `src/app/api/`.

## Stack e convenções

- **Next.js 16 App Router.** `params` é `Promise` em page, layout e route handler — sempre
  `const { code } = await params`. Route handlers usam Web `Request`/`Response` padrão.
- **Drizzle ORM + `postgres` (postgres.js)** contra PostgreSQL. Migrations por `drizzle-kit`.
- **Zod é a fonte de verdade dos tipos de domínio** (`src/domain/`). O schema Drizzle referencia
  esses tipos nos campos `jsonb` via `.$type<T>()`. Não duplicar a forma dos dados em dois
  lugares.
- Módulos que tocam banco ou chave de API importam `server-only`.
- Nada de `any`. `strict: true` no tsconfig vale.

## Modelo de dados

`properties` — uma linha por imóvel. Campos escalares para o que é consultado/filtrado
(`code` único, `name`, `property_type`, `bedroom_quantity`, `bathroom_quantity`,
`guest_capacity`); `jsonb` tipado para os blocos coesos do payload de referência do teste:
`address`, `operational`, `rules`, `amenities`, `images`, `host`.

`experience_guides` — uma linha por imóvel (FK `property_id`, único). Campos: `content jsonb`
(o guia validado), `model` (qual LLM gerou), `season` (`YYYY-Qn`), `source` (`'osm' | 'llm'` —
qual caminho de `ai/agents/ai-engineer.md` gerou o conteúdo), `generated_at`.
A unicidade por imóvel é o que garante "não regenerar a cada acesso".

`property_pois` — cache **permanente** de geocode + POIs do OpenStreetMap por imóvel (FK
`property_id`, único). Campos: `lat`/`lon` (geocode via Nominatim), `pois jsonb` (candidatos
brutos do Overpass, sem corte), `fetched_at`. Ao contrário de `experience_guides`, não tem
`season` — endereço físico não muda por trimestre. Só é recalculado se a linha for apagada
manualmente. Detalhe do fluxo que a preenche em `ai/agents/ai-engineer.md`.

Índice: `properties.code` único — é a chave de acesso pública da aplicação.

## Repositórios

`src/server/repositories/` expõe funções, não classes, nunca linhas cruas do Drizzle:
- `properties.ts` — `findPropertyByCode(code)`, `listPropertyCodes()`.
- `guides.ts` — `findGuideByPropertyId(id)`, `insertGuideIfAbsent(...)`, `replaceGuide(...)`.
- `pois.ts` — `findPoisByPropertyId(id)`, `insertPois(...)`.

É a única camada que importa `src/server/db/`.

Normalizar o `code` recebido da URL (trim + uppercase) antes de consultar — `/fln001` e
`/FLN001` são o mesmo imóvel.

## Route handlers

| Rota | Método | Comportamento |
|---|---|---|
| `/api/properties/[code]/guide` | `POST` | Gera-se-ausente (ou se `season` mudou), valida, persiste, devolve o guia. Idempotente: chamadas concorrentes não podem gerar duas vezes. |
| `/api/properties/[code]/chat` | `POST` | Rate limit próprio primeiro (ver abaixo); recebe histórico + mensagem; devolve `ReadableStream` de texto. |

Regras:
- Código inexistente → `404` com corpo JSON `{ error: ... }`. A página usa `notFound()`.
- Validar o corpo da requisição com Zod antes de usar. Corpo inválido → `400`.
- Erros do LLM não viram `500` genérico: mapear para um shape estável
  `{ error: { code, message } }` que o cliente sabe renderizar.
- Nunca vazar mensagem de erro do provedor de LLM (pode conter fragmento de configuração) —
  logar no servidor, devolver mensagem própria.

## Rate limit do chat

`src/server/rate-limit.ts` (`checkRateLimit`, `getClientIp`) — 10 requisições/minuto por IP,
janela fixa, **em memória**. Checado no início do `POST` de `/api/properties/[code]/chat`,
antes de `findPropertyByCode`, para rejeitar barato. Estourou → `429`, corpo
`{ error: { code: 'RATE_LIMITED', message } }` (mesmo shape dos outros erros do endpoint) e
header `Retry-After`. É um limite da aplicação, distinto do 429 que o provedor de LLM pode
devolver (esse é tratado em `ai/agents/ai-engineer.md`).

**Limitação conhecida e documentada no código**: memória de processo não sobrevive a múltiplas
instâncias serverless (Vercel). Em produção real seria Redis/Upstash — para o escopo deste
teste, o limitador já deixa isso explícito em comentário.

## Concorrência na geração do guia

Dois acessos simultâneos ao mesmo imóvel não podem gerar dois guias. Usar `INSERT ... ON
CONFLICT (property_id) DO NOTHING` e, se o insert não afetou linha, reler o guia existente.
Nada de lock aplicacional em memória — o deploy é serverless, há mais de uma instância.
