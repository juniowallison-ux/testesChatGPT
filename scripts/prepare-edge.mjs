import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

for (const name of ['evaluate-student-essay', 'ocr-extract']) {
  const directory = `supabase/dashboard/${name}`;
  await mkdir(directory, { recursive: true });
  await build({
    entryPoints: [`supabase/functions/${name}/index.ts`],
    outfile: `${directory}/index.js`,
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    target: 'es2022',
    external: ['npm:*'],
    banner: {
      js: '// Arquivo completo para o editor do Supabase, gerado das funções originais.\n// Configure as chaves nos segredos do painel, nunca neste código.',
    },
  });
  console.log(`${name}: arquivo completo preparado.`);
}
