import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Imóvel não encontrado — Guia Digital do Hóspede",
};

export default function PropertyNotFound() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center px-6 py-16 gap-6 text-center">
      <h1 className="text-2xl font-semibold text-warm-800 dark:text-warm-200">
        Imóvel não encontrado
      </h1>
      <p className="text-warm-600 dark:text-warm-400 max-w-md">
        Não encontramos um guia para o código informado. Verifique se o código
        está correto e tente novamente.
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-white font-medium hover:bg-brand-700 transition-colors"
      >
        Ver imóveis disponíveis
      </Link>
    </main>
  );
}
