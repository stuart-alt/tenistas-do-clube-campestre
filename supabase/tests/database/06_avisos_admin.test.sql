begin;
select plan(21);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.nots(text) returns int language sql stable as $$
  select count(*)::int from notificacoes where usuario_id = pg_temp.id($1) and tipo = 'aviso_novo' $$;
create function pg_temp.pts(text, text) returns int language sql stable as $$
  select pontos from pontos_partida where partida_id = pg_temp.id($1) and jogador_id = pg_temp.id($2) $$;
create function pg_temp.rk(text, text) returns int language sql stable as $$
  select pontos from ranking where modalidade = $2 and jogador_id = pg_temp.id($1) $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('D', tests.criar_usuario('davi@x.com', 'Davi')),
  ('I', tests.criar_usuario('inativo@x.com', 'Inativo')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));
update profiles set ativo = false where id = pg_temp.id('I');

-- Avisos
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$insert into avisos (titulo, corpo_md, autor) values ('Oi', 'texto', pg_temp.id('A'))$$,
  '42501', null, 'não admin não cria aviso');
select tests.logar_como(pg_temp.id('ADM'));
select lives_ok($$insert into avisos (titulo, corpo_md, autor) values ('Torneio', '**sábado**', pg_temp.id('ADM'))$$,
  'admin cria aviso');
select tests.deslogar();
select is(pg_temp.nots('A'), 1, 'Ana recebe aviso_novo');
select is(pg_temp.nots('B'), 1, 'Bruno recebe aviso_novo');
select is(pg_temp.nots('I'), 0, 'inativo não recebe aviso_novo');
select is((select link from notificacoes where usuario_id = pg_temp.id('A') and tipo = 'aviso_novo'), '/avisos',
  'link do aviso');
select tests.logar_como(pg_temp.id('A'));
select is((select count(*)::int from avisos), 1, 'Ana lê avisos');
select tests.deslogar();

-- Regras
insert into u values ('p', tests.partida_confirmada('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":3,"l2":6},{"l1":6,"l2":2}]'));
insert into u values ('pd', tests.partida_confirmada('duplas', hoje(), array[pg_temp.id('A'), pg_temp.id('C')],
  array[pg_temp.id('B'), pg_temp.id('D')], '[{"l1":6,"l2":4},{"l1":6,"l2":2}]'));
select recalcular_ranking('simples');
select recalcular_ranking('duplas');
select is(pg_temp.pts('p', 'A'), 85, 'vitória vale 85 com regra padrão');

select tests.logar_como(pg_temp.id('A'));
select throws_ok($$select atualizar_regras('simples', 100, 10, 1, 0.20, 50, 6, 2)$$, 'P0001', 'SEM_PERMISSAO',
  'Ana não altera regras');
select tests.logar_como(pg_temp.id('ADM'));
select throws_ok($$select atualizar_regras('simples', 100, 10, 1, 0.20, 50, 0, 2)$$, 'P0001', 'REGRA_INVALIDA',
  'janela 0 inválida');
select throws_ok($$select atualizar_regras('simples', -1, 10, 1, 0.20, 50, 6, 2)$$, 'P0001', 'REGRA_INVALIDA',
  'valor negativo inválido');
select is(pg_temp.rk('A', 'duplas'), 82, 'ranking de duplas antes (50+20+12)');
select atualizar_regras('simples', 100, 10, 1, 0.20, 50, 6, 2);
select tests.deslogar();
select is(pg_temp.pts('p', 'A'), 135, 'vitória vale 100: partida passa a dar 135');
select is(pg_temp.rk('A', 'duplas'), 82, 'ranking de duplas inalterado');

-- Desativar jogador
select tests.logar_como(pg_temp.id('A'));
insert into u values ('s', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('B'));
select entrar_sala(pg_temp.id('s'), 2::smallint);
select throws_ok($$select definir_ativo(pg_temp.id('B'), false)$$, 'P0001', 'SEM_PERMISSAO',
  'não admin não desativa');
select tests.logar_como(pg_temp.id('ADM'));
select definir_ativo(pg_temp.id('B'), false);
select tests.logar_como(pg_temp.id('A'));
select is(pg_temp.rk('B', 'simples'), null, 'Bruno some do ranking');
select is((select jsonb_array_length(vagas) from salas_lista where id = pg_temp.id('s')), 1,
  'Bruno some das vagas da sala');
select is((select count(*)::int from profiles where id = pg_temp.id('B')), 0, 'Ana não vê o perfil de Bruno');
select tests.deslogar();
select is(pg_temp.pts('p', 'A'), 135, 'pontos de Ana contra Bruno permanecem');

-- Sala esvaziada por quem não é o criador também é cancelada
select tests.logar_como(pg_temp.id('C'));
insert into u values ('s2', criar_sala('simples', now() + interval '1 day', null, 1::smallint));
select tests.logar_como(pg_temp.id('D'));
select entrar_sala(pg_temp.id('s2'), 2::smallint);
select tests.logar_como(pg_temp.id('C'));
select sair_sala(pg_temp.id('s2'));
select tests.logar_como(pg_temp.id('D'));
select sair_sala(pg_temp.id('s2'));
select tests.deslogar();
select is((select status from salas where id = pg_temp.id('s2')), 'cancelada', 'sala vazia fica cancelada');
select is((select count(*)::int from salas_lista where id = pg_temp.id('s2')), 0, 'sala vazia some da lista');

select * from finish();
rollback;
