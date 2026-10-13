import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test('professora gerencia turma, código, tema e método com persistência', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: 'Olá, professora Andréa.' })).toBeVisible();
  await page.getByRole('button', { name: 'Turmas e códigos' }).click();
  await page.getByRole('button', { name: 'Nova turma' }).click();
  await page.getByLabel('Nome da turma').fill('Turma de teste');
  await page.getByLabel('Descrição', { exact: true }).fill('Preparação para o ENEM');
  await page.getByRole('button', { name: 'Salvar turma' }).click();
  await expect(page.getByRole('heading', { name: 'Turma de teste' })).toBeVisible();
  const card = page
    .locator('.class-card')
    .filter({ has: page.getByRole('heading', { name: 'Turma de teste' }) });
  await card.getByRole('button', { name: 'Gerar código' }).click();
  await page.getByLabel('Limite de cadastros').fill('20');
  await page.getByRole('dialog').getByRole('button', { name: 'Gerar código' }).click();
  await expect(card.locator('.code-item strong')).toHaveText(/^[A-Z0-9]{8}$/);
  await page.getByRole('button', { name: 'Temas de redação', exact: true }).click();
  await page.getByRole('button', { name: 'Novo tema' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Tema de teste');
  await page.getByLabel('Textos motivadores').fill('Uma reflexão sobre cidadania.');
  await page.getByRole('button', { name: 'Salvar tema' }).click();
  await expect(page.getByRole('heading', { name: 'Tema de teste', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Orientações da IA', exact: true }).click();
  await expect(page.locator('.guidance-card')).toHaveCount(12);
  await page.getByRole('button', { name: /Visão geral do método/ }).click();
  await page.getByLabel('Orientação pedagógica').fill('Oriente o aluno a aprofundar exemplos.');
  await page.getByRole('button', { name: 'Salvar orientação' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Orientações da IA', exact: true }).click();
  await expect(page.getByText('Oriente o aluno a aprofundar exemplos.')).toBeVisible();
  expect(errors).toEqual([]);
});
test('aluno envia uma redação e professora corrige manualmente sem perder dados', async ({
  page,
}) => {
  await page
    .getByRole('combobox', { name: 'Alternar perfil da demonstração' })
    .selectOption('student');
  await expect(page.getByRole('heading', { name: 'Olá, Mariana.' })).toBeVisible();
  await page.getByRole('button', { name: 'Escolher um tema' }).click();
  await page
    .getByLabel('Texto da redação')
    .fill('A desinformação ameaça a cidadania.\nÉ necessário ampliar a educação midiática.');
  await page.getByRole('button', { name: 'Enviar redação', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar envio' }).click();
  await expect(
    page.getByRole('heading', { name: 'Seu texto está pronto para um olhar atento.' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Alternar perfil da demonstração' })
    .selectOption('teacher');
  await page.getByRole('button', { name: 'Redações', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Filtrar tema' })
    .selectOption({ label: 'Os impactos da cultura de desinformação na sociedade brasileira' });
  await page.getByRole('button', { name: 'Abrir redação de Mariana Costa' }).click();
  await page.getByRole('button', { name: 'Corrigir manualmente' }).click();
  const dialog = page.getByRole('dialog');
  for (const select of await dialog.locator('select').all()) await select.selectOption('160');
  for (const textarea of await dialog.getByLabel('Justificativa pedagógica').all())
    await textarea.fill('Boa base; aprofunde os exemplos.');
  await dialog.getByLabel('Devolutiva geral').fill('Seu texto abre uma discussão relevante.');
  await dialog.getByLabel('Pontos fortes (um por linha)').fill('Tema bem delimitado.');
  await dialog.getByLabel('Próximos passos (um por linha)').fill('Desenvolva seus argumentos.');
  await dialog.getByRole('button', { name: 'Salvar devolutiva' }).click();
  await expect(page.locator('.total-score strong')).toHaveText('800/1000');
  await expect(page.getByText('Revisada pela professora', { exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Alternar perfil da demonstração' })
    .selectOption('student');
  await page.getByRole('button', { name: 'Minhas redações', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Filtrar tema' })
    .selectOption({ label: 'Os impactos da cultura de desinformação na sociedade brasileira' });
  await page.getByRole('button', { name: 'Abrir redação de Mariana Costa' }).click();
  await page.getByLabel('Sua dúvida').fill('Como posso desenvolver meus argumentos?');
  await page.getByRole('button', { name: 'Enviar dúvida' }).click();
  await expect(page.getByText('Enviada à professora')).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Alternar perfil da demonstração' })
    .selectOption('teacher');
  await page.getByRole('button', { name: 'Mensagens', exact: true }).click();
  const message = page
    .locator('.message-card')
    .filter({ hasText: 'Como posso desenvolver meus argumentos?' });
  await message.getByRole('button', { name: 'Marcar como lida' }).click();
  await expect(message.getByText('Lida', { exact: true })).toBeVisible();
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('papel-e-tinta-demo-v1')!),
  );
  expect(
    persisted.evaluations.some(
      (e: { total_score: number; source: string }) =>
        e.total_score === 800 && e.source === 'teacher',
    ),
  ).toBe(true);
});
test('PDF e RTF são exportados e a visualização móvel não transborda', async ({ page }) => {
  await page.getByRole('button', { name: 'Redações', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const rtf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar RTF' }).click();
  expect((await rtf).suggestedFilename()).toMatch(/\.rtf$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Olá, professora Andréa.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('documento de apoio, edição de aluno e rascunho da correção direta funcionam', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Documentos de apoio', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar documento' }).click();
  await page.getByLabel('Título privado').fill('Material pedagógico de teste');
  await page.locator('input[type=file]').setInputFiles({
    name: 'apoio.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Oriente o aluno a explicar causas e consequências.'),
  });
  await expect(page.getByLabel('Conteúdo para a IA')).toHaveValue(
    'Oriente o aluno a explicar causas e consequências.',
  );
  await page.getByRole('button', { name: 'Salvar documento' }).click();
  await expect(page.getByRole('heading', { name: 'Material pedagógico de teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(page.getByText('Desativado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Alunos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar aluno Mariana Costa' }).click();
  await page.getByLabel('Nome completo').fill('Mariana Costa Silva');
  await page.getByRole('button', { name: 'Salvar aluno' }).click();
  await expect(page.getByText('Mariana Costa Silva', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Correção direta', exact: true }).click();
  await page.getByLabel('Texto da redação').fill('Uma linha quebrada\ncontinua neste parágrafo.');
  await expect(page.getByText(/Possíveis quebras acidentais/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Correção direta', exact: true }).click();
  await expect(page.getByLabel('Texto da redação')).toHaveValue(
    'Uma linha quebrada\ncontinua neste parágrafo.',
  );
  await page.getByRole('button', { name: 'Salvar para corrigir' }).click();
  await page.getByRole('button', { name: 'Confirmar envio' }).click();
  await expect(
    page.getByRole('heading', { name: 'Seu texto está pronto para um olhar atento.' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Alternar perfil da demonstração' })
    .selectOption('student');
  await expect(page.getByRole('button', { name: 'Documentos de apoio', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Orientações da IA', exact: true })).toHaveCount(0);
});

test('projeto sem temas explica o bloqueio e permite cadastrar tema sem perder o rascunho', async ({
  page,
}) => {
  await page.evaluate(async () => {
    // Simula um projeto recém-configurado, usando somente dados locais da demonstração.
    const { initialData } = await import('/src/lib/demo.ts');
    const data = initialData();
    data.themes = [];
    data.submissions = [];
    data.evaluations = [];
    localStorage.setItem('papel-e-tinta-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Correção direta', exact: true }).click();
  const essay =
    'A democratização da educação exige investimento público. Portanto, o Ministério da Educação deve ampliar a formação docente por meio de programas continuados, para melhorar a aprendizagem.';
  await page.getByLabel('Texto da redação').fill(essay);
  await expect(page.getByRole('button', { name: 'Salvar para corrigir' })).toBeDisabled();
  await expect(page.getByText('Cadastre um tema antes de salvar a redação.')).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar primeiro tema' }).click();
  await page.getByRole('button', { name: 'Novo tema' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Democratização da educação');
  await page
    .getByLabel('Textos motivadores')
    .fill('Discuta o direito à educação e os desafios de sua efetivação.');
  await page.getByRole('button', { name: 'Salvar tema' }).click();
  await page.getByRole('button', { name: 'Correção direta', exact: true }).click();
  await expect(page.getByLabel('Texto da redação')).toHaveValue(essay);
  await expect(page.getByRole('button', { name: 'Salvar para corrigir' })).toBeEnabled();
  await page.getByRole('button', { name: 'Salvar para corrigir' }).click();
  await page.getByRole('button', { name: 'Confirmar envio' }).click();
  await expect(
    page.getByRole('heading', { name: 'Seu texto está pronto para um olhar atento.' }),
  ).toBeVisible();
});
