import { rtfEscape, wrapEssay } from './essay';
import { competencyNames, type Evaluation, type Submission } from './types';
export function reportText(
  submission: Submission,
  e: Evaluation,
  name: string,
  theme: string,
): string {
  return [
    `PAPEL E TINTA • Professora Andréa`,
    `Aluno: ${name}`,
    `Tema: ${theme}`,
    `Nota total: ${e.total_score}/1000`,
    `Avaliação: ${e.source === 'example' ? 'Exemplo demonstrativo' : e.source === 'teacher' ? 'Revisada pela professora' : 'Inteligência artificial'}`,
    '',
    'REDAÇÃO',
    ...wrapEssay(submission.reviewed_text).map((line, i) => `L${i + 1}: ${line}`),
    '',
    'DEVOLUTIVA',
    e.general_feedback,
    ...competencyNames.flatMap((n, i) => [
      `\nC${i + 1} — ${n}: ${e[`c${i + 1}_score` as keyof Evaluation]}/200`,
      String(e[`c${i + 1}_comment` as keyof Evaluation]),
    ]),
    '',
    'PONTOS FORTES',
    ...e.strengths.map((s) => `• ${s}`),
    '',
    'PRÓXIMOS PASSOS',
    ...e.improvements.map((s) => `• ${s}`),
    '',
    'PROPOSTA DE INTERVENÇÃO',
    ...Object.entries(e.intervention).map(([k, v]) => `${k}: ${v || 'Não identificado'}`),
  ].join('\n');
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportRtf(reports: string[]) {
  download(
    new Blob(
      [
        `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Georgia;}}\\uc1\\f0\\fs24\n${reports.map(rtfEscape).join('\\page\n')}}`,
      ],
      { type: 'application/rtf' },
    ),
    'correcoes-papel-e-tinta.rtf',
  );
}
export async function exportPdf(reports: string[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let page = 1;
  for (let r = 0; r < reports.length; r++) {
    if (r) {
      doc.addPage();
      page++;
    }
    let y = 20;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    for (const raw of reports[r].split('\n')) {
      const lines = doc.splitTextToSize(raw.replaceAll('•', '—'), 172) as string[];
      for (const line of lines) {
        if (y > 277) {
          doc.setFontSize(9);
          doc.text(String(page), 190, 288);
          doc.addPage();
          page++;
          y = 20;
          doc.setFontSize(11);
        }
        doc.text(line, 19, y);
        y += 5.8;
      }
    }
    doc.setFontSize(9);
    doc.text(String(page), 190, 288);
  }
  doc.save('correcoes-papel-e-tinta.pdf');
}
