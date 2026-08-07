# Guia Digital do Hóspede

Cada imóvel tem um link único com o guia da estadia: dados de acesso, regras, um guia de
experiências do bairro gerado por IA e um assistente que responde perguntas sobre aquele
imóvel específico.

**Aplicação:** https://guia-do-hospede-seazone.vercel.app
**Exemplos:** [`/FLN001`](https://guia-do-hospede-seazone.vercel.app/FLN001) (Florianópolis/SC) ·
[`/GRM001`](https://guia-do-hospede-seazone.vercel.app/GRM001) (Gramado/RS) ·
[`/UBA001`](https://guia-do-hospede-seazone.vercel.app/UBA001) (Ubatuba/SP) ·
[`/XXX999`](https://guia-do-hospede-seazone.vercel.app/XXX999) (código inexistente)

Teste técnico Seazone — AI Builder.

---

## O problema

Hoje o anfitrião entrega um folheto impresso na chegada. É manual, sujeito a erro e depende de
alguém lembrar de preparar o material. A versão digital atual resolve parte disso, mas é
estática e igual para todos os imóveis — um hóspede em Gramado lê informações de bairro de um
hóspede em Florianópolis.

O produto aqui parte de uma premissa sobre o momento de uso: **o hóspede está na porta do
imóvel, no celular, provavelmente com bagagem na mão.** Isso define a hierarquia da página —
identificação, depois acesso (WiFi, fechadura, estacionamento), depois horários, depois
regras. A senha do WiFi e o código da porta são copiáveis com um toque, porque digitar
`gramado@2024` numa smart TV com o controle é a diferença entre o produto funcionar e não
funcionar.

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router, Server Components) |
| Linguagem | TypeScript `strict` |
| Estilo | Tailwind CSS v4 (tokens via `@theme`) |
| Banco | PostgreSQL — Neon em produção, Docker Compose local |
| ORM | Drizzle + `drizzle-kit` |
| Validação | Zod v4 — fonte de verdade dos tipos de domínio |
| IA | DeepSeek V4 (API compatível com OpenAI), atrás de uma interface própria |
| Testes | Vitest + Testing Library |
| Deploy | Vercel |

## Arquitetura

```
src/
  domain/           Schemas Zod e tipos. Camada mais interna: não importa nada de server/.
  server/
    db/             Schema Drizzle, client (server-only), seed
    repositories/   Acesso a dados. Devolve tipos de domínio, nunca linhas cruas.
    ai/
      provider.ts   Interface LlmProvider + factory. Único ponto que lê a chave de API.
      providers/    Adapter do DeepSeek. Trocar de provedor é adicionar um arquivo aqui.
      prompts/      System e user prompts como funções PURAS — testáveis sem rede.
      guide-service.ts
  components/       Atomic Design: atoms → molecules → organisms → templates
  app/              Rotas: /[code], /api/properties/[code]/{guide,chat}
```

Três fronteiras que o código respeita:

1. **`domain/` não conhece infraestrutura.** Os schemas Zod são importáveis por teste puro, e o
   schema Drizzle referencia esses tipos nos campos `jsonb` via `.$type<T>()` — a forma dos
   dados é declarada uma vez só.
2. **Atom não conhece domínio.** Um `Badge` recebe `string`; quem sabe o que é uma política de
   pet é o organism. Isso é o que torna o Atomic Design útil em vez de decorativo.
3. **A chave de API não sai de `server/ai/`.** Os módulos que a tocam importam `server-only`,
   que quebra o build se algum dia forem importados de um Client Component.

## Como a IA é usada

### Guia de Experiências

Gerado na primeira visita ao imóvel, validado contra o schema Zod e **persistido**. As visitas
seguintes leem do banco — a segunda chamada responde em ~50 ms contra ~11 s da primeira.

A regeneração é amarrada à estação do ano (`season` no formato `YYYY-Qn`), porque o enunciado
pede duas coisas em tensão: não regenerar a cada acesso, mas manter a dica sazonal relevante
para a época atual. Persistir para sempre satisfaria a primeira e violaria a segunda em três
meses.

O system prompt está em `src/server/ai/prompts/experience-guide.ts`. Ele impõe um **teste de
notoriedade** — "um morador da cidade reconheceria esse nome?" — e instrui explicitamente a
omitir em vez de completar cota: *"melhor devolver 4 restaurantes que existem do que 5 com um
inventado"*.

**Grounding com dados reais (`src/server/geo/`).** Antes de montar o prompt, o serviço tenta
fundamentar o guia em dados geográficos verificáveis: geocodifica o endereço do imóvel via
**Nominatim** (cache permanente por imóvel) e busca restaurantes/atrações/farmácias/
mercados/hospitais num raio de 2 km via **Overpass API** (OpenStreetMap), com a distância real
calculada por Haversine — sem chave, sem billing. O LLM deixa de *escolher e descrever* lugares
para só *descrever* os que essa lista real forneceu; o prompt proíbe qualquer nome fora dela.

Se a cobertura do OSM não atingir os mínimos do schema (4 restaurantes, 3 atrações, os 3
essenciais) — endereço que não geocodifica, ou bairro pouco mapeado numa categoria — o sistema
cai no caminho antigo (só o teste de notoriedade) em vez de forçar um guia incompleto. Cada guia
persistido guarda `source: 'osm' | 'llm'`, para saber honestamente qual caminho gerou o quê. Ver
[Limitação conhecida](#limitação-conhecida) para o que isso significa na prática hoje.

### Assistente virtual

Streaming real: o texto aparece progressivamente porque o handler devolve um `ReadableStream`
e o cliente consome com `getReader()`, atualizando a bolha a cada chunk.

O contexto é montado por uma função pura a partir do imóvel **e** do guia já persistido — é por
isso que ele responde "que restaurantes tem perto?" com os lugares do guia daquele imóvel, e
responde coisas diferentes para FLN001 e GRM001 (pet é proibido num e permitido no outro).

Regra anti-alucinação no system prompt: responder só com o que está no contexto e, quando não
souber, dizer isso e apontar o telefone do anfitrião — nunca especular sobre preço,
disponibilidade ou política de reserva.

### Tratamento de falhas da IA

Nenhuma falha de LLM derruba a página do imóvel. Os dados de acesso são a informação crítica da
estadia e não dependem de IA.

| Falha | Comportamento |
|---|---|
| Timeout / rede | Erro mapeado, seção mostra mensagem + botão "Tentar novamente" |
| JSON fora do schema | Uma retentativa com o erro de validação no prompt; depois, falha controlada |
| Rate limit (429) | Mensagem específica, sem tratar como erro da aplicação |
| Erro no meio do stream | O texto já recebido permanece; mensagem abaixo, com reenvio |

A mensagem crua do provedor nunca chega ao cliente — vai para o log do servidor.

## Rodando local

```bash
cp .env.example .env      # preencha DEEPSEEK_API_KEY
docker compose up -d      # Postgres na porta 55433
npm install
npm run db:migrate
npm run db:seed           # FLN001, GRM001, UBA001 — idempotente
npm run dev
```

Abra http://localhost:3000.

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL |
| `DEEPSEEK_API_KEY` | Chave da API do DeepSeek — **apenas servidor** |
| `DEEPSEEK_MODEL` | Modelo (default `deepseek-v4-flash`) |

```bash
npm test        # Vitest
npm run typecheck
npm run build
```

## Decisões técnicas

Registradas com trade-off e alternativa descartada em
[`docs/decisions/001-decisoes-tecnicas.md`](docs/decisions/001-decisoes-tecnicas.md):
escolha do LLM, veracidade dos lugares sugeridos, hospedagem, política de regeneração do guia,
streaming só onde é exigido, três imóveis no seed.

O plano de execução, com os pontos de decisão apresentados antes de implementar, está em
[`docs/plano-guia-hospede.md`](docs/plano-guia-hospede.md).

## Limitação conhecida

**O grounding depende de o endereço geocodificar e de o OSM ter cobertura na categoria — quando
falta um dos dois, o guia volta a vir só do modelo.** Testado contra os serviços reais (Nominatim
+ Overpass, não mockados) nos três imóveis do seed:

- **FLN001 gera com `source: 'osm'`** — o endereço geocodifica e o Overpass devolve mais de 100
  candidatos reais num raio de 2 km (dezenas de restaurantes, farmácias, mercados, hospitais).
  Os nomes e distâncias no guia (ex. "Trindog — Aprox. 89 m") vêm direto dessa lista, não do
  modelo.
- **GRM001 e UBA001 caem no fallback (`source: 'llm'`)** porque as ruas do seed ("Rua das
  Hortênsias, 220"; "Rua da Praia Grande, 1450") não existem no índice do Nominatim — confirmado
  testando uma rua real das mesmas cidades (Rua Coberta, em Gramado, geocodifica normalmente).
  Não é falta de cobertura da cidade, é o endereço do imóvel de teste ser fictício. Com endereço
  real, o mesmo pipeline que funciona para FLN001 se aplica.
- Mesmo com geocode bem-sucedido, uma categoria pouco mapeada localmente (ex. `tourism=*`
  esparso no bairro) pode ficar abaixo do mínimo do schema — nesse caso o sistema também cai no
  fallback em vez de forçar um guia incompleto, em vez de misturar dado real com inventado.

Continua sendo uma decisão consciente de escopo, não um descuido: nenhum guia mistura lugar real
com inventado dentro da mesma resposta — ou vem inteiro fundamentado no OSM, ou inteiro do teste
de notoriedade do modelo. A evolução natural é reforçar o geocode (ex. tentar sem número, ou por
CEP, antes de desistir) e ampliar as tags de categoria por cidade conforme a cobertura do OSM
local for testada.

## Como este projeto foi construído

O repositório versiona o próprio processo de desenvolvimento, em `CLAUDE.md`, `ai/agents/` e
`.claude/skills/`. Os papéis foram separados de propósito: **Claude** planejou, apresentou os
pontos de decisão ao humano, orquestrou e revisou; **DeepSeek V4** gerou o código de
implementação sob essa orquestração; e as decisões de arquitetura ficaram com humano + Claude.

Isso está no repositório porque descreve honestamente como o código nasceu, e porque as
correções de revisão — caminhos relativos errados, `z.record` com aridade de Zod v3, um
`require()` dinâmico onde cabia import estático, e o raciocínio do modelo ligado por padrão
estourando o timeout de geração — são parte do registro.
