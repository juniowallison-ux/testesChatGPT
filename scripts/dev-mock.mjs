import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Projeto fictício: o Playwright intercepta todas as chamadas, sem usar credenciais reais.
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
    '--host',
    '0.0.0.0',
    '--port',
    '5175',
    '--strictPort',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://supabase.example.test',
      VITE_SUPABASE_ANON_KEY: 'public-test-key',
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', () => process.exit(1));
