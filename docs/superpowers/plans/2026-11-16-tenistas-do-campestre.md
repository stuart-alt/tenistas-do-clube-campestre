# Tenistas do Campestre — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA (Android + iPhone, sem lojas) para tenistas do clube: perfis, busca por disponibilidade, salas de simples/duplas, partidas com confirmação, rankings de Simples e Duplas, avisos, sininho e painel de admin.

**Architecture:** Front estático React + TypeScript (Vite) publicado no GitHub Pages. Todo dado e toda regra (pontuação, ranking, confirmações, permissões) vivem no Supabase: tabelas com RLS, escrita apenas por funções RPC `security definer`, recálculo do ranking por reprocessamento cronológico em PL/pgSQL, auto-confirmação por pg_cron. O front só lê views/tabelas e chama RPCs.

**Tech Stack:** Node 24, Vite 5, React 18, TypeScript 5, react-router-dom 6, @tanstack/react-query 5, @supabase/supabase-js 2, Tailwind CSS 3.4, vite-plugin-pwa 0.20, react-markdown 9, Vitest 2 + @testing-library/react 16 + jsdom; Supabase CLI (devDependency `supabase`, via `npx supabase`, Docker local) com pgTAP (`npx supabase test db`); `qrcode` (script).

**Spec:** `docs/superpowers/specs/2026-11-16-tenistas-do-campestre-design.md` — leia junto com este plano.

## Global Constraints

- Interface 100% em português (Brasil). Identificadores de código/banco em português, sem acentos (`partidas`, `data_jogo`).
- URL permanente: `https://stuart-alt.github.io/tenistas-do-clube-campestre/` → Vite `base: '/tenistas-do-clube-campestre/'`, router `basename` igual, manifest `start_url` e `scope` iguais.
- GitHub Pages: `dist/404.html` = cópia de `dist/index.html` (fallback de SPA).
- Supabase client com `auth.flowType: 'implicit'` (o link de redefinir senha abre no Safari, que não compartilha armazenamento com a PWA instalada; PKCE quebraria).
- Cadastro sem confirmação de e-mail (`[auth.email] enable_confirmations = false`).
- Nenhuma escrita direta do cliente em tabelas de jogo (partidas, salas, pontos, regras, avisos, notificações exceto `lida`): só via RPC.
- Fuso de referência para "hoje": `America/Sao_Paulo` (função `public.hoje()` no banco; `hojeLocal()` no front).
- Valores iniciais de regras (por modalidade, `simples` e `duplas`): vitória 50, set 10, game 1, bônus 20% (`0.20`), teto 50, janela 6 meses.
- Bônus = `least(floor((media_perdedor - media_vencedor) * bonus_pct), bonus_teto)` quando positivo, senão 0. Arredondamento para baixo (decisão do construtor).
- Super tie-break: conta como set vencido; vale 1 game ao vencedor dele, 0 ao perdedor.
- Placar: 1 a 3 sets; set sem empate; partida sem empate em sets; super tie-break só pode ser o último set.
- Data do jogo: entre `hoje() - 7` e `hoje()` (admin: qualquer data ≤ hoje).
- Auto-confirmação: partida `pendente` há mais de 48 h (`created_at`).
- Salas somem da lista 3 dias após `data_hora`.
- Habilidades: inteiro 1–5 (estrelas), padrão 3.
- Disponibilidade: `text[]` de slots `<dia>_<periodo>`, dias `seg ter qua qui sex sab dom`, períodos `manha tarde noite`.
- Erros de regra levantados no banco com mensagem = código em MAIÚSCULAS (ex.: `PLACAR_EMPATADO`); o front traduz por tabela única.

## Review Focus

1. **Duas partidas no mesmo dia / confirmação fora de ordem** — o bônus da segunda deve usar os pontos já incluindo a primeira (ordem `data_jogo, created_at, id`) e mudar quando uma partida anterior é confirmada depois. Teste em Task 3.
2. **Jogador desativado** — some do ranking, busca e salas, mas os pontos que os adversários ganharam contra ele permanecem. Teste em Task 3 e Task 6.
3. **Duas pessoas pegando a mesma vaga ao mesmo tempo** — a segunda recebe `VAGA_OCUPADA`, não erro genérico, e a sala não fica com 3 em simples. Teste em Task 5.
4. **Lançar partida às 23h30 em São Paulo** — data padrão do formulário é o dia local, não o dia UTC seguinte; o banco aceita. Teste em Task 7 (`hojeLocal`) e Task 2 (`hoje()`).
5. **Telefone digitado de qualquer jeito** — `(11) 98765-4321`, `+55 11 98765-4321`, `11987654321` geram o mesmo link `https://wa.me/5511987654321`; lixo não gera botão. Teste em Task 7.

---

## Estrutura de arquivos

```
package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html
.github/workflows/deploy.yml
public/logo.svg, public/pwa-192.png, public/pwa-512.png, public/apple-touch-icon.png
scripts/copiar-404.mjs, scripts/gerar-qrcode.mjs
supabase/config.toml
supabase/seed.sql                          # só local: schema tests + helpers
supabase/migrations/20261116000001_perfis.sql
supabase/migrations/20261116000002_partidas.sql
supabase/migrations/20261116000003_ranking.sql
supabase/migrations/20261116000004_confirmacao_notificacoes.sql
supabase/migrations/20261116000005_salas.sql
supabase/migrations/20261116000006_avisos_admin.sql
supabase/tests/database/01_perfis.test.sql ... 06_avisos_admin.test.sql
src/main.tsx, src/App.tsx, src/index.css
src/lib/supabase.ts, src/lib/database.types.ts (gerado), src/lib/erros.ts,
src/lib/whatsapp.ts, src/lib/disponibilidade.ts, src/lib/datas.ts, src/lib/plataforma.ts
src/auth/AuthProvider.tsx, EntrarPage.tsx, CadastroPage.tsx, EsqueciSenhaPage.tsx, RedefinirSenhaPage.tsx, RotaProtegida.tsx
src/layout/Layout.tsx, src/layout/InstalarBanner.tsx
src/perfil/EditarPerfilPage.tsx, PerfilPage.tsx, GradeDisponibilidade.tsx, Estrelas.tsx, FotoUpload.tsx
src/jogadores/BuscarPage.tsx
src/ranking/RankingPage.tsx
src/partidas/LancarPartidaPage.tsx, PlacarInput.tsx, PartidasPage.tsx, PartidaCard.tsx
src/salas/SalasPage.tsx, NovaSalaPage.tsx, SalaPage.tsx
src/notificacoes/Sininho.tsx, NotificacoesPage.tsx
src/avisos/AvisosPage.tsx, AvisoForm.tsx
src/admin/AdminPage.tsx, RegrasForm.tsx, Contestacoes.tsx, JogadoresAdmin.tsx
src/**/*.test.ts(x)
docs/DEPLOY.md
```

