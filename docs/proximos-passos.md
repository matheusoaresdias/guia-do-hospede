# Próximos passos — handoff para nova sessão

> Documento de continuidade. Escrito em 07/08/2026, ao fim da sessão que construiu o projeto.
> Quem pegar isto numa sessão nova tem aqui tudo que precisa para continuar sem reconstruir contexto.

---

## 1. Onde o projeto está

**Entregue e funcionando em produção.** Todos os requisitos do teste técnico estão atendidos e
foram verificados manualmente em produção, não só localmente.

- **Aplicação:** https://guia-do-hospede-seazone.vercel.app
- **Repositório:** https://github.com/matheusoaresdias/guia-do-hospede (público, integração Git com a Vercel ativa — push na `main` faz deploy)
- **Banco:** Neon (produção) · Postgres em Docker na porta **55433** (local)

| Requisito | Estado verificado |
|---|---|
| RF1 — `/[código]` com todos os campos | `/FLN001`, `/GRM001`, `/UBA001`; `/fln001` resolve igual a `/FLN001` |
| Código inexistente | `/XXX999` → 404 com tela amigável |
| RF2 — guia de IA contextualizado | GRM001 → Rua Coberta, Lago Negro, Mini Mundo, Igreja Matriz São Pedro |
| RF2 — persistido | 2ª chamada devolve `generated: false` em ~50 ms |
| RF3 — chat com streaming | 1º byte em ~0,8 s; respostas divergem por imóvel |
| Testes | 37 passando (5 arquivos) · typecheck e lint limpos |

**Comandos de verificação:** `npm test` · `npm run typecheck` · `npx eslint .` · `npm run build`

---

## 2. Como se trabalha neste repositório

Está no `CLAUDE.md` da raiz, mas o essencial:

1. Usuário pede plano → Claude planeja com **pontos de decisão explícitos** e não implementa.
2. Usuário lapida e decide.
3. **A geração de código de implementação passa pela skill `implement-with-deepseek`.** Claude
   orquestra (monta o prompt, escolhe `flash`/`pro`, define os critérios de aceite) e o
   DeepSeek V4 gera. Claude **passa CAMINHO de arquivo, nunca CONTEÚDO** — os campos `perfil` e
   `files` fazem o cliente ler as fontes vivas do disco. O `envelope-applier.mjs` aplica com
   falha dura.
4. Claude revisa o resultado, roda os critérios de aceite e reporta divergências.
5. Usuário valida.

Contrato completo em `.claude/skills/implement-with-deepseek/SKILL.md`. Perfis de contexto em
`contexto/perfis.json` (`base`, `frontend`, `backend`, `ia`, `teste`).

**Regra permanente:** quando houver mais de uma via de resolução, apresentar opções com
trade-offs e uma recomendação — não escolher sozinho.

---

## 3. Armadilhas já descobertas (não repetir)

Estas custaram tempo nesta sessão. Todas estão corrigidas no código; a lista serve para não
reintroduzir.

| Armadilha | O que acontece | Como lidar |
|---|---|---|
| **Next.js 16 tem breaking changes** | O modelo escreve API de versões antigas | Ler `node_modules/next/dist/docs/` antes de escrever rota. `params` é `Promise` — `const { code } = await params` |
| **Zod v4 mudou aridade** | `z.record(z.boolean())` não compila | `z.record(z.string(), z.boolean())`. Também `z.email()` / `z.url()` no lugar de `z.string().email()` |
| **`server-only` lança fora do React** | Qualquer script `tsx` que importe `src/server/db/client.ts` quebra | Scripts standalone (seed, migrações) abrem conexão própria — ver `src/server/db/seed.ts` |
| **DeepSeek V4 vem com raciocínio ligado** | Geração do guia estourava o timeout de 45 s | `thinking: { type: 'disabled' }` no corpo do POST. Caiu para ~11 s |
| **Listar exemplos de nomes inventados no prompt ancora o modelo neles** | Pus "Sabor da Ilha" como exemplo negativo e ele passou a gerar exatamente isso | Descrever o **critério** (teste de notoriedade), nunca dar exemplos do que evitar |
| **Vercel CLI grava `expiresAt` em segundos e lê como ms** | Todo comando responde `Not authorized` mesmo logado | Passar `--token` explícito. O token está em `~/.local/share/com.vercel.cli/auth.json` |
| **Deploy travando em `Building…`** | Builds presos por 25 min sem log | Era o e-mail do commit não batendo com a conta GitHub ligada à Vercel. Não é problema de build |
| **`create-next-app` recusa diretório com qualquer arquivo** | Falha o scaffold | Gerar em diretório temporário e copiar por cima |
| **O Vercel CLI apenda `.env*` no `.gitignore`** | Anula a exceção do `.env.example` | Reafirmar `!.env.example` **depois** da linha que ele adiciona |

