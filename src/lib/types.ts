export type Role = 'teacher' | 'student';
export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  role: Role;
  turma_id: string | null;
  created_at: string;
};
export type Turma = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
};
export type Theme = {
  id: string;
  title: string;
  description: string;
  motivating_texts: string;
  instructions: string;
  active: boolean;
  created_at: string;
};
export type AccessCode = {
  id: string;
  code: string;
  turma_id: string;
  max_uses: number;
  uses_count: number;
  expires_at: string;
  created_by: string;
};
export type Guidance = {
  id: string;
  campo_nome: string;
  titulo: string;
  conteudo: string;
  ordem: number;
  updated_at: string;
};
export type SupportDoc = {
  id: string;
  title: string;
  file_url: string | null;
  content_text: string;
  is_active: boolean;
  created_at: string;
};
export type Submission = {
  id: string;
  student_id: string;
  theme_id: string;
  original_text: string;
  reviewed_text: string;
  file_url: string | null;
  ocr_review_confirmed: boolean;
  status: 'pending' | 'evaluated';
  student_message: string | null;
  message_read_by_teacher: boolean;
  created_at: string;
};
export type Evidence = { quote: string; line: number; comment: string; competency: number };
export type Intervention = {
  agente: string | null;
  acao: string | null;
  meio: string | null;
  efeito: string | null;
  detalhamento: string | null;
};
export type Evaluation = {
  id: string;
  submission_id: string;
  theme_id: string;
  evaluation_hash: string | null;
  c1_score: number;
  c2_score: number;
  c3_score: number;
  c4_score: number;
  c5_score: number;
  total_score: number;
  c1_comment: string;
  c2_comment: string;
  c3_comment: string;
  c4_comment: string;
  c5_comment: string;
  general_feedback: string;
  strengths: string[];
  improvements: string[];
  evidence: Evidence[];
  intervention: Intervention;
  zero_reason: string | null;
  source: 'ai' | 'teacher' | 'example';
  created_at: string;
};
export type Data = {
  profiles: Profile[];
  turmas: Turma[];
  themes: Theme[];
  codes: AccessCode[];
  guidance: Guidance[];
  docs: SupportDoc[];
  submissions: Submission[];
  evaluations: Evaluation[];
};
export const competencyNames = [
  'Domínio da norma culta',
  'Compreensão do tema',
  'Argumentação',
  'Coesão textual',
  'Proposta de intervenção',
];
export const guidanceNames = [
  'Visão geral do método',
  'C1 • Gramática e norma culta',
  'C2 • Tema e repertório',
  'C3 • Argumentação e projeto de texto',
  'C4 • Coesão textual',
  'C5 • Proposta de intervenção',
  'Critérios de anulação e nota zero',
  'Tom pedagógico',
  'Estrutura da devolutiva',
  'Repertório sociocultural',
  'Citações e evidências',
  'Orientações complementares',
];