---

### Task 1: Esqueleto do projeto, PWA, deploy e Supabase local

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test-setup.ts`, `src/App.test.tsx`, `public/logo.svg` + ícones PNG, `scripts/copiar-404.mjs`, `.github/workflows/deploy.yml`, `.gitignore`, `.env.example`, `supabase/config.toml` (via `npx supabase init`), `supabase/seed.sql` (vazio por ora)

**Interfaces:**
- Produces: scripts npm `dev`, `build` (= `tsc -b && vite build && node scripts/copiar-404.mjs`), `test` (= `vitest run`), `db:start` (= `supabase start`), `db:reset` (= `supabase db reset`), `db:test` (= `supabase test db`), `db:types` (= `supabase gen types typescript --local > src/lib/database.types.ts`). Env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 1:** `npm create vite@5 . -- --template react-ts`, instalar dependências da Tech Stack, configurar Tailwind e Vitest (`environment: 'jsdom'`, `setupFiles: ['src/test-setup.ts']` com `@testing-library/jest-dom`).
- [ ] **Step 2:** `vite.config.ts`: `base: '/tenistas-do-clube-campestre/'`; `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Tenistas do Campestre', short_name: 'Tenistas', lang: 'pt-BR', display: 'standalone', start_url: '/tenistas-do-clube-campestre/', scope: '/tenistas-do-clube-campestre/', theme_color: '#166534', background_color: '#ffffff', icons: [192, 512] } })`. `index.html`: `lang="pt-BR"`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`. Ícones gerados de `public/logo.svg` (bola de tênis simples) — ferramenta à escolha.
- [ ] **Step 3: Teste que falha** — `src/App.test.tsx`: renderiza `<App />` e espera `screen.getByText('Tenistas do Campestre')`.
- [ ] **Step 4:** `npm test` → FAIL. Implementar `App` mínimo com esse título. `npm test` → PASS.
- [ ] **Step 5:** `scripts/copiar-404.mjs` copia `dist/index.html` → `dist/404.html`. `npm run build` → existe `dist/404.html` e `dist/manifest.webmanifest`.
- [ ] **Step 6:** `.github/workflows/deploy.yml`: em push para `main`: checkout, setup-node 24, `npm ci`, `npm test`, `npm run build` com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` vindos de `secrets`, `actions/upload-pages-artifact@v3` (path `dist`), `actions/deploy-pages@v4`. Permissões `pages: write`, `id-token: write`.
- [ ] **Step 7:** `npx supabase init`; em `supabase/config.toml`: `[auth] site_url = "http://localhost:5173/tenistas-do-clube-campestre/"`, `additional_redirect_urls` incluindo a URL de produção; `[auth.email] enable_confirmations = false`. `npm run db:start` sobe (Docker). `.env.example` com as duas variáveis; `.env.local` ignorado pelo git.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "chore: esqueleto React+PWA, deploy Pages e Supabase local"`

---

### Task 2: Perfis, helpers de teste, fotos e cadastro no banco