---

## 4. Segurança — invariantes que não podem ser quebradas

O repositório é **público**. Tudo que entra aqui é lido por qualquer pessoa, inclusive o
histórico de commits.

- Nenhuma chave, token ou connection string real entra em arquivo versionado, doc, teste ou
  mensagem de commit.
- `.env` é gitignored; `.env.example` só tem placeholders.
- Chave de LLM é lida **apenas** em `src/server/ai/`. Módulos que a tocam importam `server-only`.
- Nada de segredo em `NEXT_PUBLIC_*`.
- Nenhum caminho absoluto de máquina de desenvolvimento em doc ou código.
- **Auditar antes de commitar, não depois.** A varredura abaixo roda sobre o histórico inteiro
  e todos os padrões devem devolver `0`; a última linha não deve devolver nada.

```bash
for pat in 'npg_[A-Za-z0-9]{4}' 'sk-[A-Za-z0-9]{12,}' 'ghp_[A-Za-z0-9]{16,}' \
           'gho_[A-Za-z0-9]{16,}' 'AIza[A-Za-z0-9_-]{20,}' \
           '(postgres|postgresql)://[^ ]*:[^ @]+@' ; do
  printf "%-34s -> %s\n" "$pat" "$(git log --all -p | grep -ciE "$pat")"
done

git log --all --pretty=format: --name-only | sort -u | grep -E '^\.env' | grep -v example
```

Vale acrescentar à lista qualquer termo específico do seu ambiente que não deva aparecer
publicamente — e conferir o resultado **antes** de rodar `git commit`.

---

## 5. Melhorias priorizadas

Ordem por retorno nos critérios de avaliação do teste. **Os itens 1 e 2 valem mais que 3–6
somados** — se o tempo apertar, cortar de baixo para cima.

### 1. Grounding de POIs com dados reais — ~60 min · **maior prioridade**

**O problema.** Este é o débito técnico nº 1, e está documentado no README. O guia é gerado só
com o conhecimento do modelo. Atrações e serviços essenciais saem consistentemente reais (Rua
Coberta, Lago Negro, Mini Mundo, UFSC, Mercado Público, Hospital Universitário), mas a taxa de
acerto dos **restaurantes varia por geração** — em algumas o modelo traz casas reais (Box 32,
Armazém Vieira), em outras a maioria dos nomes é plausível e inventada. A Seazone é sediada em
Florianópolis: o avaliador reconhece um nome falso na hora. Isso bate direto no critério de
maior peso, *"coerência do conteúdo gerado com o endereço real"*.

**Endurecer o prompt já foi tentado e não resolve.** Foram três iterações nesta sessão; a
última chegou a piorar por ancoragem (ver armadilhas).

**A solução: inverter a responsabilidade.** Hoje o LLM escolhe *e* descreve os lugares. Passa a
só **descrever** lugares que uma fonte de dados real forneceu.

**OpenStreetMap, sem chave e sem billing:**

1. **Nominatim** (`https://nominatim.openstreetmap.org/search?format=jsonv2&q=<endereço>`) —
   geocodifica o endereço do imóvel em lat/lon. Cachear em `properties` para não geocodificar a
   cada geração.
2. **Overpass API** (`https://overpass-api.de/api/interpreter`) — busca POIs num raio de ~2 km:
   `amenity=restaurant`, `tourism=attraction`, `amenity=pharmacy`, `shop=supermarket`,
   `amenity=hospital`. Retorna nome e coordenadas reais.
3. Calcular a distância real (Haversine) entre o imóvel e cada POI — acaba com a distância
   inventada, e o campo deixa de precisar do prefixo "Aprox." como disclaimer.
4. Passar a lista de candidatos reais ao LLM, que **seleciona** os mais interessantes e escreve
   `welcome_message`, as descrições e a `seasonal_tip`. O prompt passa a proibir qualquer nome
   fora da lista fornecida.

**Cuidados obrigatórios:**
- Nominatim exige `User-Agent` identificando a aplicação e tem limite de 1 req/s — respeitar,
  e por isso o resultado precisa ser persistido.
