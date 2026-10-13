import { supabase, isDemo } from './supabase';
import { saveDemo } from './demo';
import type { Data, Profile, Evaluation, Submission } from './types';
const tables: Record<keyof Data, string> = {
  profiles: 'profiles',
  turmas: 'turmas',
  themes: 'themes',
  codes: 'access_codes',
  guidance: 'orientacoes_ia',
  docs: 'documentos_apoio',
  submissions: 'student_submissions',
  evaluations: 'student_evaluations',
};
export async function fetchData(): Promise<Data> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const results = await Promise.all(
    Object.entries(tables).map(async ([key, table]) => {
      const { data, error } = await supabase!.from(table).select('*');
      if (error) throw error;
      return [key, data ?? []];
    }),
  );
  return Object.fromEntries(results) as Data;
}
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase!
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error)
    throw new Error(
      'Não foi possível carregar seu perfil. Confirme o cadastro e as migrações do Supabase.',
    );
  return data;
}
export async function mutate<K extends keyof Data>(
  data: Data,
  key: K,
  item: Data[K][number],
  update = false,
): Promise<Data> {
  if (isDemo) {
    const list = data[key] as { id: string }[];
    const next = {
      ...data,
      [key]: update
        ? list.map((row) => (row.id === (item as { id: string }).id ? item : row))
        : [...list, item],
    };
    saveDemo(next);
    return next;
  }
  const table = tables[key];
  const payload = { ...item } as Record<string, unknown>;
  if (key === 'profiles' && update) {
    const p = item as Profile;
    const { error } = await supabase!
      .from(table)
      .update({ full_name: p.full_name, turma_id: p.turma_id })
      .eq('id', p.id);
    if (error) throw error;
    return fetchData();
  }
  if (key === 'submissions' && update) {
    const s = item as Submission;
    const { error } = await supabase!
      .from(table)
      .update({
        student_message: s.student_message,
        message_read_by_teacher: s.message_read_by_teacher,
      })
      .eq('id', s.id);
    if (error) throw error;
    return fetchData();
  }
  if (key === 'evaluations') {
    await saveManualEvaluation(item as Evaluation);
    return fetchData();
  }
  const { error } = update
    ? await supabase!.from(table).update(payload).eq('id', payload.id)
    : await supabase!.from(table).insert(payload);
  if (error) throw error;
  return fetchData();
}
export async function saveManualEvaluation(e: Evaluation) {
  const { error } = await supabase!.rpc('save_manual_evaluation', {
    p_submission_id: e.submission_id,
    p_evaluation: e,
  });
  if (error) throw error;
}
export async function saveSubmission(data: Data, s: Submission): Promise<Data> {
  return mutate(data, 'submissions', s);
}
export async function evaluateEssay(submissionId: string, feedback?: string): Promise<void> {
  if (!supabase)
    throw new Error(
      'A IA real exige uma conexão Supabase. No modo de demonstração, use a correção manual.',
    );
  const { data, error } = await supabase.functions.invoke('evaluate-student-essay', {
    body: { submission_id: submissionId, refinement: feedback || undefined },
  });
  if (error) {
    let message =
      'Não foi possível obter a avaliação. Tente novamente ou peça uma correção manual.';
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
}
export async function uploadFile(file: File, userId: string): Promise<string> {
  if (!supabase) throw new Error('Uploads reais precisam da conexão Supabase.');
  if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.');
  const path = `${userId}/${crypto.randomUUID()}.${file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'}`;
  const { error } = await supabase.storage.from('uploads').upload(path, file);
  if (error) throw error;
  return path;
}
export async function extractOcr(filePath: string): Promise<string> {
  const { data, error } = await supabase!.functions.invoke('ocr-extract', {
    body: { file_path: filePath },
  });
  if (error) {
    let message = 'Não foi possível transcrever o arquivo.';
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (!data?.text) throw new Error('Nenhum texto foi identificado.');
  return data.text;
}
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase!.storage.from('uploads').createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  if (pdf.numPages > 100) throw new Error('O documento deve ter até 100 páginas.');
  for (let page = 1; page <= pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  const text = pages.join('\n\n');
  if (!text.trim())
    throw new Error('PDF sem camada de texto. Cole a transcrição ou use um PDF pesquisável.');
  return text;
}
