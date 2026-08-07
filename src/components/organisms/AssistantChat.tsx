'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatBubble } from '@/components/molecules/ChatBubble';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'Qual a senha do WiFi?',
  'Posso trazer meu cachorro?',
  'A que horas posso fazer check-in?',
  'Que restaurantes tem perto?',
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface AssistantChatProps {
  propertyCode: string;
}

export function AssistantChat({ propertyCode }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // -----------------------------------------------------------------------
  // Rolagem automática para a última mensagem
  // -----------------------------------------------------------------------
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // -----------------------------------------------------------------------
  // Envia uma mensagem e consome o stream
  // -----------------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      // Aborta qualquer requisição pendente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const userMessage: ChatMessage = { role: 'user', content };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');
      setStreamError(null);
      setIsStreaming(true);

      // Placeholder vazio para a resposta do assistente
      const assistantPlaceholder: ChatMessage = {
        role: 'assistant',
        content: '',
      };
      setMessages((prev) => [...prev, assistantPlaceholder]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/api/properties/${propertyCode}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: updatedMessages.slice(-20),
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.error?.message ?? 'Erro ao enviar mensagem.',
          );
        }

        if (!response.body) {
          throw new Error('Resposta sem corpo.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          // Atualiza a última mensagem (do assistente) com o texto acumulado
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: accumulated,
              };
            }
            return updated;
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        const message =
          err instanceof Error ? err.message : 'Erro inesperado.';
        setStreamError(message);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isStreaming, propertyCode],
  );

  // -----------------------------------------------------------------------
  // Reenvia a última pergunta do usuário após erro
  // -----------------------------------------------------------------------
  const handleRetry = useCallback(() => {
    // Remove a última resposta do assistente (incompleta ou falha)
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });
    setStreamError(null);

    // Reenvia a última pergunta do usuário
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  // -----------------------------------------------------------------------
  // Handlers do formulário
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isStreaming) return;
      sendMessage(input.trim());
    },
    [input, isStreaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <section
      aria-labelledby="assistant-heading"
      className="flex flex-col"
    >
      <h2
        id="assistant-heading"
        className="text-2xl font-bold text-warm-900 mb-4"
      >
        💬 Assistente virtual
      </h2>
      <p className="text-sm text-warm-600 mb-4">
        Tire dúvidas sobre o imóvel, regras e recomendações do bairro.
      </p>

      {/* Lista de mensagens */}
      <div
        ref={listRef}
        aria-live="polite"
        aria-label="Histórico de mensagens"
        className="flex-1 space-y-3 mb-4 max-h-96 overflow-y-auto rounded-lg border border-warm-200 bg-warm-50 p-4"
      >
        {/* Estado vazio: perguntas sugeridas */}
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-warm-500 mb-3">
              O que você gostaria de saber?
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  disabled={isStreaming}
                  className="inline-block rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens */}
        {messages.map((msg, idx) => (
          <ChatBubble
            key={idx}
            role={msg.role === 'user' ? 'hospede' : 'assistente'}
          >
            {msg.content !== '' ? (
              msg.content
            ) : (
              /* Indicador de espera pelo primeiro token */
              <span
                className="inline-flex items-center gap-1"
                aria-label="Aguardando resposta"
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-current animate-pulse [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-current animate-pulse [animation-delay:0.4s]" />
              </span>
            )}
          </ChatBubble>
        ))}

        {/* Erro com opção de reenviar */}
        {streamError && (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-error">
              {streamError}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isStreaming}
              className="text-sm text-brand-600 hover:underline disabled:opacity-50"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Campo de entrada */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Digite sua mensagem
        </label>
        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="Digite sua pergunta..."
          className="flex-1 min-w-0 rounded-lg border border-warm-300 bg-white px-4 py-3 text-base text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-3 text-base font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Enviar mensagem"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 5.657a.75.75 0 0 0 .574.554l6.145 1.012a.25.25 0 0 1 0 .495l-6.145 1.012a.75.75 0 0 0-.574.554l-1.414 5.657a.75.75 0 0 0 .826.95 28.636 28.636 0 0 0 16.318-8.329.75.75 0 0 0 0-1.056A28.636 28.636 0 0 0 3.105 2.288Z" />
          </svg>
        </button>
      </form>
    </section>
  );
}
