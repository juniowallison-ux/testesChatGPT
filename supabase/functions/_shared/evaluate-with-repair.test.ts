import { evaluateWithRepair } from './evaluate-with-repair.ts';
import { HttpError } from './http.ts';

const text = 'A educação exige investimento público. O Ministério deve ampliar o apoio.';
function sample() {
  return {
    competencies: Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      score: 160,
      comment: 'Desenvolva os argumentos.',
    })),
    general_feedback: 'Continue praticando.',
    strengths: ['Tese clara.'],
    improvements: ['Aprofunde os exemplos.'],
    evidence: [{ quote: 'A educação', line: 1, competency: 2, comment: 'Tema identificado.' }],
    intervention: {
      agente: 'O Ministério',
      acao: 'ampliar o apoio',
      meio: null,
      efeito: null,
      detalhamento: null,
    },
    zero_reason: null,
  };
}
function assert(value: unknown): asserts value {
  if (!value) throw new Error('Verificação falhou.');
}
function input(beforeAttempt: () => Promise<void>) {
  return {
    prompt: JSON.stringify({ essay: 'L1: ' + text }),
    text,
    privateNames: ['Material privado.pdf'],
    seed: 123,
    beforeAttempt,
  };
}
async function expectError(operation: () => Promise<unknown>, status: number, message: string) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof HttpError && error.status === status);
    assert(error.message.includes(message));
    assert(
      !error.message.includes('TRECHO PRIVADO') && !error.message.includes('Material privado.pdf'),
    );
    return;
  }
  throw new Error('Deveria rejeitar a operação.');
}
Deno.test('avaliação válida faz somente uma chamada e consome um orçamento', async () => {
  let calls = 0,
    budgets = 0;
  const result = await evaluateWithRepair(
    input(async () => {
      budgets++;
    }),
    async (prompt, seed) => {
      calls++;
      assert(prompt === input(async () => {}).prompt && seed === 123);
      return sample();
    },
  );
  assert(calls === 1 && budgets === 1 && result.c5_score === 160);
});
Deno.test('uma evidência inválida gera um único reparo orientado e validado', async () => {
  let calls = 0,
    budgets = 0;
  const result = await evaluateWithRepair(
    input(async () => {
      budgets++;
    }),
    async (prompt, seed) => {
      calls++;
      if (calls === 1) {
        const r = sample();
        r.evidence[0].quote = 'TRECHO PRIVADO INEXISTENTE';
        return r;
      }
      const repair = JSON.parse(prompt).repair;
      assert(repair.code === 'evidence' && seed === 124);
      assert(repair.previous_response.evidence[0].quote === 'TRECHO PRIVADO INEXISTENTE');
      return sample();
    },
  );
  assert(calls === 2 && budgets === 2 && result.c1_score === 160);
});
for (const privacy of [false, true]) {
  Deno.test(
    'duas respostas inválidas encerram sem DTO e logs não incluem conteúdo: ' +
      (privacy ? 'privacidade' : 'evidência'),
    async () => {
      let calls = 0;
      const messages: string[] = [];
      const warn = console.warn;
      console.warn = (message: string) => {
        messages.push(message);
      };
      try {
        await expectError(
          () =>
            evaluateWithRepair(
              input(async () => {}),
              async () => {
                calls++;
                const r = sample();
                if (privacy) r.general_feedback = 'Consulte Material privado.pdf';
                else r.evidence[0].quote = 'TRECHO PRIVADO INEXISTENTE';
                return r;
              },
            ),
          502,
          'Código: ' + (privacy ? 'privacy' : 'evidence'),
        );
        assert(calls === 2 && messages.length === 2);
        assert(
          messages.every(
            (message) =>
              !message.includes(text) &&
              !message.includes('TRECHO PRIVADO') &&
              !message.includes('Material privado'),
          ),
        );
        assert(
          messages.every((message) => JSON.parse(message).event === 'evaluation_validation_failed'),
        );
      } finally {
        console.warn = warn;
      }
    },
  );
}
Deno.test('orçamento é verificado antes do reparo e impede chamada extra', async () => {
  let calls = 0,
    budgets = 0;
  await expectError(
    () =>
      evaluateWithRepair(
        input(async () => {
          budgets++;
          if (budgets === 2) throw new HttpError(429, 'Limite diário.');
        }),
        async () => {
          calls++;
          return {};
        },
      ),
    429,
    'Limite diário.',
  );
  assert(calls === 1 && budgets === 2);
});
Deno.test(
  'erros da API e de conexão não repetem chamadas nem viram falhas de validação',
  async () => {
    for (const status of [401, 429, 502, 504]) {
      let calls = 0;
      await expectError(
        () =>
          evaluateWithRepair(
            input(async () => {}),
            async () => {
              calls++;
              throw new HttpError(status, 'Falha externa.');
            },
          ),
        status,
        'Falha externa.',
      );
      assert(calls === 1);
    }
    const connection = new TypeError('Falha de conexão');
    let received: unknown;
    try {
      await evaluateWithRepair(
        input(async () => {}),
        async () => {
          throw connection;
        },
      );
    } catch (error) {
      received = error;
    }
    assert(received === connection);
  },
);
Deno.test('JSON inválido admite apenas um reparo, ainda sujeito à validação', async () => {
  let calls = 0;
  const result = await evaluateWithRepair(
    input(async () => {}),
    async (prompt) => {
      calls++;
      if (calls === 1) throw new SyntaxError('JSON incorreto');
      assert(JSON.parse(prompt).repair.code === 'format');
      return sample();
    },
  );
  assert(calls === 2 && result.c2_score === 160);
});
