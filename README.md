# Papel & Tinta — Professora Andréa

Sistema de redações ENEM em **português brasileiro**, com React 18, Vite, TypeScript, Tailwind, componentes de interface baseados em Radix/shadcn, ícones Lucide e backend Supabase. Interface “Papel e Tinta”, com Montserrat e Lora servidas localmente.

## Executar a demonstração

Requisitos: Node.js 22+ (validado com Node 24), npm.

```bash
cd /workspace/testesChatGPT
npm ci --cache /workspace/.cache/npm
npm run dev
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o sistema abre em **demonstração**. Para executar uma demonstração separada mesmo depois de configurar o Supabase, use `npm run dev:demo` (porta 5174, sem conexão externa). Os testes E2E iniciam esse servidor isolado automaticamente.

O seletor no cabeçalho alterna entre professora e aluno. As alterações ficam no `localStorage` deste navegador. As avaliações iniciais são exemplos pedagógicos identificados como tal: **não são geradas por IA**. Novos textos podem receber uma correção manual pela professora. OCR e refinamento com IA ficam indisponíveis até conectar os serviços.

Para reiniciar os dados demonstrativos, remova a chave `papel-e-tinta-demo-v1` do armazenamento do navegador. Rascunhos são separados por usuário/tema. Evite inserir dados pessoais reais na demonstração.

## Funcionalidades

- **Professora:** painel de indicadores, turmas editáveis, códigos aleatórios com limite/validade, gestão e transferência de alunos entre turmas, temas e textos motivadores, 12 orientações privadas, documentos PDF/texto ativáveis, filtros de redações, correção direta e manual, refinamento contextual por IA e leitura de dúvidas.
- **Aluno:** cadastro exclusivamente por código de turma, painel, propostas de redação, um envio por tema, editor com rascunho e sublinhado âmbar para quebras suspeitas, upload OCR com revisão obrigatória, histórico, notas por competência e dúvida de até 500 caracteres.
- **Devolutiva:** redação com L1…Ln, notas de 0 a 200 em degraus de 40, total calculado no banco, justificativas, evidências literais, cinco elementos da intervenção, pontos fortes e próximos passos.
- **Exportação:** PDF e RTF, individual ou em lote conforme filtros. O RTF usa `\uNNNN?`, incluindo pares substitutos para caracteres fora do plano básico. A numeração de linhas é a mesma da tela e do motor de IA.

## Conectar ao Supabase

A demonstração funciona sem uma conta externa. Para ativar autenticação, armazenamento, IA e OCR reais:

1. Crie um projeto Supabase novo. Aplique `supabase/migrations/202610130001_initial.sql` pelo SQL Editor ou por `supabase db push` após vincular o projeto com a CLI. Esta migração cria tabelas, índices, triggers, funções, RLS, orientações iniciais e o bucket **privado** `uploads`.
2. Em **Auth**, habilite e-mail/senha e confirmação de e-mail. Configure o endereço da aplicação em Site URL e Redirect URLs. Não ofereça login anônimo. Ajuste os limites de cadastro e CAPTCHA nas configurações do Supabase para uso público.
3. Registre o e-mail autorizado da professora pelo SQL Editor:

   ```sql
   insert into public.teacher_invitations (email, full_name)
   values (lower('EMAIL_DA_PROFESSORA'), 'Andréa');
   ```

   Em **Authentication → Users**, crie a conta desse mesmo e-mail com uma senha definida de forma segura pela professora. O trigger consome o convite e cria o perfil `teacher`. Nenhuma senha padrão é distribuída. O convite só pode ser escrito por SQL/serviço; metadados do cliente nunca definem privilégios. Crie a primeira turma e seu código pela interface, após entrar como professora.
4. Copie `.env.example` para `.env.local` e configure:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=CHAVE_PUBLICA_DO_PROJETO
   ```

   A chave pública/anon é própria para o navegador; a chave **service_role** nunca deve ter prefixo `VITE_` ou aparecer no frontend. Reinicie o Vite depois de alterar essas variáveis. O modo demonstrativo é desativado automaticamente quando ambas estão presentes.
