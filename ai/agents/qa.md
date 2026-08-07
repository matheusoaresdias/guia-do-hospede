# QA — testes e critérios de aceite

Stack: **Vitest**. `@testing-library/react` + `jsdom` para componentes; ambiente `node` para
domínio, prompts e route handlers.

## Convenções da suíte (seguir, não inventar)

- Arquivos `*.test.ts` / `*.test.tsx` ao lado do código testado.
- `describe` com o nome do módulo; `it` descrevendo comportamento em português
  (`it('rejeita guia com menos de 4 restaurantes')`).
- **`@testing-library/user-event` NÃO está instalado.** Usar `fireEvent`.
- Mock de LLM: **nunca** chamar a API real em teste. O `LlmProvider` é injetado; o teste passa
  um fake. Não usar `vi.mock` do módulo de provider quando dá para injetar.
- Para stub de `fetch`, usar `vi.stubGlobal('fetch', vi.fn())` **antes** de `vi.mocked(...)` —
  o cast sozinho não stuba nada. É o padrão usado em `src/server/geo/nominatim.test.ts` e
  `overpass.test.ts` para simular o serviço externo sem rede real.
- Mock de **repositório** (`src/server/repositories/*`): ao contrário do `LlmProvider`, não há
  injeção de dependência aqui. Importar o módulo inteiro como namespace e espiar nele —
  `const guidesRepo = await import('@/server/repositories/guides'); vi.spyOn(guidesRepo,
  'findGuideByPropertyId').mockResolvedValue(...)`. **Nunca** desestruturar a função e espiar
  nela (`const { findGuideByPropertyId } = await import(...); vi.spyOn(findGuideByPropertyId,
  ...)`) — isso não afeta a chamada real e falha em tempo de tipo. Essa confusão foi a causa
  raiz de mocks quebrados gerados pelo DeepSeek nesta sessão; não repetir o padrão errado.
- Testes que importam (direta ou indiretamente) um módulo `server-only` — qualquer
  repositório, `provider.ts`, `geo/*` — dependem do alias `server-only` →
  `node_modules/server-only/empty.js` em `vitest.config.mts` e da `DATABASE_URL` fake em
  `vitest.setup.ts` (o client `postgres` é preguiçoso, nunca conecta de verdade se todas as
  funções do repositório forem mockadas). Já configurado; não precisa repetir por teste.
- Asserção no vocabulário da API/domínio, não no vocabulário interno do componente.

## O que precisa de teste (prioridade decrescente)

1. **Validação do guia gerado** (`src/domain/experience-guide.ts`): aceita payload correto;
   rejeita 3 restaurantes, 6 restaurantes, 2 atrações, campo faltando, tipo errado. É a
   barreira que impede persistir lixo do LLM.
2. **Montagem do contexto do chat** (`prompts/assistant.ts`): função pura. Dado um imóvel e um
   guia, o system prompt contém a senha do WiFi, a política de pet correta e o telefone do
   anfitrião — e difere entre FLN001 e GRM001.
3. **`getOrCreateExperienceGuide`** (`src/server/ai/guide-service.test.ts`) com provider e
   `getGroundedCandidates` fakes: gera na primeira chamada, **não** gera na segunda (guia já
   persistido), regenera quando `season` mudou, persiste `source: 'osm'` quando há candidatos
   suficientes e `source: 'llm'` quando `getGroundedCandidates` devolve `null`, devolve erro
   tratado quando o provider lança.
4. **Grounding geográfico** (`src/server/geo/*.test.ts`): `haversineMeters` entre pontos
   conhecidos; mapeamento de tag do Overpass para categoria; `null` em timeout/erro de
   rede/status inesperado do Nominatim e do Overpass (nunca lança); `getGroundedCandidates`
   cai no fallback quando a cobertura é insuficiente mesmo com cache existente.
5. **Rate limit do chat** (`src/server/rate-limit.test.ts`): permite até o limite, nega depois
   com `retryAfterSeconds` positivo, libera de novo após a janela expirar, chaves diferentes
   têm contadores independentes.
6. **Route handler do guia** com provider fake: gera na primeira chamada, **não** gera na
   segunda (guia já persistido), regenera quando `season` mudou, devolve erro tratado quando o
   provider lança, devolve 404 para código inexistente.
7. **Normalização e busca por código**: `/fln001` acha o mesmo imóvel que `/FLN001`;
   código inexistente devolve `null`.
8. **Componentes**: `not-found` renderiza mensagem amigável; `ExperienceGuideSection` mostra
   skeleton, erro com retry e conteúdo nos três estados.

## Critérios de aceite (do PDF, verificados manualmente antes de entregar)

- [ ] `/FLN001` e `/GRM001` mostram todos os campos do RF1.
- [ ] `/XXX999` mostra tela de erro amigável, não um stack trace.
- [ ] Layout sem quebra em 375px e em desktop.
- [ ] Guia do FLN001 cita lugares de **Florianópolis**; do GRM001, de **Gramado**.
- [ ] Guia tem 4–5 restaurantes, 3–4 atrações, essenciais e dica sazonal do período atual.
- [ ] Recarregar a página **não** regenera o guia.
- [ ] Há feedback visual claro enquanto o guia é gerado.
- [ ] Chat streama (texto progressivo, não de uma vez).
- [ ] As 4 perguntas do PDF respondidas corretamente **nos dois imóveis**, com respostas
      divergentes onde os dados divergem (pet: proibido em FLN001, permitido em GRM001).
- [ ] Pergunta fora do escopo ("qual o preço da diária?") não é inventada.
- [ ] Nenhuma chave ou segredo no repositório ou no histórico de commits.
