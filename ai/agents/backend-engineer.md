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
(o guia validado), `model` (qual LLM gerou), `season` (`YYYY-Qn`), `generated_at`.
A unicidade por imóvel é o que garante "não regenerar a cada acesso".

Índice: `properties.code` único — é a chave de acesso pública da aplicação.

## Repositórios

`src/server/repositories/` expõe funções, não classes: `findPropertyByCode(code)`,
`findGuideByPropertyId(id)`, `upsertGuide(...)`. Retornam tipos de domínio já validados, nunca
linhas cruas do Drizzle. É a única camada que importa `src/server/db/`.

Normalizar o `code` recebido da URL (trim + uppercase) antes de consultar — `/fln001` e
`/FLN001` são o mesmo imóvel.

## Route handlers

| Rota | Método | Comportamento |
|---|---|---|
| `/api/properties/[code]/guide` | `POST` | Gera-se-ausente (ou se `season` mudou), valida, persiste, devolve o guia. Idempotente: chamadas concorrentes não podem gerar duas vezes. |
| `/api/properties/[code]/chat` | `POST` | Recebe histórico + mensagem; devolve `ReadableStream` de texto. |

Regras:
- Código inexistente → `404` com corpo JSON `{ error: ... }`. A página usa `notFound()`.
- Validar o corpo da requisição com Zod antes de usar. Corpo inválido → `400`.
- Erros do LLM não viram `500` genérico: mapear para um shape estável
  `{ error: { code, message } }` que o cliente sabe renderizar.
- Nunca vazar mensagem de erro do provedor de LLM (pode conter fragmento de configuração) —
  logar no servidor, devolver mensagem própria.

## Concorrência na geração do guia

Dois acessos simultâneos ao mesmo imóvel não podem gerar dois guias. Usar `INSERT ... ON
CONFLICT (property_id) DO NOTHING` e, se o insert não afetou linha, reler o guia existente.
Nada de lock aplicacional em memória — o deploy é serverless, há mais de uma instância.
