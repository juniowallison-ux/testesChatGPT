import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  Users,
  FileText,
  SlidersHorizontal,
  FolderOpen,
  MessageSquare,
  PenLine,
  GraduationCap,
  ArrowUpRight,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Bell,
  LoaderCircle,
  AlertCircle,
  Check,
  Feather,
} from 'lucide-react';
import { Button } from './components/ui';
import { AppContext } from './lib/context';
import { errorMessage } from './lib/errors';
import { isDemo, supabase } from './lib/supabase';
import { ids, loadDemo } from './lib/demo';
import { fetchData, getProfile, mutate } from './lib/store';
import type { Data, Profile, Submission } from './lib/types';
import { Dashboard, SubmissionsPage, StudentsPage } from './components/dashboard';
import {
  ClassesPage,
  ThemesPage,
  GuidancePage,
  DocumentsPage,
  MessagesPage,
} from './components/management';
import { EssayEditor, EvaluationPage, StudentDashboard } from './components/essay-pages';
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    try {
      if (signup) {
        const { data, error } = await supabase!.auth.signUp({
          email: String(f.get('email')),
          password: String(f.get('password')),
          options: {
            data: {
              full_name: String(f.get('name')),
              access_code: String(f.get('code')).trim().toUpperCase(),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmation(true);
          return;
        }
      } else {
        const { error } = await supabase!.auth.signInWithPassword({
          email: String(f.get('email')),
          password: String(f.get('password')),
        });
        if (error) throw error;
      }
      await onLogin();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível entrar.'));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-shell">
      <div className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Feather />
          </span>
          <span>
            Papel <i>&</i> Tinta<small>COM PROFESSORA ANDRÉA</small>
          </span>
        </div>
        <span className="eyebrow">CADA TEXTO, UM NOVO COMEÇO</span>
        <h1>
          Boas ideias merecem
          <br />
          <em>encontrar sua voz.</em>
        </h1>
        <p>Um espaço para escrever, aprender e transformar seu caminho até o ENEM.</p>
        <div className="story-lines">
          <PenLine size={32} />
          <span>
            Seu próximo capítulo
            <br />
            começa aqui.
          </span>
        </div>
      </div>
      <div className="login-panel">
        <span className="eyebrow">SEJA BEM-VINDO</span>
        <h2>{signup ? 'Vamos escrever essa história?' : 'Seu espaço de aprendizagem.'}</h2>
        <p className="muted">
          {signup
            ? 'Entre para sua turma usando o código da professora.'
            : 'Entre com seu e-mail e senha para continuar.'}
        </p>
        {confirmation ? (
          <div className="notice">
            <Check /> Cadastro recebido. Confirme seu e-mail para entrar.
          </div>
        ) : (
          <form onSubmit={submit} className="form-stack">
            {signup && (
              <>
                <label>
                  Seu nome completo
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Código da turma
                  <input
                    name="code"
                    required
                    maxLength={32}
                    placeholder="Código fornecido pela professora"
                  />
                </label>
              </>
            )}
            <label>
              E-mail
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={loading}>
              {loading ? <LoaderCircle className="spin" /> : null}
              {signup ? 'Criar minha conta' : 'Entrar na plataforma'}
              <ArrowUpRight size={17} />
            </Button>
          </form>
        )}
        <button
          className="text-link login-switch"
          onClick={() => {
            setSignup(!signup);
            setConfirmation(false);
            setError('');
          }}
        >
          {signup ? 'Já tenho conta. Entrar' : 'Sou aluno e tenho um código de turma'}
        </button>
        <p className="login-foot">Uma redação de cada vez. Uma conquista a cada passo.</p>
      </div>
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<Data | null>(() => (isDemo ? loadDemo() : null));
  const [profile, setProfile] = useState<Profile | null>(() =>
    isDemo ? loadDemo().profiles.find((p) => p.id === ids.teacher)! : null,
  );
  const dataRef = useRef(data);
  dataRef.current = data;
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [themeId, setThemeId] = useState<string | null>(null);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const loadSession = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setData(null);
        setProfile(null);
        return;
      }
      const [p, d] = await Promise.all([getProfile(session.user.id), fetchData()]);
      setProfile(p);
      setData(d);
    } catch (err) {
      setLoadError(errorMessage(err, 'Erro ao carregar o ambiente.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    void loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setData(null);
        setLoadError('');
      }
      if (event === 'SIGNED_IN') setTimeout(() => void loadSession(), 0);
    });
    return () => subscription.unsubscribe();
  }, [loadSession]);
  const refresh = async () => {
    if (!isDemo) setData(await fetchData());
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (err) {
      notify(errorMessage(err, 'Não foi possível concluir a operação.'), true);
    } finally {
      setBusy(false);
    }
  };
  const navigate = (value: string) => {
    setPage(value);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const save = async <K extends keyof Data>(key: K, item: Data[K][number], update = false) => {
    if (!dataRef.current) return;
    const next = await mutate(dataRef.current, key, item, update);
    dataRef.current = next;
    setData(next);
  };
  if (loading)
    return (
      <div className="loading-screen">
        <Feather size={36} />
        <LoaderCircle className="spin" />
        <p>Preparando seu espaço de escrita…</p>
      </div>
    );
  if (loadError)
    return (
      <div className="loading-screen">
        <AlertCircle />
        <h2>Não foi possível carregar sua conta.</h2>
        <p>{loadError}</p>
        <Button onClick={() => void loadSession()}>Tentar novamente</Button>
        <Button variant="outline" onClick={() => void supabase?.auth.signOut()}>
          Sair
        </Button>
      </div>
    );
  if (!profile || !data) return <Login onLogin={loadSession} />;
  const teacher = profile.role === 'teacher';
  const unread = data.submissions.filter(
    (s) => s.student_message && !s.message_read_by_teacher,
  ).length;
  const nav = teacher
    ? [
        { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
        { id: 'submissions', label: 'Redações', icon: FileText },
        { id: 'classes', label: 'Turmas e códigos', icon: Users },
        { id: 'students', label: 'Alunos', icon: GraduationCap },
        { id: 'themes', label: 'Temas de redação', icon: BookOpen },
        { id: 'direct', label: 'Correção direta', icon: PenLine },
      ]
    : [
        { id: 'dashboard', label: 'Meu painel', icon: LayoutDashboard },
        { id: 'themes', label: 'Temas disponíveis', icon: BookOpen },
        { id: 'submissions', label: 'Minhas redações', icon: FileText },
      ];
  const config = teacher
    ? [
        { id: 'guidance', label: 'Orientações da IA', icon: SlidersHorizontal },
        { id: 'documents', label: 'Documentos de apoio', icon: FolderOpen },
        { id: 'messages', label: 'Mensagens', icon: MessageSquare },
      ]
    : [];
  const ctx = {
    data,
    profile,
    demo: isDemo,
    busy,
    notify,
    run,
    save,
    refresh,
    navigate,
    openResult: (s: Submission) => {
      setSelected(s);
      navigate('result');
    },
    startEssay: (id: string) => {
      setThemeId(id);
      navigate('write');
    },
  };
  return (
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        {mobile && (
          <button
            className="sidebar-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('dashboard');
            }}
            className="brand"
          >
            <span className="brand-icon">
              <Feather size={24} />
            </span>
            <span>
              Papel <i>&</i> Tinta<small>PROFESSORA ANDRÉA</small>
            </span>
          </a>
          <div className="workspace-label">
            <span className="tiny-dot" />
            {teacher ? 'ESPAÇO DA PROFESSORA' : 'ESPAÇO DO ALUNO'}
          </div>
          <nav aria-label="Navegação principal">
            {nav.map((n) => (
              <button
                key={n.id}
                aria-label={n.label}
                className={`nav-item ${page === n.id ? 'active' : ''}`}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={18} />
                {n.label}
                {page === n.id && <span className="nav-active-dot" />}
              </button>
            ))}
            {teacher && (
              <>
                <div className="nav-section-label">SEU MÉTODO</div>
                {config.map((n) => (
                  <button
                    key={n.id}
                    aria-label={n.label}
                    className={`nav-item ${page === n.id ? 'active' : ''}`}
                    onClick={() => navigate(n.id)}
                  >
                    <n.icon size={18} />
                    {n.label}
                    {n.id === 'messages' && unread > 0 && (
                      <span className="nav-count">{unread}</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </nav>
          <div className="sidebar-note">
            <span className="note-spark">✧</span>
            <p>
              Escrever é um processo.
              <br />
              <em>Evoluir também.</em>
            </p>
            <span>Um olhar atento para cada texto.</span>
          </div>
          <div className="sidebar-profile">
            <div className="avatar">
              {profile.full_name
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </div>
            <span>
              <strong>{teacher ? 'Professora Andréa' : profile.full_name}</strong>
              <small>{teacher ? 'Educadora · Redação ENEM' : 'Estudante · Redação ENEM'}</small>
            </span>
            {!isDemo && (
              <button
                aria-label="Sair"
                className="icon-button"
                onClick={() =>
                  void run(async () => {
                    await supabase!.auth.signOut();
                    navigate('dashboard');
                  })
                }
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-context">
              <button
                className="icon-button mobile-menu"
                aria-label="Abrir menu"
                onClick={() => setMobile(!mobile)}
              >
                {mobile ? <X /> : <Menu />}
              </button>
              <span>{teacher ? 'Área da professora' : 'Área do aluno'}</span>
              <span className="topbar-slash">/</span>
              <strong>
                {[...nav, ...config].find((n) => n.id === page)?.label ||
                  { write: 'Nova redação', result: 'Devolutiva' }[page] ||
                  'Correção direta'}
              </strong>
            </div>
            <div className="topbar-actions">
              {isDemo && (
                <>
                  <span className="demo-chip">Demonstração</span>
                  <label className="role-select">
                    <span className="sr-only">Alternar perfil da demonstração</span>
                    <select
                      value={profile.role}
                      onChange={(e) => {
                        setProfile(
                          data.profiles.find(
                            (p) =>
                              p.id === (e.target.value === 'teacher' ? ids.teacher : ids.student),
                          )!,
                        );
                        navigate('dashboard');
                      }}
                    >
                      <option value="teacher">Professora</option>
                      <option value="student">Aluno</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </>
              )}
              <button
                className="notification-button"
                aria-label={teacher ? 'Abrir mensagens' : 'Abrir minhas redações'}
                onClick={() => navigate(teacher ? 'messages' : 'submissions')}
              >
                <Bell size={19} />
                {teacher && unread > 0 && <i />}
              </button>
              <span className="header-avatar">{teacher ? 'A' : profile.full_name[0]}</span>
            </div>
          </header>
          <main className="main-content">
            {page === 'dashboard' ? (
              teacher ? (
                <Dashboard />
              ) : (
                <StudentDashboard />
              )
            ) : page === 'submissions' ? (
              <SubmissionsPage />
            ) : page === 'classes' && teacher ? (
              <ClassesPage />
            ) : page === 'students' && teacher ? (
              <StudentsPage />
            ) : page === 'themes' ? (
              <ThemesPage />
            ) : page === 'guidance' && teacher ? (
              <GuidancePage />
            ) : page === 'documents' && teacher ? (
              <DocumentsPage />
            ) : page === 'messages' && teacher ? (
              <MessagesPage />
            ) : page === 'direct' && teacher ? (
              <EssayEditor direct />
            ) : page === 'write' ? (
              <EssayEditor themeId={themeId} />
            ) : page === 'result' && selected ? (
              <EvaluationPage submissionId={selected.id} />
            ) : (
              <StudentDashboard />
            )}
          </main>
          <footer className="app-footer">
            <span>
              Papel & Tinta <span className="footer-dot">·</span> Aprender. Escrever. Evoluir.
            </span>
            <span>
              Feito para o seu próximo capítulo <Feather size={13} />
            </span>
          </footer>
        </div>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={20} /> : <Check size={20} />}
          <span>{toast.message}</span>
          <button className="icon-button" aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle className="spin" size={17} /> Processando…
        </div>
      )}
    </AppContext.Provider>
  );
}
