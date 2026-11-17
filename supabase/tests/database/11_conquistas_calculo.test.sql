begin;
select plan(45);

create temp table u (k text primary key, id uuid);
grant all on u to authenticated;
create function pg_temp.id(text) returns uuid language sql stable as $$ select id from u where k = $1 $$;
create function pg_temp.v(text, text, text default null) returns int language sql stable as $$
  select valor from calcular_conquistas(pg_temp.id($1), hoje()) where conquista = $2 and modalidade is not distinct from $3 $$;
create function pg_temp.n(text, text, text default null) returns int language sql stable as $$
  select nivel from calcular_conquistas(pg_temp.id($1), hoje()) where conquista = $2 and modalidade is not distinct from $3 $$;

-- Simples: a (lado 1) x b (lado 2); placar padrão 6-3 6-3 para o lado 1
create function pg_temp.p(p_data date, p_a text, p_b text, p_sets text default '[{"l1":6,"l2":3},{"l1":6,"l2":3}]')
returns void language sql as $$
  select tests.partida_confirmada('simples', p_data, array[pg_temp.id(p_a)], array[pg_temp.id(p_b)], p_sets::jsonb)
$$;
-- Duplas: (a1, a2) x (b1, b2)
create function pg_temp.d(p_data date, p_a1 text, p_a2 text, p_b1 text, p_b2 text) returns void language sql as $$
  select tests.partida_confirmada('duplas', p_data, array[pg_temp.id(p_a1), pg_temp.id(p_a2)],
    array[pg_temp.id(p_b1), pg_temp.id(p_b2)], '[{"l1":6,"l2":3},{"l1":6,"l2":3}]'::jsonb)
$$;
create function pg_temp.limpar() returns void language sql as $$ delete from salas; delete from partidas $$;

insert into u select k, tests.criar_usuario(lower(k) || '@x.com', k)
from unnest(array['P', 'R', 'E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
                  'N', 'N2', 'M', 'M2', 'Z1', 'Z2', 'Z3', 'Z4', 'H', 'H2', 'Q', 'Q2', 'G', 'G2',
                  'T1', 'T2', 'T3', 'T4', 'V1', 'V2', 'V3', 'V4', 'W', 'W2', 'W3', 'AD', 'IN', 'IN2', 'C1', 'X1', 'X2']) k;
insert into u values ('ADM', tests.criar_usuario('admin@x.com', 'Admin', true));

create temp table w as select date_trunc('week', (hoje() - 60)::timestamp)::date as seg;
grant all on w to authenticated;
create function pg_temp.seg() returns date language sql stable as $$ select seg from w $$;

-- catálogo
select is((select count(*)::int from conquistas_catalogo), 11, 'catalogo tem 11 conquistas');
select is((select limites from conquistas_catalogo where chave = 'sequencia'), '{2,4,8,12}'::int[], 'limites de sequencia');
select is((select limites from conquistas_catalogo where chave = 'partidas'), '{1,10,25,50}'::int[], 'limites de partidas');

-- partidas e vitórias: 10 na janela, 1 fora (6 meses atrás) e 1 no futuro
select pg_temp.p(hoje() - i, 'P', 'R') from generate_series(1, 10) i;
select pg_temp.p((hoje() - interval '6 months')::date, 'P', 'R');
select pg_temp.p(hoje() + 1, 'P', 'R');
select is(pg_temp.v('P', 'partidas'), 10, 'partidas: 10 na janela (fora e futuro nao contam)');
select is(pg_temp.n('P', 'partidas'), 2, 'partidas: nivel 2 com 10');
select is(pg_temp.v('P', 'vitorias'), 10, 'vitorias: 10');

-- adversários: 3 rivais diferentes
select pg_temp.p(hoje() - 1, 'E1', 'E2');
select pg_temp.p(hoje() - 2, 'E1', 'E3');
select pg_temp.p(hoje() - 3, 'E1', 'E4');
select is(pg_temp.v('E1', 'adversarios'), 3, 'adversarios: 3 rivais diferentes');
select is(pg_temp.n('E1', 'adversarios'), 1, 'adversarios: nivel 1 com 3');

-- parceiros (só duplas): D1 com D2 e com D5
select pg_temp.d(hoje() - 2, 'D1', 'D2', 'D3', 'D4');
select pg_temp.d(hoje() - 3, 'D1', 'D5', 'D6', 'D7');
select is(pg_temp.v('D1', 'parceiros'), 2, 'parceiros: 2 parceiros diferentes');
select is(pg_temp.n('D1', 'parceiros'), 1, 'parceiros: nivel 1 com 2');
select is(pg_temp.v('D3', 'parceiros'), 1, 'parceiros: o parceiro do adversario tambem conta');

