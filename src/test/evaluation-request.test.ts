import { beforeEach, describe, expect, it, vi } from 'vitest';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke } },
  isDemo: false,
}));
import { evaluateEssay } from '../lib/store';

describe('Chamada da correção', () => {
  beforeEach(() => invoke.mockReset());
  it('envia o identificador e aceita as cinco competências', async () => {
    invoke.mockResolvedValue({
      data: {
        evaluation: { c1_score: 0, c2_score: 160, c3_score: 160, c4_score: 160, c5_score: 200 },
      },
      error: null,
    });
    await evaluateEssay('redacao-1');
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith(
      'evaluate-student-essay',
      expect.objectContaining({
        body: { submission_id: 'redacao-1', refinement: undefined },
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it('preserva o motivo da OpenAI e o código HTTP', async () => {
    invoke.mockResolvedValue({
      error: {
        context: new Response(JSON.stringify({ error: 'A API da OpenAI está sem créditos.' }), {
          status: 429,
        }),
      },
    });
    await expect(evaluateEssay('redacao-1')).rejects.toThrow(
      'A API da OpenAI está sem créditos. (HTTP 429)',
    );
  });
  it('também mostra mensagens do gateway do Supabase', async () => {
    invoke.mockResolvedValue({
      error: { context: new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 }) },
    });
    await expect(evaluateEssay('redacao-1')).rejects.toThrow('Invalid JWT (HTTP 401)');
  });
  it('não considera uma resposta vazia ou incompleta uma correção concluída', async () => {
    for (const data of [null, {}, { evaluation: { c1_score: 160 } }]) {
      invoke.mockResolvedValue({ data, error: null });
      await expect(evaluateEssay('redacao-1')).rejects.toThrow('sem uma avaliação completa');
    }
  });
  it('identifica falta de conexão sem expor o erro bruto', async () => {
    invoke.mockResolvedValue({
      error: { name: 'FunctionsFetchError', context: new Error('Detalhes internos') },
    });
    await expect(evaluateEssay('redacao-1')).rejects.toThrow(
      'Não foi possível conectar à função de correção.',
    );
  });
  it('orienta a consultar o resultado após expirar o tempo de espera', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    try {
      invoke.mockImplementation(async () => {
        controller.abort();
        return { error: { name: 'FunctionsFetchError' } };
      });
      await expect(evaluateEssay('redacao-1')).rejects.toThrow('Atualizar resultado');
      expect(timeout).toHaveBeenCalledWith(115000);
    } finally {
      timeout.mockRestore();
    }
  });
});
