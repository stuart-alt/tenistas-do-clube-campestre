begin;
select plan(28);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;

insert into u values
  ('A', tests.criar_usuario('ana@x.com', 'Ana')),
  ('B', tests.criar_usuario('bruno@x.com', 'Bruno')),
  ('C', tests.criar_usuario('carla@x.com', 'Carla')),
  ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true)),
  ('ADM2', tests.criar_usuario('admin2@x.com', 'Admin Dois', true));

-- Salas diretamente (como dono do banco): vencida aberta, vencida confirmada, futura aberta
insert into salas (id, criador, modalidade, data_hora, status) values
  ('00000000-0000-0000-0000-0000000000a1', pg_temp.id('A'), 'simples', now() - interval '1 hour', 'aberta'),
  ('00000000-0000-0000-0000-0000000000a2', pg_temp.id('A'), 'simples', now() - interval '1 hour', 'confirmada'),
  ('00000000-0000-0000-0000-0000000000a3', pg_temp.id('A'), 'simples', now() + interval '1 day', 'aberta');
insert into sala_vagas values
  ('00000000-0000-0000-0000-0000000000a1', 1, pg_temp.id('A')),
  ('00000000-0000-0000-0000-0000000000a2', 1, pg_temp.id('A')),
  ('00000000-0000-0000-0000-0000000000a2', 2, pg_temp.id('B')),
  ('00000000-0000-0000-0000-0000000000a3', 1, pg_temp.id('A'));

-- A. salas_lista esconde a aberta vencida imediatamente
select tests.logar_como(pg_temp.id('B'));
select is((select count(*)::int from salas_lista where id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'salas_lista esconde sala aberta vencida');
select is((select count(*)::int from salas_lista where id = '00000000-0000-0000-0000-0000000000a2'), 1,
  'salas_lista mantém confirmada vencida');
select is((select count(*)::int from salas_lista where id = '00000000-0000-0000-0000-0000000000a3'), 1,
  'salas_lista mantém aberta futura');
select throws_ok($$select entrar_sala('00000000-0000-0000-0000-0000000000a1', 2::smallint)$$,
  'P0001', 'SALA_FECHADA', 'entrar em sala vencida');
select tests.deslogar();

select is(encerrar_salas_incompletas(), 1, 'encerra uma sala e devolve a contagem');
select is((select status from salas where id = '00000000-0000-0000-0000-0000000000a1'), 'cancelada', 'aberta vencida cancelada');
select is((select status from salas where id = '00000000-0000-0000-0000-0000000000a2'), 'confirmada', 'confirmada vencida intacta');
select is((select status from salas where id = '00000000-0000-0000-0000-0000000000a3'), 'aberta', 'aberta futura intacta');
select is((select count(*)::int from notificacoes where tipo = 'sala_cancelada' and usuario_id = pg_temp.id('A')
  and link = '/salas' and texto ~ '^Sua sala de \d\d/\d\d às \d\d:\d\d não completou e foi encerrada\.$'), 1,
  'ocupante notificado com o texto esperado');
select is((select count(*)::int from notificacoes where tipo = 'sala_cancelada' and usuario_id = pg_temp.id('B')), 0,
  'quem não estava na sala não é notificado');
select is(encerrar_salas_incompletas(), 0, 'segunda execução não encerra nada');

-- C. mensagens
select tests.logar_como(pg_temp.id('A'));
select throws_ok($$select enviar_mensagem_admin('duvida', '   ')$$, 'P0001', 'MENSAGEM_INVALIDA', 'texto vazio');
select throws_ok($$select enviar_mensagem_admin('duvida', repeat('x', 2001))$$, 'P0001', 'MENSAGEM_INVALIDA', 'texto longo');
select throws_ok($$select enviar_mensagem_admin('outro', 'oi')$$, 'P0001', 'MENSAGEM_INVALIDA', 'tipo inválido');
insert into u values ('m', enviar_mensagem_admin('sugestao', '  Mais quadras  '));
select is((select texto from mensagens_admin where id = pg_temp.id('m')), 'Mais quadras', 'texto aparado');
select throws_ok($$insert into mensagens_admin (autor, tipo, texto) values (pg_temp.id('A'), 'duvida', 'x')$$,
  '42501', null, 'insert direto falha');
select throws_ok($$select responder_mensagem_admin(pg_temp.id('m'), 'ok')$$, 'P0001', 'SEM_PERMISSAO', 'jogador não responde');

select tests.logar_como(pg_temp.id('B'));
select is((select count(*)::int from mensagens_admin), 0, 'outro jogador não vê a mensagem');
select tests.logar_como(pg_temp.id('A'));
select is((select count(*)::int from mensagens_admin), 1, 'autor vê a própria');

select tests.deslogar();
select is((select count(*)::int from notificacoes where tipo = 'mensagem_admin' and link = '/admin'
  and texto = 'Nova mensagem de Ana: Sugestão'
  and usuario_id in (pg_temp.id('ADM'), pg_temp.id('ADM2'))), 2, 'todos os admins notificados');

select tests.logar_como(pg_temp.id('ADM'));
select is((select count(*)::int from mensagens_admin), 1, 'admin vê tudo');
select throws_ok($$select responder_mensagem_admin('00000000-0000-0000-0000-000000000000', 'ok')$$,
  'P0001', 'MENSAGEM_NAO_ENCONTRADA', 'mensagem inexistente');
select throws_ok($$select responder_mensagem_admin(pg_temp.id('m'), '  ')$$, 'P0001', 'MENSAGEM_INVALIDA', 'resposta vazia');
select throws_ok($$select responder_mensagem_admin(pg_temp.id('m'), repeat('x', 2001))$$, 'P0001', 'MENSAGEM_INVALIDA', 'resposta longa');
select lives_ok($$select responder_mensagem_admin(pg_temp.id('m'), 'Vamos ver')$$, 'admin responde');
select lives_ok($$select responder_mensagem_admin(pg_temp.id('m'), 'Resolvido')$$, 'responder de novo sobrescreve');
select is((select resposta || '|' || (respondido_por = pg_temp.id('ADM'))::text from mensagens_admin where id = pg_temp.id('m')),
  'Resolvido|true', 'resposta gravada com o admin');
select tests.deslogar();
select is((select count(*)::int from notificacoes where tipo = 'mensagem_respondida' and link = '/contato'
  and texto = 'O administrador respondeu sua mensagem.' and usuario_id = pg_temp.id('A')), 2, 'autor notificado a cada resposta');

select * from finish();
rollback;