**Files:**
- Create: `supabase/migrations/20261116000001_perfis.sql`, `supabase/tests/database/01_perfis.test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces:
  - `public.hoje() returns date` — `(now() at time zone 'America/Sao_Paulo')::date`.
  - `public.is_admin() returns boolean` — security definer, lê `profiles.is_admin` de `auth.uid()`.
  - Tabela `public.profiles(id uuid pk → auth.users on delete cascade, email text unique not null, nome text not null, data_nascimento date not null, telefone text not null, genero text check in ('masculino','feminino'), categoria text check in ('A','B','C','D'), foto_url text, forehand/backhand/saque/voleio/velocidade/resistencia smallint not null default 3 check 1..5, disponibilidade text[] not null default '{}', ativo boolean not null default true, is_admin boolean not null default false, created_at timestamptz default now())`.
  - Trigger em `auth.users` after insert → cria profile a partir de `raw_user_meta_data` (`nome, data_nascimento, telefone, genero, categoria`) e `email`.
  - Trigger before update em profiles: se não `is_admin()` (e não superusuário), mantém `is_admin`, `ativo`, `email` antigos.
  - RLS profiles: select para `authenticated` se `ativo or id = auth.uid() or is_admin()`; update se `id = auth.uid()` ou `is_admin()`; sem insert/delete para clientes.
  - Bucket Storage `fotos` público para leitura; insert/update/delete apenas em objetos cujo primeiro segmento do caminho = `auth.uid()::text`.
  - Em `seed.sql` (só local), schema `tests` com grant usage/execute para `authenticated`:
    - `tests.criar_usuario(p_email text, p_nome text default 'Jogador', p_admin boolean default false) returns uuid`
    - `tests.logar_como(p_id uuid) returns void` — `set_config('request.jwt.claims', json {sub, role:'authenticated'}, true)` + `set local role authenticated`
    - `tests.deslogar() returns void` — `reset role`

- [ ] **Step 1: Teste que falha** — `01_perfis.test.sql` (pgTAP, `begin; select plan(N); ... select * from finish(); rollback;`):
  - criar usuário via `tests.criar_usuario('ana@x.com','Ana')` → `is((select nome from profiles where email='ana@x.com'), 'Ana')`; `is(categoria, 'C')` quando meta tem categoria C.
  - logado como Ana: `update profiles set categoria='B' where id=ana` → categoria = 'B' (categoria editável).
  - logado como Ana: `update profiles set is_admin=true, ativo=false where id=ana` → continuam `false`/`true`.
  - logado como Ana: update no perfil de Bruno → 0 linhas afetadas.
  - Bruno desativado (como superusuário): Ana logada não vê Bruno (`count = 0`); admin logado vê.
  - `is(hoje(), (now() at time zone 'America/Sao_Paulo')::date)`.
  - `throws_ok` ao gravar `forehand = 6`.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL (tabela inexistente).
- [ ] **Step 3:** Escrever migration e helpers do seed conforme Interfaces.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `feat(db): perfis, RLS, fotos e helpers de teste`

---

### Task 3: Partidas, registro e motor de ranking

**Files:**
- Create: `supabase/migrations/20261116000002_partidas.sql`, `supabase/migrations/20261116000003_ranking.sql`, `supabase/tests/database/02_partidas.test.sql`, `supabase/tests/database/03_ranking.test.sql`
- Modify: `supabase/seed.sql` (helper `tests.partida_confirmada`)

**Interfaces:**
- Consumes: `profiles`, `hoje()`, `is_admin()`, helpers `tests.*`.
- Produces:
  - `regras(modalidade text pk check in ('simples','duplas'), pts_vitoria int, pts_set int, pts_game int, bonus_pct numeric(4,2), bonus_teto int, janela_meses int)` — seed na migration com os valores das Global Constraints para as duas linhas. Select para `authenticated`.
  - `partidas(id uuid pk default gen_random_uuid(), modalidade text, data_jogo date, sala_id uuid null, lancado_por uuid → profiles, status text check in ('pendente','confirmada','contestada','cancelada') default 'pendente', motivo_contestacao text, confirmado_por uuid, confirmado_em timestamptz, created_at timestamptz default now())`.
  - `partida_jogadores(partida_id → partidas on delete cascade, jogador_id → profiles, lado smallint check in (1,2), pk(partida_id, jogador_id))`.
  - `partida_sets(partida_id → partidas on delete cascade, ordem smallint check 1..3, games_lado1 smallint ≥0, games_lado2 smallint ≥0, super_tiebreak boolean default false, pk(partida_id, ordem))`.
  - `pontos_partida(partida_id, jogador_id, modalidade, data_jogo, vitoria boolean, pontos int, bonus int, pk(partida_id, jogador_id))` — cache, recriado pelo recálculo.
  - RLS: select para `authenticated` em todas; nenhuma escrita direta.
  - `registrar_partida(p_modalidade text, p_data_jogo date, p_lado1 uuid[], p_lado2 uuid[], p_sets jsonb, p_sala_id uuid default null) returns uuid` — security definer. `p_sets` = `[{"l1":6,"l2":4,"stb":false}, ...]`. Erros: `NAO_PARTICIPANTE` (caller fora dos lados e não admin), `JOGADORES_INVALIDOS` (tamanho ≠ 1/2 por lado conforme modalidade, repetidos ou inativos), `DATA_INVALIDA`, `SETS_INVALIDOS` (0 ou >3 sets, games negativos), `SET_EMPATADO`, `PLACAR_EMPATADO`, `SUPER_TIEBREAK_NAO_FINAL`. Status `pendente`, `lancado_por = auth.uid()`. Se `p_sala_id`, grava `salas.partida_id` (coluna criada na Task 5 — nesta task, apenas guardar `sala_id` na partida).
  - `recalcular_ranking(p_modalidade text) returns void` — security definer.
  - `tests.partida_confirmada(p_modalidade text, p_data date, p_lado1 uuid[], p_lado2 uuid[], p_sets jsonb) returns uuid` — insere direto (sem validação de data), status `confirmada`, chama `recalcular_ranking`.
  - View `ranking` (security_invoker): `modalidade, jogador_id, nome, categoria, foto_url, pontos, vitorias, partidas, posicao` — soma `pontos+bonus` de `pontos_partida` com `data_jogo > hoje() - make_interval(months => janela_meses)`, só jogadores `ativo` com ≥1 partida na janela; `posicao = rank() over (partition by modalidade order by pontos desc)`; ordenação padrão `pontos desc, vitorias desc, nome`.
  - `pontos_expirando(p_jogador uuid, p_modalidade text, p_dias int default 30) returns table(pontos int, expira_em date)` — soma dos pontos (com bônus) de partidas na janela cuja expiração (`data_jogo + janela`) cai nos próximos `p_dias`; `expira_em` = a mais próxima. Zero linhas se nada expira.

Algoritmo de `recalcular_ranking` (não determinado pela assinatura):

```
delete from pontos_partida where modalidade = p_modalidade;
r := regras de p_modalidade;
for m in partidas confirmadas da modalidade order by data_jogo, created_at, id:
  sets_l1, sets_l2, games_l1, games_l2 := 0
  for s in sets de m:
    lado vencedor do set := 1 se l1>l2 senão 2; soma 1 em sets_<lado>
    if s.stb: games_<lado vencedor> += 1
    else: games_l1 += s.l1; games_l2 += s.l2
  venc := 1 se sets_l1 > sets_l2 senão 2
  para cada jogador j de m: pts_antes(j) := coalesce(sum(pontos+bonus) from pontos_partida
        where jogador_id=j and modalidade=p_modalidade
          and data_jogo > m.data_jogo - make_interval(months => r.janela_meses), 0)
     -- só existem linhas de partidas já processadas → "anteriores na ordem"
  dif := avg(pts_antes dos perdedores) - avg(pts_antes dos vencedores)
  bonus := case when dif > 0 then least(floor(dif * r.bonus_pct), r.bonus_teto) else 0 end
  insert para cada jogador:
    pontos = (r.pts_vitoria se lado=venc senão 0) + sets_<lado>*r.pts_set + games_<lado>*r.pts_game
    bonus  = bonus se lado=venc senão 0
    vitoria = (lado = venc)