-- pneu: 6-0 do lado 1, 6-0 do lado 2 e uma derrota 0-6 (não conta)
select pg_temp.p(hoje() - 3, 'N', 'N2', '[{"l1":6,"l2":0},{"l1":6,"l2":3}]');
select pg_temp.p(hoje() - 2, 'N2', 'N', '[{"l1":0,"l2":6},{"l1":3,"l2":6}]');
select pg_temp.p(hoje() - 1, 'N', 'N2', '[{"l1":0,"l2":6},{"l1":0,"l2":6}]');
select is(pg_temp.v('N', 'pneu'), 2, 'pneu: 6-0 a favor, de qualquer lado; 0-6 contra nao conta');

-- virada: perdeu o 1º set e venceu; as outras não contam
select pg_temp.p(hoje() - 3, 'M', 'M2', '[{"l1":3,"l2":6},{"l1":6,"l2":3},{"l1":7,"l2":5}]');
select pg_temp.p(hoje() - 2, 'M', 'M2', '[{"l1":3,"l2":6},{"l1":3,"l2":6}]');
select pg_temp.p(hoje() - 1, 'M', 'M2', '[{"l1":6,"l2":3},{"l1":6,"l2":3}]');
select is(pg_temp.v('M', 'virada'), 1, 'virada: so a vitoria depois de perder o 1o set');

-- zebra: Z1 pontua e depois perde para Z4, que ainda não tinha pontos
select pg_temp.p(pg_temp.seg(), 'Z1', 'Z2');
select pg_temp.p(pg_temp.seg() + 7, 'Z1', 'Z3');
select pg_temp.p(pg_temp.seg() + 14, 'Z4', 'Z1');
select is(pg_temp.v('Z4', 'zebra'), 1, 'zebra: vitoria com bonus');
select is(pg_temp.v('Z1', 'zebra'), 0, 'zebra: quem ganhou sem bonus nao conta');

-- anfitrião: sala criada por H que virou partida confirmada; sala sem partida não conta
select pg_temp.p(hoje() - 4, 'H', 'H2');
insert into salas (criador, modalidade, data_hora, status, partida_id)
select pg_temp.id('H'), 'simples', now(), 'confirmada', id
from partidas where lancado_por = pg_temp.id('H') and status = 'confirmada';
insert into salas (criador, modalidade, data_hora, status)
values (pg_temp.id('H'), 'simples', now() + interval '1 day', 'aberta');
select is(pg_temp.v('H', 'anfitriao'), 1, 'anfitriao: sala com partida confirmada');
select is(pg_temp.v('H2', 'anfitriao'), 0, 'anfitriao: nao e criador, nao conta');

-- sequência: 4 semanas seguidas
select pg_temp.p(pg_temp.seg() + 7 * k + 2, 'Q', 'Q2') from generate_series(0, 3) k;
select is(pg_temp.v('Q', 'sequencia'), 4, 'sequencia: 4 semanas seguidas');
select is(pg_temp.n('Q', 'sequencia'), 2, 'sequencia: nivel 2 com 4');
-- com buraco: semanas 0,1 e 3,4,5 -> maior série 3
select pg_temp.p(pg_temp.seg() + 7 * k + 2, 'G', 'G2') from unnest(array[0, 1, 3, 4, 5]) k;
select is(pg_temp.v('G', 'sequencia'), 3, 'sequencia: buraco no meio, vale a maior serie');

-- sequencia_atual e progresso (usam P, que tem 10 partidas)
select tests.logar_como(pg_temp.id('P'));
select throws_ok(format('select * from progresso_conquistas(%L)', pg_temp.id('R')), 'SEM_PERMISSAO', 'progresso de outro jogador');
select is((select proximo_limite from progresso_conquistas(pg_temp.id('P')) where conquista = 'partidas'), 25, 'progresso: proximo limite 25');
select is((select valor from progresso_conquistas(pg_temp.id('P')) where conquista = 'partidas'), 10, 'progresso: valor 10');
select isnt((select valida_ate from progresso_conquistas(pg_temp.id('P')) where conquista = 'partidas'), null, 'progresso: valida_ate preenchida');
select throws_ok(format('select * from sequencia_atual(%L)', pg_temp.id('R')), 'SEM_PERMISSAO', 'sequencia_atual de outro jogador');
select tests.deslogar();

-- sequencia_atual: semana passada e retrasada, nada nesta
select pg_temp.p((date_trunc('week', hoje()::timestamp)::date - 6), 'W', 'W3');
select pg_temp.p((date_trunc('week', hoje()::timestamp)::date - 13), 'W', 'W3');
select tests.logar_como(pg_temp.id('W'));
select is((select semanas from sequencia_atual(pg_temp.id('W'))), 2, 'sequencia_atual: 2 semanas');
select is((select jogou_esta_semana from sequencia_atual(pg_temp.id('W'))), false, 'sequencia_atual: nao jogou esta semana');
select tests.deslogar();
select pg_temp.p(hoje(), 'W2', 'W3');
select tests.logar_como(pg_temp.id('W2'));
select is((select semanas from sequencia_atual(pg_temp.id('W2'))), 1, 'sequencia_atual: jogou hoje, 1 semana');
select tests.deslogar();

