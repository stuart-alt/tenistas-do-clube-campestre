begin;
select plan(32);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
-- Simples: a (lado 1) vence b (lado 2) por 6-3 6-3
create function pg_temp.p(p_data date, p_a text, p_b text) returns uuid language sql as $$
  select tests.partida_confirmada('simples', p_data, array[pg_temp.id(p_a)], array[pg_temp.id(p_b)],
    '[{"l1":6,"l2":3},{"l1":6,"l2":3}]'::jsonb)
$$;
create function pg_temp.notifs(text, text, text default '%') returns int language sql stable as $$
  select count(*)::int from notificacoes where usuario_id = pg_temp.id($1) and tipo = $2 and texto like $3 $$;
create function pg_temp.linha(text, text, text default null) returns conquistas_jogador language sql stable as $$
  select * from conquistas_jogador
  where jogador_id = pg_temp.id($1) and conquista = $2 and modalidade is not distinct from $3 $$;
create function pg_temp.limpar() returns void language sql as $$
  delete from salas; delete from partidas;
  select recalcular_ranking('simples'); select recalcular_ranking('duplas');
  delete from notificacoes; delete from conquistas_jogador; delete from conquistas_avisos;
$$;

insert into u select k, tests.criar_usuario(lower(k) || '@x.com', k)
from unnest(array['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10',
                  'V', 'V2', 'X', 'X2']) k;
insert into u values ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- 1ª partida: ganha bronze de partidas, com texto e link exatos
select pg_temp.p(hoje() - 1, 'A', 'B');
select is((pg_temp.linha('B', 'partidas')).nivel, 1, 'retrato: partidas nivel 1');
select is((select texto || '|' || link from notificacoes
           where usuario_id = pg_temp.id('B') and tipo = 'conquista_ganha' and texto like '%Partidas%'),
          'Você ganhou 🎾 Partidas — bronze (1 partida)!|/jogadores/' || pg_temp.id('B'),
          'conquista_ganha: texto e link');
select is(pg_temp.notifs('B', 'conquista_ganha', '%Partidas%'), 1, '1 aviso de partidas');
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 🥇 Vitórias — bronze (1 vitória)!'), 1,
          'vitorias: singular com valor 1');
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 👑 Nº 1 Simples!'), 1, 'nivel unico: texto sem nome de nivel');

-- 2ª partida: continua no nível 1, sem aviso novo
select pg_temp.p(hoje() - 2, 'A', 'B');
select is((pg_temp.linha('B', 'partidas')).valor, 2, 'retrato: valor atualizado para 2');
select is(pg_temp.notifs('B', 'conquista_ganha', '%Partidas%'), 1, 'mesmo nivel: sem aviso novo');

-- Cancelamento pelo admin: a medalha some sem aviso
select pg_temp.limpar();
create temp table pc as select pg_temp.p(hoje() - 1, 'A', 'B') as id;
grant all on pc to authenticated;
delete from notificacoes;
select tests.logar_como(pg_temp.id('ADM'));
select admin_cancelar_partida((select id from pc));
select tests.deslogar();
select is((select count(*)::int from conquistas_jogador where jogador_id = pg_temp.id('B')), 0,
          'cancelamento: retrato de B vazio');
select is((select count(*)::int from notificacoes where tipo like 'conquista%'), 0, 'cancelamento: sem aviso de conquista');

-- Vencimento: V perde 1 partida (só tem partidas bronze)
select pg_temp.limpar();
select pg_temp.p(hoje() - 1, 'V2', 'V');
create temp table ve as select (pg_temp.linha('V', 'partidas')).expira_em as d;
grant all on ve to authenticated;
select is((select d from ve), ((hoje() - 1) + interval '6 months')::date - 1, 'expira_em: ultimo dia na janela');
select is(pg_temp.notifs('V', 'conquista_vencendo'), 0, 'longe do vencimento: sem aviso');
select avaliar_conquistas(pg_temp.id('V'), true, (select d from ve) - 11);
select is(pg_temp.notifs('V', 'conquista_vencendo'), 0, 'a 11 dias: sem aviso');
select avaliar_conquistas(pg_temp.id('V'), true, (select d from ve) - 5);
select is((select texto || '|' || link from notificacoes where usuario_id = pg_temp.id('V') and tipo = 'conquista_vencendo'),
          'Sua medalha 🎾 Partidas vence em 6 dias. Lance uma partida para renovar!|/jogadores/' || pg_temp.id('V'),
          'conquista_vencendo: texto e link');
select is((pg_temp.linha('V', 'partidas')).avisado_vencimento, true, 'avisado_vencimento marcado');
select avaliar_conquistas(pg_temp.id('V'), true, (select d from ve) - 4);
select is(pg_temp.notifs('V', 'conquista_vencendo'), 1, 'rodar de novo: sem segundo aviso');
select pg_temp.p(hoje(), 'V2', 'V');
select is((pg_temp.linha('V', 'partidas')).avisado_vencimento, false, 'partida nova empurra expira_em: aviso liberado');
select ok((pg_temp.linha('V', 'partidas')).expira_em > (select d from ve), 'expira_em mais tarde');
select avaliar_conquistas(pg_temp.id('V'), true, (pg_temp.linha('V', 'partidas')).expira_em + 1);
select ok((pg_temp.linha('V', 'partidas')).jogador_id is null, 'depois de expira_em: linha apagada');

