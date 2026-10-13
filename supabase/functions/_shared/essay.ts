/** Uma única régua, usada pelo navegador, pelas funções e pelas exportações. */
export function wrapEssay(text: string, width = 80): string[] {
  const lines: string[] = [];
  for (const paragraph of text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((p) => p.trim())) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && line.length + word.length + 1 > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
  }
  return lines;
}
export function suspiciousLines(text: string): number[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return lines.flatMap((line, i) =>
    line.trim().length > 0 &&
    line.trim().length < 120 &&
    !/[.!?;:][”"')\]]?$/.test(line.trim()) &&
    Boolean(lines[i + 1]?.trim())
      ? [i + 1]
      : [],
  );
}
export function snapScore(score: number): number {
  if (!Number.isFinite(score)) throw new Error('Nota inválida.');
  return Math.max(0, Math.min(200, Math.round(score / 40) * 40));
}
export async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}
export function parseJsonResponse(raw: string): unknown {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('A IA não retornou um JSON válido.');
    return JSON.parse(clean.slice(start, end + 1));
  }
}
export function validEvidence(text: string, evidence: { quote: string; line: number }): boolean {
  return (
    evidence.quote.trim().length > 0 &&
    text.includes(evidence.quote) &&
    Number.isInteger(evidence.line) &&
    Boolean(wrapEssay(text)[evidence.line - 1]?.includes(evidence.quote))
  );
}
export function rtfEscape(text: string): string {
  return [...text]
    .map((char) => {
      if (char === '\\' || char === '{' || char === '}') return '\\' + char;
      if (char === '\n') return '\\par\n';
      if (char.charCodeAt(0) < 128) return char;
      let out = '';
      for (let i = 0; i < char.length; i++) {
        const n = char.charCodeAt(i);
        out += `\\u${n > 32767 ? n - 65536 : n}?`;
      }
      return out;
    })
    .join('');
}
