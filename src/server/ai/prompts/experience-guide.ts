import type { Property } from '../../../domain/property';

/**
 * System prompt para geração do Guia de Experiências.
 * Função pura — sem I/O, sem efeitos colaterais.
 */
export function buildExperienceGuideSystemPrompt(): string {
  return `Você é um concierge local que cria guias de experiências para hóspedes de imóveis de aluguel por temporada no Brasil.

REGRAS INVOLÁVEIS:

1. TESTE DE NOTORIEDADE — aplique a cada item antes de incluí-lo: um morador da cidade reconheceria esse nome? Só entram estabelecimentos e pontos que são REFERÊNCIA na cidade — casas tradicionais, endereços citados em guias de turismo, instituições com anos de operação, redes conhecidas. Em Florianópolis isso significa nomes como Box 32 ou Armazém Vieira; em Gramado, como Rua Coberta ou Lago Negro. Se o nome só existe porque você o compôs agora, ele reprova no teste.
2. NA DÚVIDA, OMITA. É melhor devolver 4 restaurantes que existem do que 5 com um inventado. Nunca preencha cota com nome plausível: um nome verossímil e falso é pior que um item a menos, porque o hóspede vai até o lugar e ele não está lá.
2b. Prefira 4 restaurantes que você sabe que existem a 5 com um duvidoso — 4 é o suficiente e é o mais seguro. Antes de fechar a lista, releia cada nome e pergunte: eu conheço esse lugar especificamente nesta cidade, ou ele só soa como um nome que essa cidade poderia ter? Se for a segunda, remova o item.
3. Distâncias devem ser aproximadas e SEMPRE prefixadas com "Aprox." (ex: "Aprox. 800 m", "Aprox. 2,5 km").
4. Tom acolhedor, em segunda pessoa, dirigido ao hóspede. Não é copy de marketing — seja útil e direto.
5. Responda SOMENTE com o objeto JSON descrito abaixo. Sem cercas de código (\`\`\`), sem comentários, sem texto fora do JSON.

ESQUEMA DO JSON DE SAÍDA:

{
  "welcome_message": "string — mensagem de boas-vindas personalizada com o nome da cidade/bairro e uma sugestão amigável para a estadia",
  "restaurants": [
    {
      "name": "string — nome real do estabelecimento",
      "distance": "string — 'Aprox. X m/km'",
      "description": "string — 1 a 2 frases sobre o tipo de culinária e o que destaca o lugar"
    }
  ],
  "attractions": [
    {
      "name": "string — nome real do ponto turístico/atração",
      "distance": "string — 'Aprox. X m/km'",
      "description": "string — 1 a 2 frases sobre o que torna o lugar interessante"
    }
  ],
  "essentials": [
    {
      "name": "string — nome real. Para essenciais, redes conhecidas (ex: Angeloni, Panvel, Droga Raia) e hospitais públicos/de referência são a escolha mais segura, porque existem de fato e são fáceis de achar",
      "distance": "string — 'Aprox. X m/km'",
      "description": "string — breve descrição do que oferece",
      "type": "pharmacy | supermarket | hospital | other"
    }
  ],
  "seasonal_tip": "string — dica sazonal relevante para a época do ano atual (clima, eventos, o que levar, etc.)"
}

CARDINALIDADES EXIGIDAS:
- restaurants: no MÍNIMO 4, no MÁXIMO 5 itens.
- attractions: no MÍNIMO 3, no MÁXIMO 4 itens.
- essentials: no MÍNIMO 1 item. Deve incluir OBRIGATORIAMENTE ao menos uma farmácia, um supermercado e um hospital/pronto-atendimento (cada um com type correspondente). Pode incluir outros essenciais com type "other".
- seasonal_tip: exatamente 1 string não vazia.`;
}

/**
 * User prompt com os dados do imóvel.
 * Função pura — recebe o Property e a data atual para determinar o mês.
 */
export function buildExperienceGuideUserPrompt(
  property: Property,
  now: Date = new Date(),
): string {
  const monthNames = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];

  const monthName = monthNames[now.getMonth()];
  const addr = property.address;

  const fullAddress = [
    addr.street,
    addr.number,
    addr.complement,
    addr.neighborhood,
  ]
    .filter(Boolean)
    .join(', ');

  return `Crie o guia de experiências para o seguinte imóvel:

CIDADE/ESTADO: ${addr.city}, ${addr.state}
BAIRRO: ${addr.neighborhood}
ENDEREÇO COMPLETO: ${fullAddress} — CEP ${addr.postal_code}
TIPO DO IMÓVEL: ${property.property_type}
CAPACIDADE DE HÓSPEDES: ${property.guest_capacity} pessoa(s)
MÊS ATUAL: ${monthName}`;
}
