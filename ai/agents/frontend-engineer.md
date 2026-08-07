# Frontend engineer — UI do guia

Área: `src/app/`, `src/components/`.

## Atomic Design (exigido pelo teste)

```
src/components/
  atoms/       Badge, Skeleton, Button, Icon, SectionTitle, CopyableValue
  molecules/   AmenityItem, PolicyRow, InfoRow, WifiCard, HostCard, PlaceCard, ChatBubble
  organisms/   PropertyHero, AccessSection, RulesSection, ContactSection,
               ExperienceGuideSection, AssistantChat
  templates/   GuidebookTemplate
```

Regras:
- **Atom** não conhece domínio: recebe `string`/`ReactNode`, nunca um objeto `Property`.
- **Molecule** compõe atoms e pode conhecer uma fatia pequena do domínio.
- **Organism** monta uma seção inteira a partir de um objeto de domínio.
- **Template** define o layout da página; a página (`src/app/[code]/page.tsx`) só busca dados
  e passa para o template.
- Server Component por padrão. `'use client'` só onde há estado ou efeito — na prática:
  `ExperienceGuideSection` (fetch + estados) e `AssistantChat` (streaming). Nunca marcar a
  página inteira como client.

## Mobile-first (critério de avaliação)

- Escrever o estilo base para 375px e subir com `sm:`/`md:`/`lg:`. Não o contrário.
- Alvos de toque ≥ 44px. Texto base 16px (evita zoom automático no iOS).
- Nenhum overflow horizontal em 375px — tabela ou bloco largo rola no próprio container.
- A senha do WiFi e o código de acesso precisam ser copiáveis com um toque: o hóspede está
  na porta do imóvel com o celular na mão. Esse é o momento de maior valor do produto.

## Hierarquia de conteúdo

O que resolve o problema do hóspede vem primeiro, não o que é bonito:
1. Identificação do imóvel (foto, nome, cidade).
2. **Acesso**: WiFi, instruções de entrada, estacionamento.
3. Check-in / check-out.
4. Regras e políticas.
5. Guia de Experiências (IA).
6. Assistente (chat).
7. Contato do anfitrião — também fixo/acessível de qualquer ponto.

## Estados obrigatórios

- **Guia de Experiências**: carregando (skeleton com a forma do conteúdo final + texto de
  progresso, não um spinner solto), erro (mensagem + botão de tentar de novo), pronto.
- **Chat**: vazio (com as perguntas sugeridas do teste), streamando (texto crescendo +
  indicador), erro (mantém o que já chegou).
- **Imóvel inexistente**: `src/app/[code]/not-found.tsx` — mensagem amigável, explica que o
  código pode estar errado, e não expõe stack nem jargão técnico.

## Tailwind v4

Configuração via CSS (`@theme` em `globals.css`), não `tailwind.config.js`. Definir os tokens
de cor e tipografia lá e usá-los pelas classes — nada de hex solto espalhado em `className`.
