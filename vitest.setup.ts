import '@testing-library/jest-dom/vitest';

// db/client.ts abre a conexão no top-level do módulo (`createDb()` fora de
// qualquer função). O client `postgres` é preguiçoso — não conecta de fato até
// a primeira query — então uma URL só precisa ter forma válida para testes que
// importam um repositório mas mockam todas as suas funções via vi.spyOn nunca
// tocarem o banco de verdade.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:55433/test';
