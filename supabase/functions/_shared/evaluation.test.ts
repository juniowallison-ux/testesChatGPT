import { EvaluationValidationError, normalizeEvaluation } from './evaluation.ts';
import { literalQuote, validEvidence, wrapEssay } from './essay.ts';
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
function assert(value: boolean): asserts value {
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
Deno.test(
  'numeração errada é corrigida somente quando a citação identifica uma única linha',
  () => {
    const r = sample();
    r.evidence[0].line = 99;
    const normalized = normalizeEvaluation(r, text);
    const evidence = normalized.evidence as typeof r.evidence;
    assert(evidence[0].line === 1);
    assert(validEvidence(text, evidence[0]));
  },
);
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
Deno.test('espaços duplicados, tabulação e CRLF preservam os trechos corretos', () => {
  const source = text
    .replace('O Ministério', 'O \t Ministério')
    .replace('por repasses', 'por\r\nrepasses');
  const r = sample();
  const normalized = normalizeEvaluation(r, source);
  const evidence = normalized.evidence as typeof r.evidence;
  assert(evidence[0].quote === 'O Ministério' && validEvidence(source, evidence[0]));
  const intervention = normalized.intervention as typeof r.intervention;
  assert(intervention.agente === 'O \t Ministério');
  assert(intervention.meio === 'por\r\nrepasses');
  assert(Object.values(intervention).every((quote) => source.includes(quote)));
});
Deno.test('citação vazia, ambígua ou que cruza linhas continua sendo rejeitada', () => {
  const r = sample();
  r.evidence[0].quote = ' ';
  mustReject(r);
  r.evidence[0].quote = 'O Ministério';
  r.evidence[0].line = 99;
  let ambiguous = false;
  try {
    normalizeEvaluation(r, text + '\n' + text);
  } catch {
    ambiguous = true;
  }
  assert(ambiguous);
  r.evidence[0].quote = wrapEssay(text).join(' ');
  mustReject(r);
});
Deno.test('não modifica grafia ou pontuação para aceitar uma citação', () => {
  const r = sample();
  r.evidence[0].quote = 'O Ministerio';
  mustReject(r);
  r.evidence[0].quote = 'o Ministério';
  mustReject(r);
  r.intervention.meio = 'por repasses.';
  mustReject(r);
});
Deno.test('busca de trecho literal escapa metacaracteres e mantém a grafia original', () => {
  assert(
    literalQuote('Use (a+b) [x] R$ 20.00? e uma\\barra.', '(a+b) [x] R$ 20.00?') ===
      '(a+b) [x] R$ 20.00?',
  );
  assert(
    literalQuote('Uma\tfrase  com\nespaços.', 'Uma frase com espaços.') ===
      'Uma\tfrase  com\nespaços.',
  );
  assert(literalQuote('Use axb.', 'a+b') === null);
  assert(literalQuote('Uma frase.', ' ') === null);
});
Deno.test(
  'números de linha escritos pelo aluno não são confundidos com referências da devolutiva',
  () => {
    const source = 'O Ministério menciona linha 100 e deve ampliar o apoio por repasses.';
    const r = sample();
    r.evidence = [{ quote: 'linha 100', line: 1, comment: 'Trecho do texto.', competency: 5 }];
    r.intervention = {
      agente: 'O Ministério',
      acao: 'ampliar o apoio',
      meio: 'por repasses',
      efeito: null as unknown as string,
      detalhamento: null as unknown as string,
    };
    const result = normalizeEvaluation(r, source);
    assert(Boolean(result));
  },
);
Deno.test('erro de validação identifica a regra sem expor o trecho ou a resposta', () => {
  const r = sample();
  r.evidence[0].quote = 'TRECHO PRIVADO INEXISTENTE';
  try {
    normalizeEvaluation(r, text);
  } catch (error) {
    assert(error instanceof EvaluationValidationError && error.code === 'evidence');
    assert(!error.message.includes('TRECHO PRIVADO'));
    return;
  }
  throw new Error('Deveria rejeitar evidência inexistente.');
});
Deno.test('citação literal da redação não é tratada como vazamento das instruções', () => {
  const source = text + '\nO aluno menciona documentos de apoio como assunto da redação.';
  const r = sample();
  r.evidence = [
    { quote: 'documentos de apoio', line: 3, comment: 'Trecho do texto.', competency: 2 },
  ];
  const normalized = normalizeEvaluation(r, source);
  const evidence = normalized.evidence as typeof r.evidence;
  assert(validEvidence(source, evidence[0]));
  r.general_feedback = 'Consulte os documentos de apoio.';
  let rejected = false;
  try {
    normalizeEvaluation(r, source);
  } catch (error) {
    rejected = error instanceof EvaluationValidationError && error.code === 'privacy';
  }
  assert(rejected);
});
