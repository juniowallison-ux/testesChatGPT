import { describe, expect, it } from 'vitest';
import { errorMessage } from '../lib/errors';
describe('Mensagens de falha do Supabase', () => {
  it('preserva o motivo do erro retornado como objeto simples', () => {
    expect(
      errorMessage(
        { message: 'Não foi possível salvar a redação.', code: '42501' },
        'Falha genérica',
      ),
    ).toBe('Não foi possível salvar a redação.');
  });
  it('preserva erros locais e não expõe os demais campos', () => {
    expect(errorMessage(new Error('Texto inválido.'), 'Falha genérica')).toBe('Texto inválido.');
    expect(
      errorMessage({ message: 'Falha ao salvar.', details: 'Dados privados' }, 'Falha genérica'),
    ).toBe('Falha ao salvar.');
  });
  it('usa mensagem padrão para objetos sem mensagem legível', () => {
    for (const error of [null, undefined, {}, { message: '' }, { message: 42 }])
      expect(errorMessage(error, 'Tente novamente.')).toBe('Tente novamente.');
  });
});
