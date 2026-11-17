# Conquistas (medalhas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medalhas com níveis, calculadas no banco a partir das partidas confirmadas na janela do ranking, expostas no perfil, com aviso ao ganhar e antes de vencer.

**Architecture:** Uma função pura `calcular_conquistas(jogador, data_ref)` conta as partidas confirmadas da janela relativa a uma data. Simulando datas futuras com ela, obtemos `valida_ate` e `expira_em`. `avaliar_conquistas` compara o resultado com o retrato guardado (`conquistas_jogador`), grava e notifica. Ela roda no fim de `recalcular_ranking` e num cron diário. O front lê o retrato (todos) e `progresso_conquistas` (só o próprio jogador).

**Tech Stack:** Supabase Postgres (plpgsql, pgTAP, pg_cron), React 18 + TS + react-query + Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-conquistas-design.md` (ler inteiro antes de qualquer tarefa; o catálogo e as regras de aviso estão lá).

## Global Constraints

- Só contam partidas `status = 'confirmada'`, dentro da janela `data_jogo + make_interval(months => janela_meses) > D` com `janela_meses` da linha `simples` de `regras`, e com `data_jogo <= hoje`.
- Semana = `date_trunc('week', data_jogo)::date` (segunda a domingo).
- Administradores (`is_admin`) e inativos (`not ativo`) não têm medalhas, e o retrato deles fica vazio.
- Todas as funções novas: `language plpgsql|sql`, `security definer set search_path = public`. Erros em MAIÚSCULAS (`SEM_PERMISSAO` já existe e está traduzido em `src/lib/erros.ts`).
- Nomes dos níveis: 1 bronze, 2 prata, 3 ouro, 4 diamante. Medalhas de nível único (`podio`, `numero1`) não exibem nome de nível.
- Textos das notificações (exatos):
  - ganha: `Você ganhou {emoji} {nome} — {nível} ({valor} {unidade})!`. Em nível único: `Você ganhou {emoji} {nome} {Simples|Duplas}!`
  - vencendo: `Sua medalha {emoji} {nome} vence em {N} dias. Lance uma partida para renovar!`
  - estreia: `Chegaram as conquistas! Você já tem {N} medalhas. Veja no seu perfil.`
  - link de todas: `/jogadores/{jogador_id}`.
- Avisos de vencimento: 10 dias antes de `expira_em`. Cooldown do "ganhou" em pódio/nº 1: 30 dias.
- Cron diário: `select cron.schedule('conquistas-diarias', '5 3 * * *', 'select public.avaliar_conquistas_todos()');` (00:05 São Paulo).
- Não tocar nos containers ou portas do projeto dog-store-estoque. Banco local em 553xx. `npm run db:test` e `npm test` precisam passar.

## Review Focus

1. **Desempenho na confirmação:** com ~40 jogadores e ~30 partidas cada, confirmar uma partida deve continuar rápido (< 1 s no banco local). Teste na Task 2: um pgTAP que gera esse volume e mede `clock_timestamp()` em torno de `tests.partida_confirmada`.
2. **Partida cancelada pelo admin depois de dar medalha:** a medalha desce ou some na reavaliação, sem notificar. Teste na Task 2.
3. **Partida com `data_jogo` no futuro ou exatamente no limite da janela:** a de hoje − 6 meses já não conta; uma futura não conta. Teste na Task 1.
4. **Jogador com medalha que vira admin ou é desativado:** o retrato dele é limpo na próxima avaliação. Teste na Task 2.
5. **Perfil de outro jogador sem medalhas e o próprio perfil sem partidas:** mostram "Ainda sem medalhas" e a lista de próximas metas sem erro. Teste na Task 3.

---

### Task 1: Catálogo, retrato e cálculo puro

**Files:**
- Create: `supabase/migrations/20261119000001_conquistas_calculo.sql`
- Create: `supabase/tests/database/11_conquistas_calculo.test.sql`

**Interfaces:**
- Produces:
  - Tabela `conquistas_catalogo(chave text pk, nome text, emoji text, descricao text, unidade text, limites int[] not null, por_modalidade boolean not null default false, ordem int)`, preenchida com as 11 linhas do catálogo do spec. Unidades: `semanas`, `partidas`, `vitórias`, `adversários`, `parceiros`, `salas`, `vitórias`, `viradas`, `sets`. Nome e emoji vêm da tabela do spec. Para `podio`, `limites = '{1}'` (os 3 primeiros vêm da regra, não do limite); para `numero1`, `limites = '{1}'`. Ambas têm `por_modalidade = true`.
  - Tabela `conquistas_jogador(jogador_id uuid references profiles on delete cascade, conquista text references conquistas_catalogo, modalidade text null check (modalidade in ('simples','duplas')), nivel int not null check (nivel >= 1), valor int not null, desde timestamptz not null default now(), valida_ate date null, expira_em date null, avisado_vencimento boolean not null default false)`, com unique em `(jogador_id, conquista, coalesce(modalidade,''))` (índice único por expressão).
  - Tabela `conquistas_avisos(jogador_id uuid references profiles on delete cascade, conquista text, modalidade text, ultimo_aviso_ganho timestamptz not null, primary key (jogador_id, conquista, modalidade))`.
  - RLS: `conquistas_catalogo` e `conquistas_jogador` com `select` para `authenticated` (using true). `conquistas_avisos` sem acesso pelo app. Nenhuma escrita pelo app.
  - `calcular_conquistas(p_jogador uuid, p_ref date, p_hoje date default public.hoje()) returns table (conquista text, modalidade text, valor int, nivel int)`, sem grant para authenticated. Retorna uma linha por chave do catálogo (pódio e nº 1: uma por modalidade), incluindo nível 0. `nivel` = quantos limites ≤ `valor`. Contagem com partidas confirmadas onde `data_jogo <= p_hoje` e `data_jogo + janela > p_ref`. `podio`/`numero1` vêm da view `ranking` (`posicao <= 3` / `posicao = 1`, valor 1 ou 0) e só fazem sentido com `p_ref = p_hoje`; com `p_ref > p_hoje`, retornam o mesmo que em `p_hoje`. Admin ou inativo: todas com nível 0.
  - `validade_conquista(p_jogador uuid, p_conquista text, p_hoje date default public.hoje()) returns table (valida_ate date, expira_em date)`. Candidatos D = datas distintas `(data_jogo + janela)::date > p_hoje` das partidas confirmadas do jogador. Em ordem crescente: `valida_ate` = (1º D com nível < nível em p_hoje) − 1 dia; `expira_em` = (1º D com nível 0) − 1 dia. Nulos para `podio`/`numero1` ou nível 0.
  - `sequencia_atual(p_jogador uuid) returns table (semanas int, jogou_esta_semana boolean)`, com grant para authenticated e só para o próprio jogador (senão `SEM_PERMISSAO`). `semanas` = série de semanas consecutivas com partida confirmada terminando na semana atual (se tiver partida) ou na anterior; 0 se nenhuma das duas tiver.
  - `progresso_conquistas(p_jogador uuid) returns table (conquista text, modalidade text, nivel int, valor int, proximo_limite int, valida_ate date)`, com grant para authenticated. `p_jogador <> auth.uid()` → `SEM_PERMISSAO`. `proximo_limite` = `limites[nivel+1]` ou nulo.

- [ ] **Step 1: Write the failing pgTAP tests** (`11_conquistas_calculo.test.sql`; datas relativas a `hoje()`; usar `tests.criar_usuario`, `tests.partida_confirmada`, `tests.logar_como`)
  - `catalogo tem 11 conquistas` e `limites de sequencia = {2,4,8,12}` e `limites de partidas = {1,10,25,50}`.
  - `partidas`: 10 partidas na janela → `valor 10, nivel 2`. Uma partida em `hoje() - interval '6 months'` não conta. Uma com `data_jogo = hoje()+1` não conta.
  - `vitorias`, `adversarios` (3 rivais diferentes → nível 1), `parceiros` (só duplas), `pneu` (set 6–0 do lado do jogador), `virada` (perdeu o 1º set e venceu), `zebra` (vitória com `pontos_partida.bonus > 0`), `anfitriao` (sala criada pelo jogador com `partida_id` de partida confirmada → valor 1). Uma asserção `is()` para cada.
  - `sequencia`: partidas em 4 semanas consecutivas → valor 4, nível 2. Um buraco de uma semana no meio → valor = maior série.
  - `podio`/`numero1`: o 1º do ranking de simples tem `numero1 simples nivel 1` e `podio simples nivel 1`. O 4º tem 0. Empate no 1º → os dois têm `numero1`.
  - Admin → todas as linhas com nível 0.
  - `validade_conquista`: 10 partidas, a mais antiga em `hoje()-170 dias`. `partidas` nível 2 → `valida_ate` = data da 1ª a sair + janela − 1 (calcular no teste com `make_interval`), e `expira_em` = data da última + janela − 1.
  - `progresso_conquistas` de outro jogador → `throws_ok(..., 'SEM_PERMISSAO')`. Do próprio → linha `partidas` com `proximo_limite 25` quando `valor 10`.
  - `sequencia_atual`: partidas na semana passada e na retrasada, nada nesta → `(2, false)`.

- [ ] **Step 2: Run** `npm run db:reset; npm run db:test` → falha (funções não existem).
- [ ] **Step 3: Implement** a migração com as tabelas, o seed do catálogo e as funções acima (sem notificações, sem cron, sem mexer em `recalcular_ranking`).
- [ ] **Step 4: Run** `npm run db:reset; npm run db:test` → todos passam (os 237 antigos + os novos).
- [ ] **Step 5: Commit** `feat: cálculo das conquistas no banco`

### Task 2: Avaliação, avisos, cron e estreia

**Files:**
- Create: `supabase/migrations/20261119000002_conquistas_avisos.sql`
- Create: `supabase/tests/database/12_conquistas_avisos.test.sql`
- Modify: `docs/DEPLOY.md` (seção do pg_cron: acrescentar o job `conquistas-diarias`)
- Modify: `src/lib/database.types.ts` (via `npm run db:types`)

**Interfaces:**
- Consumes: `calcular_conquistas`, `validade_conquista`, as tabelas da Task 1.
- Produces:
  - Constraint `notificacoes_tipo_check` recriada com todos os tipos atuais (ver `20261117000001_salas_vencidas_mensagens.sql`) mais `conquista_ganha`, `conquista_vencendo`, `conquistas_estreia`.
  - `avaliar_conquistas(p_jogador uuid, p_notificar boolean default true, p_hoje date default public.hoje()) returns void`, sem grant. Regras do spec, seção "Retrato":
    - nível novo ou maior → upsert (`desde = now()`, `avisado_vencimento = false`) e notificação `conquista_ganha`. Em `podio`/`numero1`, só se `conquistas_avisos.ultimo_aviso_ganho` for nulo ou < now() − 30 dias, e então atualiza a data.
    - nível igual → atualiza `valor`, `valida_ate`, `expira_em`. Se `expira_em` ficou mais tarde, `avisado_vencimento = false`.
    - nível menor → atualiza sem notificar. Nível 0 → apaga a linha sem notificar.
    - `expira_em - p_hoje <= 10`, `not avisado_vencimento` e `p_notificar` → notificação `conquista_vencendo` com N = `expira_em - p_hoje + 1` (dias até sumir) e marca `avisado_vencimento`.
    - admin/inativo → apaga todas as linhas dele.
  - `avaliar_conquistas_todos(p_notificar boolean default true) returns void`, sem grant. Chama `avaliar_conquistas` para cada perfil não-admin que tenha partida confirmada ou linha no retrato, e para quem tem linha no retrato mesmo que agora seja admin/inativo.
  - `recalcular_ranking(p_modalidade)`: `create or replace` copiando **exatamente** a definição de `20261118000001_limite_semanal.sql` e acrescentando no fim `perform avaliar_conquistas_todos();`.
  - Estreia, no fim da migração: `avaliar_conquistas_todos(false)`; depois `update conquistas_jogador set avisado_vencimento = true where expira_em <= hoje() + 10`; depois uma notificação `conquistas_estreia` por jogador com ≥ 1 linha (texto exato com N = nº de linhas).
  - Cron `conquistas-diarias` (Global Constraints).

- [ ] **Step 1: Write the failing pgTAP tests** (`12_conquistas_avisos.test.sql`)
  - 1ª partida confirmada → retrato tem `partidas nivel 1` e o jogador tem 1 notificação `conquista_ganha` com o texto exato `Você ganhou 🎾 Partidas — bronze (1 partidas)!`. Ajuste a pluralização no catálogo/texto como preferir, mas fixe o texto no teste.
  - 2ª partida (ainda nível 1) → nenhuma `conquista_ganha` nova para `partidas`.
  - Admin cancela (`admin_cancelar_partida`) a única partida → a linha `partidas` some, sem notificação nova (Review Focus 2).
  - Vencimento: retrato com `expira_em` em ≤ 10 dias → `avaliar_conquistas(j, true, hoje())` cria 1 `conquista_vencendo`. Rodar de novo não cria outra. Uma partida nova que empurra `expira_em` → `avisado_vencimento` volta a false.
  - `p_hoje` no futuro além de `expira_em` → linha apagada.
  - Pódio: o jogador entra no top 3 → 1 aviso. Sai e volta → nenhum aviso novo (cooldown). Com `ultimo_aviso_ganho` forçado para 31 dias atrás, sai e volta → aviso.
  - Jogador com medalha vira admin (`update profiles set is_admin = true`) → `avaliar_conquistas_todos()` apaga o retrato dele (Review Focus 4).
  - Estreia: chamar o bloco de estreia num cenário com histórico → 1 notificação `conquistas_estreia` por jogador e nenhuma `conquista_ganha`. Para testar, extraia o bloco numa função `estrear_conquistas()` sem grant, que a migração chama.
  - `cron.job` contém `conquistas-diarias`.
  - Desempenho (Review Focus 1): gerar 40 jogadores × 30 partidas confirmadas e medir uma chamada a `tests.partida_confirmada` com `ok(elapsed < interval '1 second')`.
- [ ] **Step 2: Run** `npm run db:reset; npm run db:test` → falha.
- [ ] **Step 3: Implement** a migração. Se o teste de desempenho falhar, otimize dentro de `avaliar_conquistas_todos` (por exemplo, pular `validade_conquista` quando nível e partidas do jogador não mudaram) sem mudar o comportamento.
- [ ] **Step 4: Run** `npm run db:reset; npm run db:test` → tudo passa. Depois `npm run db:types` e `npm test`.
- [ ] **Step 5: Update** `docs/DEPLOY.md` com o `cron.schedule` do job novo junto aos outros.
- [ ] **Step 6: Commit** `feat: avisos e cron das conquistas`

### Task 3: Seção Conquistas no perfil

**Files:**
- Create: `src/perfil/conquistas.ts` (helpers puros), `src/perfil/conquistas.test.ts`
- Create: `src/perfil/Conquistas.tsx`, `src/perfil/Conquistas.test.tsx`
- Modify: `src/perfil/PerfilPage.tsx` (render depois do card, dentro de `!jogador.is_admin`)

**Interfaces:**
- Consumes: tabelas `conquistas_catalogo` e `conquistas_jogador` (select), RPCs `progresso_conquistas(p_jogador)` e `sequencia_atual(p_jogador)` (Task 1), tipos de `src/lib/database.types.ts` (Task 2).
- Produces:
  - `nomeNivel(nivel: number): 'bronze' | 'prata' | 'ouro' | 'diamante'`
  - `corNivel(nivel: number): string` (classes Tailwind; escolha livre)
  - `formatarValidade(data: string | null): string`: `'válida até dd/mm'`, ou `'atual'` quando nulo.
  - `<Conquistas jogadorId={string} proprio={boolean} />`

- [ ] **Step 1: Write failing tests**
  - `conquistas.test.ts`: `nomeNivel(1..4)` → bronze/prata/ouro/diamante. `formatarValidade('2027-03-12')` → `'válida até 12/03'`. `formatarValidade(null)` → `'atual'`.
  - `Conquistas.test.tsx` (mock do supabase como nos outros testes de `src/perfil`):
    - Outro jogador com retrato `sequencia nivel 2 valor 4 valida_ate 2027-03-12` → mostra `🔥`, `Sequência`, `prata`, `4 semanas`, `válida até 12/03`, e **não** chama `progresso_conquistas`.
    - Outro jogador com `podio simples` → `Top 3 Simples` e `atual`.
    - Outro jogador sem linhas → `Ainda sem medalhas` (Review Focus 5).
    - Próprio jogador: progresso com `adversarios nivel 0 valor 2 proximo_limite 3` → texto `Enturmado → bronze` e `2/3`, e uma barra (`role="progressbar"` com `aria-valuenow=2` e `aria-valuemax=3`).
    - Próprio jogador com `sequencia_atual = (3, false)` → `Jogue esta semana para não quebrar a sequência`. Com `(3, true)` → texto ausente.
    - Próprio jogador sem partidas (todas nível 0) → `Ainda sem medalhas` mais a lista de próximas metas.
  - `PerfilPage.test.tsx`: o perfil de admin não renderiza `Conquistas`, e o de jogador renderiza o título `Conquistas`.
- [ ] **Step 2: Run** `npm test` → falha.
- [ ] **Step 3: Implement** os helpers, o componente (react-query, chaves `['conquistas', jogadorId]` e `['progresso-conquistas', jogadorId]`) e a inclusão na PerfilPage. Layout conforme os esboços do spec, em lista simples; cada medalha mostra a `descricao` do catálogo numa linha pequena abaixo.
- [ ] **Step 4: Run** `npm test` e `npm run build` → passam.
- [ ] **Step 5: Commit** `feat: seção Conquistas no perfil`
