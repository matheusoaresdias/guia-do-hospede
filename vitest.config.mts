import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom para os testes de componente; os testes de domínio e de handler
    // não dependem de DOM e rodam igual neste ambiente.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
      // O pacote 'server-only' lança fora do runtime de Server Component do Next
      // (ver node_modules/server-only/index.js). O Next resolve para empty.js via
      // a condição de export 'react-server', que o Vitest não declara — sem este
      // alias, qualquer teste que importe um módulo server-only quebra.
      'server-only': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        './node_modules/server-only/empty.js',
      ),
    },
  },
});