5. Configure `OPENAI_API_KEY` nos **segredos das Edge Functions do Supabase**, pelo painel seguro. Opcionalmente, defina `OPENAI_MODEL` (padrão `gpt-4o`; também aceita `gpt-4o-mini` e versões datadas compatíveis) e `WEB_ORIGIN` (origem do frontend para CORS). `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são bindings fornecidos pelo runtime Supabase.
6. Implante as funções:

   ```bash
   supabase functions deploy evaluate-student-essay
   supabase functions deploy ocr-extract
   ```

   Para publicar pelo editor do painel, sem usar a CLI, execute `node scripts/prepare-edge.mjs`. Ele gera arquivos completos em `supabase/dashboard/evaluate-student-essay/index.js` e `supabase/dashboard/ocr-extract/index.js`. Crie cada função com o nome correspondente e substitua o conteúdo do arquivo `index.ts` do editor pelo conteúdo do arquivo completo gerado. São arquivos JavaScript válidos no runtime TypeScript das Edge Functions, com os módulos locais já incluídos. Configure os segredos no painel e mantenha a opção de verificação JWT do gateway desativada; a autenticação é validada pelo código das funções.

   O arquivo `supabase/config.toml` desabilita a verificação JWT do gateway porque as próprias funções chamam `auth.getUser()` **antes** de acessar dados. Não há endpoint de avaliação público sem autenticação.
7. Cadastre temas e personalize as 12 orientações. Envie um texto com uma conta de aluno criada com um código válido. Verifique a devolutiva, o isolamento entre alunos, OCR, signed URL de documento, uma correção manual e um refinamento. As integrações externas ainda precisam desse teste com suas credenciais.

**Destinos necessários:** o domínio HTTPS do seu projeto Supabase e `api.openai.com` nas funções de IA. Os pacotes são baixados de `registry.npmjs.org`. Não é necessário fornecer um token GitHub para executar a aplicação. Os segredos do provedor pertencem ao runtime Supabase, não ao Vite.

## Modelo e segurança

A migração contém as oito entidades solicitadas: `profiles`, `turmas`, `access_codes`, `themes`, `orientacoes_ia`, `documentos_apoio`, `student_submissions`, `student_evaluations`. Há quatro tabelas internas adicionais: convites da professora, cache de avaliação, contagem diária de IA e bloqueios de avaliações em andamento. **Todas têm RLS.**

- Alunos leem seu perfil, sua turma, propostas disponíveis/históricas e suas próprias redações/avaliações. Orientações, documentos, códigos e cache não ficam acessíveis ao aluno.
- Cadastro valida o código, a validade, o limite e a turma ativa na mesma transação que cria o usuário. O contador é atualizado sob bloqueio de linha; os metadados `role` enviados pelo navegador são ignorados.
- A unicidade de envio aluno/tema usa um bloqueio transacional para impedir envios concorrentes. Professores podem salvar múltiplas correções diretas sobre o mesmo tema.
- Colunas sensíveis de perfil e redação têm privilégios de escrita restritos. Aluno não pode mudar papel, substituir redação, marcar leitura, definir status ou gravar avaliação. A professora marca leitura sem substituir o conteúdo da dúvida. Cada aluno envia uma dúvida por redação corrigida.
- `save_manual_evaluation` exige perfil de professora e persiste notas/status atomicamente. O total é uma coluna gerada. O banco rejeita notas fora dos degraus ENEM e anulações com pontuação diferente de zero.
- `uploads` aceita até 10 MB por arquivo. A pasta é o UUID do usuário. Links de leitura são assinados, com 60 segundos de validade. Não há URL pública de upload. Professores leem arquivos para revisão; alunos não leem arquivos alheios.
- As funções validam a identidade com Auth e verificam a propriedade da redação antes de usar o cliente de serviço. O limite de IA é de 10 chamadas/dia por aluno e 200 por professora, compartilhado entre OCR e avaliação. Há bloqueio de processamento por redação com recuperação após 5 minutos.
- Tokens, prompts, redações e conteúdo do provedor não são registrados nos logs. Erros de provedor retornam mensagens controladas.

## Motor de avaliação

A implementação comum em `supabase/functions/_shared/essay.ts` é reexportada ao frontend. Ela preserva palavras e parágrafos na régua de cerca de 80 caracteres. Palavras maiores que 80 caracteres não são fragmentadas. Essa régua **não equivale à contagem de linhas de uma folha manuscrita** e não é usada como critério automático de anulação.

O hash SHA-256 inclui texto, tema, orientações, documentos ativos, provedor, modelo e versão do motor. A troca para OpenAI usa uma nova versão do cache, preservando as avaliações já salvas e separando resultados de provedores anteriores. Refinamentos também incluem o pedido e a avaliação anterior. O cache é lido antes da chamada ao provedor. Notas revisadas manualmente têm origem `teacher` e não são reutilizadas como cache da IA. Uma chamada repetida para uma redação já corrigida retorna sua avaliação atual; somente a professora pode solicitar um refinamento.

A API da OpenAI recebe JSON Schema estrito (Structured Outputs), temperatura 0,1 e seed derivada do hash. O modelo padrão é GPT-4o e o OCR usa entradas multimodais: imagens são enviadas como `image_url` e PDFs como `file`. `store: false` desativa o armazenamento de respostas para recuperação pela API; as políticas de retenção do provedor continuam aplicáveis. A assinatura do ChatGPT e o faturamento da API são separados. Seed reduz variação, mas o provedor não garante resultados idênticos entre versões; o cache torna as chamadas repetidas estáveis. Há parser de fallback para JSON em markdown. O validador exige cinco competências distintas, evidencia literal na linha indicada e trechos literais para os cinco elementos de C5 (ou `null` quando ausentes). Notas são normalizadas para degraus de 40; anulações justificadas zeram as cinco competências. Respostas inválidas ou com referências conhecidas ao contexto privado são rejeitadas antes da persistência. O validador não comprova por si só o mérito pedagógico de cada justificativa; a professora pode revisar a avaliação.

O texto original do OCR e o texto revisado são guardados separadamente. O banco também exige `ocr_review_confirmed` quando a redação está vinculada a um arquivo. O OCR preserva a escrita, marca `[ilegível]` e não tenta completar palavras. A interface exige confirmação de revisão antes do envio. PDFs de apoio devem ter camada de texto; PDFs digitalizados podem ser transcritos e colados manualmente. O contexto ativo de avaliação tem limite de 200.000 caracteres, para evitar chamadas excessivas.

## Validação e manutenção

```bash
npm test                # 20 testes: regras compartilhadas e mensagens de falha
npm run typecheck       # TypeScript do frontend
npm run build           # Build de produção
npm run check:edge      # TypeScript das duas Edge Functions (Deno)
npm run test:edge       # 20 testes: validador e integração OpenAI simulada, sem custo de API
npm run test:e2e        # Fluxos no Chromium: gestão, correção, dúvida e exportações
npm run test:db         # PostgreSQL 17 em Docker, migração + isolamento/RLS
```

Os testes do banco usam uma fixture mínima das tabelas de Auth/Storage sobre PostgreSQL real. Validam a migração e as políticas, mas não substituem o teste em um Supabase hospedado. O script cria e remove seu próprio contêiner, sem publicar portas. Docker é opcional para desenvolvimento do frontend.

Para os testes de navegador, use o Chromium instalado em `/usr/bin/chromium`, defina `CHROMIUM_PATH` ou instale o browser com `npx playwright install chromium`. Para Deno, os scripts usam o cache ignorado `.cache/deno`. Dependências e versões efetivas ficam registradas em `package-lock.json`.

O servidor de produção pode usar `dist/` em uma hospedagem estática HTTPS. Não hospede segredos no bundle. `npm run preview` serve para validar o build local; não é um servidor de produção. O frontend ainda precisa ser publicado em uma hospedagem. Neste ambiente, a URL e a chave pública do Supabase já foram configuradas. As funções evaluate-student-essay e ocr-extract foram publicadas pelo usuário e responderam a verificações HTTP, incluindo rejeição de pedidos sem login. A correção e o OCR com usuário autenticado ainda precisam de teste funcional com a OpenAI.

## Organização

```text
src/components/                 Telas, formulários e componentes acessíveis
src/lib/                        Tipos, dados demonstrativos, acesso Supabase e exportações
supabase/migrations/            Esquema PostgreSQL, RLS, triggers e funções
supabase/functions/_shared/     HTTP, provedor OpenAI, régua e validação
supabase/functions/evaluate-student-essay/
supabase/functions/ocr-extract/
tests/e2e/                      Fluxos do navegador
scripts/test-db.sh               Teste SQL/RLS com banco temporário
```

Cada tarefa de nuvem já é isolada. Use este checkout existente; não crie worktrees para iniciar o projeto sem uma solicitação explícita.

A chave `OPENAI_API_KEY` deve ser criada em https://platform.openai.com/api-keys e configurada somente em **Supabase → Edge Functions → Secrets**. Não configure esta chave como variável `VITE_` nem a coloque nos arquivos das funções. Para ativar, a conta da API precisa de faturamento/créditos disponíveis. Chamadas reais de correção e OCR ainda precisam de validação após a publicação das funções e a configuração da chave.

## Publicação manual do site

O pacote estático preparado neste ambiente está em `/workspace/releases/papel-e-tinta-site.zip`. Ele contém a pasta `papel-e-tinta-site` com `index.html` e os arquivos de `dist`, usando a conexão pública configurada do Supabase. Não contém arquivos `.env`, código SQL ou chaves privadas de IA.

Para publicar pelo Netlify, extraia o ZIP, entre em https://app.netlify.com/drop e envie a pasta que contém `index.html`. Depois de obter a URL HTTPS do site, configure essa URL em **Supabase → Authentication → URL Configuration → Site URL** e na lista de redirecionamentos permitidos. Entre com a conta da professora e teste correção e OCR. A publicação do ambiente Codex e a publicação do site são etapas distintas.

## Entrega pelo GitHub

A branch `codex/papel-e-tinta` inclui o código completo e a pasta `site/`, com o build estático preparado para publicação manual. No GitHub, selecione essa branch e use **Code → Download ZIP**. Extraia o arquivo e envie somente a pasta `site` ao Netlify Drop.

Também é possível importar essa branch no Netlify. `netlify.toml` configura o build e a conexão pública do Supabase; a chave publishable é destinada ao navegador. A chave privada da OpenAI permanece exclusivamente nos segredos do Supabase e não é incluída no repositório ou no site. Se modificar o código, execute `npm run build` para gerar um novo `dist`; a pasta `site` é uma cópia do build atual.

## Botão de correção desativado

Antes de corrigir, cadastre o tema real da proposta em **Temas de redação → Novo tema**, preencha título e textos motivadores e salve. Em **Correção direta**, selecione esse tema, cole a redação e clique em **Salvar para corrigir → Confirmar envio**. Na devolutiva, clique em **Avaliar com IA**. Quando não houver temas, a interface mostra o requisito e um atalho para cadastrar o primeiro, preservando o rascunho no mesmo navegador. O cenário foi validado no teste E2E de projeto sem temas.

Para atualizar um site publicado manualmente, baixe novamente o ZIP da branch `codex/papel-e-tinta`, extraia e envie a pasta `site` pela área de upload de deploy manual em **Netlify → seu site → Deploys**. Isso mantém o endereço do site existente.
