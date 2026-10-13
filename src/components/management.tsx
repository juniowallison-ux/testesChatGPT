import { useState } from 'react';
import {
  Plus,
  Users,
  Copy,
  Pencil,
  BookOpen,
  ArrowUpRight,
  FileText,
  Upload,
  MessageSquare,
  Check,
  SlidersHorizontal,
  CalendarDays,
} from 'lucide-react';
import { Button, Modal } from './ui';
import { useApp } from '../lib/context';
import { PageHeading, Empty } from './dashboard';
import { extractPdfText, uploadFile, getSignedUrl } from '../lib/store';
import type { Turma, Theme, Guidance } from '../lib/types';
export function ClassesPage() {
  const { data, profile, save, run, busy, notify } = useApp();
  const [edit, setEdit] = useState<Turma | null>(null);
  const [open, setOpen] = useState(false);
  const [codeTurma, setCodeTurma] = useState<string | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      await save(
        'turmas',
        {
          id: edit?.id || crypto.randomUUID(),
          name: String(f.get('name')).trim(),
          description: String(f.get('description')),
          active: f.get('active') === 'on',
          created_at: edit?.created_at || new Date().toISOString(),
        },
        !!edit,
      );
      setOpen(false);
      notify('Turma salva.');
    });
  }
  function createCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const code = Array.from(bytes, (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      await save('codes', {
        id: crypto.randomUUID(),
        code,
        turma_id: codeTurma!,
        max_uses: Number(f.get('max')),
        uses_count: 0,
        expires_at: new Date(String(f.get('expiry')) + 'T23:59:59').toISOString(),
        created_by: profile.id,
      });
      setCodeTurma(null);
      notify('Novo código criado. Compartilhe com os alunos.');
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="APRENDER EM CONJUNTO"
        title="Turmas e códigos"
        description="Organize os encontros e abra as portas para seus alunos."
        action={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            Nova turma
          </Button>
        }
      />
      <div className="cards-grid">
        {data.turmas.map((t) => (
          <section className="panel class-card" key={t.id}>
            <div className="card-top">
              <span className="large-icon">
                <Users size={23} />
              </span>
              <span className={`badge ${t.active ? 'badge-green' : 'badge-neutral'}`}>
                {t.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <h2>{t.name}</h2>
            <p>{t.description || 'Uma nova turma, muitas possibilidades.'}</p>
            <div className="class-info">
              <span>
                <Users size={15} />
                {data.profiles.filter((p) => p.turma_id === t.id).length} alunos
              </span>
              <span>
                <FileText size={15} />
                {
                  data.submissions.filter(
                    (s) => data.profiles.find((p) => p.id === s.student_id)?.turma_id === t.id,
                  ).length
                }{' '}
                redações
              </span>
            </div>
            <div className="code-list">
              {data.codes
                .filter((c) => c.turma_id === t.id)
                .map((c) => (
                  <div key={c.id} className="code-item">
                    <div>
                      <strong>{c.code}</strong>
                      <small>
                        {c.uses_count}/{c.max_uses} usos · até{' '}
                        {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                        {new Date(c.expires_at) < new Date() ? ' · Expirado' : ''}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Copiar código ${c.code}`}
                      onClick={() =>
                        void run(async () => {
                          await navigator.clipboard.writeText(c.code);
                          notify('Código copiado.');
                        })
                      }
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                ))}
            </div>
            <div className="card-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEdit(t);
                  setOpen(true);
                }}
              >
                <Pencil size={14} />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCodeTurma(t.id)}
                disabled={!t.active}
              >
                <Plus size={14} />
                Gerar código
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!data.turmas.length && (
        <Empty
          title="Sua primeira turma começa aqui"
          description="Crie uma turma e compartilhe o código de acesso."
        />
      )}
      <Modal open={open} onOpenChange={setOpen} title={edit ? 'Editar turma' : 'Criar nova turma'}>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Nome da turma
            <input name="name" required maxLength={100} defaultValue={edit?.name} />
          </label>
          <label>
            Descrição
            <textarea
              name="description"
              rows={3}
              maxLength={1000}
              defaultValue={edit?.description}
            />
          </label>
          <label className="checkbox-label">
            <input name="active" type="checkbox" defaultChecked={edit?.active ?? true} />
            Turma ativa
          </label>
          <Button disabled={busy}>Salvar turma</Button>
        </form>
      </Modal>
      <Modal
        open={!!codeTurma}
        onOpenChange={(v) => {
          if (!v) setCodeTurma(null);
        }}
        title="Gerar código de acesso"
        description="O cadastro só será permitido com um código válido de uma turma ativa."
      >
        <form className="form-stack" onSubmit={createCode}>
          <label>
            Limite de cadastros
            <input type="number" name="max" min={1} max={10000} defaultValue={35} required />
          </label>
          <label>
            Válido até
            <input
              type="date"
              name="expiry"
              min={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)}
              required
            />
          </label>
          <Button disabled={busy}>Gerar código</Button>
        </form>
      </Modal>
    </>
  );
}
export function ThemesPage() {
  const { data, profile, save, run, busy, notify, startEssay } = useApp();
  const teacher = profile.role === 'teacher';
  const [edit, setEdit] = useState<Theme | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Theme | null>(null);
  const themes = data.themes.filter((t) => teacher || t.active);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      await save(
        'themes',
        {
          id: edit?.id || crypto.randomUUID(),
          title: String(f.get('title')).trim(),
          description: String(f.get('description')),
          motivating_texts: String(f.get('texts')),
          instructions: String(f.get('instructions')),
          active: f.get('active') === 'on',
          created_at: edit?.created_at || new Date().toISOString(),
        },
        !!edit,
      );
      setOpen(false);
      notify('Tema salvo.');
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="IDEIAS QUE MERECEM UM TEXTO"
        title="Temas de redação"
        description={
          teacher
            ? 'Proponha discussões, inspire repertórios e acompanhe novos olhares.'
            : 'Escolha um tema e dê voz às suas ideias.'
        }
        action={
          teacher && (
            <Button
              onClick={() => {
                setEdit(null);
                setOpen(true);
              }}
            >
              <Plus size={17} />
              Novo tema
            </Button>
          )
        }
      />
      <div className="cards-grid themes-grid">
        {themes.map((t, i) => {
          const sent = data.submissions.some(
            (s) => s.theme_id === t.id && s.student_id === profile.id,
          );
          return (
            <section key={t.id} className="panel theme-card">
              <div className={`theme-card-art theme-art-${i % 3}`}>
                <BookOpen size={37} />
                <span>PROPOSTA {String(i + 1).padStart(2, '0')}</span>
                <div className="theme-art-lines" />
              </div>
              <div className="theme-card-body">
                <div className="card-top">
                  <span className={`badge ${t.active ? 'badge-green' : 'badge-neutral'}`}>
                    {t.active ? 'Disponível' : 'Rascunho'}
                  </span>
                  <span className="muted">
                    <CalendarDays size={13} /> {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <h2>{t.title}</h2>
                <p>{t.description}</p>
                <div className="card-actions">
                  <Button variant="outline" size="sm" onClick={() => setDetail(t)}>
                    Ler proposta <ArrowUpRight size={14} />
                  </Button>
                  {teacher ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEdit(t);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                      Editar
                    </Button>
                  ) : (
                    <Button size="sm" disabled={sent} onClick={() => startEssay(t.id)}>
                      {sent ? 'Já enviada' : 'Escrever'}
                      <Pencil size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {!themes.length && (
        <Empty
          title="Novos temas em breve"
          description="As propostas da professora aparecerão aqui."
        />
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={edit ? 'Editar tema' : 'Nova proposta de redação'}
      >
        <form className="form-stack" onSubmit={submit}>
          <label>
            Título
            <input name="title" required maxLength={250} defaultValue={edit?.title} />
          </label>
          <label>
            Descrição
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              defaultValue={edit?.description}
            />
          </label>
          <label>
            Textos motivadores
            <textarea
              name="texts"
              rows={6}
              required
              maxLength={20000}
              defaultValue={edit?.motivating_texts}
            />
          </label>
          <label>
            Instruções
            <textarea
              name="instructions"
              rows={3}
              maxLength={5000}
              defaultValue={edit?.instructions}
            />
          </label>
          <label className="checkbox-label">
            <input name="active" type="checkbox" defaultChecked={edit?.active ?? true} />
            Disponibilizar para os alunos
          </label>
          <Button disabled={busy}>Salvar tema</Button>
        </form>
      </Modal>
      <Modal
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
        title={detail?.title || 'Proposta'}
      >
        <div className="reading-content">
          <p>{detail?.description}</p>
          <h3>Textos motivadores</h3>
          <p className="preserve-lines">{detail?.motivating_texts}</p>
          <h3>Instruções</h3>
          <p>{detail?.instructions}</p>
        </div>
        {!teacher && detail && (
          <Button
            disabled={data.submissions.some(
              (s) => s.theme_id === detail.id && s.student_id === profile.id,
            )}
            onClick={() => {
              startEssay(detail.id);
              setDetail(null);
            }}
          >
            Começar redação <Pencil size={16} />
          </Button>
        )}
      </Modal>
    </>
  );
}
export function GuidancePage() {
  const { data, save, run, busy, notify } = useApp();
  const [edit, setEdit] = useState<Guidance | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="O SEU JEITO DE ENSINAR"
        title="Orientações da IA"
        description="Seu método pedagógico orienta cada devolutiva. Estes conteúdos são privados."
      />
      <div className="notice">
        <SlidersHorizontal size={20} />
        <span>
          A régua ENEM, a validação de evidências e a privacidade são regras fixas do motor. As
          orientações personalizam o olhar pedagógico.
        </span>
      </div>
      <div className="guidance-grid">
        {[...data.guidance]
          .sort((a, b) => a.ordem - b.ordem)
          .map((g, i) => (
            <button key={g.id} className="panel guidance-card" onClick={() => setEdit(g)}>
              <span className="guidance-number">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{g.titulo}</h3>
                <p>{g.conteudo || 'Adicione suas orientações para esta etapa.'}</p>
              </div>
              <Pencil size={16} />
            </button>
          ))}
      </div>
      {!data.guidance.length && (
        <Empty
          title="Orientações não encontradas"
          description="Aplique a migração do Supabase para criar os 12 campos do método."
        />
      )}
      <Modal
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
        title={edit?.titulo || 'Orientação'}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await save(
                'guidance',
                {
                  ...edit!,
                  conteudo: String(f.get('content')),
                  updated_at: new Date().toISOString(),
                },
                true,
              );
              setEdit(null);
              notify('Orientação atualizada. Novas avaliações usarão a nova versão.');
            });
          }}
        >
          <label>
            Orientação pedagógica
            <textarea name="content" rows={12} maxLength={10000} defaultValue={edit?.conteudo} />
          </label>
          <Button disabled={busy}>Salvar orientação</Button>
        </form>
      </Modal>
    </>
  );
}
export function DocumentsPage() {
  const { data, profile, demo, save, run, busy, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  async function read(file: File) {
    if (file.size > 10 * 1024 * 1024) throw new Error('Limite de 10 MB por documento.');
    const text = file.type === 'application/pdf' ? await extractPdfText(file) : await file.text();
    if (text.length > 60000) throw new Error('O texto deve ter até 60.000 caracteres.');
    setContent(text);
    setFile(file);
  }
  return (
    <>
      <PageHeading
        eyebrow="REPERTÓRIO PARA O SEU MÉTODO"
        title="Documentos de apoio"
        description="Materiais privados que ajudam a contextualizar as avaliações da IA."
        action={
          <Button
            onClick={() => {
              setContent('');
              setFile(null);
              setOpen(true);
            }}
          >
            <Upload size={16} />
            Adicionar documento
          </Button>
        }
      />
      <div className="notice">
        <FileText size={20} />
        <span>
          Envie PDFs pesquisáveis ou arquivos de texto. Os alunos não têm acesso a estes documentos
          ou aos seus nomes.
        </span>
      </div>
      <div className="cards-grid">
        {data.docs.map((doc) => (
          <section className="panel document-card" key={doc.id}>
            <div className="card-top">
              <span className="large-icon">
                <FileText size={23} />
              </span>
              <span className={`badge ${doc.is_active ? 'badge-green' : 'badge-neutral'}`}>
                {doc.is_active ? 'No contexto da IA' : 'Desativado'}
              </span>
            </div>
            <h2>{doc.title}</h2>
            <p>
              {doc.content_text.slice(0, 160)}
              {doc.content_text.length > 160 ? '…' : ''}
            </p>
            <small className="muted">
              {doc.content_text.length.toLocaleString('pt-BR')} caracteres
            </small>
            <div className="card-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await save('docs', { ...doc, is_active: !doc.is_active }, true);
                    notify('Contexto atualizado.');
                  })
                }
              >
                {doc.is_active ? 'Desativar' : 'Ativar'}
              </Button>
              {doc.file_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void run(async () => {
                      const url = await getSignedUrl(doc.file_url!);
                      window.open(url, '_blank', 'noopener,noreferrer');
                    })
                  }
                >
                  Abrir arquivo
                  <ArrowUpRight size={14} />
                </Button>
              )}
            </div>
          </section>
        ))}
      </div>
      {!data.docs.length && (
        <Empty
          title="Seu repertório começa aqui"
          description="Adicione um material de referência ou cole suas orientações complementares."
        />
      )}
      <Modal open={open} onOpenChange={setOpen} title="Adicionar documento de apoio">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const path = file && !demo ? await uploadFile(file, profile.user_id) : null;
              await save('docs', {
                id: crypto.randomUUID(),
                title: String(f.get('title')),
                file_url: path,
                content_text: content,
                is_active: true,
                created_at: new Date().toISOString(),
              });
              setOpen(false);
              notify('Documento adicionado.');
            });
          }}
        >
          <label>
            Título privado
            <input name="title" required maxLength={200} />
          </label>
          <label className="file-input-label">
            <Upload size={17} />
            Carregar PDF ou texto
            <input
              type="file"
              accept="application/pdf,text/plain"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => read(f));
              }}
            />
          </label>
          <label>
            Conteúdo para a IA
            <textarea
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              maxLength={60000}
            />
          </label>
          {demo && (
            <small className="muted">
              Demonstração: somente o texto extraído é guardado localmente.
            </small>
          )}
          <Button disabled={busy || !content.trim()}>Salvar documento</Button>
        </form>
      </Modal>
    </>
  );
}
export function MessagesPage() {
  const { data, save, run, busy, openResult, notify } = useApp();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const rows = data.submissions
    .filter((s) => s.student_message && (!onlyUnread || !s.message_read_by_teacher))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <PageHeading
        eyebrow="ESCUTA QUE TRANSFORMA"
        title="Mensagens dos alunos"
        description="Dúvidas são oportunidades para continuar a conversa."
      />
      <label className="checkbox-label filter-check">
        <input
          type="checkbox"
          checked={onlyUnread}
          onChange={(e) => setOnlyUnread(e.target.checked)}
        />
        Mostrar apenas não lidas
      </label>
      <div className="message-list">
        {rows.map((s) => (
          <section key={s.id} className="panel message-card">
            <div className="card-top">
              <div className="student-cell">
                <span className="student-avatar color-0">
                  <MessageSquare size={18} />
                </span>
                <div>
                  <strong>{data.profiles.find((p) => p.id === s.student_id)?.full_name}</strong>
                  <small>{data.themes.find((t) => t.id === s.theme_id)?.title}</small>
                </div>
              </div>
              <span
                className={`badge ${s.message_read_by_teacher ? 'badge-neutral' : 'badge-blue'}`}
              >
                {s.message_read_by_teacher ? 'Lida' : 'Nova mensagem'}
              </span>
            </div>
            <p className="message-text">{s.student_message}</p>
            <div className="card-actions">
              <Button variant="outline" size="sm" onClick={() => openResult(s)}>
                Ver redação <ArrowUpRight size={14} />
              </Button>
              {!s.message_read_by_teacher && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await save('submissions', { ...s, message_read_by_teacher: true }, true);
                      notify('Mensagem marcada como lida.');
                    })
                  }
                >
                  <Check size={14} />
                  Marcar como lida
                </Button>
              )}
            </div>
          </section>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="Tudo tranquilo por aqui"
          description="As dúvidas enviadas pelos alunos aparecerão neste espaço."
        />
      )}
    </>
  );
}
