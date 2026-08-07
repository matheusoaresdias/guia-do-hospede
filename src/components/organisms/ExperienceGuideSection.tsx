'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ExperienceGuide } from '@/domain/experience-guide';
import { Skeleton } from '@/components/atoms/Skeleton';
import { PlaceCard } from '@/components/molecules/PlaceCard';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type SectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; guide: ExperienceGuide };

// ---------------------------------------------------------------------------
// Mapeamento de tipos de essencial para ícone e rótulo
// ---------------------------------------------------------------------------

const essentialMeta: Record<
  string,
  { icon: string; label: string }
> = {
  pharmacy: { icon: '💊', label: 'Farmácia' },
  supermarket: { icon: '🛒', label: 'Supermercado' },
  hospital: { icon: '🏥', label: 'Hospital' },
  other: { icon: '📍', label: 'Serviço' },
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface ExperienceGuideSectionProps {
  code: string;
}

export function ExperienceGuideSection({ code }: ExperienceGuideSectionProps) {
  const [state, setState] = useState<SectionState>({ status: 'loading' });

  const fetchGuide = useCallback(async () => {
    try {
      const response = await fetch(`/api/properties/${code}/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.error?.message ??
          'Não foi possível carregar o guia de experiências.';
        setState({ status: 'error', message });
        return;
      }

      const data = await response.json();
      setState({ status: 'ready', guide: data.guide });
    } catch {
      setState({
        status: 'error',
        message:
          'Erro de conexão ao carregar o guia. Verifique sua rede e tente novamente.',
      });
    }
  }, [code]);

  // O enunciado exige feedback visual enquanto o guia é gerado, e a geração é
  // um POST com efeito colateral (persiste no banco) — não dá para resolvê-la
  // no Server Component sem perder o estado de carregando. O setState acontece
  // depois do await, em callback, não sincronamente no corpo do efeito; a regra
  // não distingue os dois casos.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGuide();
  }, [fetchGuide]);

  // O retry reintroduz o estado de carregando, que fetchGuide não seta mais
  // sozinha para não violar a regra de setState dentro de efeito.
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void fetchGuide();
  }, [fetchGuide]);

  // -----------------------------------------------------------------------
  // Estado: carregando
  // -----------------------------------------------------------------------
  if (state.status === 'loading') {
    return (
      <section aria-labelledby="experience-heading" className="space-y-6">
        <div>
          <h2
            id="experience-heading"
            className="text-2xl font-bold text-warm-900 dark:text-warm-100"
          >
            Experiências no bairro
          </h2>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Estamos preparando recomendações personalizadas para a sua
            estadia...
          </p>
        </div>

        {/* Skeleton que espelha a forma do conteúdo final */}
        <div className="space-y-8" aria-hidden="true">
          {/* Welcome */}
          <Skeleton className="h-20 w-full" />

          {/* Restaurantes */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`rest-skel-${i}`} className="h-24 w-full" />
            ))}
          </div>

          {/* Atrações */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`attr-skel-${i}`} className="h-24 w-full" />
            ))}
          </div>

          {/* Essenciais */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`ess-skel-${i}`} className="h-24 w-full" />
            ))}
          </div>

          {/* Dica sazonal */}
          <Skeleton className="h-16 w-full" />
        </div>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Estado: erro
  // -----------------------------------------------------------------------
  if (state.status === 'error') {
    return (
      <section aria-labelledby="experience-heading" className="space-y-4">
        <h2
          id="experience-heading"
          className="text-2xl font-bold text-warm-900 dark:text-warm-100"
        >
          Experiências no bairro
        </h2>

        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 text-center">
          <p className="text-red-700 dark:text-red-300 text-sm mb-4">
            {state.message}
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Estado: pronto
  // -----------------------------------------------------------------------
  const { guide } = state;

  return (
    <section aria-labelledby="experience-heading" className="space-y-8">
      <div>
        <h2
          id="experience-heading"
          className="text-2xl font-bold text-warm-900 dark:text-warm-100"
        >
          Experiências no bairro
        </h2>
      </div>

      {/* Mensagem de boas-vindas */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="text-warm-800 dark:text-warm-200 leading-relaxed">
          {guide.welcome_message}
        </p>
      </div>

      {/* Restaurantes */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          🍽️ Restaurantes
        </h3>
        <div className="grid gap-3">
          {guide.restaurants.map((r, i) => (
            <PlaceCard
              key={`rest-${i}`}
              name={r.name}
              distance={r.distance}
              description={r.description}
            />
          ))}
        </div>
      </div>

      {/* Atrações */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          🏛️ Atrações
        </h3>
        <div className="grid gap-3">
          {guide.attractions.map((a, i) => (
            <PlaceCard
              key={`attr-${i}`}
              name={a.name}
              distance={a.distance}
              description={a.description}
            />
          ))}
        </div>
      </div>

      {/* Essenciais */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          🏪 Serviços essenciais
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {guide.essentials.map((e, i) => {
            const meta = essentialMeta[e.type] ?? essentialMeta.other;
            return (
              <PlaceCard
                key={`ess-${i}`}
                name={e.name}
                distance={e.distance}
                description={e.description}
                categoryIcon={meta.icon}
                categoryLabel={meta.label}
              />
            );
          })}
        </div>
      </div>

      {/* Dica sazonal */}
      <div className="rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 p-4">
        <p className="text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">
          🌦️ Dica da estação
        </p>
        <p className="text-sm text-brand-800 dark:text-brand-200 leading-relaxed">
          {guide.seasonal_tip}
        </p>
      </div>
    </section>
  );
}