```

- [ ] **Step 1: Teste que falha** — `02_partidas.test.sql`:
  - Ana logada registra simples vs Bruno, hoje, `6-4 3-6 6-2` → retorna uuid, status `pendente`, 2 linhas em `partida_jogadores`, 3 em `partida_sets`.
  - `throws_ok` com mensagem: Carla (não participante) registrando Ana×Bruno → `NAO_PARTICIPANTE`; data `hoje()+1` e `hoje()-8` → `DATA_INVALIDA`; `hoje()-7` aceita; sets `6-6` → `SET_EMPATADO`; `6-4 4-6` → `PLACAR_EMPATADO`; 4 sets → `SETS_INVALIDOS`; stb no 1º de 3 sets → `SUPER_TIEBREAK_NAO_FINAL`; duplas com 1 jogador por lado → `JOGADORES_INVALIDOS`; mesmo jogador nos dois lados → `JOGADORES_INVALIDOS`; adversário inativo → `JOGADORES_INVALIDOS`.
  - insert direto em `partidas` como `authenticated` → falha (RLS).
- [ ] **Step 2: Teste que falha** — `03_ranking.test.sql` (usa `tests.partida_confirmada`; IDs A, B, C, D, X):
  - **Exemplo do spec:** A×B `6-4 3-6 6-2`, ambos com 0 → A: pontos 85, bônus 0; B: 22.
  - **Super tie-break:** `6-4 4-6 10-7(stb)` → vencedor 81 (50+20+11), perdedor 20 (10+10).
  - **Bônus:** B vence X `6-0 6-0` (B=82); depois A (0) vence B `6-4 3-6 6-2` → bônus de A = 16 (`floor(82*0.20)`), total A = 101.
  - **Teto:** mesmo cenário com `bonus_pct = 1.00` → bônus 50.
  - **Duplas:** médias — lado vencedor (0, 0) vence lado perdedor (82, 0) → média 41 → bônus 8 para **cada** vencedor.
  - **Mesmo dia, ordem:** duas partidas na mesma data; a segunda (created_at maior) usa os pontos da primeira no cálculo do bônus.
  - **Confirmação fora de ordem:** partida P2 (data d) confirmada; depois P1 (data d-1) confirmada e recálculo → bônus de P2 muda para refletir P1.
  - **Janela:** partida com `data_jogo = hoje() - interval '7 months'` não entra no `ranking`; com `hoje() - interval '5 months'` entra.
  - **Ranking:** quem não tem partida não aparece; dois jogadores com mesmos pontos têm mesma `posicao`; ordem por vitórias depois nome.
  - **Inativo:** B desativado some do `ranking`, mas os pontos de A ganhos contra B continuam.
  - **Modalidades separadas:** partida de duplas não altera `ranking` de simples.
  - **Expirando:** partida de 85 pts com `data_jogo = hoje() - 6 meses + 10 dias` → `pontos_expirando(A,'simples')` = (85, essa data + 6 meses).
- [ ] **Step 3:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 4:** Implementar migrations 0002 e 0003 e helper do seed conforme Interfaces e algoritmo.
- [ ] **Step 5:** `npm run db:reset && npm run db:test` → PASS (todos os arquivos).
- [ ] **Step 6: Commit** — `feat(db): partidas, validação de placar e motor de ranking`

---

### Task 4: Confirmação, contestação, auto-confirmação e notificações

**Files:**
- Create: `supabase/migrations/20261116000004_confirmacao_notificacoes.sql`, `supabase/tests/database/04_confirmacao.test.sql`
- Modify: `registrar_partida` (via `create or replace` nesta migration) para notificar adversários.

**Interfaces:**
- Consumes: `partidas`, `recalcular_ranking`, `is_admin()`.
- Produces:
  - `notificacoes(id uuid pk, usuario_id → profiles on delete cascade, tipo text, texto text, link text, lida boolean default false, created_at timestamptz default now())`. RLS: select e update (só coluna `lida`, via grant de coluna) do próprio usuário.
  - Tipos: `sala_entrou`, `sala_saiu`, `sala_completa`, `sala_cancelada`, `partida_pendente`, `partida_confirmada`, `partida_contestada`, `aviso_novo`, `contestacao_admin`.
  - `notificar(p_usuario uuid, p_tipo text, p_texto text, p_link text) returns void` (interna, sem grant a clientes).
  - `registrar_partida` passa a notificar cada adversário (`partida_pendente`, link `/partidas`).
  - `confirmar_partida(p_id uuid) returns void` — permitido a jogador do lado oposto ao `lancado_por` com status `pendente`, ou admin com status `pendente`/`contestada`. Senão `SEM_PERMISSAO` / `STATUS_INVALIDO`. Define `confirmada`, `confirmado_por`, `confirmado_em`, recalcula a modalidade, notifica os demais jogadores (`partida_confirmada`).
  - `contestar_partida(p_id uuid, p_motivo text) returns void` — adversário de `lancado_por`, status `pendente`. Status `contestada`, notifica `lancado_por` (`partida_contestada`) e todos os admins (`contestacao_admin`, link `/admin`).
  - `admin_corrigir_partida(p_id uuid, p_data_jogo date, p_sets jsonb) returns void` — admin; mesmas validações de placar (`SET_EMPATADO` etc.) e `data_jogo ≤ hoje()`; substitui sets, confirma, recalcula.
  - `admin_cancelar_partida(p_id uuid) returns void` — admin; status `cancelada`, recalcula.
  - `auto_confirmar_partidas() returns int` — confirma `pendente` com `created_at < now() - interval '48 hours'`, recalcula modalidades afetadas, retorna quantidade. Agendado: `create extension if not exists pg_cron; select cron.schedule('auto-confirmar', '0 * * * *', 'select public.auto_confirmar_partidas()')`.
  - Extrair a validação de placar de `registrar_partida` para `validar_sets(p_sets jsonb) returns void` e reutilizá-la (DRY).

- [ ] **Step 1: Teste que falha** — `04_confirmacao.test.sql`:
  - Ana lança vs Bruno → Bruno tem 1 notificação `partida_pendente`; ranking sem pontos.
  - Ana tenta confirmar a própria → `SEM_PERMISSAO`. Bruno confirma → `confirmada`, ranking: Ana 85.
  - Duplas Ana+Carla × Bruno+Davi lançada por Ana: Carla confirmar → `SEM_PERMISSAO`; Davi confirma → ok.
  - Bruno contesta → `contestada`, admin recebe `contestacao_admin`; Bruno tenta confirmar depois → `STATUS_INVALIDO`; admin confirma → `confirmada`.
  - Admin corrige placar para `6-0 6-0` → pontos recalculados (Ana 82). Admin cancela → Ana some do ranking.
  - Partida com `created_at = now() - interval '49 hours'` → `auto_confirmar_partidas()` retorna 1 e status `confirmada`; com 47 h → continua `pendente`.
  - Ana não vê notificações de Bruno; Ana consegue `update notificacoes set lida=true` nas suas; não consegue alterar `texto`.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3:** Implementar migration 0004.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `feat(db): confirmação, contestação, auto-confirmação e notificações`

---

### Task 5: Salas

**Files:**
- Create: `supabase/migrations/20261116000005_salas.sql`, `supabase/tests/database/05_salas.test.sql`

**Interfaces:**
- Consumes: `notificar`, `profiles`, `partidas.sala_id`.
- Produces:
  - `salas(id uuid pk, criador uuid → profiles, modalidade text, data_hora timestamptz, recado text, status text check in ('aberta','confirmada','cancelada') default 'aberta', partida_id uuid null → partidas, created_at)`.
  - `sala_vagas(sala_id → salas on delete cascade, posicao smallint, jogador_id → profiles, pk(sala_id, posicao), unique(sala_id, jogador_id))`. Simples: posições 1–2. Duplas: 1–2 = Dupla 1, 3–4 = Dupla 2.
  - RLS: select para `authenticated`; escrita só via RPC.
  - `criar_sala(p_modalidade text, p_data_hora timestamptz, p_recado text, p_posicao smallint) returns uuid` — `DATA_INVALIDA` se `data_hora <= now()`; criador ocupa `p_posicao`.
  - `entrar_sala(p_sala uuid, p_posicao smallint) returns void` — erros `VAGA_OCUPADA` (inclusive violação de pk por concorrência — capturar `unique_violation`), `JA_NA_SALA`, `POSICAO_INVALIDA`, `SALA_FECHADA` (cancelada ou já com partida). Notifica os outros (`sala_entrou`); se ficou cheia → status `confirmada` e notifica todos (`sala_completa`).
  - `sair_sala(p_sala uuid) returns void` — remove vaga, status volta a `aberta` se estava `confirmada`, notifica (`sala_saiu`). Se o criador sai e a sala fica vazia → `cancelada`.
  - `cancelar_sala(p_sala uuid) returns void` — só criador (ou admin); `cancelada`, notifica ocupantes (`sala_cancelada`).
  - `registrar_partida` (create or replace) passa a gravar `salas.partida_id` quando `p_sala_id` informado.
  - View `salas_lista` (security_invoker): salas com `status <> 'cancelada'`, `partida_id is null`, `data_hora > now() - interval '3 days'`, colunas da sala + `vagas jsonb` (`[{posicao, jogador_id, nome, foto_url}]`, só jogadores ativos), ordenada por `data_hora`.

- [ ] **Step 1: Teste que falha** — `05_salas.test.sql`:
  - Ana cria sala de simples amanhã na posição 1 → 1 vaga ocupada, `aberta`. Data no passado → `DATA_INVALIDA`.
  - Bruno entra na 1 → `VAGA_OCUPADA`; entra na 2 → `confirmada`, Ana recebe `sala_entrou` e `sala_completa`.
  - Carla entra na 2 → `VAGA_OCUPADA`; posição 3 em simples → `POSICAO_INVALIDA`; Ana entrar de novo (duplas) → `JA_NA_SALA`.
  - Bruno sai → `aberta`, Ana recebe `sala_saiu`.
  - Duplas: 4 entram em 1–4 → `confirmada`.
  - Ana cancela → `cancelada`, ocupantes notificados, some de `salas_lista`; Bruno tentando cancelar sala de Ana → `SEM_PERMISSAO`.
  - Sala com `data_hora = now() - interval '4 days'` não aparece em `salas_lista`; com 2 dias aparece.
  - Partida registrada com `p_sala_id` → sala some de `salas_lista`.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3:** Implementar migration 0005.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `feat(db): salas com vagas e notificações`

---

### Task 6: Avisos e funções de admin

**Files:**
- Create: `supabase/migrations/20261116000006_avisos_admin.sql`, `supabase/tests/database/06_avisos_admin.test.sql`

**Interfaces:**
- Consumes: `is_admin()`, `notificar`, `recalcular_ranking`.
- Produces:
  - `avisos(id uuid pk, titulo text not null, corpo_md text not null, fixado boolean default false, autor uuid → profiles, created_at, updated_at)`. RLS: select `authenticated`; insert/update/delete só `is_admin()`.
  - Trigger after insert em `avisos` → `aviso_novo` para todos os perfis ativos (link `/avisos`).
  - `atualizar_regras(p_modalidade text, p_pts_vitoria int, p_pts_set int, p_pts_game int, p_bonus_pct numeric, p_bonus_teto int, p_janela_meses int) returns void` — admin (`SEM_PERMISSAO`), valores ≥ 0, `janela_meses` ≥ 1 (`REGRA_INVALIDA`); grava e chama `recalcular_ranking(p_modalidade)`.
  - `definir_ativo(p_jogador uuid, p_ativo boolean) returns void` — admin.

- [ ] **Step 1: Teste que falha** — `06_avisos_admin.test.sql`:
  - Ana (não admin) inserir aviso → falha RLS. Admin insere → Ana e Bruno recebem `aviso_novo`; inativo não recebe.
  - Ana chama `atualizar_regras` → `SEM_PERMISSAO`. Admin muda `pts_vitoria` de simples para 100 → partida existente `6-4 3-6 6-2` passa a dar 135 ao vencedor; ranking de duplas inalterado.
  - `janela_meses = 0` → `REGRA_INVALIDA`.
  - Admin `definir_ativo(Bruno,false)` → Bruno some de `ranking`, `salas_lista.vagas` e da visão de Ana em `profiles`; pontos de Ana contra Bruno continuam.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3:** Implementar migration 0006.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `feat(db): avisos, regras e ativação pelo admin`

---

### Task 7: Base do front — cliente, auth, layout, instalação e helpers

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/database.types.ts` (gerado: `npm run db:types`), `src/lib/erros.ts`, `src/lib/whatsapp.ts`, `src/lib/disponibilidade.ts`, `src/lib/datas.ts`, `src/lib/plataforma.ts` e seus `.test.ts`; `src/auth/*`, `src/layout/Layout.tsx`, `src/layout/InstalarBanner.tsx`, `src/layout/InstalarBanner.test.tsx`, `src/auth/CadastroPage.test.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: env vars; RPC/tabelas das Tasks 2–6 (tipos gerados).
- Produces:
  - `supabase: SupabaseClient<Database>` (`flowType: 'implicit'`, `persistSession: true`, `detectSessionInUrl: true`).
  - `useAuth(): { session: Session | null; perfil: Perfil | null; carregando: boolean; recarregarPerfil(): Promise<void> }` com `type Perfil = Database['public']['Tables']['profiles']['Row']`.
  - `<RotaProtegida>`: sem sessão → `/entrar`.
  - `traduzirErro(e: unknown): string` — mapa de todos os códigos das Tasks 3–6 para frases em português; desconhecido → "Algo deu errado. Tente novamente."
  - `linkWhatsApp(telefone: string): string | null` — só dígitos; 10–11 dígitos → prefixa `55`; 12–13 dígitos começando com `55` → mantém; senão `null`. Retorna `https://wa.me/<digitos>`.
  - `DIAS = ['seg','ter','qua','qui','sex','sab','dom'] as const`, `PERIODOS = ['manha','tarde','noite'] as const`, `slot(dia, periodo): string`, `emComum(a: string[], b: string[]): number`, rótulos `ROTULO_DIA`, `ROTULO_PERIODO`.
  - `hojeLocal(agora?: Date): string` (`YYYY-MM-DD` pelos componentes locais, nunca `toISOString`), `formatarData(iso: string): string` (`dd/mm/aaaa`).
  - `detectarPlataforma(ua: string): 'ios' | 'android' | 'outro'`, `estaInstalado(): boolean` (`display-mode: standalone` ou `navigator.standalone`).
  - Rotas (`BrowserRouter basename="/tenistas-do-clube-campestre"`): públicas `/entrar`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`; protegidas dentro de `Layout`: `/` → `/ranking`, `/ranking`, `/jogadores`, `/jogadores/:id`, `/perfil`, `/salas`, `/salas/nova`, `/salas/:id`, `/partidas`, `/partidas/nova`, `/notificacoes`, `/avisos`, `/admin` (só admin). Páginas ainda não feitas = placeholder com o título.
  - `Layout`: cabeçalho com título, slot do sininho (Task 11) e avatar → `/perfil`; navegação inferior: Ranking, Jogadores, Salas, Partidas, Avisos; `Admin` aparece no cabeçalho se `perfil.is_admin`.

- [ ] **Step 1: Testes que falham** (helpers):
  - `linkWhatsApp('(11) 98765-4321')`, `('+55 11 98765-4321')`, `('11987654321')`, `('5511987654321')` → `'https://wa.me/5511987654321'`; `('1133334444')` → `'https://wa.me/551133334444'`; `('123')`, `('')` → `null`.
  - `emComum(['seg_noite','sab_manha'], ['sab_manha','dom_manha'])` → 1; `slot('seg','noite')` → `'seg_noite'`.
  - `hojeLocal(new Date(2026, 10, 16, 23, 30))` → `'2026-11-16'` (com `TZ=America/Sao_Paulo` no script de teste: `"test": "cross-env TZ=America/Sao_Paulo vitest run"` ou equivalente).
  - `detectarPlataforma` com UA de iPhone Safari → `'ios'`; Android Chrome → `'android'`; Windows Chrome → `'outro'`.
  - `traduzirErro({ message: 'VAGA_OCUPADA' })` → `'Essa vaga já foi ocupada.'`; `traduzirErro(new Error('xyz'))` → mensagem genérica.
- [ ] **Step 2:** `npm test` → FAIL. Implementar helpers. `npm test` → PASS.
- [ ] **Step 3: Testes que falham** (componentes, `vi.mock('../lib/supabase')`):
  - `InstalarBanner`: UA iOS e não instalado → texto contém "Compartilhar" e "Adicionar à Tela de Início"; instalado → não renderiza; Android com evento `beforeinstallprompt` disparado → botão "Instalar app" que chama `prompt()`. Botão "Agora não" esconde e grava em `localStorage` (try/catch).
  - `CadastroPage`: submit chama `supabase.auth.signUp` com `email`, `password` e `options.data` = `{ nome, data_nascimento, telefone, genero, categoria }`; senha < 6 caracteres mostra erro sem chamar.
- [ ] **Step 4:** Implementar auth (Entrar: e-mail+senha; Cadastro: nome, nascimento, e-mail, telefone, gênero, categoria, senha; Esqueci: `resetPasswordForEmail(email, { redirectTo: location.origin + import.meta.env.BASE_URL + 'redefinir-senha' })`; Redefinir: nova senha → `updateUser({ password })` → mensagem "Senha alterada. Volte ao app e entre com a nova senha."), `AuthProvider`, `RotaProtegida`, `Layout`, `InstalarBanner` (exibido acima do conteúdo em todas as telas). React Query `QueryClientProvider` em `main.tsx`.
- [ ] **Step 5:** `npm test` → PASS. Manual: `npm run dev` com `.env.local` do Supabase local → cadastrar, sair, entrar; Inbucket local (`http://localhost:54324`) recebe o e-mail de redefinição e o link leva a `/redefinir-senha`.
- [ ] **Step 6: Commit** — `feat: auth, layout, banner de instalação e helpers`

