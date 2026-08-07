import type { Property } from '@/domain/property';
import type { ExperienceGuide } from '@/domain/experience-guide';

/**
 * Monta o system prompt do assistente virtual a partir dos dados do imóvel
 * e do guia de experiências (quando disponível).
 *
 * Função pura — não depende de rede, provider ou banco.
 */
export function buildAssistantSystemPrompt(
  property: Property,
  guide: ExperienceGuide | null,
): string {
  const lines: string[] = [];

  lines.push('Você é um assistente virtual de um imóvel de temporada.');
  lines.push('Seu objetivo é ajudar o hóspede com informações sobre o imóvel e a região.');
  lines.push('');
  lines.push('REGRAS ABSOLUTAS:');
  lines.push('1. Responda EXCLUSIVAMENTE com base nos dados fornecidos abaixo.');
  lines.push('2. Se a informação solicitada NÃO estiver nos dados abaixo, diga claramente que não tem essa informação e oriente o hóspede a falar com o anfitrião (nome e telefone estão nos dados).');
  lines.push('3. NUNCA invente preço, disponibilidade, política de reserva, ou qualquer dado que não esteja explicitamente nos dados fornecidos.');
  lines.push('4. Respostas curtas e diretas — o hóspede está no celular.');
  lines.push('5. Responda SEMPRE em português do Brasil, na segunda pessoa (você).');
  lines.push('6. Seja acolhedor e prestativo, mas objetivo.');
  lines.push('');
  lines.push('--- DADOS DO IMÓVEL ---');
  lines.push(`Nome: ${property.name}`);
  lines.push(`Tipo: ${property.property_type}`);
  lines.push(`Quartos: ${property.bedroom_quantity}`);
  lines.push(`Banheiros: ${property.bathroom_quantity}`);
  lines.push(`Capacidade: ${property.guest_capacity} hóspedes`);
  lines.push(`Endereço: ${property.address.street}, ${property.address.number}${property.address.complement ? `, ${property.address.complement}` : ''} — ${property.address.neighborhood}, ${property.address.city}/${property.address.state}, CEP ${property.address.postal_code}`);
  lines.push('');
  lines.push('--- ACESSO ---');
  lines.push(`WiFi: rede "${property.operational.wifi_network}" / senha "${property.operational.wifi_password}"`);
  lines.push(`Tipo de acesso: ${property.operational.property_access_type}`);
  lines.push(`Instruções de entrada: ${property.operational.property_access_instructions}`);
  lines.push(`Código/Senha: ${property.operational.property_password}`);
  lines.push(`Check-in automático: ${property.operational.is_self_checkin ? 'Sim' : 'Não'}`);
  if (property.operational.has_parking_spot) {
    lines.push(`Estacionamento: Vaga ${property.operational.parking_spot_identifier ?? 'disponível'} — ${property.operational.parking_spot_instructions ?? 'Sem instruções adicionais'}`);
  } else {
    lines.push('Estacionamento: Não disponível');
  }
  lines.push('');
  lines.push('--- HORÁRIOS ---');
  lines.push(`Check-in: ${property.rules.check_in_time}`);
  lines.push(`Check-out: ${property.rules.check_out_time}`);
  lines.push('');
  lines.push('--- POLÍTICAS ---');
  lines.push(`Animais de estimação: ${property.rules.allow_pet ? 'PERMITIDO' : 'NÃO PERMITIDO'}`);
  lines.push(`Fumantes: ${property.rules.smoking_permitted ? 'PERMITIDO' : 'NÃO PERMITIDO'}`);
  lines.push(`Adequado para crianças: ${property.rules.suitable_for_children ? 'SIM' : 'NÃO'}`);
  lines.push(`Adequado para bebês: ${property.rules.suitable_for_babies ? 'SIM' : 'NÃO'}`);
  lines.push(`Eventos: ${property.rules.events_permitted ? 'PERMITIDO' : 'NÃO PERMITIDO'}`);
  lines.push('');
  lines.push('--- COMODIDADES ---');
  const activeAmenities = Object.entries(property.amenities)
    .filter(([, value]) => value)
    .map(([key]) => key);
  if (activeAmenities.length > 0) {
    lines.push(activeAmenities.join(', '));
  } else {
    lines.push('Nenhuma comodidade listada.');
  }
  lines.push('');
  lines.push('--- ANFITRIÃO ---');
  lines.push(`Nome: ${property.host.name}`);
  lines.push(`Telefone: ${property.host.phone}`);

  if (guide) {
    lines.push('');
    lines.push('--- GUIA DE EXPERIÊNCIAS ---');
    lines.push(`Mensagem de boas-vindas: ${guide.welcome_message}`);
    lines.push('');
    lines.push('Restaurantes próximos:');
    for (const r of guide.restaurants) {
      lines.push(`- ${r.name} (${r.distance}): ${r.description}`);
    }
    lines.push('');
    lines.push('Atrações próximas:');
    for (const a of guide.attractions) {
      lines.push(`- ${a.name} (${a.distance}): ${a.description}`);
    }
    lines.push('');
    lines.push('Serviços essenciais:');
    for (const e of guide.essentials) {
      lines.push(`- [${e.type}] ${e.name} (${e.distance}): ${e.description}`);
    }
    lines.push('');
    lines.push(`Dica sazonal: ${guide.seasonal_tip}`);
  } else {
    lines.push('');
    lines.push('--- GUIA DE EXPERIÊNCIAS ---');
    lines.push('O guia de experiências ainda não foi gerado para este imóvel.');
    lines.push('Caso o hóspede pergunte sobre restaurantes ou atrações, oriente-o a consultar o guia mais tarde ou falar com o anfitrião.');
  }

  return lines.join('\n');
}
