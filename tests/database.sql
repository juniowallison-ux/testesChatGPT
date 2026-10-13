\set ON_ERROR_STOP on
create function public.test_assert(condition boolean,message text) returns void language plpgsql as $$ begin if condition is not true then raise exception 'FALHOU: %',message; end if; end $$;
-- Convite administrativo não pode ser forjado pelo cadastro público.
insert into public.teacher_invitations values('andrea@example.test','Andréa');
insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000001','andrea@example.test','{}');
select test_assert((select role='teacher' from profiles where user_id='00000000-0000-4000-8000-000000000001'),'bootstrap da professora');
select test_assert((select count(*)=0 from teacher_invitations),'convite consumido');
insert into turmas(id,name) values('00000000-0000-4000-8000-000000000010','Turma teste');
insert into themes(id,title) values('00000000-0000-4000-8000-000000000020','Tema teste');
insert into access_codes(code,turma_id,max_uses,expires_at,created_by) values('CODIGO01','00000000-0000-4000-8000-000000000010',2,now()+interval '1 day',(select id from profiles where role='teacher'));
insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000002','aluno@example.test','{"full_name":"Aluno 1","access_code":"CODIGO01","role":"teacher"}');
insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000003','aluno2@example.test','{"full_name":"Aluno 2","access_code":"CODIGO01"}');
select test_assert((select role='student' from profiles where user_id='00000000-0000-4000-8000-000000000002'),'metadados não elevam privilégio');
select test_assert((select uses_count=2 from access_codes where code='CODIGO01'),'contador de código');
do $$ begin
  begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'esgotado@example.test','{"full_name":"Aluno","access_code":"CODIGO01"}'); raise exception 'FALHOU: código esgotado aceito';
  exception when raise_exception then if sqlerrm not like 'Código de turma inválido%' then raise; end if; end;
  begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'semcodigo@example.test','{"full_name":"Aluno"}'); raise exception 'FALHOU: cadastro sem código aceito';
  exception when raise_exception then if sqlerrm not like 'Código de turma inválido%' then raise; end if; end;
end $$;
insert into documentos_apoio(title,content_text) values('Método privado','Conteúdo privado');
select test_assert((select not public from storage.buckets where id='uploads'),'bucket privado');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select test_assert((select count(*)=1 from profiles),'aluno só lê próprio perfil');
select test_assert((select count(*)=0 from orientacoes_ia),'orientações privadas');
select test_assert((select count(*)=0 from documentos_apoio),'documentos privados');
select test_assert((select count(*)=0 from access_codes),'códigos privados');
insert into student_submissions(id,student_id,theme_id,original_text,reviewed_text) values('00000000-0000-4000-8000-000000000030',current_profile_id(),'00000000-0000-4000-8000-000000000020','Minha redação.','Minha redação.');
insert into storage.objects(bucket_id,name) values('uploads','00000000-0000-4000-8000-000000000002/redacao.pdf');
do $$ begin
  begin insert into student_submissions(student_id,theme_id,original_text,reviewed_text) values(current_profile_id(),'00000000-0000-4000-8000-000000000020','Outro texto.','Outro texto.'); raise exception 'FALHOU: envio duplicado';
  exception when raise_exception then if sqlerrm not like 'Você já enviou%' then raise; end if; end;
  begin update student_submissions set status='evaluated'; raise exception 'FALHOU: aluno alterou status'; exception when insufficient_privilege then null; end;
  begin update student_submissions set reviewed_text='Texto novo'; raise exception 'FALHOU: aluno substituiu redação'; exception when insufficient_privilege then null; end;
  begin update profiles set role='teacher'; raise exception 'FALHOU: aluno alterou papel'; exception when insufficient_privilege then null; end;
  begin select * from evaluation_cache; raise exception 'FALHOU: cache exposto'; exception when insufficient_privilege then null; end;
  begin perform save_manual_evaluation('00000000-0000-4000-8000-000000000030','{}'); raise exception 'FALHOU: aluno corrigiu nota';
  exception when raise_exception then if sqlerrm not like 'Acesso exclusivo%' then raise; end if; end;
  begin insert into storage.objects(bucket_id,name) values('uploads','00000000-0000-4000-8000-000000000003/redacao.pdf'); raise exception 'FALHOU: upload em pasta alheia'; exception when insufficient_privilege then null; end;
  begin update student_submissions set message_read_by_teacher=true; raise exception 'FALHOU: aluno marcou leitura'; exception when raise_exception then if sqlerrm not like 'Apenas a professora%' then raise; end if; end;
