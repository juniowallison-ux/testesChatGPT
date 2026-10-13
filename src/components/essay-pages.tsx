import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  PenLine,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Download,
  MessageSquare,
  Send,
  LoaderCircle,
  Save,
  TrendingUp,
  FileText,
  Check,
  Pencil,
  Eye,
} from 'lucide-react';
import { Button, Modal, Tabs } from './ui';
import { errorMessage } from '../lib/errors';
import { useApp } from '../lib/context';
import { PageHeading, Empty, EssayTable, StatusBadge } from './dashboard';
import { wrapEssay, suspiciousLines, snapScore } from '../lib/essay';
import { competencyNames, type Evaluation, type Submission } from '../lib/types';
import { evaluateEssay, extractOcr, uploadFile } from '../lib/store';
import { reportText, exportPdf, exportRtf } from '../lib/export';
export function StudentDashboard() {
  const { data, profile, startEssay, navigate, demo } = useApp();
  const rows = data.submissions.filter((s) => s.student_id === profile.id);
  const es = data.evaluations.filter((e) => rows.some((s) => s.id === e.submission_id));
  const turma = data.turmas.find((t) => t.id === profile.turma_id);
  const available = data.themes.filter((t) => t.active && !rows.some((s) => s.theme_id === t.id));
  return (
    <>
      <PageHeading
        eyebrow="UM NOVO CAPÍTULO COMEÇA AQUI"
        title={`Olá, ${profile.full_name.split(' ')[0]}.`}
        description="Suas ideias têm lugar no papel. Vamos dar o próximo passo?"
      />
      <div className="student-welcome">
        <span className="eyebrow">{turma?.name || 'Sua turma'} · PROFESSORA ANDRÉA</span>
        <h2>
          A escrita melhora
          <br />
          quando você <em>continua.</em>
        </h2>
        <p>Explore uma proposta, organize seus argumentos e transforme ideias em uma redação.</p>
        <Button onClick={() => (available[0] ? startEssay(available[0].id) : navigate('themes'))}>
          Escolher um tema <ArrowRight size={16} />
        </Button>
        <PenLine className="student-welcome-art" size={140} />
      </div>
      {demo && (
        <div className="notice">
          <Eye size={18} />
          Demonstração com dados locais. As devolutivas de exemplo não foram geradas por IA.
        </div>
      )}
      <div className="stats-grid student-stats">
        <div className="stat-card">
          <span>Minhas redações</span>
          <strong>{rows.length}</strong>
          <small>Uma prática que transforma</small>
          <FileText className="stat-float" />
        </div>
        <div className="stat-card">
          <span>Minha melhor nota</span>
          <strong>{es.length ? Math.max(...es.map((e) => e.total_score)) : '—'}</strong>
          <small>De até 1.000 pontos</small>
          <TrendingUp className="stat-float" />
        </div>
        <div className="stat-card">
          <span>Temas para escrever</span>
          <strong>{available.length}</strong>
          <small>Novas oportunidades de aprender</small>
          <BookOpen className="stat-float" />
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Minha trajetória</h2>
            <p>Cada texto mostra um pouco da sua evolução.</p>
          </div>
          <button className="text-link" onClick={() => navigate('themes')}>
            Explorar temas <ArrowRight size={15} />
          </button>
        </div>
        <EssayTable rows={rows} compact />
      </section>
    </>
  );
}
export function EssayEditor({
  direct = false,
  themeId,
}: {
  direct?: boolean;
  themeId?: string | null;
}) {
  const { data, profile, demo, busy, run, save, refresh, notify, openResult, navigate } = useApp();
  const [selectedTheme, setSelectedTheme] = useState(
    themeId || data.themes.find((t) => t.active)?.id || '',
  );
  const draftKey = `papel-draft-${profile.id}-${direct ? 'direct' : selectedTheme}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(draftKey) || '';
    } catch {
      return '';
    }
  });
  const [tab, setTab] = useState('type');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [ocrOriginal, setOcrOriginal] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const overlayRef = useRef<HTMLPreElement>(null);
  const theme = data.themes.find((t) => t.id === selectedTheme);
  const suspicious = suspiciousLines(text);
  const logicalLines = wrapEssay(text);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, text);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [draftKey, text]);
  const alreadySent =
    !direct &&
    data.submissions.some((s) => s.student_id === profile.id && s.theme_id === selectedTheme);
  const sendBlockReason = busy
    ? 'Aguarde a operação em andamento.'
    : !theme
      ? data.themes.length === 0
        ? 'Cadastre um tema antes de salvar a redação.'
        : 'Selecione o tema da redação no campo acima.'
      : !text.trim()
        ? 'Digite ou cole a redação para continuar.'
        : alreadySent
          ? 'Você já enviou uma redação para este tema.'
          : extracted && !reviewed
            ? 'Confirme a revisão do texto extraído antes de enviar.'
            : '';
  async function submit() {
    if (alreadySent) throw new Error('Você já enviou uma redação para este tema.');
    if (extracted && !reviewed) throw new Error('Revise o texto extraído antes de enviar.');
    if (!text.trim() || !theme) throw new Error('Escolha um tema e escreva sua redação.');
    const submission: Submission = {
      id: crypto.randomUUID(),
      student_id: profile.id,
      theme_id: selectedTheme,
      original_text: extracted ? ocrOriginal : text,
      reviewed_text: text,
      file_url: filePath,
      ocr_review_confirmed: extracted && reviewed,
      status: 'pending',
      student_message: null,
      message_read_by_teacher: false,
      created_at: new Date().toISOString(),
    };
    await save('submissions', submission);
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setConfirm(false);
    openResult(submission);
    notify(
      demo
        ? 'Redação salva localmente. A professora pode corrigir manualmente.'
        : 'Redação enviada.',
    );
    if (!demo && !direct) {
      try {
        await evaluateEssay(submission.id);
        await refresh();
        notify('Redação avaliada. Sua devolutiva está disponível.');
      } catch (error) {
        notify(errorMessage(error, 'Avaliação pendente. Você pode tentar novamente.'), true);
      }
    }
  }
  async function ocr(file: File) {
    if (demo)
      throw new Error(
        'OCR real exige Supabase e uma chave de IA. A demonstração permite digitar e revisar o texto.',
      );
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type))
      throw new Error('Use JPG, PNG ou PDF.');
    const path = await uploadFile(file, profile.user_id);
    const transcription = await extractOcr(path);
    setFilePath(path);
    setText(transcription);
    setOcrOriginal(transcription);
    setExtracted(true);
    setReviewed(false);
    notify('Texto extraído. Revise toda a transcrição antes de enviar.');
  }
  return (
    <>
      <button className="back-link" onClick={() => navigate(direct ? 'dashboard' : 'themes')}>
        <ArrowLeft size={15} />
        Voltar
      </button>
      <PageHeading
        eyebrow={direct ? 'SEU OLHAR, NO DETALHE' : 'HORA DE COLOCAR AS IDEIAS NO PAPEL'}
        title={direct ? 'Correção direta' : 'Sua nova redação'}
        description={
          direct
            ? 'Cole um texto, avalie por IA ou construa sua própria devolutiva.'
            : 'Escreva com calma. Seu rascunho é salvo neste navegador.'
        }
      />
      <div className="editor-layout">
        <section className="panel editor-panel">
          <div className="editor-theme-selector">
            <label>
              Tema da redação
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                disabled={!direct}
                aria-describedby={!theme ? 'essay-theme-help' : undefined}
              >
                <option value="">Escolha um tema</option>
                {data.themes
                  .filter((t) => direct || t.active)
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {!theme && (
            <div className="notice editor-theme-notice" id="essay-theme-help" role="status">
              <AlertTriangle size={20} />
              <div>
                <strong>
                  {data.themes.length === 0
                    ? 'Cadastre o tema da proposta'
                    : 'Escolha o tema da proposta'}
                </strong>
                <p>
                  {data.themes.length === 0
                    ? 'A correção precisa do tema para avaliar se a redação atende à proposta. Seu rascunho fica salvo neste navegador.'
                    : 'Selecione o tema no campo acima para liberar o envio da redação.'}
                </p>
                {profile.role === 'teacher' && data.themes.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => navigate('themes')}>
                    Cadastrar primeiro tema <BookOpen size={15} />
                  </Button>
                )}
              </div>
            </div>
          )}
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'type', label: 'Digitar ou colar texto' },
              { value: 'ocr', label: 'Enviar foto ou PDF' },
            ]}
          >
            {tab === 'ocr' && (
              <div className="upload-area">
                <Upload size={28} />
                <h3>Sua redação, do papel para a tela.</h3>
                <p>Envie uma foto legível ou PDF de até 10 MB.</p>
                <label className="btn btn-outline file-choose">
                  Selecionar arquivo
                  <input
                    aria-label="Enviar arquivo para OCR"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    disabled={busy || demo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void run(() => ocr(f));
                    }}
                  />
                </label>
                {demo && (
                  <small>
                    Disponível após conectar Supabase e IA. Você pode digitar o texto abaixo.
                  </small>
                )}
              </div>
            )}
            <div className="essay-editor-wrap">
              <pre ref={overlayRef} className="essay-overlay" aria-hidden="true">
                {text ? (
                  text.split('\n').map((line, i) => (
                    <span key={i} className={suspicious.includes(i + 1) ? 'suspicious-line' : ''}>
                      {line || ' '}
                      {'\n'}
                    </span>
                  ))
                ) : (
                  <span className="editor-placeholder">
                    Comece pela sua ideia principal. O resto ganha forma, uma palavra de cada vez…
                  </span>
                )}
              </pre>
              <textarea
                aria-label="Texto da redação"
                className="essay-textarea"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (extracted) setReviewed(false);
                }}
                onScroll={(e) => {
                  if (overlayRef.current)
                    overlayRef.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`;
                }}
                maxLength={16000}
                spellCheck
                lang="pt-BR"
              />
            </div>
          </Tabs>
          <div className="editor-counter">
            <span>
              <Save size={13} />
              {storageError ? 'Armazenamento local indisponível' : 'Rascunho salvo neste navegador'}
            </span>
            <span>
              {words} palavras <i>·</i> {logicalLines.length} linhas de referência
            </span>
          </div>
          {suspicious.length > 0 && (
            <div className="notice notice-amber">
              <AlertTriangle size={20} />
              <span>
                Possíveis quebras acidentais nas linhas de entrada {suspicious.join(', ')}. Linhas
                curtas sem pontuação estão sublinhadas em âmbar. Confira se pertencem ao mesmo
                parágrafo.
              </span>
            </div>
          )}
          {extracted && (
            <div className="ocr-review">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                Revisei toda a transcrição e confirmo que corresponde à minha redação.
              </label>
            </div>
          )}
          <div className="editor-bottom">
            <p id="essay-send-help" role={sendBlockReason ? 'status' : undefined}>
              {sendBlockReason ||
                (direct
                  ? 'Salve o texto e, na próxima tela, escolha avaliar com IA ou corrigir manualmente.'
                  : 'Confira seu texto antes de enviar. O envio por tema é único.')}
            </p>
            <Button
              disabled={Boolean(sendBlockReason)}
              aria-describedby="essay-send-help"
              onClick={() => setConfirm(true)}
            >
              {direct ? 'Salvar para corrigir' : 'Enviar redação'}
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
        <aside className="editor-aside">
          <section className="panel">
            <span className="eyebrow">A PROPOSTA</span>
            <h3>{theme?.title || 'Selecione um tema'}</h3>
            <p>{theme?.description}</p>
            <details>
              <summary>Textos motivadores</summary>
              <p className="preserve-lines">{theme?.motivating_texts}</p>
            </details>
            <details open>
              <summary>Instruções</summary>
              <p>{theme?.instructions}</p>
            </details>
          </section>
          <section className="writing-tip">
            <PenLine size={23} />
            <h3>Antes de enviar…</h3>
            <ul>
              <li>Sua tese está clara?</li>
              <li>Os argumentos estão desenvolvidos?</li>
              <li>Há conexão entre os parágrafos?</li>
              <li>A intervenção tem os cinco elementos?</li>
              <li>Você revisou a pontuação?</li>
            </ul>
            <small>
              A régua de referência preserva palavras e organiza o texto em linhas de
              aproximadamente 80 caracteres.
            </small>
          </section>
        </aside>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Pronto para o próximo passo?"
        description="Confira o tema e o texto. Após o envio, o aluno não pode substituir a redação."
      >
        <p>
          <strong>{theme?.title}</strong>
        </p>
        <p className="muted">
          {words} palavras · {logicalLines.length} linhas de referência.
        </p>
        {demo && (
          <div className="notice">
            Esta redação será salva apenas na demonstração local, sem chamada à IA.
          </div>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Continuar revisando
          </Button>
          <Button disabled={busy} onClick={() => void run(submit)}>
            Confirmar envio <Send size={15} />
          </Button>
        </div>
      </Modal>
    </>
  );
}
function emptyEvaluation(s: Submission): Evaluation {
  return {
    id: crypto.randomUUID(),
    submission_id: s.id,
    theme_id: s.theme_id,
    evaluation_hash: null,
    c1_score: 0,
    c2_score: 0,
    c3_score: 0,
    c4_score: 0,
    c5_score: 0,
    total_score: 0,
    c1_comment: '',
    c2_comment: '',
    c3_comment: '',
    c4_comment: '',
    c5_comment: '',
    general_feedback: '',
    strengths: [],
    improvements: [],
    evidence: [],
    intervention: { agente: null, acao: null, meio: null, efeito: null, detalhamento: null },
    zero_reason: null,
    source: 'teacher',
    created_at: new Date().toISOString(),
  };
}
export function EvaluationPage({ submissionId }: { submissionId: string }) {
  const { data, profile, demo, busy, run, save, refresh, notify, navigate } = useApp();
  const s = data.submissions.find((s) => s.id === submissionId);
  const evaluation = data.evaluations.find((e) => e.submission_id === submissionId);
  const teacher = profile.role === 'teacher';
  const [active, setActive] = useState(0);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState('');
  const [refinement, setRefinement] = useState('');
  const [chat, setChat] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [evaluationError, setEvaluationError] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  useEffect(() => {
    setEvaluationError('');
  }, [submissionId]);
  useEffect(() => {
    if (evaluation) setEvaluationError('');
  }, [evaluation]);
  if (!s)
    return (
      <Empty
        title="Redação não encontrada"
        description="Volte à lista de redações para tentar novamente."
      />
    );
  const theme = data.themes.find((t) => t.id === s.theme_id);
  const student = data.profiles.find((p) => p.id === s.student_id);
  const lines = wrapEssay(s.reviewed_text);
  async function evaluate(instruction?: string) {
    setEvaluationError('');
    setEvaluating(true);
    try {
      await evaluateEssay(submissionId, instruction);
      try {
        await refresh();
      } catch {
        throw new Error(
          'A avaliação foi concluída, mas não foi possível carregar a devolutiva. Clique em “Atualizar resultado” para consultar a correção salva.',
        );
      }
      notify('Devolutiva concluída.');
      if (instruction) {
        setChat((prev) => [...prev, instruction]);
        setRefinement('');
      }
    } catch (error) {
      setEvaluationError(errorMessage(error, 'Não foi possível concluir a avaliação.'));
      throw error;
    } finally {
      setEvaluating(false);
    }
  }
  function updateDraft(key: keyof Evaluation, value: unknown) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : null));
  }
  async function download(format: 'pdf' | 'rtf') {
    if (!s || !evaluation) return;
    const report = reportText(
      s,
      evaluation,
      student?.full_name || 'Professora',
      theme?.title || '',
    );
    if (format === 'pdf') await exportPdf([report]);
    else exportRtf([report]);
    setExportOpen(false);
  }
  function submitManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    void run(async () => {
      const total = [
        draft.c1_score,
        draft.c2_score,
        draft.c3_score,
        draft.c4_score,
        draft.c5_score,
      ].reduce((a, b) => a + b, 0);
      if (draft.zero_reason && total !== 0)
        throw new Error('Avaliações anuladas devem ter todas as competências zeradas.');
      const result = {
        ...draft,
        total_score: total,
        evaluation_hash: null,
        source: 'teacher' as const,
        created_at: new Date().toISOString(),
      };
      await save('evaluations', result, !!evaluation);
      if (demo) await save('submissions', { ...s!, status: 'evaluated' }, true);
      setEdit(false);
      notify('Correção manual salva.');
    });
  }
  return (
    <>
      <button className="back-link" onClick={() => navigate('submissions')}>
        <ArrowLeft size={15} />
        Voltar às redações
      </button>
      <PageHeading
        eyebrow="CADA DEVOLUTIVA, UM NOVO CAMINHO"
        title="Um olhar sobre a sua escrita"
        description={theme?.title || 'Redação'}
        action={
          evaluation && (
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <Download size={16} />
              Exportar
            </Button>
          )
        }
      />
      <div className="result-meta">
        <span>{student?.full_name}</span>
        <span>{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
        <StatusBadge status={s.status} />
      </div>
      {evaluationError && (
        <div className="notice notice-amber evaluation-error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Não foi possível mostrar a correção</strong>
            <p>{evaluationError}</p>
            <p>
              A redação continua salva. Atualizar o resultado consulta os dados sem iniciar outra
              chamada à IA.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await refresh();
                  notify('Resultado consultado.');
                })
              }
            >
              Atualizar resultado
            </Button>
          </div>
        </div>
      )}
      {evaluation?.source === 'example' && (
        <div className="notice">
          <Eye size={18} />
          Devolutiva ilustrativa da demonstração. Não é uma avaliação produzida por IA.
        </div>
      )}
      <section className="panel numbered-essay">
        <div className="panel-heading">
          <div>
            <h2>Seu texto, em primeiro lugar.</h2>
            <p>A mesma numeração acompanha a avaliação e os arquivos exportados.</p>
          </div>
          <span className="badge badge-neutral">{lines.length} linhas</span>
        </div>
        <div className="essay-lines">
          {lines.map((line, i) => (
            <div key={i} className="essay-line" id={`line-${i + 1}`}>
              <span>L{i + 1}</span>
              <p>{line}</p>
            </div>
          ))}
        </div>
      </section>
      {!evaluation ? (
        <section className="panel pending-evaluation">
          <Sparkles size={29} />
          <h2>
            {evaluating ? 'Avaliando sua redação…' : 'Seu texto está pronto para um olhar atento.'}
          </h2>
          <p role={evaluating ? 'status' : undefined}>
            {evaluating
              ? 'Aguarde a resposta da IA. A nota aparecerá aqui quando a correção for concluída.'
              : demo
                ? 'A demonstração não chama a IA. Entre como professora para criar uma correção manual.'
                : 'Inicie a avaliação para receber a devolutiva detalhada por competência.'}
          </p>
          <div className="form-actions">
            {!demo && (
              <Button disabled={busy} onClick={() => void run(() => evaluate())}>
                {evaluating ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                {evaluating
                  ? 'Avaliando…'
                  : evaluationError
                    ? 'Tentar avaliar novamente'
                    : 'Avaliar com IA'}
              </Button>
            )}
            {teacher && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDraft(emptyEvaluation(s));
                  setEdit(true);
                }}
              >
                Corrigir manualmente <Pencil size={15} />
              </Button>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="evaluation-summary">
            <div className="total-score">
              <span className="eyebrow">NOTA TOTAL</span>
              <strong>
                {evaluation.total_score}
                <small>/1000</small>
              </strong>
              <p>
                {evaluation.zero_reason
                  ? 'Avaliação anulada'
                  : 'Seu próximo passo começa nesta devolutiva.'}
              </p>
              <span className="badge badge-blue">
                {evaluation.source === 'teacher'
                  ? 'Revisada pela professora'
                  : evaluation.source === 'example'
                    ? 'Exemplo demonstrativo'
                    : 'Avaliação com IA'}
              </span>
            </div>
            <div className="feedback-intro">
              <span className="eyebrow">COM O OLHAR DA PROFESSORA ANDRÉA</span>
              <h2>Você está construindo seu caminho.</h2>
              <p>{evaluation.general_feedback}</p>
              {evaluation.zero_reason && (
                <p className="form-error">Motivo de anulação: {evaluation.zero_reason}</p>
              )}
            </div>
          </div>
          <section className="panel competency-panel">
            <div className="panel-heading">
              <div>
                <h2>Competência por competência</h2>
                <p>Entenda seus pontos fortes e onde você pode avançar.</p>
              </div>
              {teacher && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft(structuredClone(evaluation));
                    setEdit(true);
                  }}
                >
                  <Pencil size={14} />
                  Editar correção
                </Button>
              )}
            </div>
            <div className="competency-tabs" role="tablist" aria-label="Competências ENEM">
              {competencyNames.map((name, i) => (
                <button
                  role="tab"
                  aria-selected={active === i}
                  aria-controls="competency-detail"
                  id={`competency-tab-${i}`}
                  className={active === i ? 'selected' : ''}
                  onClick={() => setActive(i)}
                  key={name}
                >
                  <span>C{i + 1}</span>
                  <strong>
                    {evaluation[`c${i + 1}_score` as keyof Evaluation] as number}
                    <small>/200</small>
                  </strong>
                  <em>{name}</em>
                </button>
              ))}
            </div>
            <div
              className="competency-detail"
              role="tabpanel"
              id="competency-detail"
              aria-labelledby={`competency-tab-${active}`}
            >
              <h3>
                C{active + 1} · {competencyNames[active]}
              </h3>
              <p>{String(evaluation[`c${active + 1}_comment` as keyof Evaluation])}</p>
              {evaluation.evidence
                .filter((e) => e.competency === active + 1)
                .map((e, i) => (
                  <blockquote key={i}>
                    <a href={`#line-${e.line}`}>L{e.line}</a> “{e.quote}”<p>{e.comment}</p>
                  </blockquote>
                ))}
              {active === 4 && (
                <div className="intervention-grid">
                  {Object.entries(evaluation.intervention).map(([key, value]) => (
                    <div key={key}>
                      <span>
                        {key === 'acao'
                          ? 'Ação'
                          : key === 'meio'
                            ? 'Meio / modo'
                            : key === 'efeito'
                              ? 'Efeito / finalidade'
                              : key === 'agente'
                                ? 'Agente'
                                : 'Detalhamento'}
                      </span>
                      <p>{value || 'Não identificado no texto'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          <div className="feedback-grid">
            <section className="panel feedback-card">
              <CheckCircle2 className="green-icon" size={24} />
              <h3>Continue fazendo</h3>
              <ul>
                {evaluation.strengths.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
            <section className="panel feedback-card">
              <TrendingUp className="blue-icon" size={24} />
              <h3>Seu próximo passo</h3>
              <ul>
                {evaluation.improvements.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          </div>
          {teacher ? (
            <section className="panel conversation">
              <h2>
                <Sparkles size={20} />
                Refinar com a IA
              </h2>
              <p className="muted">
                A conversa usa esta redação e a avaliação atual. A versão anterior é substituída
                após a validação.
              </p>
              {chat.map((m, i) => (
                <div className="chat-message" key={i}>
                  <strong>Seu pedido de refinamento</strong>
                  <p>{m}</p>
                  <span className="badge badge-green">Avaliação atualizada</span>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => evaluate(refinement));
                }}
              >
                <label>
                  Orientação contextual
                  <textarea
                    value={refinement}
                    onChange={(e) => setRefinement(e.target.value)}
                    maxLength={2000}
                    placeholder="Ex.: reavalie a produtividade do repertório citado na introdução…"
                    rows={3}
                    required
                    disabled={demo}
                  />
                </label>
                <Button disabled={demo || busy || !refinement.trim()}>
                  <Sparkles size={16} />
                  Refinar avaliação
                </Button>
                {demo && (
                  <small className="muted">
                    Disponível com Supabase e IA conectados. A edição manual funciona na
                    demonstração.
                  </small>
                )}
              </form>
            </section>
          ) : (
            <section className="panel conversation">
              <h2>
                <MessageSquare size={20} />
                Vamos conversar sobre sua redação?
              </h2>
              <p className="muted">
                Envie uma dúvida à professora. Até 500 caracteres, associada a esta redação.
              </p>
              {s.student_message ? (
                <div className="chat-message">
                  <p>{s.student_message}</p>
                  <span
                    className={`badge ${s.message_read_by_teacher ? 'badge-green' : 'badge-amber'}`}
                  >
                    {s.message_read_by_teacher ? 'Lida pela professora' : 'Enviada à professora'}
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await save(
                        'submissions',
                        { ...s, student_message: message.trim(), message_read_by_teacher: false },
                        true,
                      );
                      setMessage('');
                      notify('Sua dúvida foi enviada.');
                    });
                  }}
                >
                  <label>
                    Sua dúvida
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      minLength={1}
                      required
                      rows={3}
                      placeholder="O que você gostaria de entender melhor?"
                    />
                  </label>
                  <div className="form-actions">
                    <small className="muted">{message.length}/500 caracteres</small>
                    <Button disabled={busy || !message.trim()}>
                      <Send size={15} />
                      Enviar dúvida
                    </Button>
                  </div>
                </form>
              )}
            </section>
          )}
        </>
      )}
      <Modal
        open={edit}
        onOpenChange={setEdit}
        title="Seu olhar sobre a redação"
        description="As notas seguem os degraus oficiais de 40 pontos."
      >
        {draft && (
          <form className="form-stack" onSubmit={submitManual}>
            {competencyNames.map((n, i) => (
              <div className="manual-competency" key={n}>
                <label>
                  C{i + 1} · {n}
                  <select
                    value={Number(draft[`c${i + 1}_score` as keyof Evaluation])}
                    onChange={(e) =>
                      updateDraft(
                        `c${i + 1}_score` as keyof Evaluation,
                        snapScore(Number(e.target.value)),
                      )
                    }
                  >
                    {[0, 40, 80, 120, 160, 200].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Justificativa pedagógica
                  <textarea
                    required
                    maxLength={5000}
                    rows={3}
                    value={String(draft[`c${i + 1}_comment` as keyof Evaluation])}
                    onChange={(e) =>
                      updateDraft(`c${i + 1}_comment` as keyof Evaluation, e.target.value)
                    }
                  />
                </label>
              </div>
            ))}
            <label>
              Devolutiva geral
              <textarea
                required
                maxLength={5000}
                rows={4}
                value={draft.general_feedback}
                onChange={(e) => updateDraft('general_feedback', e.target.value)}
              />
            </label>
            <label>
              Pontos fortes (um por linha)
              <textarea
                rows={3}
                value={draft.strengths.join('\n')}
                onChange={(e) => updateDraft('strengths', e.target.value.split('\n'))}
              />
            </label>
            <label>
              Próximos passos (um por linha)
              <textarea
                rows={3}
                value={draft.improvements.join('\n')}
                onChange={(e) => updateDraft('improvements', e.target.value.split('\n'))}
              />
            </label>
            <h3>C5 · Elementos da intervenção</h3>
            {Object.entries(draft.intervention).map(([k, v]) => (
              <label key={k}>
                {
                  (
                    {
                      agente: 'Agente',
                      acao: 'Ação',
                      meio: 'Meio / modo',
                      efeito: 'Efeito',
                      detalhamento: 'Detalhamento',
                    } as Record<string, string>
                  )[k]
                }
                <input
                  value={v || ''}
                  maxLength={1500}
                  onChange={(e) =>
                    updateDraft('intervention', {
                      ...draft.intervention,
                      [k]: e.target.value || null,
                    })
                  }
                />
              </label>
            ))}
            <label>
              Motivo de anulação (se aplicável)
              <input
                value={draft.zero_reason || ''}
                maxLength={1000}
                onChange={(e) => updateDraft('zero_reason', e.target.value || null)}
              />
            </label>
            <div className="manual-total">
              Total:{' '}
              {[
                draft.c1_score,
                draft.c2_score,
                draft.c3_score,
                draft.c4_score,
                draft.c5_score,
              ].reduce((a, b) => a + b, 0)}{' '}
              / 1000
            </div>
            <Button disabled={busy}>
              Salvar devolutiva <Check size={16} />
            </Button>
          </form>
        )}
      </Modal>
      <Modal open={exportOpen} onOpenChange={setExportOpen} title="Guardar sua devolutiva">
        <p className="muted">O texto e a numeração de linhas serão incluídos no arquivo.</p>
        <div className="form-actions">
          <Button onClick={() => void run(() => download('pdf'))}>Baixar PDF</Button>
          <Button variant="outline" onClick={() => void run(() => download('rtf'))}>
            Baixar RTF
          </Button>
        </div>
      </Modal>
    </>
  );
}
