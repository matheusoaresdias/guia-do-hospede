import Link from "next/link";
import { listPropertyCodes } from "@/server/repositories/properties";

export default async function Home() {
  const codes = await listPropertyCodes();

  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <main className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center py-16 px-6 gap-8">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-700">
          Guia Digital do Hóspede
        </h1>
        <p className="text-lg text-center text-warm-600 max-w-md">
          Todas as informações do seu imóvel em um só lugar: WiFi, acesso,
          regras, experiências e um assistente virtual.
        </p>
        {codes.length === 0 ? (
          <p className="text-warm-500">Nenhum imóvel cadastrado ainda.</p>
        ) : (
          <nav
            aria-label="Imóveis disponíveis"
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            {codes.map((code) => (
              <Link
                key={code}
                href={`/${code}`}
                className="flex h-12 items-center justify-center rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
              >
                {code}
              </Link>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}
