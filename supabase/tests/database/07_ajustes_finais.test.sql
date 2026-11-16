begin;
select plan(21);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.st(text) returns text language sql stable as $$ select status from salas where id = pg_temp.id($1) $$;
create function pg_temp.nots(text, text) returns int language sql stable as $$
  select count(*)::int from notificacoes where usuario_id = pg_temp.id($1) and tipo = $2 $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('D', tests.criar_usuario('davi@x.com', 'Davi')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- 1. registrar_partida valida a sala
-- Sala confirmada de Ana x Bruno
select tests.logar_como(pg_temp.id('A'));
insert into u values ('s', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('B'));
select entrar_sala(pg_temp.id('s'), 2::smallint);
-- Sala aberta só com Carla
select tests.logar_como(pg_temp.id('C'));
insert into u values ('aberta', criar_sala('simples', now() + interval '1 day', null, 1::smallint));

select tests.logar_como(pg_temp.id('C'));
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('C')], array[pg_temp.id('D')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('s'))$$, 'P0001', 'JOGADORES_INVALIDOS',
  'Carla x Davi não usa a sala de Ana x Bruno');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('C')], array[pg_temp.id('D')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', gen_random_uuid())$$, 'P0001', 'SALA_NAO_ENCONTRADA',
  'sala inexistente');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('C')], array[pg_temp.id('D')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('aberta'))$$, 'P0001', 'SALA_FECHADA',
  'sala ainda aberta não recebe partida');
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('C')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('s'))$$, 'P0001', 'JOGADORES_INVALIDOS',
  'Ana x Carla não usa a sala de Ana x Bruno');
select tests.deslogar();
select is((select partida_id from salas where id = pg_temp.id('s')), null, 'sala segue sem partida');

select tests.logar_como(pg_temp.id('A'));
insert into u values ('p1', registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('s')));
select tests.deslogar();
select is((select partida_id from salas where id = pg_temp.id('s')), pg_temp.id('p1'), 'sala vinculada à partida');

select tests.logar_como(pg_temp.id('B'));
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('B')], array[pg_temp.id('A')],
  '[{"l1":4,"l2":6},{"l1":2,"l2":6}]', pg_temp.id('s'))$$, 'P0001', 'SALA_FECHADA',
  'segundo lançamento da mesma sala');
select tests.deslogar();
select is((select count(*)::int from partidas where sala_id = pg_temp.id('s')), 1, 'só uma partida da sala');

-- Lado invertido também vale (conjunto, não ordem)
select tests.logar_como(pg_temp.id('A'));
insert into u values ('s2', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('B'));
select entrar_sala(pg_temp.id('s2'), 2::smallint);
select lives_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('B')], array[pg_temp.id('A')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('s2'))$$, 'Bruno lança pela sala com lados invertidos');
select tests.deslogar();

-- 10. admin_cancelar_partida notifica os jogadores
select tests.logar_como(pg_temp.id('ADM'));
select admin_cancelar_partida(pg_temp.id('p1'));
select tests.deslogar();
select is(pg_temp.nots('A', 'partida_cancelada'), 1, 'Ana notificada do cancelamento');
select is(pg_temp.nots('B', 'partida_cancelada'), 1, 'Bruno notificado do cancelamento');
select is((select texto || '|' || link from notificacoes
           where usuario_id = pg_temp.id('A') and tipo = 'partida_cancelada'),
  'Uma partida sua foi cancelada pelo administrador.|/partidas', 'texto e link do cancelamento');
select is(pg_temp.nots('ADM', 'partida_cancelada'), 0, 'admin não é notificado');

-- 9. definir_ativo(false) libera as vagas do jogador
select tests.logar_como(pg_temp.id('A'));
insert into u values ('conf', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('D'));
select entrar_sala(pg_temp.id('conf'), 2::smallint);
insert into u values ('so_d', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('C'));
insert into u values ('ab', criar_sala('duplas', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('D'));
select entrar_sala(pg_temp.id('ab'), 3::smallint);
select tests.logar_como(pg_temp.id('A'));
insert into u values ('jog', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('D'));
select entrar_sala(pg_temp.id('jog'), 2::smallint);
select tests.logar_como(pg_temp.id('A'));
select registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('D')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('jog'));
select tests.deslogar();
select is(pg_temp.st('conf'), 'confirmada', 'sala Ana x Davi confirmada');
delete from notificacoes where tipo = 'sala_saiu';

select tests.logar_como(pg_temp.id('ADM'));
select definir_ativo(pg_temp.id('D'), false);
select tests.deslogar();
select is((select count(*)::int from sala_vagas where jogador_id = pg_temp.id('D')
           and sala_id in (pg_temp.id('conf'), pg_temp.id('ab'), pg_temp.id('so_d'))), 0,
  'Davi sai das salas abertas e confirmadas');
select is(pg_temp.st('conf'), 'aberta', 'sala confirmada volta a aberta');
select is(pg_temp.st('ab'), 'aberta', 'sala aberta segue aberta');
select is(pg_temp.st('so_d'), 'cancelada', 'sala que ficou vazia é cancelada');
select is(pg_temp.nots('A', 'sala_saiu'), 1, 'Ana recebe sala_saiu');
select is(pg_temp.nots('C', 'sala_saiu'), 1, 'Carla recebe sala_saiu');
select is((select count(*)::int from sala_vagas where sala_id = pg_temp.id('jog') and jogador_id = pg_temp.id('D')), 1,
  'sala com partida não é mexida');

select * from finish();
rollback;
