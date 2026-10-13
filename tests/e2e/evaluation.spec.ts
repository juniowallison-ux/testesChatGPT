import { test, expect, type Page } from '@playwright/test';
import { initialData, exampleEvaluation, ids } from '../../src/lib/demo';
test.use({ baseURL: 'http://127.0.0.1:5175' });

async function setup(page: Page) {
  const data = initialData();
  const submission = {
    ...data.submissions[0],
    student_id: ids.teacher,
    status: 'pending' as const,
  };
  data.submissions = [submission];
  data.evaluations = [];
  const tables = {
    profiles: 'profiles',
    turmas: 'turmas',
    themes: 'themes',
    access_codes: 'codes',
    orientacoes_ia: 'guidance',
    documentos_apoio: 'docs',
    student_submissions: 'submissions',
    student_evaluations: 'evaluations',
  } as const;
  const user = {
    id: ids.teacher,
    email: 'teacher@example.test',
    aud: 'authenticated',
    role: 'authenticated',
  };
  let calls = 0;
  let mode: 'error' | 'success' | 'waiting' = 'error';
  await page.route('https://supabase.example.test/**', async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let body: unknown;
    if (url.pathname.endsWith('/token')) {
      body = {
        access_token: 'mock-authenticated-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user,
      };
    } else if (url.pathname.endsWith('/user')) body = user;
    else if (url.pathname.endsWith('/evaluate-student-essay')) {
      calls++;
      if (mode === 'waiting') await new Promise((resolve) => setTimeout(resolve, 800));
      if (mode === 'error')
        return route.fulfill({
          status: 429,
          headers,
          json: { error: 'A API da OpenAI está sem créditos. Verifique o faturamento da API.' },
        });
      const evaluation = { ...exampleEvaluation(submission.id), source: 'ai' as const };
      data.evaluations = [evaluation];
      data.submissions = [{ ...submission, status: 'evaluated' }];
      body = { evaluation };
    } else {
      const table = url.pathname.split('/').pop() as keyof typeof tables;
      if (!tables[table]) throw new Error(`Chamada inesperada: ${url.pathname}`);
      body =
        table === 'profiles' && url.searchParams.has('user_id')
          ? data.profiles[0]
          : data[tables[table]];
    }
    await route.fulfill({ headers, json: body });
  });
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('password-for-test');
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, professora Andréa.' })).toBeVisible();
  await page.getByRole('button', { name: 'Redações', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir redação de Andréa' }).click();
  return {
    setMode: (value: typeof mode) => {
      mode = value;
    },
    calls: () => calls,
    data,
    submission,
  };
}

test('falha permanece visível e consulta do resultado não chama a IA novamente', async ({
  page,
}) => {
  const api = await setup(page);
  await page.getByRole('button', { name: 'Avaliar com IA', exact: true }).click();
  const error = page.locator('.evaluation-error');
  await expect(error).toContainText('A API da OpenAI está sem créditos.');
  await expect(error).toContainText('HTTP 429');
  await page.clock.install();
  await page.clock.fastForward(7000);
  await expect(error).toBeVisible();
  await expect(page.locator('.toast.error')).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar resultado' }).click();
  await expect(page.getByRole('button', { name: 'Tentar avaliar novamente' })).toBeEnabled();
  expect(api.calls()).toBe(1);
  api.setMode('success');
  await page.getByRole('button', { name: 'Tentar avaliar novamente' }).click();
  await expect(page.locator('.total-score strong')).toHaveText('880/1000');
  await expect(page.locator('.result-meta')).toContainText('Corrigida');
  await expect(error).toHaveCount(0);
  expect(api.calls()).toBe(2);
});

test('mostra espera e impede cliques repetidos até carregar a devolutiva', async ({ page }) => {
  const api = await setup(page);
  api.setMode('waiting');
  await page.getByRole('button', { name: 'Avaliar com IA', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Avaliando sua redação…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avaliando…', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Corrigir manualmente' })).toBeDisabled();
  await expect(page.locator('.total-score strong')).toHaveText('880/1000');
  expect(api.calls()).toBe(1);
});

test('consulta recupera uma avaliação salva sem repetir a chamada à IA', async ({ page }) => {
  const api = await setup(page);
  await page.getByRole('button', { name: 'Avaliar com IA', exact: true }).click();
  await expect(page.locator('.evaluation-error')).toBeVisible();
  // Simula uma avaliação concluída no servidor depois de o navegador perder a resposta.
  api.data.evaluations = [{ ...exampleEvaluation(api.submission.id), source: 'ai' }];
  api.data.submissions = [{ ...api.submission, status: 'evaluated' }];
  await page.getByRole('button', { name: 'Atualizar resultado' }).click();
  await expect(page.locator('.total-score strong')).toHaveText('880/1000');
  await expect(page.locator('.evaluation-error')).toHaveCount(0);
  await expect(page.locator('.toast.error')).toHaveCount(0);
  expect(api.calls()).toBe(1);
});
