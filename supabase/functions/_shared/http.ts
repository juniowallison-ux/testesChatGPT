import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('WEB_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
export function preflight(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  return null;
}
export async function context(req: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key || !anon) throw new HttpError(503, 'Backend ainda não configurado.');
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer '))
    throw new HttpError(401, 'Entre na sua conta para continuar.');
  const auth = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();
  if (error || !user) throw new HttpError(401, 'Sessão inválida ou expirada.');
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: profile, error: pError } = await admin
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (pError || !profile) throw new HttpError(403, 'Perfil de acesso não encontrado.');
  return { admin, user, profile };
}
export async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 20000) throw new HttpError(413, 'Solicitação muito grande.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Solicitação inválida.');
  }
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Nunca registrar prompts, textos dos alunos ou a resposta do provedor.
  console.error('Operação interrompida:', error instanceof Error ? error.name : 'erro');
  return json(
    {
      error:
        'Não foi possível concluir a operação. Tente novamente ou solicite uma correção manual.',
    },
    502,
  );
}
export function checkDb(error: { message: string } | null) {
  if (error) throw new HttpError(503, 'Não foi possível acessar os dados da avaliação.');
}
export async function budget(admin: Awaited<ReturnType<typeof context>>['admin'], userId: string) {
  const { error } = await admin.rpc('consume_ai_budget', { p_user_id: userId });
  if (error)
    throw new HttpError(
      429,
      'Limite diário de IA atingido. Tente amanhã ou solicite uma correção manual.',
    );
}