---

### Task 8: Perfil (editar e ver) e busca de jogadores

**Files:**
- Create: `src/perfil/EditarPerfilPage.tsx`, `PerfilPage.tsx`, `GradeDisponibilidade.tsx`, `Estrelas.tsx`, `FotoUpload.tsx`, `src/jogadores/BuscarPage.tsx`, `src/perfil/GradeDisponibilidade.test.tsx`, `src/jogadores/BuscarPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `linkWhatsApp`, `DIAS/PERIODOS/slot/emComum`, `pontos_expirando`, view `ranking`, `traduzirErro`.
- Produces:
  - `<GradeDisponibilidade valor={string[]} onChange?={(v: string[]) => void} />` — grade 7×3 (Seg–Dom × Manhã/Tarde/Noite); sem `onChange` = somente leitura.
  - `<Estrelas valor={number} onChange?={(n: number) => void} rotulo={string} />` — 1–5.
  - `<FotoUpload onEnviada={(url: string) => void} />` — redimensiona para no máx. 512 px JPEG, envia a `fotos/<uid>/<timestamp>.jpg`, devolve URL pública.
  - `<BotaoWhatsApp telefone={string} />` dentro de `PerfilPage.tsx` (exportado) — não renderiza quando `linkWhatsApp` é `null`.

- [ ] **Step 1: Testes que falham:**
  - `GradeDisponibilidade`: clicar em "Seg / Noite" com `valor=[]` chama `onChange(['seg_noite'])`; clicar de novo com `['seg_noite']` → `onChange([])`; sem `onChange` não há botões clicáveis.
  - `BuscarPage` (supabase mockado retornando Ana `['seg_noite','sab_manha']`, Bruno `['dom_tarde']`, Carla `['seg_noite']`, usuário logado com `['seg_noite','sab_manha']`): ordem Ana, Carla, Bruno; filtro dia `Sáb` + período `Manhã` → só Ana; filtro categoria `B` aplicado; o próprio usuário não aparece na lista.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar:
  - `/perfil` (Editar): foto, nome, telefone, data de nascimento, gênero, categoria (A–D), 6 habilidades (Forehand, Backhand, Saque, Voleio, Velocidade, Resistência), disponibilidade; salvar via `update profiles`. Botão "Sair".
  - `/jogadores/:id` (Ver): foto, nome, idade, categoria, gênero, habilidades (somente leitura), disponibilidade (somente leitura), `BotaoWhatsApp`, posições "Simples: Nº · Duplas: Nº" (da view `ranking`; "—" se fora), pontos; últimas 10 partidas confirmadas (data, adversário(s), placar, V/D); no próprio perfil, aviso "X pontos expiram em N dias" de `pontos_expirando` para cada modalidade (se houver).
  - `/jogadores` (Buscar): filtros dia, período, categoria, gênero; ordenado por `emComum` desc, depois nome; card com foto, nome, categoria, nº de horários em comum → toque abre perfil.
- [ ] **Step 4:** `npm test` → PASS. Manual: editar perfil, enviar foto, ver o próprio perfil e o de outro usuário; tocar no WhatsApp abre `wa.me`.
- [ ] **Step 5: Commit** — `feat: perfil, disponibilidade, WhatsApp e busca de jogadores`

---

### Task 9: Ranking

**Files:**
- Create: `src/ranking/RankingPage.tsx`, `src/ranking/RankingPage.test.tsx`

**Interfaces:**
- Consumes: view `ranking`.

- [ ] **Step 1: Teste que falha** — mock com linhas de simples (Ana B 412 pos 1, Carlos A 398 pos 2, Pedro D 355 pos 3) e duplas (Ana 50 pos 1): aba "Simples" ativa por padrão mostra "1", "Ana", "B", "412" em ordem; filtro "D" mostra só Pedro com posição **3**; aba "Duplas" mostra só Ana; lista vazia mostra "Nenhuma partida confirmada nos últimos 6 meses." (usar `janela_meses` de `regras`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar: abas Simples | Duplas; select "Todas / A / B / C / D"; linha = posição, foto (ou iniciais), nome, categoria, pontos; toque → `/jogadores/:id`; linha do usuário logado destacada.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat: tela de ranking com abas e filtro`

