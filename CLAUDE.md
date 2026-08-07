@AGENTS.md

# Guia Digital do Hóspede — roteamento de contexto

Aplicação Next.js (App Router) que serve, em `/{codigo}`, um guia personalizado por imóvel:
dados operacionais, um Guia de Experiências gerado por IA e persistido, e um assistente
virtual em chat com streaming. Teste técnico Seazone — AI Builder.

| Diretório | Responsabilidade |
|---|---|
| `src/app/` | Rotas do App Router: página `/[code]`, `not-found`, route handlers de `guide` e `chat` |
| `src/components/` | Atomic Design: `atoms/`, `molecules/`, `organisms/`, `templates/` |
| `src/domain/` | Tipos e schemas Zod do domínio (imóvel, guia de experiências) — fonte de verdade |
| `src/server/db/` | Drizzle: schema, client, seed |
| `src/server/ai/` | Provider de LLM, prompts e validação do conteúdo gerado |
| `docs/decisions/` | ADRs — decisões técnicas e seus trade-offs |
| `ai/agents/` | Docs de contexto por área (roteados abaixo) — não são subagentes executáveis |

## Disparo automático de contexto (não esperar o usuário pedir)

Antes de **planejar ou implementar** em uma área abaixo, ler o(s) arquivo(s) indicados:

| Tarefa toca em… | Ler antes |
|---|---|
| Componentes, layout, responsividade, Atomic Design | `ai/agents/frontend-engineer.md` |
| Schema, migrations, repositórios, route handlers, persistência | `ai/agents/backend-engineer.md` |
| Prompt, system prompt, geração do guia, chat, tratamento de falha da IA | `ai/agents/ai-engineer.md` |
| Geocode, POIs, enriquecimento com dados externos (`src/server/geo/`) | `ai/agents/ai-engineer.md` (fluxo) — schema de `property_pois` em `ai/agents/backend-engineer.md` |
| Testes, critérios de aceite, edge cases | `ai/agents/qa.md` |

Fontes vivas (nunca duplicar — consultar direto): schema em `src/server/db/schema.ts`;
tipos de domínio em `src/domain/`; decisões em `docs/decisions/`; requisitos originais em
`docs/teste-tecnico-seazone.pdf`.

**Next.js 16**: esta versão tem breaking changes em relação ao conhecimento prévio do modelo.
Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever código de rota,
`params`, route handler ou streaming.

Postgres local roda na porta **55433** (a 5432 costuma estar ocupada) via
`docker-compose.yml`.

## Regra de segredos (repositório é PÚBLICO)

- Nenhuma chave, token ou connection string real entra no repositório — nem em código, nem em
  docs, nem em teste, nem no histórico de commits.
- `.env` é gitignored. `.env.example` só tem placeholders.
- Chave de LLM é lida **apenas no servidor**. Nada de `NEXT_PUBLIC_*` para segredo.
- Todo módulo que toca a chave importa `server-only`.
- Antes de tornar o repo público, varrer o histórico inteiro atrás de padrões de chave.

## Fluxo de trabalho com o usuário

1. Usuário pede um **plano de ação** → Claude planeja com pontos de decisão explícitos; não
   implementa direto.
2. Usuário **lapida** o plano e decide os pontos abertos.
3. **Geração de código passa pela skill `implement-with-deepseek`**: Claude orquestra —
   analisa, planeja, escolhe o modelo (`flash`/`pro`) e os parâmetros — e o DeepSeek V4 gera o
   código. Claude passa **CAMINHO** de arquivo, nunca CONTEÚDO: os campos `perfil` e `files`
   fazem o cliente ler as fontes vivas do disco, e o `envelope-applier.mjs` aplica o resultado
   com falha dura. Claude não gera código de implementação diretamente quando a tarefa se
   qualifica; decisões de arquitetura continuam sendo de Claude + usuário.
4. **Claude revisa** o que foi gerado e aponta divergências com o plano.
5. Usuário valida manualmente e aprova.

## Pontos de decisão (regra permanente)

Quando existir **mais de uma via de resolução** (regra de produto, UX, escopo, trade-off de
arquitetura): não escolher silenciosamente. Apresentar as opções com trade-offs e uma
recomendação, e deixar a decisão para o usuário. Vale em plano E durante implementação.

Exigem aprovação humana sempre: troca de stack, troca de provedor de LLM, alteração de escopo
frente aos requisitos do PDF, e tornar o repositório público.
