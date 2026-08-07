'use client';

import { useEffect } from 'react';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-warm-50 text-warm-900">
        <main className="flex flex-col flex-1 items-center justify-center px-6 py-16 gap-6 text-center">
          <h1 className="text-2xl font-semibold text-warm-800">
            Algo deu errado
          </h1>
          <p className="text-warm-600 max-w-md">
            Não conseguimos carregar esta página agora. Tente novamente em
            instantes.
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
