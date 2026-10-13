import { normalizeEvaluation } from './evaluation.ts';
const text =
  'O Ministério deve ampliar o apoio por repasses, para reduzir a evasão, com acompanhamento público.';
function sample() {
  return {
    competencies: Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      score: 159,
      comment: 'Boa estrutura.',
    })),
    general_feedback: 'Continue praticando.',
    strengths: ['Clareza.'],
    improvements: ['Aprofunde.'],
    evidence: [{ quote: 'O Ministério', line: 1, comment: 'Agente identificado.', competency: 5 }],
    intervention: {
      agente: 'O Ministério',
      acao: 'ampliar o apoio',
      meio: 'por repasses',
      efeito: 'para reduzir a evasão',
      detalhamento: 'com acompanhamento público',
    },
    zero_reason: null,
  };
}
function assert(value: boolean) {
  if (!value) throw new Error('Verificação falhou.');
}
function mustReject(value: unknown, names: string[] = []) {
  let rejected = false;
  try {
    normalizeEvaluation(value, text, names);
  } catch {
    rejected = true;
  }
  assert(rejected);
}
Deno.test('cinco notas são normalizadas e o DTO não contém campos internos', () => {
  const r = normalizeEvaluation(sample(), text);
  assert(r.c1_score === 160 && r.c5_score === 160);
  assert(!('competencies' in r));
});
Deno.test('evidência inventada é rejeitada', () => {
  const r = sample();
  r.evidence[0].quote = 'O governo estadual';
  mustReject(r);
});
Deno.test('linha inexistente é rejeitada', () => {
  const r = sample();
  r.evidence[0].line = 99;
  mustReject(r);
});
Deno.test('competências repetidas são rejeitadas', () => {
  const r = sample();
  r.competencies[4].number = 1;
  mustReject(r);
});
Deno.test('elemento C5 sem citação literal é rejeitado', () => {
  const r = sample();
  r.intervention.meio = 'por campanhas';
  mustReject(r);
});
Deno.test('nome privado e instruções internas não vazam', () => {
  const r = sample();
  r.general_feedback = 'Consulte Método secreto.pdf';
  mustReject(r, ['Método secreto.pdf']);
  r.general_feedback = 'Segundo as orientações internas da professora';
  mustReject(r);
});
Deno.test('comentários não podem apontar linha inexistente', () => {
  const r = sample();
  r.general_feedback = 'Na linha 100 há um desvio.';
  mustReject(r);
});
Deno.test('anulação justificada zera as cinco competências', () => {
  const r = { ...sample(), zero_reason: 'Fuga total ao tema.' };
  const normalized = normalizeEvaluation(r, text);
  assert([1, 2, 3, 4, 5].every((n) => normalized[`c${n}_score`] === 0));
});
