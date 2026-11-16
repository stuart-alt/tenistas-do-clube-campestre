begin;
select plan(27);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.st(text) returns text language sql stable as $$ select status from salas where id = pg_temp.id($1) $$;
create function pg_temp.nv(text) returns int language sql stable as $$
  select count(*)::int from sala_vagas where sala_id = pg_temp.id($1) $$;
create function pg_temp.nots(text, text) returns int language sql stable as $$
  select count(*)::int from notificacoes where usuario_id = pg_temp.id($1) and tipo = $2 $$;
create function pg_temp.na_lista(text) returns boolean language sql stable as $$
  select exists (select 1 from salas_lista where id = pg_temp.id($1)) $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('D', tests.criar_usuario('davi@x.com', 'Davi')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- Criar
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$select criar_sala('simples', now() - interval '1 hour', null, 1::smallint)$$,
  'P0001', 'DATA_INVALIDA', 'data no passado');
insert into u values ('s', criar_sala('simples', now() + interval '1 day', 'Quem topa?', 1::smallint));
select is(pg_temp.nv('s'), 1, 'criador ocupa 1 vaga');
select is(pg_temp.st('s'), 'aberta', 'sala nasce aberta');

-- Entrar
select tests.logar_como(pg_temp.id('B'));
select throws_ok($$select entrar_sala(pg_temp.id('s'), 1::smallint)$$, 'P0001', 'VAGA_OCUPADA', 'vaga ocupada');
select entrar_sala(pg_temp.id('s'), 2::smallint);
select is(pg_temp.st('s'), 'confirmada', 'sala cheia fica confirmada');
select tests.logar_como(pg_temp.id('C'));
select throws_ok($$select entrar_sala(pg_temp.id('s'), 2::smallint)$$, 'P0001', 'VAGA_OCUPADA', 'sala cheia: vaga ocupada');
select throws_ok($$select entrar_sala(pg_temp.id('s'), 3::smallint)$$, 'P0001', 'POSICAO_INVALIDA', 'posição 3 em simples');
select tests.deslogar();
select is(pg_temp.nv('s'), 2, 'simples nunca passa de 2');
select is(pg_temp.nots('A', 'sala_entrou'), 1, 'Ana recebe sala_entrou');
select is(pg_temp.nots('A', 'sala_completa'), 1, 'Ana recebe sala_completa');
select is(pg_temp.nots('B', 'sala_completa'), 1, 'Bruno recebe sala_completa');
select is(pg_temp.nots('B', 'sala_entrou'), 0, 'quem entrou não é notificado da própria entrada');

-- Sair
select tests.logar_como(pg_temp.id('B'));
select sair_sala(pg_temp.id('s'));
select tests.deslogar();
select is(pg_temp.st('s'), 'aberta', 'sair reabre a sala');
select is(pg_temp.nots('A', 'sala_saiu'), 1, 'Ana recebe sala_saiu');

-- Duplas
select tests.logar_como(pg_temp.id('A'));
insert into u values ('d', criar_sala('duplas', now() + interval '2 days', null, 1::smallint));
select throws_ok($$select entrar_sala(pg_temp.id('d'), 2::smallint)$$, 'P0001', 'JA_NA_SALA', 'já está na sala');
select tests.logar_como(pg_temp.id('B'));
select entrar_sala(pg_temp.id('d'), 2::smallint);
select tests.logar_como(pg_temp.id('C'));
select entrar_sala(pg_temp.id('d'), 3::smallint);
select is(pg_temp.st('d'), 'aberta', 'duplas com 3 segue aberta');
select tests.logar_como(pg_temp.id('D'));
select entrar_sala(pg_temp.id('d'), 4::smallint);
select is(pg_temp.st('d'), 'confirmada', 'duplas com 4 confirmada');

-- Cancelar
select tests.logar_como(pg_temp.id('B'));
select throws_ok($$select cancelar_sala(pg_temp.id('d'))$$, 'P0001', 'SEM_PERMISSAO', 'só o criador cancela');
select tests.logar_como(pg_temp.id('A'));
select ok(pg_temp.na_lista('d'), 'sala aparece na lista');
select cancelar_sala(pg_temp.id('d'));
select tests.deslogar();
select is(pg_temp.st('d'), 'cancelada', 'sala cancelada');
select is(pg_temp.nots('B', 'sala_cancelada') + pg_temp.nots('C', 'sala_cancelada') + pg_temp.nots('D', 'sala_cancelada'), 3,
  'ocupantes notificados');
select ok(not pg_temp.na_lista('d'), 'cancelada some da lista');

-- Janela de 3 dias
insert into salas (criador, modalidade, data_hora) values
  (pg_temp.id('A'), 'simples', now() - interval '4 days'),
  (pg_temp.id('A'), 'simples', now() - interval '2 days');
select is((select count(*)::int from salas_lista where data_hora < now() - interval '3 days'), 0,
  'sala de 4 dias atrás fora da lista');
select is((select count(*)::int from salas_lista where data_hora between now() - interval '3 days' and now()), 1,
  'sala de 2 dias atrás na lista');

-- Partida com sala_id (a sala precisa estar confirmada com os jogadores da partida)
select tests.logar_como(pg_temp.id('B'));
select entrar_sala(pg_temp.id('s'), 2::smallint);
select tests.logar_como(pg_temp.id('A'));
select registrar_partida('simples', hoje(), array[pg_temp.id('A')], array[pg_temp.id('B')],
  '[{"l1":6,"l2":4},{"l1":6,"l2":2}]', pg_temp.id('s'));
select tests.deslogar();
select ok(not pg_temp.na_lista('s'), 'sala com partida some da lista');

-- Sem escrita direta
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$insert into salas (criador, modalidade, data_hora) values (auth.uid(), 'simples', now() + interval '1 day')$$,
  '42501', null, 'insert direto em salas bloqueado');
select throws_ok($$insert into sala_vagas (sala_id, posicao, jogador_id) values (pg_temp.id('s'), 1, auth.uid())$$,
  '42501', null, 'insert direto em sala_vagas bloqueado');
select tests.deslogar();

select * from finish();
rollback;
