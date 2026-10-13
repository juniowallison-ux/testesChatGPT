import { openai } from './ai.ts';
import { HttpError } from './http.ts';
import { responseSchema } from './evaluation.ts';

function assert(value: unknown, message = 'Verificação falhou'): asserts value {
  if (!value) throw new Error(message);
}
const ocrSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
  required: ['text'],
};
async function withMock(
  fetcher: typeof fetch,
  run: () => Promise<void>,
  key: string | undefined = 'chave-apenas-para-teste',
) {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get('OPENAI_API_KEY');
  const originalModel = Deno.env.get('OPENAI_MODEL');
  if (key === undefined) Deno.env.delete('OPENAI_API_KEY');
  else Deno.env.set('OPENAI_API_KEY', key);
  Deno.env.delete('OPENAI_MODEL');
  globalThis.fetch = fetcher;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete('OPENAI_API_KEY');
    else Deno.env.set('OPENAI_API_KEY', originalKey);
    if (originalModel === undefined) Deno.env.delete('OPENAI_MODEL');
    else Deno.env.set('OPENAI_MODEL', originalModel);
  }
}
function success(content = '{"text":"Texto transcrito."}') {
  return Response.json({
    choices: [{ finish_reason: 'stop', message: { content, refusal: null } }],
  });
}
async function expectError(run: () => Promise<unknown>, status: number, contains: string) {
  try {
    await run();
  } catch (error) {
    assert(error instanceof HttpError && error.status === status);
    assert(error.message.includes(contains));
    return;
  }
  throw new Error('A operação deveria falhar.');
}
Deno.test('OpenAI: autenticação, modelo, schema estrito, seed e fallback JSON', async () => {
  await withMock(
    async (url, init) => {
      assert(url === 'https://api.openai.com/v1/chat/completions');
      assert(init?.method === 'POST');
      const headers = new Headers(init.headers);
      assert(headers.get('Authorization') === 'Bearer chave-apenas-para-teste');
      const request = JSON.parse(String(init.body));
      assert(request.model === 'gpt-4o' && request.store === false);
      assert(request.temperature === 0.1 && request.seed === 123);
      assert(request.response_format.type === 'json_schema');
      assert(request.response_format.json_schema.strict === true);
      assert(request.response_format.json_schema.name === 'enem_evaluation');
      assert(request.messages[0].role === 'system');
      assert(request.messages[1].content[0].text === 'L1: Minha redação.');
      return success('```json\n{"resultado":"válido"}\n```');
    },
    async () => {
      const result = (await openai(
        'Avalie sem inventar.',
        [{ text: 'L1: Minha redação.' }],
        responseSchema,
        { seed: 123 },
      )) as { resultado: string };
      assert(result.resultado === 'válido');
    },
  );
});
Deno.test('OpenAI: OCR de imagem usa conteúdo multimodal', async () => {
  await withMock(
    async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const image = request.messages[1].content[0];
      assert(
        image.type === 'image_url' && image.image_url.url === 'data:image/png;base64,aW1hZ2Vt',
      );
      assert(image.image_url.detail === 'high');
      assert(request.response_format.json_schema.name === 'ocr_transcription');
      return success();
    },
    async () => {
      const result = (await openai(
        'Transcreva.',
        [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2Vt' } }],
        ocrSchema,
        { schemaName: 'ocr_transcription' },
      )) as { text: string };
      assert(result.text === 'Texto transcrito.');
    },
  );
});
Deno.test('OpenAI: PDF é enviado como arquivo, não como imagem', async () => {
  await withMock(
    async (_url, init) => {
      const content = JSON.parse(String(init?.body)).messages[1].content[0];
      assert(content.type === 'file' && content.file.filename === 'redacao.pdf');
      assert(content.file.file_data === 'data:application/pdf;base64,cGRm');
      return success();
    },
    async () => {
      await openai(
        'Transcreva.',
        [{ inlineData: { mimeType: 'application/pdf', data: 'cGRm' } }],
        ocrSchema,
      );
    },
  );
});
Deno.test('OpenAI: ausência de chave impede a chamada externa', async () => {
  let called = false;
  await withMock(
    async () => {
      called = true;
      return success();
    },
    async () => {
      Deno.env.delete('OPENAI_API_KEY');
      await expectError(
        () => openai('Avalie.', [{ text: 'Texto' }], ocrSchema),
        503,
        'OPENAI_API_KEY',
      );
      assert(!called);
    },
  );
});
Deno.test('OpenAI: modelo incompatível é rejeitado antes da chamada', async () => {
  let called = false;
  await withMock(
    async () => {
      called = true;
      return success();
    },
    async () => {
      Deno.env.set('OPENAI_MODEL', 'modelo-incompatível');
      await expectError(
        () => openai('Avalie.', [{ text: 'Texto' }], ocrSchema),
        503,
        'OPENAI_MODEL',
      );
      assert(!called);
    },
  );
});
Deno.test('OpenAI: recusa não é tratada como avaliação', async () => {
  await withMock(
    async () =>
      Response.json({
        choices: [
          { finish_reason: 'stop', message: { refusal: 'Recusa do provedor.', content: null } },
        ],
      }),
    async () => {
      await expectError(() => openai('Avalie.', [{ text: 'Texto' }], ocrSchema), 422, 'revisão');
    },
  );
});
Deno.test('OpenAI: resposta truncada não é aceita nem parcialmente salva', async () => {
  await withMock(
    async () =>
      Response.json({
        choices: [{ finish_reason: 'length', message: { content: '{"text":"incompleto"' } }],
      }),
    async () => {
      await expectError(() => openai('Avalie.', [{ text: 'Texto' }], ocrSchema), 502, 'parcial');
    },
  );
});
for (const [status, expectedStatus, term] of [
  [401, 502, 'chave'],
  [429, 429, 'créditos'],
  [500, 502, 'Tente novamente'],
] as const) {
  Deno.test(`OpenAI: HTTP ${status} retorna erro controlado sem expor o provedor`, async () => {
    await withMock(
      async () =>
        Response.json({ error: { message: 'INFORMAÇÃO PRIVADA DO PROVEDOR' } }, { status }),
      async () => {
        await expectError(
          () => openai('Avalie.', [{ text: 'Texto' }], ocrSchema),
          expectedStatus,
          term,
        );
      },
    );
  });
}
Deno.test(
  'OpenAI: todos os objetos do schema proíbem campos extras e exigem os campos declarados',
  () => {
    function check(schema: Record<string, unknown>) {
      if (schema.type === 'object') {
        assert(schema.additionalProperties === false);
        const properties = schema.properties as Record<string, Record<string, unknown>>;
        const required = schema.required as string[];
        assert(Object.keys(properties).every((key) => required.includes(key)));
        assert(Object.keys(properties).length === required.length);
        Object.values(properties).forEach(check);
      } else if (schema.type === 'array') check(schema.items as Record<string, unknown>);
    }
    check(responseSchema);
  },
);
Deno.test('OpenAI: texto ausente na resposta é rejeitado', async () => {
  await withMock(
    async () => success(''),
    async () => {
      await expectError(() => openai('Avalie.', [{ text: 'Texto' }], ocrSchema), 502, 'legível');
    },
  );
});
Deno.test('OpenAI: falha de conexão é identificada sem expor o erro bruto', async () => {
  await withMock(
    async () => {
      throw new TypeError('Detalhes privados da conexão');
    },
    async () => {
      await expectError(
        () => openai('Avalie.', [{ text: 'Texto' }], responseSchema),
        502,
        'conectar à OpenAI',
      );
    },
  );
});
Deno.test('OpenAI: tempo excedido é identificado e a avaliação pode limitar a espera', async () => {
  await withMock(
    async (_url, init) => {
      assert(init?.signal instanceof AbortSignal);
      const error = new Error('Tempo excedido');
      error.name = 'TimeoutError';
      throw error;
    },
    async () => {
      await expectError(
        () => openai('Avalie.', [{ text: 'Texto' }], responseSchema, { timeoutMs: 45000 }),
        504,
        'tempo esperado',
      );
    },
  );
});