---

### Task 10: Partidas — lançar, confirmar, contestar, histórico

**Files:**
- Create: `src/partidas/LancarPartidaPage.tsx`, `PlacarInput.tsx`, `PartidasPage.tsx`, `PartidaCard.tsx`, `src/partidas/PlacarInput.test.tsx`, `src/partidas/LancarPartidaPage.test.tsx`

**Interfaces:**
- Consumes: RPCs `registrar_partida`, `confirmar_partida`, `contestar_partida`; tabelas `partidas`, `partida_jogadores`, `partida_sets`, `pontos_partida`; `hojeLocal`, `formatarData`, `traduzirErro`; `salas_lista` (pré-preenchimento).
- Produces:
  - `type SetPlacar = { l1: number; l2: number; stb: boolean }`
  - `<PlacarInput valor={SetPlacar[]} onChange={(v: SetPlacar[]) => void} />` — 1 a 3 linhas; botões "+ set" / remover; checkbox "Super tie-break" só no último set.
  - Rota `/partidas/nova?sala=<id>` pré-preenche modalidade, data (dia da sala, se ≤ hoje) e jogadores (Dupla 1 = lado 1, Dupla 2 = lado 2).

- [ ] **Step 1: Testes que falham:**
  - `PlacarInput`: começa com 1 set; "+ set" até 3 e depois desabilita; checkbox de super tie-break aparece só no último.
  - `LancarPartidaPage`: data padrão = `hojeLocal()`; `min` = hoje−7 e `max` = hoje; ao enviar simples Ana (logada) × Bruno `6-4 3-6 6-2` chama `rpc('registrar_partida', { p_modalidade: 'simples', p_data_jogo: <hoje>, p_lado1: [ana], p_lado2: [bruno], p_sets: [{l1:6,l2:4,stb:false},{l1:3,l2:6,stb:false},{l1:6,l2:2,stb:false}], p_sala_id: null })`; erro `PLACAR_EMPATADO` do RPC aparece traduzido; com `?sala=` os jogadores vêm preenchidos.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar:
  - Lançar: modalidade, data, seleção de jogadores (usuário logado fixo no lado 1; em duplas escolhe parceiro e 2 adversários; busca por nome), `PlacarInput`, enviar → `/partidas`.
  - `/partidas`: seção "Aguardando sua confirmação" (pendentes em que o usuário é adversário de `lancado_por`) com botões "Confirmar" e "Contestar" (pede motivo); seção "Aguardando o adversário" (lançadas pelo usuário/lado dele, pendentes) com texto "confirma automaticamente em Xh"; "Histórico" (confirmadas/contestadas/canceladas, mais recentes primeiro) com placar, data, status e pontos ganhos (`pontos + bônus` de `pontos_partida`). Botão flutuante "Lançar resultado".
