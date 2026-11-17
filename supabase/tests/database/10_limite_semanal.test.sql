begin;
select plan(28);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.conta(text, text) returns boolean language sql stable as $$
  select conta from pontos_partida where partida_id = pg_temp.id($1) and jogador_id = pg_temp.id($2) $$;
create function pg_temp.bonus(text, text) returns int language sql stable as $$
  select bonus from pontos_partida where partida_id = pg_temp.id($1) and jogador_id = pg_temp.id($2) $$;
create function pg_temp.rk(text, text) returns int language sql stable as $$
  select pontos from ranking where modalidade = $2 and jogador_id = pg_temp.id($1) $$;
create function pg_temp.pos(text, text) returns int language sql stable as $$
  select posicao from ranking where modalidade = $2 and jogador_id = pg_temp.id($1) $$;
create function pg_temp.contadas(text, text) returns int language sql stable as $$
  select count(*)::int from pontos_partida where jogador_id = pg_temp.id($1) and modalidade = $2 and conta $$;
create function pg_temp.limpar() returns void language sql as $$ delete from partidas; delete from u where k like 'p%' $$;

-- Derrotas do jogador do lado 1 (3 sets): pontos de quem perde
-- L1 = 29, L2 = 27, L3 = 22, L4 = 20, L5 = 16
create function pg_temp.sets(int) returns jsonb language sql immutable as $$
  select (array[
    '[{"l1":7,"l2":6},{"l1":6,"l2":7},{"l1":6,"l2":7}]',
    '[{"l1":7,"l2":5},{"l1":5,"l2":7},{"l1":5,"l2":7}]',
    '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":3,"l2":6}]',
    '[{"l1":6,"l2":3},{"l1":2,"l2":6},{"l1":2,"l2":6}]',
    '[{"l1":6,"l2":0},{"l1":0,"l2":6},{"l1":0,"l2":6}]'
  ]::jsonb[])[$1] $$;
-- Partida de simples: p_perde (lado 1) perde para p_vence com a derrota tipo p_tipo
create function pg_temp.derrota(p_k text, p_data date, p_perde text, p_vence text, p_tipo int) returns void
language sql as $$
  insert into u values (p_k, tests.partida_confirmada('simples', p_data, array[pg_temp.id(p_perde)],
    array[pg_temp.id(p_vence)], pg_temp.sets(p_tipo)))
