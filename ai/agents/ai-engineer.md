# AI engineer — geração de conteúdo e chat

Área: `src/server/ai/`. Cobre o Guia de Experiências gerado por IA (RF2) e o assistente
virtual (RF3). É o critério de avaliação com maior peso do teste ("Integração com IA:
qualidade do prompt e do system prompt, coerência do conteúdo gerado com o endereço real,
funcionamento correto do chat, tratamento de falhas da IA").

## Arquitetura

```
src/server/ai/
  provider.ts              # interface LlmProvider + factory; único lugar que lê a API key
  providers/deepseek.ts    # adapter DeepSeek V4 (API compatível com OpenAI)
  prompts/experience-guide.ts   # system + user prompt do guia — variante padrão e grounded
  prompts/assistant.ts          # system prompt do chat, montado a partir do imóvel + guia
  guide-service.ts         # orquestra grounding → geração → validação → persistência
src/server/geo/
  nominatim.ts       # geocode do endereço do imóvel (OpenStreetMap) — nunca lança, retorna null
  overpass.ts         # busca restaurantes/atrações/essenciais reais num raio de 2 km — idem
  distance.ts          # haversineMeters — função pura
  poi-service.ts        # getGroundedCandidates: cache (property_pois) + checagem de suficiência
```

Regras:
- `provider.ts` e tudo abaixo dele importam `server-only`. A chave nunca cruza para o cliente.
- A interface `LlmProvider` expõe exatamente dois métodos: `generateJson<T>()` e
  `streamText()`. Trocar de provedor deve ser um arquivo novo em `providers/`, nada mais.
- `src/server/geo/*` também importa `server-only` e nunca lança — qualquer falha (geocode,
  Overpass, timeout, cobertura insuficiente) devolve `null` para `guide-service.ts` decidir o
  fallback, nunca propaga como exceção.
- Nenhum componente React importa nada de `src/server/ai/` nem de `src/server/geo/` — a
  fronteira é o route handler.

## Guia de Experiências (RF2)

Saída obrigatória, validada com Zod antes de persistir:
`welcome_message`, `restaurants` (**4 a 5**), `attractions` (**3 a 4**), `essentials`
(farmácia, mercado, hospital), `seasonal_tip`. Itens de lugar têm `name`, `distance`
(string, sempre prefixada com "Aprox."), `description`; `essentials` também tem `type`.

**Duas vias para chegar nesse JSON, nunca misturadas na mesma resposta — o guia persistido
guarda qual delas gerou (`experience_guides.source: 'osm' | 'llm'`):**

1. **Grounded (primária).** `guide-service.ts` chama `getGroundedCandidates(property)`
   (`src/server/geo/poi-service.ts`) antes de montar o prompt: geocodifica o endereço via
   Nominatim (cache permanente em `property_pois`, não expira por `season`) e busca
   restaurantes/atrações/farmácias/mercados/hospitais reais num raio de 2 km via Overpass
   (OpenStreetMap). Se a lista cobrir os mínimos do schema (≥4 restaurantes, ≥3 atrações, ≥1 de
   cada essencial), o LLM usa `buildGroundedExperienceGuideSystemPrompt` +
   `buildGroundedExperienceGuideUserPrompt` — o prompt já proíbe qualquer nome fora da lista
   fornecida; o modelo só **seleciona e descreve**, nunca inventa. `source: 'osm'`.
2. **Teste de notoriedade (fallback).** Se o geocode falhar, o Overpass estiver indisponível,
   ou a cobertura do OSM na área for insuficiente para os mínimos do schema,
   `getGroundedCandidates` devolve `null` e o sistema cai no caminho antigo:
   `buildExperienceGuideSystemPrompt` + `buildExperienceGuideUserPrompt`, com a regra "um
   morador da cidade reconheceria esse nome?" e "na dúvida, omita" — sem dado de candidato
   real. `source: 'llm'`.

O prompt (nas duas vias) recebe o **endereço real completo** (rua, número, bairro, cidade,
estado, CEP), o tipo de imóvel, a capacidade e o **mês atual** — a dica sazonal depende disso.

Regras do system prompt padrão (fallback; as duas primeiras evitam a falha mais grave do
produto quando não há grounding disponível):
- Sugerir apenas estabelecimentos **consolidados e conhecidos** da cidade/bairro informados.
  Nunca inventar nome, endereço ou distância.
- Se não houver certeza sobre um lugar específico, preferir uma opção mais genérica porém
  real a arriscar um nome inventado.
- Distâncias são aproximadas e devem ser declaradas como tal.
- Tom: acolhedor, na segunda pessoa, dirigido ao hóspede — não é copy de marketing.
- Responder **somente** com o JSON no schema pedido, sem cercas de código nem comentários.

Persistência: uma linha por imóvel em `experience_guides`, com `season` (`YYYY-Qn`) e
`source`. Só regenera se não existir ou se a estação virou — nunca a cada acesso. O cache de
geocode+POIs em `property_pois` é independente disso: não tem `season`, só é recalculado se a
linha for apagada manualmente (endereço mudou).

## Assistente virtual (RF3)

- **Streaming é obrigatório**: o texto aparece progressivamente. Route handler devolve um
  `ReadableStream`; o cliente consome incrementalmente.
- Contexto do system prompt: dados operacionais do imóvel **e** o guia de experiências já
  persistido. Montado por uma função pura e testável.
- Anti-alucinação, no system prompt:
  - Responder exclusivamente com base nos dados fornecidos.
  - Se a informação não estiver no contexto, dizer isso com clareza e orientar o hóspede a
    falar com o anfitrião (nome e telefone estão no contexto) — nunca especular.
  - Nunca inventar preço, disponibilidade, política ou dado de reserva.
  - Respostas curtas e diretas; o hóspede está no celular.
- Deve acertar as 4 perguntas do teste: senha do WiFi, pet, horário de check-in, restaurantes
  próximos. E as respostas precisam **divergir entre imóveis** (pet é proibido em FLN001 e
  permitido em GRM001).

## Tratamento de falhas da IA (critério explícito de avaliação)

Nenhuma falha de LLM pode derrubar a página do imóvel — os dados operacionais (WiFi, acesso,
check-in) são a informação crítica da estadia e não dependem de IA.

| Falha | Comportamento |
|---|---|
| Timeout / erro de rede (LLM) | Retry com backoff (1 tentativa). Depois, estado de erro no bloco do guia com botão "tentar novamente". |
| JSON inválido ou fora do schema | 1 retry com o erro de validação no prompt. Depois, falha controlada. |
| Resposta truncada | Tratada como JSON inválido. |
| Rate limit (429) do provedor de LLM | Mensagem específica pedindo para tentar em instantes; não conta como erro do app. |
| Nominatim ou Overpass fora do ar, timeout, ou cobertura insuficiente | **Não é erro do usuário.** `getGroundedCandidates` devolve `null`; `guide-service.ts` cai no prompt de teste de notoriedade sem retry — a geração continua e devolve um guia válido, só com `source: 'llm'`. |
| Falha no chat, mid-stream | O que já chegou permanece na tela; mensagem de erro abaixo, com opção de reenviar. |
| Rate limit próprio do chat (429, `src/server/rate-limit.ts`) | 10 mensagens/minuto por IP, em memória — distinto do 429 do provedor. Ver `ai/agents/backend-engineer.md`. |

O bloco do guia tem três estados visuais explícitos: **carregando** (skeleton + texto de
progresso), **erro** (mensagem + retry), **pronto**. Sem estado silencioso.