- [ ] **Step 4:** `npm test` → PASS. Manual com dois usuários em janelas diferentes: lançar, confirmar, ver ranking atualizar; contestar.
- [ ] **Step 5: Commit** — `feat: lançar, confirmar e contestar partidas`

---

### Task 11: Salas, sininho e quadro de avisos

**Files:**
- Create: `src/salas/SalasPage.tsx`, `NovaSalaPage.tsx`, `SalaPage.tsx`, `src/salas/SalaPage.test.tsx`, `src/notificacoes/Sininho.tsx`, `NotificacoesPage.tsx`, `src/notificacoes/Sininho.test.tsx`, `src/avisos/AvisosPage.tsx`, `AvisoForm.tsx`, `src/avisos/AvisosPage.test.tsx`
- Modify: `src/layout/Layout.tsx` (inserir `<Sininho />`)

**Interfaces:**
- Consumes: `salas_lista`, RPCs `criar_sala`, `entrar_sala`, `sair_sala`, `cancelar_sala`; `notificacoes`; `avisos`; `traduzirErro`.

- [ ] **Step 1: Testes que falham:**
  - `SalaPage` (duplas, vagas 1=Ana, 2=vazia, 3=Bruno, 4=vazia; usuário Carla): mostra "Dupla 1" com Ana e botão "Entrar aqui" na vaga 2, "Dupla 2" com Bruno; clicar em "Entrar aqui" da vaga 4 chama `rpc('entrar_sala', { p_sala: id, p_posicao: 4 })`; erro `VAGA_OCUPADA` mostra a frase traduzida e recarrega a sala. Para o criador aparece "Cancelar sala"; para ocupante aparece "Sair"; sala `confirmada` com data ≤ agora mostra "Lançar resultado" → `/partidas/nova?sala=<id>`.
  - `Sininho`: com 3 não lidas mostra badge "3"; com 0 não mostra badge; clique navega para `/notificacoes`.
  - `AvisosPage`: aviso fixado aparece antes de um mais novo não fixado; `**Sábado**` renderiza em `<strong>`; usuário não admin não vê "Novo aviso"; admin vê "Novo aviso", "Editar", "Excluir".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar:
  - `/salas`: lista de `salas_lista` agrupada por dia (cards: tipo, dia/hora, recado, vagas preenchidas "3/4", status); botão "Criar sala".
  - `/salas/nova`: tipo, data e hora, recado, vaga inicial (em duplas: Dupla 1 ou 2).
  - `/salas/:id`: como no teste; ocupantes com foto e nome (toque → perfil).
  - `Sininho`: conta `notificacoes` não lidas do usuário; refetch a cada 60 s e ao focar a janela (React Query `refetchInterval: 60000`, `refetchOnWindowFocus: true`).
  - `/notificacoes`: lista mais recentes primeiro; tocar marca `lida=true` e navega para `link`; "Marcar todas como lidas".
  - `/avisos`: fixados primeiro, depois `created_at desc`; corpo em `react-markdown` (sem HTML bruto); admin: `AvisoForm` (título, corpo em Markdown com dica "**negrito**, *itálico*, - lista, [link](url)", fixado) com criar/editar/excluir direto na tabela (RLS garante admin).
