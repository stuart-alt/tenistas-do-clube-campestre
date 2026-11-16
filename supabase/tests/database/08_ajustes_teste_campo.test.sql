begin;
select plan(12);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- 1. Celular brasileiro
select throws_ok($$update profiles set telefone = '1133334444' where id = pg_temp.id('A')$$,
  '23514', null, 'telefone fixo é recusado');
select throws_ok($$update profiles set telefone = '(11) 98765-4321' where id = pg_temp.id('A')$$,
  '23514', null, 'telefone formatado é recusado no banco');
select throws_ok($$update profiles set telefone = '01987654321' where id = pg_temp.id('A')$$,
  '23514', null, 'DDD iniciado em 0 é recusado');
select lives_ok($$update profiles set telefone = '21987654321' where id = pg_temp.id('A')$$,
  'celular com DDD é aceito');

-- 2. Administradores fora do jogo
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('ADM')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]')$$, 'P0001', 'ADMIN_NAO_JOGA', 'admin como adversário');
select tests.logar_como(pg_temp.id('ADM'));
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ADM')], array[pg_temp.id('A')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]')$$, 'P0001', 'ADMIN_NAO_JOGA', 'admin lançando como jogador');
select throws_ok($$select criar_sala('simples', now() + interval '1 day', null, 1::smallint)$$,
  'P0001', 'ADMIN_NAO_JOGA', 'admin não cria sala');

select tests.logar_como(pg_temp.id('A'));
insert into u values ('s', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('ADM'));
select throws_ok($$select entrar_sala(pg_temp.id('s'), 2::smallint)$$,
  'P0001', 'ADMIN_NAO_JOGA', 'admin não entra em sala');
select lives_ok($$select cancelar_sala(pg_temp.id('s'))$$, 'admin ainda cancela sala');

-- 3. Ranking: quem vira admin sai; o adversário mantém os pontos
select tests.deslogar();
select tests.partida_confirmada('simples', hoje(), array[pg_temp.id('B')], array[pg_temp.id('C')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]');
select is((select count(*)::int from ranking where modalidade = 'simples' and jogador_id = pg_temp.id('C')), 1,
  'perdedor aparece antes');
update profiles set is_admin = true where id = pg_temp.id('C');
select is((select count(*)::int from ranking where jogador_id = pg_temp.id('C')), 0,
  'admin some do ranking');
select cmp_ok((select pontos from ranking where modalidade = 'simples' and jogador_id = pg_temp.id('B')), '>', 0,
  'o adversário mantém os pontos');

select * from finish();
rollback;
