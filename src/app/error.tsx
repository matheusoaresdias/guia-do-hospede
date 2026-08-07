'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ErrorPage({ error, retry }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col flex-1 items-center justify-center px-6 py-16 gap-6 text-center">
      <h1 className="text-2xl font-semibold text-warm-800">
        Algo deu errado
      </h1>
      <p className="text-warm-600 max-w-md">
        Não conseguimos carregar esta página agora. Tente novamente em
        instantes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-white font-medium hover:bg-brand-700 transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-warm-300 px-6 text-warm-700 font-medium hover:bg-warm-100 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