- [ ] **Step 4:** `npm test` → PASS. Manual: dois usuários enchendo uma sala de duplas; sininho atualizando; aviso novo gera notificação.
- [ ] **Step 5: Commit** — `feat: salas, sininho e quadro de avisos`

---

### Task 12: Painel do administrador

**Files:**
- Create: `src/admin/AdminPage.tsx`, `RegrasForm.tsx`, `Contestacoes.tsx`, `JogadoresAdmin.tsx`, `src/admin/RegrasForm.test.tsx`

**Interfaces:**
- Consumes: `regras`, RPCs `atualizar_regras`, `confirmar_partida`, `admin_corrigir_partida`, `admin_cancelar_partida`, `definir_ativo`; `PlacarInput`, `PartidaCard`.

- [ ] **Step 1: Teste que falha** — `RegrasForm` com regras de simples carregadas: campos mostram 50, 10, 1, 20 (%), 50, 6; alterar vitória para 100 e salvar chama `rpc('atualizar_regras', { p_modalidade: 'simples', p_pts_vitoria: 100, p_pts_set: 10, p_pts_game: 1, p_bonus_pct: 0.2, p_bonus_teto: 50, p_janela_meses: 6 })` após confirmar o diálogo "Isso vai recalcular todo o ranking de simples. Continuar?".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `/admin` com três abas:
  - **Regras:** um `RegrasForm` por modalidade (bônus exibido em %, enviado como fração).
  - **Partidas:** contestadas primeiro (com motivo), depois busca de qualquer partida; ações Confirmar, Corrigir (abre `PlacarInput` + data) e Cancelar.
  - **Jogadores:** lista com busca, inclui inativos; alternar Ativo/Inativo via `definir_ativo`.
  - `/admin` para não admin → redireciona para `/ranking`.
- [ ] **Step 4:** `npm test` → PASS. Manual: tornar um usuário local admin (`update profiles set is_admin=true where email=...` no Studio local `http://localhost:54323`) e exercitar as três abas.
- [ ] **Step 5: Commit** — `feat: painel do administrador`

---

### Task 13: Produção — Supabase na nuvem, Gmail, Pages e QR code

**Files:**
- Create: `docs/DEPLOY.md`, `scripts/gerar-qrcode.mjs`, `docs/qrcode.png`

**Interfaces:**
- Consumes: tudo acima.

Passos que dependem de contas do usuário são escritos em `docs/DEPLOY.md` e executados **com** o usuário (pedir os dados no momento; nunca commitar segredos).

- [ ] **Step 1:** `scripts/gerar-qrcode.mjs` (pacote `qrcode`) gera `docs/qrcode.png` (1024 px, margem 2) para `https://stuart-alt.github.io/tenistas-do-clube-campestre/`. `node scripts/gerar-qrcode.mjs` → arquivo existe; ler o PNG com um leitor de QR (ou verificar com o próprio pacote) e conferir a URL.
- [ ] **Step 2:** Escrever `docs/DEPLOY.md` com, nesta ordem:
  1. Criar projeto no Supabase (região São Paulo, `sa-east-1`); `npx supabase link --project-ref <ref>`; `npx supabase db push` (migrations; o seed **não** vai para produção).
  2. Ativar extensão pg_cron no painel se `db push` reclamar; conferir job `auto-confirmar` em `cron.job`.
  3. Auth → Providers → Email: desligar "Confirm email". Auth → URL Configuration: Site URL e Redirect URL = `https://stuart-alt.github.io/tenistas-do-clube-campestre/` e `.../redefinir-senha`.
  4. Gmail: ativar verificação em 2 etapas, criar "senha de app"; Auth → SMTP: host `smtp.gmail.com`, porta `465`, usuário = e-mail Gmail, senha = senha de app, remetente "Tenistas do Campestre". Traduzir os templates de e-mail "Reset password" para português.
  5. GitHub → Settings → Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Settings → Pages → Source: GitHub Actions.
  6. Primeiro admin: depois de se cadastrar no app, rodar no SQL Editor `update profiles set is_admin = true where email = '<e-mail>';`.
  7. Distribuição: imprimir `docs/qrcode.png`; instruções de instalação (Android: abrir no Chrome → "Instalar app"; iPhone: abrir no **Safari** → Compartilhar → "Adicionar à Tela de Início").
- [ ] **Step 3:** Com o usuário: executar o DEPLOY.md; push na `main`; Action verde.
- [ ] **Step 4: Verificação em produção** (Android e iPhone reais): instalar pelo QR; cadastrar; editar perfil com foto; criar sala e ocupar vaga com segundo usuário; lançar e confirmar partida; ranking atualiza; "esqueci minha senha" chega pelo Gmail e redefinir funciona no iPhone; admin publica aviso e sininho mostra.
- [ ] **Step 5: Commit** — `docs: guia de deploy e QR code`
