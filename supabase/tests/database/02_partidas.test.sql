begin;
select plan(20);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;

insert into u values
  ('ana', tests.criar_usuario('ana@x.com', 'Ana')),
  ('bruno', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('carla', tests.criar_usuario('carla@x.com', 'Carla')),
  ('davi', tests.criar_usuario('davi@x.com', 'Davi')),
  ('ines', tests.criar_usuario('ines@x.com', 'Ines')),
  ('admin', tests.criar_usuario('admin@x.com', 'Admin', true));
update profiles set ativo = false where id = pg_temp.id('ines');

-- Registro válido
select tests.logar_como(pg_temp.id('ana'));
insert into u values ('p1', registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')],
  '[{"l1":6,"l2":4,"stb":false},{"l1":3,"l2":6,"stb":false},{"l1":6,"l2":2,"stb":false}]'));

select isnt(pg_temp.id('p1'), null, 'registrar_partida retorna uuid');
select is((select status from partidas where id = pg_temp.id('p1')), 'pendente', 'partida nasce pendente');
select is((select lancado_por from partidas where id = pg_temp.id('p1')), pg_temp.id('ana'), 'lancado_por = auth.uid()');
select is((select count(*) from partida_jogadores where partida_id = pg_temp.id('p1')), 2::bigint, '2 jogadores gravados');
select is((select count(*) from partida_sets where partida_id = pg_temp.id('p1')), 3::bigint, '3 sets gravados');

-- Datas
select throws_ok($$select registrar_partida('simples', hoje() + 1, array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4}]')$$,
  'P0001', 'DATA_INVALIDA', 'data futura é inválida');
select throws_ok($$select registrar_partida('simples', hoje() - 8, array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4}]')$$,
  'P0001', 'DATA_INVALIDA', 'data com mais de 7 dias é inválida');
select lives_ok($$select registrar_partida('simples', hoje() - 7, array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4}]')$$,
  'data de 7 dias atrás é aceita');

-- Placar
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":6}]')$$,
  'P0001', 'SET_EMPATADO', 'set empatado');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4},{"l1":4,"l2":6}]')$$,
  'P0001', 'PLACAR_EMPATADO', 'partida empatada em sets');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')],
  '[{"l1":6,"l2":4},{"l1":4,"l2":6},{"l1":6,"l2":4},{"l1":6,"l2":4}]')$$,
  'P0001', 'SETS_INVALIDOS', '4 sets é inválido');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[]')$$,
  'P0001', 'SETS_INVALIDOS', '0 sets é inválido');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":-1,"l2":6}]')$$,
  'P0001', 'SETS_INVALIDOS', 'games negativos são inválidos');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')],
  '[{"l1":10,"l2":7,"stb":true},{"l1":4,"l2":6},{"l1":6,"l2":4}]')$$,
  'P0001', 'SUPER_TIEBREAK_NAO_FINAL', 'super tie-break só no último set');

-- Jogadores
select throws_ok($$select registrar_partida('duplas', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4}]')$$,
  'P0001', 'JOGADORES_INVALIDOS', 'duplas exige 2 por lado');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('ana')], '[{"l1":6,"l2":4}]')$$,
  'P0001', 'JOGADORES_INVALIDOS', 'mesmo jogador nos dois lados');
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('ines')], '[{"l1":6,"l2":4}]')$$,
  'P0001', 'JOGADORES_INVALIDOS', 'adversário inativo');

-- Participação
select tests.logar_como(pg_temp.id('carla'));
select throws_ok($$select registrar_partida('simples', hoje(), array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4}]')$$,
  'P0001', 'NAO_PARTICIPANTE', 'não participante não registra');

select throws_ok($$insert into partidas (modalidade, data_jogo, lancado_por) values ('simples', hoje(), pg_temp.id('carla'))$$,
  '42501', null, 'insert direto em partidas é bloqueado');

-- Admin: qualquer data passada, mesmo sem participar
select tests.logar_como(pg_temp.id('admin'));
select lives_ok($$select registrar_partida('simples', hoje() - 30, array[pg_temp.id('ana')], array[pg_temp.id('bruno')], '[{"l1":6,"l2":4}]')$$,
  'admin registra com data antiga sem participar');

select tests.deslogar();
select * from finish();
rollback;