end $$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
select test_assert((select count(*)=0 from student_submissions),'isolamento das redações');
select test_assert((select count(*)=0 from storage.objects),'isolamento dos arquivos');
reset role;
select set_config('request.jwt.claim.sub','',false);
select persist_evaluation('00000000-0000-4000-8000-000000000030','{"c1_score":160,"c2_score":200,"c3_score":160,"c4_score":160,"c5_score":200,"c1_comment":"A","c2_comment":"B","c3_comment":"C","c4_comment":"D","c5_comment":"E","general_feedback":"Boa base","strengths":[],"improvements":[],"intervention":{}}','ai','hash-test');
select test_assert((select total_score=880 from student_evaluations),'total calculado no banco');
select test_assert((select status='evaluated' from student_submissions),'status atualizado atomicamente');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select test_assert((select count(*)=1 from student_evaluations),'aluno lê avaliação própria');
update student_submissions set student_message='Como melhorar meu argumento?';
do $$ begin
  begin update student_submissions set student_message='Outra dúvida'; raise exception 'FALHOU: substituição da dúvida'; exception when raise_exception then if sqlerrm not like 'Dúvida inválida%' then raise; end if; end;
end $$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select test_assert((select count(*)=3 from profiles),'professora lê alunos');
select test_assert((select count(*)=12 from orientacoes_ia),'12 orientações');
select test_assert((select count(*)=1 from documentos_apoio),'professora lê documentos');
update student_submissions set message_read_by_teacher=true;
select test_assert((select message_read_by_teacher from student_submissions),'professora marca leitura');
select save_manual_evaluation('00000000-0000-4000-8000-000000000030','{"c1_score":200,"c2_score":200,"c3_score":160,"c4_score":160,"c5_score":200,"c1_comment":"A","c2_comment":"B","c3_comment":"C","c4_comment":"D","c5_comment":"E","general_feedback":"Revisada","strengths":[],"improvements":[],"intervention":{}}');
select test_assert((select total_score=920 and source='teacher' and evaluation_hash is null from student_evaluations),'correção manual');
insert into student_submissions(student_id,theme_id,original_text,reviewed_text) values(current_profile_id(),'00000000-0000-4000-8000-000000000020','Direta.','Direta.'),(current_profile_id(),'00000000-0000-4000-8000-000000000020','Direta 2.','Direta 2.');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Uma avaliação automática em andamento não pode apagar a revisão manual.
do $$ begin
  begin perform persist_evaluation('00000000-0000-4000-8000-000000000030','{}','ai','hash'); raise exception 'FALHOU: IA apagou correção manual';
  exception when raise_exception then if sqlerrm not like 'A correção manual foi preservada%' then raise; end if; end;
end $$;
set role service_role;
select test_assert(claim_evaluation('00000000-0000-4000-8000-000000000030'),'primeiro trabalho adquirido');
select test_assert(not claim_evaluation('00000000-0000-4000-8000-000000000030'),'concorrência de avaliações bloqueada');
do $$ begin
  for i in 1..10 loop perform consume_ai_budget('00000000-0000-4000-8000-000000000002'); end loop;
  begin perform consume_ai_budget('00000000-0000-4000-8000-000000000002'); raise exception 'FALHOU: limite diário'; exception when raise_exception then if sqlerrm not like 'Limite diário%' then raise; end if; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin select * from profiles; raise exception 'FALHOU: acesso anônimo'; exception when insufficient_privilege then null; end;
  begin perform claim_evaluation('00000000-0000-4000-8000-000000000030'); raise exception 'FALHOU: função privilegiada anônima'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'SQL e RLS: todas as verificações concluídas' as result;
