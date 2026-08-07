import type { ReactNode } from 'react';

export interface PlaceCardProps {
  name: string;
  distance: string;
  description: string;
  /** Ícone ou rótulo opcional de categoria (ex: "🍽️", "🏛️", "💊") */
  categoryIcon?: ReactNode;
  /** Rótulo textual da categoria (ex: "Restaurante", "Farmácia") */
  categoryLabel?: string;
}

export function PlaceCard({
  name,
  distance,
  description,
  categoryIcon,
  categoryLabel,
}: PlaceCardProps) {
  return (
    <article className="rounded-lg border border-warm-200 bg-warm-50 p-4">
      <div className="flex items-start gap-3">
        {(categoryIcon || categoryLabel) && (
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-warm-500 shrink-0">
            {categoryIcon && <span aria-hidden="true">{categoryIcon}</span>}
            {categoryLabel && <span className="font-medium">{categoryLabel}</span>}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-warm-900 text-base">
            {name}
          </h3>
          <p className="text-sm text-warm-500 mt-0.5">
            {distance}
          </p>
          <p className="text-sm text-warm-700 mt-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}
