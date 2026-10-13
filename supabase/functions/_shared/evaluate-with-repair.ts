import { openai } from './ai.ts';
import { HttpError } from './http.ts';
import {
  EvaluationValidationError,
  normalizeEvaluation,
  responseSchema,
  systemPrompt,
} from './evaluation.ts';

type Generator = (prompt: string, seed: number) => Promise<unknown>;
export async function evaluateWithRepair(
  input: {
    prompt: string;
    text: string;
    privateNames: string[];
    seed: number;
    beforeAttempt: () => Promise<void>;
  },
  generate: Generator = (prompt, seed) =>
    openai(systemPrompt, [{ text: prompt }], responseSchema, {
      seed,
      schemaName: 'enem_evaluation',
      timeoutMs: 45000,
    }),
) {
  let prompt = input.prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    // Cada chamada, inclusive o reparo, consome o limite diário.
    await input.beforeAttempt();
    let raw: unknown;
    try {
      raw = await generate(prompt, (input.seed + attempt) % 2147483647);
      return normalizeEvaluation(raw, input.text, input.privateNames);
    } catch (error) {
      const validation =
        error instanceof SyntaxError
          ? new EvaluationValidationError('format', 'A resposta não contém um JSON válido.')
          : error;
      // Falhas da API, de rede e de orçamento não iniciam uma segunda chamada.
      if (!(validation instanceof EvaluationValidationError)) throw error;
      // Nunca registrar o texto, os trechos, o contexto privado ou a resposta da IA.
      console.warn(
        JSON.stringify({
          event: 'evaluation_validation_failed',
          code: validation.code,
          attempt: attempt + 1,
        }),
      );
      if (attempt === 1)
        throw new HttpError(
          502,
          'A devolutiva não passou pela validação após uma tentativa de reparo. ' +
            validation.message +
            ' Nenhuma nota foi salva. Código: ' +
            validation.code +
            '.',
        );
      prompt = JSON.stringify({
        request: input.prompt,
        repair: {
          instruction:
            'Reavalie e retorne o JSON completo. Corrija a falha indicada, preservando a matriz ENEM. Copie as evidências exatamente das linhas fornecidas, use trechos curtos e não exponha contexto privado. Não invente evidências para satisfazer o formato.',
          code: validation.code,
          reason: validation.message,
          previous_response: raw ?? null,
        },
      });
    }
  }
  throw new Error('Avaliação não concluída.');
}
