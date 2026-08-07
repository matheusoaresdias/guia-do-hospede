// Script standalone (roda por tsx, fora do runtime do Next).
// Por isso NÃO importa ./client — aquele módulo carrega 'server-only', que lança
// por design fora do ambiente React. Aqui abrimos e fechamos a nossa própria conexão.
//
// O .env precisa ser carregado ANTES de qualquer coisa ler process.env.DATABASE_URL,
// então o carregamento fica no topo do módulo, não dentro de main().
try {
  process.loadEnvFile?.('.env');
} catch {
  // .env ausente é aceitável — as variáveis podem vir do ambiente (CI, Vercel).
}

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

import { propertySchema } from '../../domain/property';
import { properties } from './schema';
import seedData from './seed-data.json' with { type: 'json' };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL não definida. Copie .env.example para .env e preencha.');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const item of seedData) {
    const parsed = propertySchema.parse(item);

    const result = await db
      .insert(properties)
      .values({
        code: parsed.code,
        name: parsed.name,
        property_type: parsed.property_type,
        bedroom_quantity: parsed.bedroom_quantity,
        bathroom_quantity: parsed.bathroom_quantity,
        guest_capacity: parsed.guest_capacity,
        address: parsed.address,
        operational: parsed.operational,
        rules: parsed.rules,
        amenities: parsed.amenities,
        images: parsed.images,
        host: parsed.host,
      })
      .onConflictDoUpdate({
        target: properties.code,
        set: {
          name: sql`excluded.name`,
          property_type: sql`excluded.property_type`,
          bedroom_quantity: sql`excluded.bedroom_quantity`,
          bathroom_quantity: sql`excluded.bathroom_quantity`,
          guest_capacity: sql`excluded.guest_capacity`,
          address: sql`excluded.address`,
          operational: sql`excluded.operational`,
          rules: sql`excluded.rules`,
          amenities: sql`excluded.amenities`,
          images: sql`excluded.images`,
          host: sql`excluded.host`,
        },
      })
      // xmax = 0 distingue INSERT de UPDATE numa cláusula ON CONFLICT.
      .returning({ inserted: sql<boolean>`xmax = 0` });

    if (result[0]?.inserted) {
      inserted += 1;
      console.log(`  ✓ Inserido:   ${parsed.code}`);
    } else {
      updated += 1;
      console.log(`  ↻ Atualizado: ${parsed.code}`);
    }
  }

  console.log(`\nSeed concluído: ${inserted} inseridos, ${updated} atualizados.`);
}

main()
  .catch((err) => {
    console.error('Erro no seed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
