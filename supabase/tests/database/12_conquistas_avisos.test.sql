begin;
select plan(46);

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
                  'V', 'V2', 'X', 'X2', 'Y', 'Y2']) k;
insert into u values ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

-- Desempenho: 40 jogadores x 30 partidas confirmadas. Roda primeiro, antes que as outras seções
-- deixem linhas mortas nesta transação (que o autovacuum não consegue limpar)
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
select diag('confirmacao inteira (ranking + conquistas): ' || (clock_timestamp() - (select t from t0)));
-- O que as conquistas acrescentam a cada confirmação é uma chamada a avaliar_conquistas_todos no fim de
-- recalcular_ranking; o laço de pontos de recalcular_ranking (anterior às conquistas) varia muito neste
-- ambiente, então o limite vale para a parte das conquistas, a melhor de 3 medições
create temp table tc (dur interval);
grant all on tc to authenticated;
create function pg_temp.medir() returns void language plpgsql as $$
declare t timestamptz := clock_timestamp();
begin
  perform avaliar_conquistas_todos();
  insert into tc values (clock_timestamp() - t);
end $$;
select pg_temp.medir() from generate_series(1, 3);
select diag('avaliar_conquistas_todos (40 jogadores), melhor de 3: ' || (select min(dur) from tc));
select ok((select min(dur) from tc) < interval '1 second', 'desempenho: conquistas acrescentam menos de 1 s a uma confirmacao');
select pg_temp.limpar();

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
select is((pg_temp.linha('A', 'numero1', 'simples')).nivel, 1, 'numero1: voltou a ser 1o');
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 👑 Nº 1 Simples!'), 1, 'numero1: cooldown, sem aviso novo');
update conquistas_avisos set ultimo_aviso_ganho = now() - interval '31 days'
where jogador_id = pg_temp.id('A') and conquista = 'podio' and modalidade = 'simples';
select pg_temp.p(hoje() - 1 - 7 * w, k, 'L' || (5 + w)) from unnest(array['C', 'E', 'G']) k, generate_series(2, 3) w;
select ok((pg_temp.linha('A', 'podio', 'simples')).jogador_id is null, 'podio: saiu de novo');
select pg_temp.p(hoje() - 1 - 7 * w, 'A', 'L' || (6 + w)) from generate_series(3, 4) w;
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 🏆 Pódio Simples!'), 2, 'podio: depois de 30 dias, aviso de novo');
select is(pg_temp.notifs('A', 'conquista_ganha', 'Você ganhou 👑 Nº 1 Simples!'), 1, 'numero1: cooldown proprio, ainda sem aviso novo');

-- Vira admin: avaliar_conquistas_todos apaga o retrato
select ok((select count(*) from conquistas_jogador where jogador_id = pg_temp.id('A')) > 0, 'A tem medalhas');
update profiles set is_admin = true where id = pg_temp.id('A');
select avaliar_conquistas_todos();
select is((select count(*)::int from conquistas_jogador where jogador_id = pg_temp.id('A')), 0, 'virou admin: retrato vazio');
update profiles set is_admin = false where id = pg_temp.id('A');

-- Fica inativo: avaliar_conquistas_todos apaga o retrato
select avaliar_conquistas_todos();
select ok((select count(*) from conquistas_jogador where jogador_id = pg_temp.id('A')) > 0, 'A tem medalhas de novo');
update profiles set ativo = false where id = pg_temp.id('A');
select avaliar_conquistas_todos();
select is((select count(*)::int from conquistas_jogador where jogador_id = pg_temp.id('A')), 0, 'inativo: retrato vazio');
update profiles set ativo = true where id = pg_temp.id('A');

-- Sobe de nível: 9 -> 10 partidas (Y perde todas; 1 delas 100 dias atrás)
select pg_temp.limpar();
select pg_temp.p(hoje() - 100, 'Y2', 'Y');
select pg_temp.p(hoje() - i, 'Y2', 'Y') from generate_series(1, 8) i;
select is((pg_temp.linha('Y', 'partidas')).nivel, 1, '9 partidas: bronze');
select pg_temp.p(hoje() - 9, 'Y2', 'Y');
select is((pg_temp.linha('Y', 'partidas')).nivel, 2, '10 partidas: prata');
select is(pg_temp.notifs('Y', 'conquista_ganha', 'Você ganhou 🎾 Partidas — prata (10 partidas)!'), 1, 'subiu de nivel: aviso de prata');
-- Desce de nível: a partida de 100 dias atrás sai da janela; expira_em não muda, avisado_vencimento fica como estava
update conquistas_jogador set avisado_vencimento = true where jogador_id = pg_temp.id('Y') and conquista = 'partidas';
create temp table ye as select (pg_temp.linha('Y', 'partidas')).valida_ate as va, (pg_temp.linha('Y', 'partidas')).expira_em as ex;
grant all on ye to authenticated;
select is((select va from ye), ((hoje() - 100) + interval '6 months')::date - 1, 'prata valida ate a 10a partida sair');
select avaliar_conquistas(pg_temp.id('Y'), true, (select va from ye) + 1);
select is((pg_temp.linha('Y', 'partidas')).nivel, 1, 'desceu para bronze');
select is((pg_temp.linha('Y', 'partidas')).expira_em, (select ex from ye), 'expira_em igual');
select is((pg_temp.linha('Y', 'partidas')).avisado_vencimento, true, 'desceu: avisado_vencimento mantido');
select is(pg_temp.notifs('Y', 'conquista_ganha', '%Partidas%'), 2, 'desceu: sem aviso novo');

-- Estreia: com histórico, 1 aviso por jogador e nenhum por medalha
select pg_temp.limpar();
select pg_temp.p(hoje() - 1, 'X', 'X2');
select pg_temp.p(hoje() - 8, 'X', 'X2');
select pg_temp.p((hoje() - interval '6 months')::date + 3, 'B', 'D');
delete from conquistas_jogador; delete from conquistas_avisos; delete from notificacoes;
select estrear_conquistas();
select is((select count(*)::int from notificacoes where tipo = 'conquista_ganha'), 0, 'estreia: sem aviso por medalha');
-- X: sequência (2 semanas), partidas, vitórias, pódio e nº 1 em simples
select is((select string_agg(texto || '|' || link, ',') from notificacoes
           where usuario_id = pg_temp.id('X') and tipo = 'conquistas_estreia'),
          'Chegaram as conquistas! Você já tem 5 medalhas. Veja no seu perfil.|/jogadores/' || pg_temp.id('X'),
          'estreia: 1 aviso com 5 medalhas');
-- D: só partidas (4º no ranking)
select is((select string_agg(texto, ',') from notificacoes where usuario_id = pg_temp.id('D') and tipo = 'conquistas_estreia'),
          'Chegaram as conquistas! Você já tem 1 medalha. Veja no seu perfil.', 'estreia: singular com 1 medalha');
select is((select count(*)::int from notificacoes where tipo = 'conquistas_estreia'),
          (select count(distinct jogador_id)::int from conquistas_jogador), 'estreia: 1 aviso por jogador com medalha');
select is((select bool_and(avisado_vencimento) from conquistas_jogador where jogador_id = pg_temp.id('D')), true,
          'estreia: medalhas a vencer entram ja avisadas');

-- Cron
select is((select count(*)::int from cron.job where jobname = 'conquistas-diarias'
           and schedule = '0 12 * * *' and command = 'select public.avaliar_conquistas_todos()'), 1, 'cron conquistas-diarias');

select * from finish();
rollback;
