import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  Users,
  TrendingUp,
  Clock3,
  Search,
  Download,
  BookOpen,
  MessageCircle,
  CheckCheck,
  PenLine,
  Plus,
} from 'lucide-react';
import { Button, Modal } from './ui';
import { useApp } from '../lib/context';
import { exportPdf, exportRtf, reportText } from '../lib/export';
import type { Submission } from '../lib/types';
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status === 'evaluated' ? 'badge-green' : 'badge-amber'}`}>
      {status === 'evaluated' ? <CheckCheck size={12} /> : <Clock3 size={12} />}{' '}
      {status === 'evaluated' ? 'Corrigida' : 'Aguardando correção'}
    </span>
  );
}
export function EssayTable({ rows, compact = false }: { rows: Submission[]; compact?: boolean }) {
  const { data, profile, openResult } = useApp();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{profile.role === 'teacher' ? 'ALUNO / TEMA' : 'TEMA'}</th>
            {!compact && <th>TURMA</th>}
            <th>ENVIO</th>
            <th>NOTA</th>
            <th>STATUS</th>
            <th>
              <span className="sr-only">Ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const student = data.profiles.find((p) => p.id === s.student_id);
            const theme = data.themes.find((t) => t.id === s.theme_id);
            const evaluation = data.evaluations.find((e) => e.submission_id === s.id);
            return (
              <tr key={s.id}>
                <td>
                  <div className="student-cell">
                    {profile.role === 'teacher' && (
                      <span className={`student-avatar color-${i % 4}`}>
                        {student?.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('') || 'PA'}
                      </span>
                    )}
                    <div>
                      <strong>
                        {profile.role === 'teacher'
                          ? student?.full_name || 'Correção direta'
                          : theme?.title}
                      </strong>
                      {profile.role === 'teacher' && (
                        <small title={theme?.title}>{theme?.title}</small>
                      )}
                    </div>
                  </div>
                </td>
                {!compact && (
                  <td className="muted">
                    {data.turmas.find((t) => t.id === student?.turma_id)?.name || 'Direta'}
                  </td>
                )}
                <td className="date-cell">
                  {new Date(s.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </td>
                <td>
                  <span className={evaluation ? 'score-value' : 'muted'}>
                    {evaluation?.total_score ?? '—'}
                  </span>
                  {evaluation && <span className="score-denominator"> / 1000</span>}
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td>
                  <button
                    className="table-action"
                    onClick={() => openResult(s)}
                    aria-label={`Abrir redação de ${student?.full_name || 'aluno'}`}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && (
        <Empty title="Nenhuma redação por aqui" description="Os envios aparecerão neste espaço." />
      )}
    </div>
  );
}
export function Dashboard() {
  const { data, navigate, profile } = useApp();
  const students = data.profiles.filter((p) => p.role === 'student');
  const essays = data.submissions.filter(
    (s) => data.profiles.find((p) => p.id === s.student_id)?.role === 'student',
  );
  const evaluations = data.evaluations.filter((e) => essays.some((s) => s.id === e.submission_id));
  const average = evaluations.length
    ? Math.round(evaluations.reduce((a, e) => a + e.total_score, 0) / evaluations.length)
    : 0;
  const pending = essays.filter((s) => s.status === 'pending').length;
  return (
    <>
      <PageHeading
        eyebrow="SEU OLHAR FAZ A DIFERENÇA"
        title={`Olá, professora ${profile.full_name.split(' ')[0]}.`}
        description="Cada redação é uma oportunidade de ir mais longe. Vamos acompanhar?"
        action={
          <Button onClick={() => navigate('direct')}>
            <PenLine size={17} />
            Nova correção
            <Plus size={16} />
          </Button>
        }
      />
      <div className="welcome-banner">
        <div className="banner-copy">
          <span className="banner-label">
            <span /> APRENDIZAGEM QUE TRANSFORMA
          </span>
          <h2>
            Da primeira ideia
            <br />
            ao próximo <em>mil.</em>
          </h2>
          <p>
            Seu método, potencializado pela inteligência artificial.
            <br />
            Mais tempo para o que importa: seus alunos.
          </p>
          <button onClick={() => navigate('guidance')}>
            Conhecer meu método <ArrowRight size={15} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-orbit orbit-1" />
          <div className="art-orbit orbit-2" />
          <div className="paper-sheet paper-back" />
          <div className="paper-sheet paper-front">
            <div className="paper-heading">Toda escrita é um caminho.</div>
            <div className="paper-rule" />
            <div className="paper-rule" />
            <div className="paper-rule short" />
            <div className="paper-rule" />
            <div className="paper-rule" />
            <div className="paper-rule medium" />
            <div className="paper-signature">Um passo de cada vez.</div>
            <div className="paper-grade">
              880<span>/1000</span>
              <svg viewBox="0 0 90 22">
                <path d="M4 13Q40 0 85 9M8 19Q40 8 72 15" />
              </svg>
            </div>
          </div>
          <div className="art-pen" />
          <span className="art-star star-1">✧</span>
          <span className="art-star star-2">✦</span>
          <span className="art-caption">IDEIAS NO PAPEL. FUTUROS EM CONSTRUÇÃO.</span>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            label: 'Alunos acompanhados',
            value: students.length,
            icon: Users,
            note: `Em ${data.turmas.filter((t) => t.active).length} turmas ativas`,
            tone: 'blue',
          },
          {
            label: 'Redações recebidas',
            value: essays.length,
            icon: FileText,
            note: `${evaluations.length} já corrigidas`,
            tone: 'purple',
          },
          {
            label: 'Média das redações',
            value: average || '—',
            icon: TrendingUp,
            note: 'De até 1.000 pontos',
            tone: 'green',
          },
          {
            label: 'Aguardando correção',
            value: pending,
            icon: Clock3,
            note: pending ? 'Vamos dar o próximo passo?' : 'Tudo em dia por aqui!',
            tone: 'amber',
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.tone}`}>
                <s.icon size={18} />
              </span>
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Redações recentes</h2>
              <p>As últimas histórias que chegaram até você.</p>
            </div>
            <button className="text-link" onClick={() => navigate('submissions')}>
              Ver todas <ArrowRight size={14} />
            </button>
          </div>
          <EssayTable
            rows={[...essays].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)}
            compact
          />
        </section>
        <section className="panel theme-highlight">
          <div className="panel-heading">
            <div>
              <h2>Na pauta da turma</h2>
              <p>Ideias que merecem ser discutidas.</p>
            </div>
            <BookOpen size={19} />
          </div>
          {data.themes
            .filter((t) => t.active)
            .slice(0, 2)
            .map((t, i) => (
              <button className="theme-preview" key={t.id} onClick={() => navigate('themes')}>
                <span className="theme-preview-number">0{i + 1}</span>
                <span>
                  <span className="eyebrow">TEMA DE REDAÇÃO</span>
                  <strong>{t.title}</strong>
                  <small>
                    {data.submissions.filter((s) => s.theme_id === t.id).length} redações enviadas{' '}
                    <ArrowUpRight size={14} />
                  </small>
                </span>
              </button>
            ))}
          <button className="theme-bottom" onClick={() => navigate('themes')}>
            Gerenciar temas <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="dashboard-bottom">
        <div>
          <span className="mini-icon">
            <MessageCircle size={19} />
          </span>
          <p>
            <strong>Uma conversa também ensina.</strong>
            <span>Confira as dúvidas dos alunos e ajude a construir o próximo passo.</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('messages')}>
          Abrir mensagens <ArrowUpRight size={14} />
        </Button>
      </div>
    </>
  );
}
export function SubmissionsPage() {
  const { data, profile, busy, notify, run, save } = useApp();
  const [search, setSearch] = useState('');
  const [turma, setTurma] = useState('');
  const [theme, setTheme] = useState('');
  const [status, setStatus] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const rows = data.submissions
    .filter(
      (s) =>
        (profile.role === 'teacher' || s.student_id === profile.id) &&
        (!theme || s.theme_id === theme) &&
        (!status || s.status === status) &&
        (!turma || data.profiles.find((p) => p.id === s.student_id)?.turma_id === turma) &&
        `${data.profiles.find((p) => p.id === s.student_id)?.full_name} ${data.themes.find((t) => t.id === s.theme_id)?.title}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  async function exportRows(format: 'pdf' | 'rtf') {
    const reports = rows.flatMap((s) => {
      const e = data.evaluations.find((e) => e.submission_id === s.id);
      return e
        ? [
            reportText(
              s,
              e,
              data.profiles.find((p) => p.id === s.student_id)?.full_name || 'Professora',
              data.themes.find((t) => t.id === s.theme_id)?.title || '',
            ),
          ]
        : [];
    });
    if (!reports.length) {
      notify('Nenhuma avaliação concluída neste filtro.', true);
      return;
    }
    if (format === 'pdf') await exportPdf(reports);
    else exportRtf(reports);
    setExportOpen(false);
    notify(`${reports.length} avaliação(ões) exportada(s).`);
  }
  return (
    <>
      <PageHeading
        eyebrow="CADA TEXTO CONTA"
        title={profile.role === 'teacher' ? 'Redações' : 'Minhas redações'}
        description="Acompanhe os envios, as devolutivas e cada nova conquista."
        action={
          <Button variant="outline" disabled={busy} onClick={() => setExportOpen(true)}>
            <Download size={16} />
            Exportar
          </Button>
        }
      />
      <section className="panel">
        <div className="filter-bar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Buscar redações"
              placeholder="Buscar aluno ou tema…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {profile.role === 'teacher' && (
            <select
              aria-label="Filtrar turma"
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
            >
              <option value="">Todas as turmas</option>
              {data.turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar tema"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="">Todos os temas</option>
            {data.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="evaluated">Corrigidas</option>
            <option value="pending">Aguardando</option>
          </select>
        </div>
        <div className="list-count">{rows.length} redação(ões) encontrada(s)</div>
        <EssayTable rows={rows} />
      </section>
      <Modal
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar devolutivas"
        description="Serão exportadas as avaliações concluídas que correspondem aos filtros atuais."
      >
        <div className="form-actions">
          <Button onClick={() => void run(() => exportRows('pdf'))}>Baixar PDF</Button>
          <Button variant="outline" onClick={() => void run(() => exportRows('rtf'))}>
            Baixar RTF
          </Button>
        </div>
        <p className="muted">
          O RTF usa escapes Unicode e pode ser editado em processadores de texto.
        </p>
      </Modal>
    </>
  );
}
export function StudentsPage() {
  const { data, save, run, busy, notify } = useApp();
  const [edit, setEdit] = useState<import('../lib/types').Profile | null>(null);
  const [search, setSearch] = useState('');
  const students = data.profiles.filter(
    (p) => p.role === 'student' && p.full_name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="QUEM ESCREVE ESSA HISTÓRIA"
        title="Seus alunos"
        description="Um olhar individual para cada trajetória."
      />
      <section className="panel">
        <div className="filter-bar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Buscar aluno"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pelo nome…"
            />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ALUNO</th>
                <th>TURMA</th>
                <th>REDAÇÕES</th>
                <th>MÉDIA</th>
                <th>
                  <span className="sr-only">Editar aluno</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((p, i) => {
                const rows = data.submissions.filter((s) => s.student_id === p.id);
                const es = data.evaluations.filter((e) =>
                  rows.some((s) => s.id === e.submission_id),
                );
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="student-cell">
                        <span className={`student-avatar color-${i % 4}`}>
                          {p.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <strong>{p.full_name}</strong>
                      </div>
                    </td>
                    <td>{data.turmas.find((t) => t.id === p.turma_id)?.name}</td>
                    <td>{rows.length}</td>
                    <td className="score-value">
                      {es.length
                        ? Math.round(es.reduce((a, e) => a + e.total_score, 0) / es.length)
                        : '—'}
                    </td>
                    <td>
                      <button
                        className="table-action"
                        aria-label={`Editar aluno ${p.full_name}`}
                        onClick={() => setEdit(p)}
                      >
                        <PenLine size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!students.length && (
            <Empty
              title="Nenhum aluno encontrado"
              description="Compartilhe um código da turma para receber os primeiros cadastros."
            />
          )}
        </div>
      </section>
      <Modal
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
        title="Editar aluno"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void run(async () => {
              await save(
                'profiles',
                {
                  ...edit!,
                  full_name: String(form.get('name')).trim(),
                  turma_id: String(form.get('turma')),
                },
                true,
              );
              setEdit(null);
              notify('Aluno atualizado.');
            });
          }}
        >
          <label>
            Nome completo
            <input name="name" required maxLength={120} defaultValue={edit?.full_name} />
          </label>
          <label>
            Turma
            <select name="turma" defaultValue={edit?.turma_id || ''} required>
              {data.turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy}>Salvar aluno</Button>
        </form>
      </Modal>
    </>
  );
}
