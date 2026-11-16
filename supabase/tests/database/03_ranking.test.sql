begin;
select plan(33);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.pts(text, text) returns int language sql stable as $$
  select pontos from pontos_partida where partida_id = pg_temp.id($1) and jogador_id = pg_temp.id($2) $$;
create function pg_temp.bonus(text, text) returns int language sql stable as $$
  select bonus from pontos_partida where partida_id = pg_temp.id($1) and jogador_id = pg_temp.id($2) $$;
create function pg_temp.rk(text, text) returns int language sql stable as $$
  select pontos from ranking where modalidade = $2 and jogador_id = pg_temp.id($1) $$;
create function pg_temp.limpar() returns void language sql as $$ delete from partidas $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('D', tests.criar_usuario('davi@x.com', 'Davi')),
  ('X', tests.criar_usuario('xavier@x.com', 'Xavier'));

-- Exemplo do spec
insert into u values ('p', tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select is(pg_temp.pts('p', 'A'), 85, 'spec: vencedor 85');
select is(pg_temp.bonus('p', 'A'), 0, 'spec: sem bônus entre zerados');
select is(pg_temp.pts('p', 'B'), 22, 'spec: perdedor 22');
select pg_temp.limpar();
delete from u where k = 'p';

-- Super tie-break
insert into u values ('p', tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":4,"l2":6},{"l1":10,"l2":7,"stb":true}]'));
select is(pg_temp.pts('p', 'A'), 81, 'stb: vencedor 50+20+11');
select is(pg_temp.pts('p', 'B'), 20, 'stb: perdedor 10+10');
select pg_temp.limpar();
delete from u where k = 'p';

-- Bônus e teto
insert into u values ('p0', tests.partida_confirmada('simples', hoje() - 2, array[pg_temp.id('B')], array[pg_temp.id('X')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
insert into u values ('p', tests.partida_confirmada('simples', hoje() - 1, array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select is(pg_temp.pts('p0', 'B'), 82, 'bônus: B soma 82 antes');
select is(pg_temp.bonus('p', 'A'), 16, 'bônus: floor(82 * 0.20)');
select is(pg_temp.rk('A', 'simples'), 101, 'bônus: total de A no ranking');
update regras set bonus_pct = 1.00 where modalidade = 'simples';
select recalcular_ranking('simples');
select is(pg_temp.bonus('p', 'A'), 50, 'teto: bônus limitado a 50');
update regras set bonus_pct = 0.20 where modalidade = 'simples';
select pg_temp.limpar();
delete from u where k in ('p', 'p0');

-- Duplas: médias
insert into u values ('p0', tests.partida_confirmada('duplas', hoje() - 2, array[pg_temp.id('B'), pg_temp.id('C')],
  array[pg_temp.id('X'), pg_temp.id('D')], '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
insert into u values ('p', tests.partida_confirmada('duplas', hoje() - 1, array[pg_temp.id('A'), pg_temp.id('X')],
  array[pg_temp.id('B'), pg_temp.id('D')], '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select is(pg_temp.bonus('p', 'A'), 8, 'duplas: bônus 8 para A (média 41)');
select is(pg_temp.bonus('p', 'X'), 8, 'duplas: bônus 8 para X (média 41)');
select pg_temp.limpar();
delete from u where k in ('p', 'p0');

-- Mesmo dia: ordem por created_at
insert into u values ('p0', tests.partida_confirmada('simples', hoje(), array[pg_temp.id('B')], array[pg_temp.id('X')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
insert into u values ('p', tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select is(pg_temp.bonus('p', 'A'), 16, 'mesmo dia: segunda partida usa pontos da primeira');
update partidas set created_at = created_at + interval '1 hour' where id = pg_temp.id('p0');
select recalcular_ranking('simples');
select is(pg_temp.bonus('p', 'A'), 0, 'mesmo dia: invertendo created_at, a ordem muda');
select pg_temp.limpar();
delete from u where k in ('p', 'p0');

-- Confirmação fora de ordem
insert into u values ('p2', tests.partida_confirmada('simples', hoje() - 1, array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
select is(pg_temp.bonus('p2', 'A'), 0, 'fora de ordem: P2 sozinha sem bônus');
insert into u values ('p1', tests.partida_confirmada('simples', hoje() - 2, array[pg_temp.id('B')], array[pg_temp.id('X')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]'));
select is(pg_temp.bonus('p2', 'A'), 16, 'fora de ordem: P1 anterior confirmada depois muda bônus de P2');
select pg_temp.limpar();
delete from u where k in ('p1', 'p2');

-- Janela
select tests.partida_confirmada('simples', (hoje() - interval '7 months')::date, array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]');
select is((select count(*) from ranking where jogador_id = pg_temp.id('A')), 0::bigint, 'janela: 7 meses atrás fica fora');
select tests.partida_confirmada('simples', (hoje() - interval '5 months')::date, array[pg_temp.id('A')], array[pg_temp.id('C')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]');
select is(pg_temp.rk('A', 'simples'), 85, 'janela: 5 meses atrás entra (só ela conta)');
select pg_temp.limpar();

-- Ranking: presença, empate de posição, ordem
select tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')], '[{"l1":6,"l2":0},{"l1":6,"l2":0}]');
select tests.partida_confirmada('simples', hoje(), array[pg_temp.id('C')], array[pg_temp.id('D')], '[{"l1":6,"l2":0},{"l1":6,"l2":0}]');
select is((select count(*) from ranking where jogador_id = pg_temp.id('X')), 0::bigint, 'ranking: sem partida não aparece');
select is((select array_agg(posicao order by nome) from ranking where modalidade = 'simples'), array[1, 3, 1, 3],
  'ranking: mesmos pontos, mesma posição (Ana, Bruno, Carla, Davi)');
update regras set pts_vitoria = 0, pts_set = 0, pts_game = 0 where modalidade = 'simples';
select tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('D')], '[{"l1":6,"l2":0},{"l1":6,"l2":0}]');
select is((select array_agg(nome) from ranking where modalidade = 'simples'), array['Ana', 'Carla', 'Bruno', 'Davi'],
  'ranking: pontos iguais ordenam por vitórias e depois nome');
select is((select array_agg(distinct posicao) from ranking where modalidade = 'simples'), array[1], 'ranking: todos empatados em 1º');
update regras set pts_vitoria = 50, pts_set = 10, pts_game = 1 where modalidade = 'simples';
select pg_temp.limpar();

-- Inativo
select tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]');
update profiles set ativo = false where id = pg_temp.id('B');
select recalcular_ranking('simples');
select is((select count(*) from ranking where jogador_id = pg_temp.id('B')), 0::bigint, 'inativo: some do ranking');
select is(pg_temp.rk('A', 'simples'), 85, 'inativo: pontos ganhos contra ele permanecem');
update profiles set ativo = true where id = pg_temp.id('B');

-- Modalidades separadas (A tem 85 em simples)
select tests.partida_confirmada('duplas', hoje(), array[pg_temp.id('A'), pg_temp.id('C')], array[pg_temp.id('B'), pg_temp.id('D')],
  '[{"l1":6,"l2":0},{"l1":6,"l2":0}]');
select is(pg_temp.rk('A', 'simples'), 85, 'modalidades: duplas não altera simples');
select is((select count(*) from ranking where modalidade = 'simples'), 2::bigint, 'modalidades: simples segue com 2 jogadores');
select is(pg_temp.rk('C', 'duplas'), 82, 'modalidades: duplas tem ranking próprio');
select pg_temp.limpar();

-- Expirando
select tests.partida_confirmada('simples', (hoje() - interval '6 months' + interval '10 days')::date,
  array[pg_temp.id('A')], array[pg_temp.id('B')], '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]');
select is((select row(pontos, expira_em)::text from pontos_expirando(pg_temp.id('A'), 'simples')),
  row(85, ((hoje() - interval '6 months' + interval '10 days')::date + interval '6 months')::date)::text,
  'expirando: 85 pontos expiram em data + 6 meses');
select is((select count(*) from pontos_expirando(pg_temp.id('A'), 'simples', 5)), 0::bigint, 'expirando: nada nos próximos 5 dias');
select is((select count(*) from pontos_expirando(pg_temp.id('B'), 'duplas')), 0::bigint, 'expirando: zero linhas sem pontos');

-- Acesso pelo app
select tests.logar_como(pg_temp.id('A'));
select is((select count(*) from ranking where modalidade = 'simples'), 2::bigint, 'authenticated lê ranking');
select throws_ok($$update regras set pts_vitoria = 999$$, '42501', null, 'authenticated não escreve em regras');
select is((select pts_vitoria from regras where modalidade = 'simples'), 50, 'authenticated não altera regras');
select throws_ok($$select recalcular_ranking('simples')$$, '42501', null, 'authenticated não chama recalcular_ranking');
select tests.deslogar();

select * from finish();
rollback;