- Overpass é público e pode ficar lento ou fora do ar. **A geração não pode depender dele para
  não quebrar**: se falhar, cair no caminho atual (só LLM) e marcar a origem do guia.
- Sugestão de schema: adicionar `source: 'osm' | 'llm'` ao guia persistido, para o README poder
  afirmar honestamente qual caminho gerou o quê.
- Nem toda cidade tem boa cobertura no OSM. Ubatuba e Gramado provavelmente têm menos que
  Florianópolis — testar os três antes de declarar pronto.

**Critérios de aceite:** guia do FLN001 só contém estabelecimentos presentes na resposta do
Overpass; distâncias batem com o cálculo Haversine; com o Overpass indisponível, a geração
ainda funciona pelo caminho antigo; os três imóveis geram guia válido.

### 2. Erros, carregamento e abuso — ~20 min

Lacunas reais encontradas na análise:

- **`src/app/error.tsx` e `src/app/global-error.tsx`** — hoje um erro inesperado no servidor
  mostra a tela padrão do Next, não a nossa. O critério *"tratamento de erros e edge cases"* é
  explícito no enunciado.
- **`src/app/[code]/loading.tsx`** — sem isso, o cold start do Neon aparece como tela branca.
  Um esqueleto da página resolve e ainda demonstra streaming de UI do App Router.
- **Rate limit próprio no chat** — `/api/properties/[code]/chat` é público e gasta token. Hoje
  só mapeia o 429 do provedor. Um limite por IP em memória já é honesto para o escopo (e o
  README deve dizer que em produção real seria Redis/Upstash, já que serverless não compartilha
  memória entre instâncias).

### 3. CI no GitHub Actions — ~15 min

Workflow em `.github/workflows/ci.yml` rodando em push e PR: `npm ci`, `npm run typecheck`,
`npx eslint .`, `npm test`, `npm run build`. Sem segredos — o build precisa de `DATABASE_URL`,
então use um Postgres de serviço do próprio Actions ou torne a home resiliente a banco ausente.
*"Boas práticas e padrões"* é critério do enunciado.

### 4. Playwright — ~25 min

Testes unitários já cobrem domínio, prompts e estados de UI. Um smoke e2e cobre o que falta:
carregar `/FLN001` e ver a senha do WiFi; `/XXX999` mostrar a tela amigável; enviar uma pergunta
no chat e ver o texto crescer progressivamente (é a prova visual do streaming). Rodar contra o
servidor local via `webServer` do Playwright. **Atenção:** `@testing-library/user-event` não
está instalado neste repo e os testes existentes usam `fireEvent` — não misturar convenções.

### 5. Open Graph e roadmap no README — ~15 min

- **OG image dinâmica** (`src/app/[code]/opengraph-image.tsx` com `ImageResponse`): o anfitrião
  **compartilha esse link por WhatsApp** — é o canal real de distribuição do produto, e hoje o
  preview é vazio. Mostrar foto, nome do imóvel e cidade.
- **Seção de roadmap no README**, com o que tornaria a aplicação indispensável e por quê:
  integração com o PMS/motor de reservas (o guia hoje não sabe as datas da estadia — saber
  transformaria "check-in às 15h" em "seu check-in é amanhã às 15h"); envio automático do link
  por WhatsApp na confirmação; upsell de serviços (limpeza extra, late checkout); telemetria do
  que os hóspedes mais perguntam, realimentando o guia; multilíngue.

### 6. Revisar `ai/agents/` e as skills — o que sobrar

Conferir se os docs de contexto ainda descrevem o código como ele é depois das mudanças acima.
Valor interno, não avaliado diretamente — **cortar primeiro se o tempo apertar**.

---

## 6. RAG: por que não foi feito

Foi levantado e **descartado deliberadamente**, não esquecido.

O contexto do assistente é o imóvel inteiro mais o guia de experiências — cerca de 2 KB. Cabe
folgado na janela de contexto. RAG aqui não resolve nenhum problema existente e adiciona modos
de falha: chunking, recall ruim, embedding desatualizado em relação ao guia. Um avaliador
sênior lê isso como arquitetura decorativa.

**Onde faria sentido de verdade** — e vale registrar no roadmap: um corpus por imóvel que
genuinamente não cabe em contexto, como manual do condomínio, FAQ longa do anfitrião ou
histórico de conversas anteriores. Aí `pgvector` no Neon seria a escolha natural. Enquanto o
contexto couber inteiro no prompt, passar tudo é mais simples, mais barato e mais correto.
