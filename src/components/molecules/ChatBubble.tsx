interface ChatBubbleProps {
  /** Quem enviou a mensagem */
  role: 'hospede' | 'assistente';
  /** Conteúdo da mensagem (texto ou elementos) */
  children: React.ReactNode;
}

/**
 * Bolha de mensagem do chat.
 * - 'hospede': alinhada à direita, fundo brand.
 * - 'assistente': alinhada à esquerda, fundo neutro.
 */
export function ChatBubble({ role, children }: ChatBubbleProps) {
  const isHost = role === 'hospede';

  return (
    <div className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 text-sm leading-relaxed break-words ${
          isHost
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-warm-100 text-warm-900 rounded-bl-sm'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
