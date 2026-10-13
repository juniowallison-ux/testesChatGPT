import {
  context,
  body,
  failure,
  json,
  preflight,
  checkDb,
  HttpError,
  budget,
} from '../_shared/http.ts';
import { openai, openAIModel } from '../_shared/ai.ts';
import { normalizeEvaluation, responseSchema, systemPrompt } from '../_shared/evaluation.ts';
import { sha256, wrapEssay } from '../_shared/essay.ts';
Deno.serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  let cleanup: (() => Promise<void>) | null = null;
  try {
    const { admin, user, profile } = await context(req);
    const input = await body(req);
    if (typeof input.submission_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.submission_id))
      throw new HttpError(400, 'Identificador de redação inválido.');
    const refinement = input.refinement;
    if (
      refinement !== undefined &&
      (profile.role !== 'teacher' ||
        typeof refinement !== 'string' ||
        !refinement.trim() ||
        refinement.length > 2000)
    )
      throw new HttpError(403, 'Refinamento exclusivo da professora, com até 2.000 caracteres.');
    const { data: s, error: sError } = await admin
      .from('student_submissions')
      .select('*')
      .eq('id', input.submission_id)
      .single();
    if (sError || !s) throw new HttpError(404, 'Redação não encontrada.');
    if (profile.role !== 'teacher' && s.student_id !== profile.id)
      throw new HttpError(403, 'Você não tem acesso a esta redação.');
    const { data: existing, error: eError } = await admin
      .from('student_evaluations')
      .select('*')
      .eq('submission_id', s.id)
      .maybeSingle();
    checkDb(eError);
    if (existing && !refinement) return json({ evaluation: existing, cached: true });
    if (refinement && !existing) throw new HttpError(400, 'Crie uma avaliação antes de refiná-la.');
    const { data: claimed, error: claimError } = await admin.rpc('claim_evaluation', {
      p_submission_id: s.id,
    });
    checkDb(claimError);
    if (!claimed)
      throw new HttpError(409, 'Esta redação já está sendo avaliada. Aguarde e atualize a página.');
    cleanup = async () => {
      const { error } = await admin.from('evaluation_jobs').delete().eq('submission_id', s.id);
      if (error) console.error('Falha na liberação do trabalho de avaliação.');
    };
    const results = await Promise.all([
      admin
        .from('themes')
        .select('title,description,motivating_texts,instructions')
        .eq('id', s.theme_id)
        .single(),
      admin.from('orientacoes_ia').select('campo_nome,titulo,conteudo,ordem').order('ordem'),
      admin.from('documentos_apoio').select('title,content_text').eq('is_active', true).order('id'),
    ]);
    results.forEach((r) => checkDb(r.error));
    const theme = results[0].data;
    const guidance = results[1].data;
    const docs = results[2].data;
    const config = {
      version: 'enem-openai-v2',
      provider: 'openai',
      model: openAIModel(),
      text: s.reviewed_text,
      theme,
      guidance,
      docs,
      refinement: refinement || null,
      previous: refinement ? existing : null,
    };
    const serialized = JSON.stringify(config);
    if (serialized.length > 200000)
      throw new HttpError(
        413,
        'O contexto ativo está muito grande. Reduza os documentos de apoio ativos.',
      );
    const hash = await sha256(serialized);
    const { data: cached, error: cacheError } = await admin
      .from('evaluation_cache')
      .select('result')
      .eq('hash', hash)
      .maybeSingle();
    checkDb(cacheError);
    let evaluation = cached?.result;
    if (!evaluation) {
      await budget(admin, user.id);
      const privateNames = [
        ...docs!.map((d: { title: string }) => d.title),
        ...guidance!
          .filter((g: { campo_nome: string }) => g.campo_nome.includes('_'))
          .map((g: { campo_nome: string }) => g.campo_nome),
      ];
      const prompt = JSON.stringify({
        theme,
        guidance: guidance!.map((g: { campo_nome: string; conteudo: string }) => ({
          campo: g.campo_nome,
          orientacao: g.conteudo,
        })),
        support: docs!.map((d: { content_text: string }) => d.content_text),
        essay: wrapEssay(s.reviewed_text)
          .map((line, i) => `L${i + 1}: ${line}`)
          .join('\n'),
        previous: refinement ? existing : undefined,
        refinement: refinement || undefined,
      });
      try {
        evaluation = normalizeEvaluation(
          await openai(systemPrompt, [{ text: prompt }], responseSchema, {
            seed: parseInt(hash.slice(0, 8), 16) % 2147483647,
            schemaName: 'enem_evaluation',
          }),
          s.reviewed_text,
          privateNames,
        );
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          502,
          'A devolutiva não passou pela validação de formato, evidências ou privacidade. Nenhuma nota foi salva; tente novamente ou use a correção manual.',
        );
      }
      const { error } = await admin
        .from('evaluation_cache')
        .upsert({ hash, result: evaluation }, { onConflict: 'hash', ignoreDuplicates: true });
      checkDb(error);
    }
    const { error } = await admin.rpc('persist_evaluation', {
      p_submission_id: s.id,
      p_evaluation: evaluation,
      p_source: 'ai',
      p_hash: hash,
      p_allow_teacher_override: profile.role === 'teacher' && Boolean(refinement),
    });
    checkDb(error);
    return json({ evaluation, cached: Boolean(cached), evaluation_hash: hash });
  } catch (error) {
    return failure(error);
  } finally {
    if (cleanup) await cleanup();
  }
});
