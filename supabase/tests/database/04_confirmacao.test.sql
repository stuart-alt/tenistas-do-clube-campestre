begin;
select plan(38);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.st(text) returns text language sql stable as $$ select status from partidas where id = pg_temp.id($1) $$;
create function pg_temp.rk(text, text) returns int language sql stable as $$
  select pontos from ranking where modalidade = $2 and jogador_id = pg_temp.id($1) $$;
create function pg_temp.nots(text, text) returns int language sql stable as $$
  select count(*)::int from notificacoes where usuario_id = pg_temp.id($1) and tipo = $2 $$;
create function pg_temp.limpar() returns void language sql as $$
  delete from notificacoes; delete from partidas $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('D', tests.criar_usuario('davi@x.com', 'Davi')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- Simples: lançar, notificar, confirmar
select tests.logar_como(pg_temp.id('A'));
insert into u values ('p', registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select tests.deslogar();
select is(pg_temp.nots('B', 'partida_pendente'), 1, 'adversário recebe partida_pendente');
select is(pg_temp.nots('A', 'partida_pendente'), 0, 'quem lançou não é notificado');
select is(pg_temp.rk('A', 'simples'), null, 'pendente não pontua');

select tests.logar_como(pg_temp.id('A'));
select throws_ok($$select confirmar_partida(pg_temp.id('p'))$$, 'P0001', 'SEM_PERMISSAO', 'quem lançou não confirma');
select tests.logar_como(pg_temp.id('B'));
select confirmar_partida(pg_temp.id('p'));
select tests.deslogar();
select is(pg_temp.st('p'), 'confirmada', 'adversário confirma');
select is(pg_temp.rk('A', 'simples'), 85, 'ranking: Ana 85');
select is(pg_temp.nots('A', 'partida_confirmada'), 1, 'lançador notificado da confirmação');

select tests.logar_como(pg_temp.id('B'));
select throws_ok($$select admin_corrigir_partida(pg_temp.id('p'), hoje(), '[{"l1":6,"l2":0},{"l1":6,"l2":0}]')$$,
  'P0001', 'SEM_PERMISSAO', 'jogador não corrige placar');
select tests.logar_como(pg_temp.id('ADM'));
select admin_corrigir_partida(pg_temp.id('p'), hoje(), '[{"l1":6,"l2":0},{"l1":6,"l2":0}]');
select tests.deslogar();
select is(pg_temp.rk('A', 'simples'), 82, 'correção para 6-0 6-0: Ana 82');

select tests.logar_como(pg_temp.id('ADM'));
select admin_cancelar_partida(pg_temp.id('p'));
select tests.deslogar();
select is(pg_temp.rk('A', 'simples'), null, 'cancelada: Ana some do ranking');
select is(pg_temp.st('p'), 'cancelada', 'status cancelada');
select pg_temp.limpar();

-- Duplas: só adversário do lançador confirma
select tests.logar_como(pg_temp.id('A'));
insert into u values ('d', registrar_partida('duplas', hoje(), array[pg_temp.id('A'), pg_temp.id('C')],
  array[pg_temp.id('B'), pg_temp.id('D')], '[{"l1":6,"l2":4},{"l1":6,"l2":3}]'));
select tests.logar_como(pg_temp.id('C'));
select throws_ok($$select confirmar_partida(pg_temp.id('d'))$$, 'P0001', 'SEM_PERMISSAO', 'parceiro não confirma');
select tests.logar_como(pg_temp.id('D'));
select confirmar_partida(pg_temp.id('d'));
select tests.deslogar();
select is(pg_temp.st('d'), 'confirmada', 'adversário da dupla confirma');
select pg_temp.limpar();

-- Contestação
select tests.logar_como(pg_temp.id('A'));
insert into u values ('c', registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select throws_ok($$select contestar_partida(pg_temp.id('c'), 'x')$$, 'P0001', 'SEM_PERMISSAO', 'lançador não contesta');
select tests.logar_como(pg_temp.id('B'));
select contestar_partida(pg_temp.id('c'), 'placar errado');
select tests.deslogar();
select is(pg_temp.st('c'), 'contestada', 'adversário contesta');
select is((select motivo_contestacao from partidas where id = pg_temp.id('c')), 'placar errado', 'motivo gravado');
select is(pg_temp.nots('ADM', 'contestacao_admin'), 1, 'admin notificado da contestação');
select is(pg_temp.nots('A', 'partida_contestada'), 1, 'lançador notificado da contestação');
select tests.logar_como(pg_temp.id('B'));
select throws_ok($$select confirmar_partida(pg_temp.id('c'))$$, 'P0001', 'STATUS_INVALIDO', 'contestada não é confirmável pelo jogador');
select tests.logar_como(pg_temp.id('ADM'));
select confirmar_partida(pg_temp.id('c'));
select tests.deslogar();
select is(pg_temp.st('c'), 'confirmada', 'admin confirma contestada');

-- RLS das notificações
select tests.logar_como(pg_temp.id('A'));
select is((select count(*)::int from notificacoes where usuario_id <> pg_temp.id('A')), 0, 'Ana não vê notificações alheias');
select lives_ok($$update notificacoes set lida = true$$, 'Ana marca as suas como lidas');
select throws_ok($$update notificacoes set texto = 'x'$$, '42501', null, 'texto não é editável');
select tests.deslogar();
select is((select count(*)::int from notificacoes where usuario_id = pg_temp.id('A') and not lida), 0, 'notificações de Ana lidas');
select pg_temp.limpar();

-- Auto-confirmação
select tests.logar_como(pg_temp.id('A'));
insert into u values ('a49', registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
insert into u values ('a47', registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('C')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select throws_ok($$select auto_confirmar_partidas()$$, '42501', null, 'cliente não chama auto_confirmar_partidas');
select tests.deslogar();
update partidas set created_at = now() - interval '49 hours' where id = pg_temp.id('a49');
update partidas set created_at = now() - interval '47 hours' where id = pg_temp.id('a47');
select is(auto_confirmar_partidas(), 1, 'auto-confirma 1 partida (49 h)');
select is(pg_temp.st('a49'), 'confirmada', '49 h: confirmada');
select is(pg_temp.st('a47'), 'pendente', '47 h: continua pendente');
select pg_temp.limpar();

-- Admin de fora lança: nasce confirmada
select tests.logar_como(pg_temp.id('ADM'));
insert into u values ('adm', registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select tests.deslogar();
select is(pg_temp.st('adm'), 'confirmada', 'admin de fora: partida já confirmada');
select is(pg_temp.rk('A', 'simples'), 82, 'admin de fora: ranking recalculado');
select is(pg_temp.nots('B', 'partida_confirmada'), 1, 'admin de fora: jogador recebe partida_confirmada');
select is(pg_temp.nots('B', 'partida_pendente'), 0, 'admin de fora: sem partida_pendente');
select pg_temp.limpar();

-- Sem escrita direta do cliente
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$update regras set pts_vitoria = 1$$, '42501', null, 'cliente não escreve em regras');
select throws_ok($$delete from partidas$$, '42501', null, 'cliente não apaga partidas');
select tests.deslogar();

-- registrar sem usuário logado
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  format($$select registrar_partida('simples', hoje(), array['%s']::uuid[], array['%s']::uuid[], '[{"l1":6,"l2":0}]')$$,
    pg_temp.id('A'), pg_temp.id('B')),
  'P0001', 'NAO_PARTICIPANTE', 'sem login: NAO_PARTICIPANTE');

-- Janela: conta em D sse data_jogo + janela > D (borda em fim de mês incluída)
create function pg_temp.borda() returns date language sql stable as $$
  select max(x)::date from generate_series(hoje() - 200, hoje(), interval '1 day') x
  where x + make_interval(months => 6) <= hoje() $$;
insert into u values ('w0', tests.partida_confirmada('simples', pg_temp.borda(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select is(pg_temp.rk('A', 'simples'), null, 'data_jogo + 6 meses = hoje (ou antes): não conta');
insert into u values ('w1', tests.partida_confirmada('simples', pg_temp.borda() + 1, array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select is(pg_temp.rk('A', 'simples'), 82, 'um dia depois: conta');
select is((select expira_em from pontos_expirando(pg_temp.id('A'), 'simples', 30)),
  (pg_temp.borda() + 1 + make_interval(months => 6))::date, 'pontos_expirando coerente com a janela');

select * from finish();
rollback;
