import { describe, it, expect } from 'vitest';
import {
  wrapEssay,
  suspiciousLines,
  snapScore,
  sha256,
  parseJsonResponse,
  validEvidence,
  rtfEscape,
} from '../lib/essay';
describe('Régua de redação', () => {
  it('preserva palavras e respeita 80 caracteres para palavras usuais', () => {
    const words = Array(40).fill('argumentação');
    const text = words.join(' ');
    const lines = wrapEssay(text);
    expect(lines.every((l) => l.length <= 80)).toBe(true);
    expect(lines.join(' ')).toBe(text);
  });
  it('mantém parágrafos separados e normaliza CRLF', () =>
    expect(wrapEssay('Primeiro parágrafo.\r\n\r\nSegundo parágrafo.')).toEqual([
      'Primeiro parágrafo.',
      'Segundo parágrafo.',
    ]));
  it('não fragmenta uma palavra maior que a régua', () =>
    expect(wrapEssay('a'.repeat(90))).toEqual(['a'.repeat(90)]));
  it('detecta quebra curta sem pontuação forte', () =>
    expect(suspiciousLines('Uma linha curta\ncontinua aqui.\n\nNovo parágrafo.')).toEqual([1]));
  it('não marca fim de parágrafo ou pontuação forte', () =>
    expect(suspiciousLines('Parágrafo curto\n\nOutra frase.\nMais uma.')).toEqual([]));
});
describe('Validação ENEM e evidências', () => {
  it.each([
    [0, 0],
    [19, 0],
    [20, 40],
    [159, 160],
    [180, 200],
    [500, 200],
    [-30, 0],
  ])('normaliza %s para %s', (input, output) => expect(snapScore(input)).toBe(output));
  it('rejeita nota não finita', () => expect(() => snapScore(NaN)).toThrow());
  it('aceita apenas citação literal na linha existente', () => {
    expect(validEvidence('A educação é um direito.', { quote: 'educação', line: 1 })).toBe(true);
    expect(validEvidence('A educação é um direito.', { quote: 'educação', line: 2 })).toBe(false);
    expect(validEvidence('A educação é um direito.', { quote: 'saúde', line: 1 })).toBe(false);
    expect(validEvidence('texto', { quote: '', line: 1 })).toBe(false);
  });
  it('gera SHA-256 estável e sensível a mudanças de contexto', async () => {
    const a = await sha256('texto+orientação');
    expect(a).toHaveLength(64);
    expect(await sha256('texto+orientação')).toBe(a);
    expect(await sha256('texto+outra orientação')).not.toBe(a);
  });
  it('parseia JSON estruturado e fallback markdown', () => {
    expect(parseJsonResponse('```json\n{"nota":160}\n```')).toEqual({ nota: 160 });
    expect(parseJsonResponse('Resposta: {"nota":200}')).toEqual({ nota: 200 });
    expect(() => parseJsonResponse('sem JSON')).toThrow();
  });
  it('exporta Unicode e escapa caracteres RTF, inclusive pares substitutos', () => {
    expect(rtfEscape('ação')).toBe('a\\u231?\\u227?o');
    expect(rtfEscape('{x}\\\n')).toBe('\\{x\\}\\\\\\par\n');
    expect(rtfEscape('😀')).toBe('\\u-10179?\\u-8704?');
  });
});