$$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('X', tests.criar_usuario('xavier@x.com', 'Xavier')),
  ('Y', tests.criar_usuario('yara@x.com', 'Yara')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- Segunda-feira de uma semana passada, dentro da janela
create temp table w as select date_trunc('week', (hoje() - 28)::timestamp)::date as seg;
grant all on w to authenticated;
create function pg_temp.seg() returns date language sql stable as $$ select seg from w $$;

select is((select max_partidas_semana from regras where modalidade = 'simples'), 2, 'padrão simples: 2 por semana');
select is((select max_partidas_semana from regras where modalidade = 'duplas'), 2, 'padrão duplas: 2 por semana');

-- 1. X perde 5 na semana; Y vence 1
select pg_temp.derrota('p1', pg_temp.seg(), 'X', 'A', 1);
select pg_temp.derrota('p2', pg_temp.seg() + 1, 'X', 'A', 2);
select pg_temp.derrota('p3', pg_temp.seg() + 2, 'X', 'A', 3);
select pg_temp.derrota('p4', pg_temp.seg() + 3, 'X', 'A', 4);
select pg_temp.derrota('p5', pg_temp.seg() + 4, 'X', 'A', 5);
insert into u values ('py', tests.partida_confirmada('simples', pg_temp.seg() + 2, array[pg_temp.id('Y')],
  array[pg_temp.id('B')], '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select is((select sum(pontos + bonus)::int from pontos_partida where jogador_id = pg_temp.id('X')), 114,
  'X fez 114 pontos em partidas (todas continuam em pontos_partida)');
select is(pg_temp.rk('X', 'simples'), 56, 'ranking de X soma só as 2 melhores (29 + 27)');
select is(pg_temp.rk('Y', 'simples'), 82, 'ranking de Y: uma vitória (82)');
select ok(pg_temp.pos('Y', 'simples') < pg_temp.pos('X', 'simples'), 'Y fica acima de X');
select is(pg_temp.contadas('X', 'simples'), 2, 'exatamente 2 partidas de X contam');
select ok(pg_temp.conta('p1', 'X') and pg_temp.conta('p2', 'X'), 'contam as duas melhores de X');
select is((select partidas from ranking where modalidade = 'simples' and jogador_id = pg_temp.id('X')), 5,
  'coluna partidas segue contando todas');
select is((select vitorias from ranking where modalidade = 'simples' and jogador_id = pg_temp.id('A')), 5,
  'coluna vitorias segue contando todas');

-- 5. N = 0 via atualizar_regras (sem limite) e volta para 2
select tests.logar_como(pg_temp.id('ADM'));
select atualizar_regras('simples', 50, 10, 1, 0.20, 50, 6, 0);
select tests.deslogar();
select is(pg_temp.contadas('X', 'simples'), 5, 'N = 0: todas as partidas contam');
select is(pg_temp.rk('X', 'simples'), 114, 'N = 0: ranking soma tudo');
select tests.logar_como(pg_temp.id('ADM'));
select atualizar_regras('simples', 50, 10, 1, 0.20, 50, 6, 2);
select tests.deslogar();
select is(pg_temp.contadas('X', 'simples'), 2, 'N = 2 de novo: recalcula');
select is(pg_temp.rk('X', 'simples'), 56, 'N = 2 de novo: ranking volta a 56');

-- 6. Bônus usa os pontos que contam: B (5 derrotas, 56 contados, 114 no total) perde para C na semana seguinte
select pg_temp.limpar();
select pg_temp.derrota('p1', pg_temp.seg(), 'B', 'A', 1);
select pg_temp.derrota('p2', pg_temp.seg() + 1, 'B', 'A', 2);
select pg_temp.derrota('p3', pg_temp.seg() + 2, 'B', 'A', 3);
select pg_temp.derrota('p4', pg_temp.seg() + 3, 'B', 'A', 4);
select pg_temp.derrota('p5', pg_temp.seg() + 4, 'B', 'A', 5);
insert into u values ('pc', tests.partida_confirmada('simples', pg_temp.seg() + 8, array[pg_temp.id('C')],
  array[pg_temp.id('B')], '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select is(pg_temp.bonus('pc', 'C'), 11, 'bônus de C = floor(56 * 0.20), não floor(114 * 0.20)');

-- 2. Domingo e segunda seguinte são semanas diferentes
select pg_temp.limpar();
select pg_temp.derrota('p1', pg_temp.seg() + 6, 'X', 'A', 1);
select pg_temp.derrota('p2', pg_temp.seg() + 6, 'X', 'A', 2);
select pg_temp.derrota('p3', pg_temp.seg() + 7, 'X', 'A', 3);
select is(pg_temp.contadas('X', 'simples'), 3, 'domingo + domingo + segunda: as 3 contam');
select is(pg_temp.rk('X', 'simples'), 78, 'ranking soma as 3 (29 + 27 + 22)');

-- 3. Limite por modalidade
select pg_temp.limpar();
select pg_temp.derrota('p1', pg_temp.seg(), 'X', 'A', 1);
select pg_temp.derrota('p2', pg_temp.seg() + 1, 'X', 'A', 2);
insert into u values ('pd1', tests.partida_confirmada('duplas', pg_temp.seg(), array[pg_temp.id('X'), pg_temp.id('C')],
  array[pg_temp.id('A'), pg_temp.id('B')], pg_temp.sets(3)));
insert into u values ('pd2', tests.partida_confirmada('duplas', pg_temp.seg() + 1, array[pg_temp.id('X'), pg_temp.id('C')],
  array[pg_temp.id('A'), pg_temp.id('B')], pg_temp.sets(4)));
select is(pg_temp.contadas('X', 'simples'), 2, '2 simples na semana contam');
select is(pg_temp.contadas('X', 'duplas'), 2, '2 duplas na mesma semana também contam');
select is(pg_temp.rk('X', 'duplas'), 42, 'ranking de duplas soma as 2 (22 + 20)');

-- 4. Empate de pontos: conta a partida mais antiga
select pg_temp.limpar();
select pg_temp.derrota('p1', pg_temp.seg() + 3, 'X', 'A', 4);
select pg_temp.derrota('p2', pg_temp.seg() + 1, 'X', 'A', 4);
select pg_temp.derrota('p3', pg_temp.seg() + 2, 'X', 'A', 1);
select ok(pg_temp.conta('p3', 'X'), 'empate: a melhor conta');
select ok(pg_temp.conta('p2', 'X'), 'empate: entre iguais, conta a de data_jogo mais cedo');
select ok(not pg_temp.conta('p1', 'X'), 'empate: a de data mais tarde fica de fora');
select pg_temp.limpar();
select pg_temp.derrota('p1', pg_temp.seg() + 1, 'X', 'A', 4);
select pg_temp.derrota('p2', pg_temp.seg() + 1, 'X', 'A', 4);
select pg_temp.derrota('p3', pg_temp.seg() + 2, 'X', 'A', 1);
select ok(pg_temp.conta('p1', 'X') and not pg_temp.conta('p2', 'X'),
  'empate no mesmo dia: conta a lançada primeiro (created_at)');

-- 7. pontos_expirando soma só as que contam
select pg_temp.limpar();
update w set seg = date_trunc('week', ((hoje() - interval '6 months')::date + 14)::timestamp)::date;
select pg_temp.derrota('p1', pg_temp.seg(), 'X', 'A', 1);
select pg_temp.derrota('p2', pg_temp.seg() + 1, 'X', 'A', 2);
select pg_temp.derrota('p3', pg_temp.seg() + 2, 'X', 'A', 3);
select pg_temp.derrota('p4', pg_temp.seg() + 3, 'X', 'A', 4);
select is((select pontos from pontos_expirando(pg_temp.id('X'), 'simples', 30)), 56,
  'pontos_expirando: só as 2 que contam (29 + 27)');

-- 8. atualizar_regras: validação e permissão
select tests.logar_como(pg_temp.id('X'));
select throws_ok($$select atualizar_regras('simples', 50, 10, 1, 0.20, 50, 6, 2)$$, 'P0001', 'SEM_PERMISSAO',
  'não admin não altera o limite');
select tests.logar_como(pg_temp.id('ADM'));
select throws_ok($$select atualizar_regras('simples', 50, 10, 1, 0.20, 50, 6, -1)$$, 'P0001', 'REGRA_INVALIDA',
  'limite negativo inválido');
select throws_ok($$select atualizar_regras('simples', 50, 10, 1, 0.20, 50, 6, null)$$, 'P0001', 'REGRA_INVALIDA',
  'limite nulo inválido');
select tests.deslogar();

select * from finish();
rollback;