-- Pódio com cooldown de 30 dias
select pg_temp.limpar();
select pg_temp.p(hoje() - 1, 'A', 'L1');
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 🏆 Pódio Simples!'), 1, 'podio: entrou no top 3, 1 aviso');
-- C, E e G vencem 2 vezes (semanas diferentes): A cai para 4º
select pg_temp.p(hoje() - 1 - 7 * w, k, 'L' || (2 + w)) from unnest(array['C', 'E', 'G']) k, generate_series(0, 1) w;
select ok((pg_temp.linha('A', 'podio', 'simples')).jogador_id is null, 'podio: saiu do top 3, linha apagada');
-- A vence mais 2 e volta
select pg_temp.p(hoje() - 1 - 7 * w, 'A', 'L' || (4 + w)) from generate_series(1, 2) w;
select is((pg_temp.linha('A', 'podio', 'simples')).nivel, 1, 'podio: voltou ao top 3');
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 🏆 Pódio Simples!'), 1, 'podio: cooldown, sem aviso novo');
update conquistas_avisos set ultimo_aviso_ganho = now() - interval '31 days'
where jogador_id = pg_temp.id('A') and conquista = 'podio' and modalidade = 'simples';
select pg_temp.p(hoje() - 1 - 7 * w, k, 'L' || (5 + w)) from unnest(array['C', 'E', 'G']) k, generate_series(2, 3) w;
select ok((pg_temp.linha('A', 'podio', 'simples')).jogador_id is null, 'podio: saiu de novo');
select pg_temp.p(hoje() - 1 - 7 * w, 'A', 'L' || (6 + w)) from generate_series(3, 4) w;
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 🏆 Pódio Simples!'), 2, 'podio: depois de 30 dias, aviso de novo');

-- Vira admin: avaliar_conquistas_todos apaga o retrato
select ok((select count(*) from conquistas_jogador where jogador_id = pg_temp.id('A')) > 0, 'A tem medalhas');
update profiles set is_admin = true where id = pg_temp.id('A');
select avaliar_conquistas_todos();
select is((select count(*)::int from conquistas_jogador where jogador_id = pg_temp.id('A')), 0, 'virou admin: retrato vazio');
update profiles set is_admin = false where id = pg_temp.id('A');

-- Estreia: com histórico, 1 aviso por jogador e nenhum por medalha
select pg_temp.limpar();
select pg_temp.p(hoje() - 1, 'X', 'X2');
select pg_temp.p(hoje() - 8, 'X', 'X2');
select pg_temp.p((hoje() - interval '6 months')::date + 3, 'B', 'D');
delete from conquistas_jogador; delete from conquistas_avisos; delete from notificacoes;
select estrear_conquistas();
select is((select count(*)::int from notificacoes where tipo = 'conquista_ganha'), 0, 'estreia: sem aviso por medalha');
select is((select string_agg(texto || '|' || link, ',') from notificacoes
           where usuario_id = pg_temp.id('X') and tipo = 'conquistas_estreia'),
          format('Chegaram as conquistas! Você já tem %s medalhas. Veja no seu perfil.|/jogadores/%s',
                 (select count(*) from conquistas_jogador where jogador_id = pg_temp.id('X')), pg_temp.id('X')),
          'estreia: 1 aviso com N medalhas');
select is((select count(*)::int from notificacoes where tipo = 'conquistas_estreia'),
          (select count(distinct jogador_id)::int from conquistas_jogador), 'estreia: 1 aviso por jogador com medalha');
select is((select bool_and(avisado_vencimento) from conquistas_jogador where jogador_id = pg_temp.id('D')), true,
          'estreia: medalhas a vencer entram ja avisadas');

-- Cron
select is((select count(*)::int from cron.job where jobname = 'conquistas-diarias'
           and schedule = '0 12 * * *' and command = 'select public.avaliar_conquistas_todos()'), 1, 'cron conquistas-diarias');

-- Desempenho: 40 jogadores x 30 partidas confirmadas
select pg_temp.limpar();
insert into u select 'P' || i, tests.criar_usuario('p' || i || '@x.com', 'P' || i) from generate_series(1, 40) i;
create temp table perf as
select gen_random_uuid() as id, 'P' || (1 + (k % 40)) as a, 'P' || (1 + ((k + 1 + k / 40) % 40)) as b,
       hoje() - (k * 150 / 600) as d, k
from generate_series(0, 599) k;
insert into partidas (id, modalidade, data_jogo, lancado_por, status, confirmado_por, confirmado_em, created_at)
select id, 'simples', d, pg_temp.id(a), 'confirmada', pg_temp.id(b), now(), now() + k * interval '1 ms' from perf;
insert into partida_jogadores (partida_id, jogador_id, lado)
select id, pg_temp.id(a), 1 from perf union all select id, pg_temp.id(b), 2 from perf;
insert into partida_sets (partida_id, ordem, games_lado1, games_lado2, super_tiebreak)
select id, o, 6, 3, false from perf, generate_series(1, 2) o;
select recalcular_ranking('simples');
-- estatísticas como em produção (o autovacuum não enxerga dados desta transação nem limpou os testes anteriores)
analyze profiles, partidas, partida_jogadores, partida_sets, pontos_partida, salas, conquistas_jogador, notificacoes;
create temp table t0 as select clock_timestamp() as t;
select pg_temp.p(hoje(), 'P1', 'P2');
create temp table t1 as select clock_timestamp() - (select t from t0) as dur;
grant all on t1 to authenticated;
select diag('confirmacao com 40 jogadores x 30 partidas: ' || (select dur from t1));
select ok((select dur from t1) < interval '1 second', 'desempenho: confirmacao em menos de 1 s');
create temp table t2 as select clock_timestamp() as t;
select avaliar_conquistas_todos();
select diag('so avaliar_conquistas_todos: ' || (clock_timestamp() - (select t from t2)));
create temp table t3 as select clock_timestamp() as t;
select recalcular_ranking('simples');
select diag('recalcular_ranking inteiro (com conquistas): ' || (clock_timestamp() - (select t from t3)));

select * from finish();
rollback;
