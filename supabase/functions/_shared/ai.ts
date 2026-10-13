import { HttpError } from './http.ts';
import { parseJsonResponse } from './essay.ts';

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export function openAIModel(): string {
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';
  // Estes modelos suportam imagem/PDF, Structured Outputs, temperatura e seed.
  if (!/^gpt-4o(?:-mini)?(?:-\d{4}-\d{2}-\d{2})?$/.test(model))
    throw new HttpError(503, 'Configure OPENAI_MODEL com gpt-4o ou gpt-4o-mini compatível.');
  return model;
}

export function toOpenAIContent(parts: Part[]): ContentPart[] {
  return parts.map((part) => {
    if ('text' in part) return { type: 'text', text: part.text };
    const { mimeType, data } = part.inlineData;
    if (mimeType === 'application/pdf')
      return {
        type: 'file',
        file: { filename: 'redacao.pdf', file_data: `data:application/pdf;base64,${data}` },
      };
    if (!['image/jpeg', 'image/png'].includes(mimeType))
      throw new HttpError(400, 'Use JPG, PNG ou PDF para a transcrição.');
    return {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${data}`, detail: 'high' },
    };
  });
}

export async function openai(
  system: string,
  parts: Part[],
  schema: Record<string, unknown>,
  options: { seed?: number; schemaName?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new HttpError(503, 'Configure OPENAI_API_KEY nos segredos do Supabase.');
  const model = openAIModel();
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(options.timeoutMs ?? 100000),
      body: JSON.stringify({
        model,
        store: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: toOpenAIContent(parts) },
        ],
        temperature: 0.1,
        ...(options.seed === undefined ? {} : { seed: options.seed }),
        max_completion_tokens: 12000,
        response_format: {
          type: 'json_schema',
          json_schema: { name: options.schemaName || 'enem_evaluation', strict: true, schema },
        },
      }),
    });
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    throw new HttpError(
      timeout ? 504 : 502,
      timeout
        ? 'A OpenAI não respondeu no tempo esperado. Consulte o resultado salvo antes de tentar novamente.'
        : 'Não foi possível conectar à OpenAI. Tente novamente mais tarde.',
    );
  }
  if (!response.ok) {
    const message =
      response.status === 401
        ? 'A OpenAI recusou a chave. Verifique OPENAI_API_KEY nos segredos do Supabase.'
        : response.status === 429
          ? 'A API da OpenAI atingiu o limite ou está sem créditos. Verifique o faturamento da API.'
          : response.status === 400 || response.status === 404
            ? 'A OpenAI recusou a configuração. Verifique o modelo e o acesso da chave no painel da API.'
            : 'A OpenAI não conseguiu concluir a solicitação. Tente novamente mais tarde.';
    throw new HttpError(response.status === 429 ? 429 : 502, message);
  }
  const payload = await response.json();
  const candidate = payload.choices?.[0];
  if (candidate?.message?.refusal)
    throw new HttpError(
      422,
      'A IA não pôde avaliar este conteúdo. Solicite revisão da professora.',
    );
  if (candidate?.finish_reason !== 'stop')
    throw new HttpError(502, 'A IA não concluiu a resposta. Nenhuma avaliação parcial foi salva.');
  const text = candidate.message?.content;
  if (typeof text !== 'string' || !text.trim())
    throw new HttpError(502, 'A IA não retornou uma resposta legível.');
  return parseJsonResponse(text);
}