-- admin e inativo: jogaram (e lideram o ranking) antes de perder o status; todas as linhas com nível 0
select pg_temp.limpar();
select pg_temp.p(hoje() - 3, 'AD', 'IN2');
select pg_temp.p(hoje() - 2, 'IN', 'IN2');
select pg_temp.p(hoje() - 1, 'IN', 'IN2');
select is(pg_temp.n('AD', 'partidas'), 1, 'antes de virar admin: tem medalha de partidas');
select is(pg_temp.n('IN', 'partidas'), 1, 'antes de ficar inativo: tem medalha de partidas');
update profiles set is_admin = true where id = pg_temp.id('AD');
update profiles set ativo = false where id = pg_temp.id('IN');
select is((select count(*)::int from calcular_conquistas(pg_temp.id('AD'), hoje())), 13, 'admin: uma linha por conquista');
select is((select count(*)::int from calcular_conquistas(pg_temp.id('AD'), hoje()) where nivel > 0 or valor > 0), 0, 'admin com partidas: todas nivel 0');
select is((select count(*)::int from calcular_conquistas(pg_temp.id('IN'), hoje()) where nivel > 0 or valor > 0), 0, 'inativo com partidas: todas nivel 0');
select is((select count(*)::int from calcular_conquistas(pg_temp.id('ADM'), hoje()) where nivel > 0), 0, 'admin sem partidas: todas nivel 0');

-- pódio e nº 1: T1 > T2 > T3 > T4 (uma partida por semana)
select pg_temp.limpar();
select pg_temp.p(pg_temp.seg() + 1, 'T1', 'T2');
select pg_temp.p(pg_temp.seg() + 8, 'T1', 'T3');
select pg_temp.p(pg_temp.seg() + 15, 'T1', 'T4');
select pg_temp.p(pg_temp.seg() + 22, 'T2', 'T3');
select pg_temp.p(pg_temp.seg() + 29, 'T2', 'T4');
select pg_temp.p(pg_temp.seg() + 36, 'T3', 'T4');
select is(pg_temp.n('T1', 'numero1', 'simples'), 1, 'numero1: o 1o do ranking');
select is(pg_temp.n('T1', 'podio', 'simples'), 1, 'podio: o 1o tambem');
select is(pg_temp.n('T3', 'podio', 'simples'), 1, 'podio: o 3o');
select is(pg_temp.n('T3', 'numero1', 'simples'), 0, 'numero1: o 3o nao tem');
select is(pg_temp.n('T4', 'podio', 'simples') + pg_temp.n('T4', 'numero1', 'simples'), 0, 'podio e numero1: o 4o nao tem');
select is(pg_temp.n('T1', 'numero1', 'duplas'), 0, 'numero1 duplas: sem partidas de duplas, 0');

-- empate no 1º: V1 e V2 com o mesmo placar na mesma data
select pg_temp.limpar();
select pg_temp.p(hoje() - 3, 'V1', 'V3');
select pg_temp.p(hoje() - 3, 'V2', 'V4');
select is(pg_temp.n('V1', 'numero1', 'simples') + pg_temp.n('V2', 'numero1', 'simples'), 2, 'numero1: empate no 1o, os dois tem');

-- validade: 10 partidas, a mais antiga há 170 dias
select pg_temp.limpar();
select pg_temp.p(hoje() - 170, 'P', 'R');
select pg_temp.p(hoje() - i, 'P', 'R') from generate_series(1, 9) i;
select is((select valida_ate from validade_conquista(pg_temp.id('P'), 'partidas')),
  (hoje() - 170 + make_interval(months => 6))::date - 1, 'validade: valida_ate quando a mais antiga sai');
select is((select expira_em from validade_conquista(pg_temp.id('P'), 'partidas')),
  (hoje() - 1 + make_interval(months => 6))::date - 1, 'validade: expira_em quando a ultima sai');

-- anfitrião: expira_em considera a partida da sala mesmo que o criador não tenha jogado
select pg_temp.limpar();
select pg_temp.p(hoje() - 10, 'X1', 'X2');
insert into salas (criador, modalidade, data_hora, status, partida_id)
select pg_temp.id('C1'), 'simples', now(), 'confirmada', id from partidas;
select is(pg_temp.n('C1', 'anfitriao'), 1, 'anfitriao: criador que nao jogou tem a medalha');
select is((select expira_em from validade_conquista(pg_temp.id('C1'), 'anfitriao')),
  (hoje() - 10 + make_interval(months => 6))::date - 1, 'anfitriao: expira_em pela partida da sala');

select * from finish();
rollback;
