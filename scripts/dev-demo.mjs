import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Os testes da demonstração nunca usam o projeto Supabase conectado.
const child = spawn(
  process.execPath,
  [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '0.0.0.0', '--port', '5174', '--strictPort'],
  { stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
child.on('error', () => process.exit(1));
