-- Conquistas: avaliação do retrato, avisos (ganhou / vai vencer), cron diário e estreia

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'sala_entrou', 'sala_saiu', 'sala_completa', 'sala_cancelada',
  'partida_pendente', 'partida_confirmada', 'partida_contestada', 'partida_cancelada',
  'aviso_novo', 'contestacao_admin', 'mensagem_admin', 'mensagem_respondida',
  'conquista_ganha', 'conquista_vencendo', 'conquistas_estreia'));

-- Desempenho: o cálculo das medalhas (fora pódio/nº 1) passa a ser feito para várias datas de
-- referência numa só consulta. calcular_conquistas e validades_conquistas mantêm o resultado
-- da 20261119000001, mas usam esse núcleo em vez de chamar calcular_conquistas uma vez por data
-- (e avaliar a view ranking a cada chamada).
create function public.calcular_conquistas_refs(p_jogador uuid, p_refs date[], p_hoje date default public.hoje())
returns table (ref date, conquista text, valor int, nivel int)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with ok as (
    select 1 from public.profiles where id = p_jogador and ativo and not is_admin
  ),
  jan as (
    select janela_meses as meses from public.regras where modalidade = 'simples'
  ),
  refs as (
    select distinct r as ref from unnest(p_refs) r
  ),
  minhas as materialized (
    select pj.partida_id, pj.lado from public.partida_jogadores pj
    where pj.jogador_id = p_jogador and exists (select 1 from ok)
  ),
  -- partidas confirmadas do jogador até hoje, com o que cada uma vale e a data em que sai da janela
  base as materialized (
    select pa.data_jogo,
           pa.data_jogo + make_interval(months => (select meses from jan)) as fim,
           coalesce(pp.vitoria, false) as vitoria,
           coalesce(pp.bonus, 0) as bonus,
           array(select o.jogador_id from public.partida_jogadores o
                 where o.partida_id = pa.id and o.lado <> mi.lado) as adversarios,
           array(select o.jogador_id from public.partida_jogadores o
                 where o.partida_id = pa.id and o.lado = mi.lado and o.jogador_id <> p_jogador
                   and pa.modalidade = 'duplas') as parceiros,
           coalesce(pp.vitoria, false) and exists (
             select 1 from public.partida_sets s
             where s.partida_id = pa.id and s.ordem = 1
               and case when mi.lado = 1 then s.games_lado1 < s.games_lado2
                        else s.games_lado2 < s.games_lado1 end) as virada,
           (select count(*) from public.partida_sets s
            where s.partida_id = pa.id and not s.super_tiebreak
              and case when mi.lado = 1 then s.games_lado1 = 6 and s.games_lado2 = 0
                       else s.games_lado2 = 6 and s.games_lado1 = 0 end)::int as pneus
    from minhas mi
    -- offset 0: busca cada partida pela chave, sem depender das estatísticas do planejador
    cross join lateral (select * from public.partidas pa where pa.id = mi.partida_id offset 0) pa
    left join public.pontos_partida pp on pp.partida_id = pa.id and pp.jogador_id = p_jogador
    where pa.status = 'confirmada'
      and pa.data_jogo <= p_hoje
  ),
  -- salas criadas pelo jogador que viraram partida confirmada
  salas_ok as materialized (
    select distinct s.partida_id,
           pa.data_jogo + make_interval(months => (select meses from jan)) as fim
    from public.salas s
    join public.partidas pa on pa.id = s.partida_id
    where s.criador = p_jogador
      and pa.status = 'confirmada'
      and pa.data_jogo <= p_hoje
      and exists (select 1 from ok)
  ),
  m as materialized (
    select r.ref, b.* from refs r join base b on b.fim > r.ref
  ),
  semanas as (
    select distinct ref, date_trunc('week', data_jogo::timestamp)::date as semana from m
  ),
  series as (
    select ref, count(*) as tam
    from (select ref, semana - (row_number() over (partition by ref order by semana))::int * 7 as grupo
          from semanas) s
    group by ref, grupo
  ),
  seq as (select ref, max(tam)::int as valor from series group by ref),
  cont as (
    select ref, count(*)::int as partidas,
           (count(*) filter (where vitoria))::int as vitorias,
           (count(*) filter (where vitoria and bonus > 0))::int as zebra,
           (count(*) filter (where virada))::int as viradas,
           sum(pneus)::int as pneus
    from m group by ref
  ),
  adv as (
    select m.ref, count(distinct a)::int as valor from m, unnest(m.adversarios) a group by m.ref
  ),
  par as (
    select m.ref, count(distinct a)::int as valor from m, unnest(m.parceiros) a group by m.ref
  ),
  anf as (
    select r.ref, count(*)::int as valor from refs r join salas_ok s on s.fim > r.ref group by r.ref
  ),
  v as (
    select r.ref, x.chave, coalesce(x.valor, 0) as valor
    from refs r
    left join seq on seq.ref = r.ref
    left join cont on cont.ref = r.ref
    left join adv on adv.ref = r.ref
    left join par on par.ref = r.ref
    left join anf on anf.ref = r.ref
    cross join lateral (values
      ('sequencia', seq.valor), ('partidas', cont.partidas), ('vitorias', cont.vitorias),
      ('adversarios', adv.valor), ('parceiros', par.valor), ('anfitriao', anf.valor),
      ('zebra', cont.zebra), ('virada', cont.viradas), ('pneu', cont.pneus)) x (chave, valor)
  )
  select v.ref, cc.chave, v.valor,
         (select count(*) from unnest(cc.limites) l where l <= v.valor)::int
  from v
  join public.conquistas_catalogo cc on cc.chave = v.chave
  order by v.ref, cc.ordem;
end;
$$;

-- calcular_conquistas: mesmo resultado da 20261119000001, usando o núcleo acima
create or replace function public.calcular_conquistas(p_jogador uuid, p_ref date, p_hoje date default public.hoje())
returns table (conquista text, modalidade text, valor int, nivel int)
language sql stable security definer set search_path = public
as $$
  with ok as (
    select 1 from public.profiles where id = p_jogador and ativo and not is_admin
  ),
  v as (
    select c.conquista as chave, null::text as modal, c.valor
    from public.calcular_conquistas_refs(p_jogador, array[p_ref], p_hoje) c
    union all select 'podio', mo, (case when exists (
        select 1 from public.ranking r
        where r.modalidade = mo and r.jogador_id = p_jogador and r.posicao <= 3
          and exists (select 1 from ok)) then 1 else 0 end)
      from unnest(array['simples', 'duplas']) mo
    union all select 'numero1', mo, (case when exists (
        select 1 from public.ranking r
        where r.modalidade = mo and r.jogador_id = p_jogador and r.posicao = 1
          and exists (select 1 from ok)) then 1 else 0 end)
      from unnest(array['simples', 'duplas']) mo
  )
  select cc.chave, v.modal, v.valor,
         (select count(*) from unnest(cc.limites) l where l <= v.valor)::int
  from public.conquistas_catalogo cc
  join v on v.chave = cc.chave
  order by cc.ordem, v.modal
$$;

-- Estado atual de cada medalha (fora pódio/nº 1): valor e nível hoje e, com nível, as datas em que
-- cairia de nível (valida_ate) e sumiria (expira_em) sem partidas novas. Uma consulta só para todas as datas.
create function public.estado_conquistas(p_jogador uuid, p_hoje date default public.hoje())
returns table (conquista text, valor int, nivel int, valida_ate date, expira_em date)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with jan as (
    select janela_meses as meses from public.regras where modalidade = 'simples'
  ),
  dias as (
    select distinct (pa.data_jogo + make_interval(months => jan.meses))::date as dia
    from (select pj.partida_id from public.partida_jogadores pj where pj.jogador_id = p_jogador
          union
          select s.partida_id from public.salas s where s.criador = p_jogador) x
    cross join lateral (select * from public.partidas pa where pa.id = x.partida_id offset 0) pa
    cross join jan
    where pa.status = 'confirmada'
      and pa.data_jogo <= p_hoje
      and (pa.data_jogo + make_interval(months => jan.meses))::date > p_hoje
  ),
  calc as materialized (
    select * from public.calcular_conquistas_refs(
      p_jogador, array(select p_hoje union select dia from dias), p_hoje)
  ),
  fut as (
    select c.ref as dia, c.conquista, c.nivel from calc c where c.ref > p_hoje
  )
  select b.conquista, b.valor, b.nivel,
         case when b.nivel > 0 then
           (select min(f.dia) from fut f where f.conquista = b.conquista and f.nivel < b.nivel) - 1 end,
         case when b.nivel > 0 then
           (select min(f.dia) from fut f where f.conquista = b.conquista and f.nivel = 0) - 1 end
  from calc b
  where b.ref = p_hoje;
end;
$$;

-- validades_conquistas: mesmo resultado da 20261119000001, a partir de estado_conquistas
create or replace function public.validades_conquistas(p_jogador uuid, p_hoje date default public.hoje())
returns table (conquista text, valida_ate date, expira_em date)
language sql stable security definer set search_path = public
as $$
  select e.conquista, e.valida_ate, e.expira_em
  from public.estado_conquistas(p_jogador, p_hoje) e
  where e.nivel > 0
$$;

-- Singular quando a quantidade é 1 (todas as unidades do catálogo fazem plural com "s")
create function public.conquistas_unidade(p_qtd int, p_unidade text) returns text
language sql immutable set search_path = public
as $$
  select p_qtd || ' ' || case when p_qtd = 1 then regexp_replace(p_unidade, 's$', '') else p_unidade end
$$;

-- Recalcula as medalhas do jogador e atualiza o retrato, avisando quando ganha/sobe de nível
-- e 10 dias antes de a medalha sumir. p_top3 / p_numero1: modalidades em que o jogador está hoje
-- no top 3 / em 1º na view ranking (avaliar_conquistas_todos lê a view uma vez só para todos).
create function public.avaliar_conquistas_posicoes(
  p_jogador uuid, p_notificar boolean, p_hoje date, p_top3 text[], p_numero1 text[]
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  v_link text := '/jogadores/' || p_jogador;
  v_ganhou boolean;
  v_avisar boolean;
begin
  if not exists (select 1 from profiles where id = p_jogador and ativo and not is_admin) then
    delete from conquistas_jogador where jogador_id = p_jogador;
    return;
  end if;

  for c in
    -- mesmo resultado de calcular_conquistas(p_jogador, p_hoje, p_hoje) e validades_conquistas,
    -- com as posições no ranking recebidas
    with calc as materialized (
      select e.conquista, null::text as modalidade, e.valor, e.nivel, e.valida_ate, e.expira_em
      from estado_conquistas(p_jogador, p_hoje) e
      union all
      select 'podio', mo, (mo = any (p_top3))::int, (mo = any (p_top3))::int, null::date, null::date
      from unnest(array['simples', 'duplas']) mo
      union all
      select 'numero1', mo, (mo = any (p_numero1))::int, (mo = any (p_numero1))::int, null::date, null::date
      from unnest(array['simples', 'duplas']) mo
    )
    select n.conquista, n.modalidade, n.valor, n.nivel,
           cc.nome, cc.emoji, cc.unidade, cc.por_modalidade,
           n.valida_ate, n.expira_em,
           r.nivel as nivel_antigo, r.expira_em as expira_antigo
    from calc n
    join conquistas_catalogo cc on cc.chave = n.conquista
    left join conquistas_jogador r
      on r.jogador_id = p_jogador and r.conquista = n.conquista
     and coalesce(r.modalidade, '') = coalesce(n.modalidade, '')
    order by cc.ordem, n.modalidade
  loop
    if c.nivel = 0 then
      if c.nivel_antigo is not null then
        delete from conquistas_jogador
        where jogador_id = p_jogador and conquista = c.conquista
          and coalesce(modalidade, '') = coalesce(c.modalidade, '');
      end if;
      continue;
    end if;

    v_ganhou := c.nivel_antigo is null or c.nivel > c.nivel_antigo;

    if v_ganhou then
      insert into conquistas_jogador
        (jogador_id, conquista, modalidade, nivel, valor, desde, valida_ate, expira_em, avisado_vencimento)
      values (p_jogador, c.conquista, c.modalidade, c.nivel, c.valor, now(), c.valida_ate, c.expira_em, false)
      on conflict (jogador_id, conquista, coalesce(modalidade, '')) do update
        set nivel = excluded.nivel, valor = excluded.valor, desde = excluded.desde,
            valida_ate = excluded.valida_ate, expira_em = excluded.expira_em,
            avisado_vencimento = false;

      if p_notificar then
        if c.por_modalidade then
          update conquistas_avisos set ultimo_aviso_ganho = now()
          where jogador_id = p_jogador and conquista = c.conquista and modalidade = c.modalidade
            and ultimo_aviso_ganho < now() - interval '30 days';
          v_avisar := found;
          if not v_avisar then
            insert into conquistas_avisos (jogador_id, conquista, modalidade, ultimo_aviso_ganho)
            values (p_jogador, c.conquista, c.modalidade, now())
            on conflict do nothing;
            v_avisar := found;
          end if;
          if v_avisar then
            perform notificar(p_jogador, 'conquista_ganha',
              format('Você ganhou %s %s %s!', c.emoji, c.nome, initcap(c.modalidade)), v_link);
          end if;
        else
          perform notificar(p_jogador, 'conquista_ganha',
            format('Você ganhou %s %s — %s (%s)!', c.emoji, c.nome,
                   (array['bronze', 'prata', 'ouro', 'diamante'])[c.nivel],
                   conquistas_unidade(c.valor, c.unidade)),
            v_link);
        end if;
      end if;
    else
      -- mesmo nível ou nível menor: atualiza sem avisar; se a medalha foi renovada, o aviso volta a valer
      update conquistas_jogador
      set nivel = c.nivel, valor = c.valor, valida_ate = c.valida_ate, expira_em = c.expira_em,
          avisado_vencimento = case when c.expira_em > c.expira_antigo then false else avisado_vencimento end
      where jogador_id = p_jogador and conquista = c.conquista
        and coalesce(modalidade, '') = coalesce(c.modalidade, '');
    end if;

    if p_notificar and c.expira_em is not null and c.expira_em - p_hoje <= 10 then
      update conquistas_jogador set avisado_vencimento = true
      where jogador_id = p_jogador and conquista = c.conquista and modalidade is null
        and not avisado_vencimento;
      if found then
        perform notificar(p_jogador, 'conquista_vencendo',
          format('Sua medalha %s %s vence em %s. Lance uma partida para renovar!', c.emoji, c.nome,
                 case when c.expira_em - p_hoje + 1 = 1 then '1 dia' else (c.expira_em - p_hoje + 1) || ' dias' end),
          v_link);
      end if;
    end if;
  end loop;
end;
$$;

create function public.avaliar_conquistas(p_jogador uuid, p_notificar boolean default true, p_hoje date default public.hoje())
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_top3 text[];
  v_numero1 text[];
begin
  select coalesce(array_agg(modalidade) filter (where posicao <= 3), '{}'),
         coalesce(array_agg(modalidade) filter (where posicao = 1), '{}')
    into v_top3, v_numero1
  from ranking where jogador_id = p_jogador;

  perform avaliar_conquistas_posicoes(p_jogador, p_notificar, p_hoje, v_top3, v_numero1);
end;
$$;

-- Avalia quem joga (perfil não-admin com partida confirmada ou sala que virou partida)
-- e quem tem retrato (mesmo que agora seja admin ou inativo, para apagar)
create function public.avaliar_conquistas_todos(p_notificar boolean default true) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v record;
begin
  perform pg_advisory_xact_lock(hashtext('avaliar_conquistas_todos'));

  for v in
    with rk as materialized (
      select jogador_id, modalidade, posicao from ranking
    )
    select p.id,
           array(select rk.modalidade from rk where rk.jogador_id = p.id and rk.posicao <= 3) as top3,
           array(select rk.modalidade from rk where rk.jogador_id = p.id and rk.posicao = 1) as numero1
    from profiles p
    where (not p.is_admin
           and (exists (select 1 from partida_jogadores pj join partidas pa on pa.id = pj.partida_id
                        where pj.jogador_id = p.id and pa.status = 'confirmada')
                or exists (select 1 from salas s join partidas pa on pa.id = s.partida_id
                           where s.criador = p.id and pa.status = 'confirmada')))
       or exists (select 1 from conquistas_jogador cj where cj.jogador_id = p.id)
    order by p.id
  loop
    perform avaliar_conquistas_posicoes(v.id, p_notificar, public.hoje(), v.top3, v.numero1);
  end loop;
end;
$$;

-- Estreia: avalia todos sem aviso por medalha; o que já está perto de sumir entra como avisado;
-- cada jogador com medalha recebe um único aviso
create function public.estrear_conquistas() returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform avaliar_conquistas_todos(false);

  update conquistas_jogador set avisado_vencimento = true where expira_em <= hoje() + 10;

  perform notificar(t.jogador_id, 'conquistas_estreia',
    format('Chegaram as conquistas! Você já tem %s. Veja no seu perfil.',
           case when t.n = 1 then '1 medalha' else t.n || ' medalhas' end),
    '/jogadores/' || t.jogador_id)
  from (select jogador_id, count(*) as n from conquistas_jogador group by jogador_id) t;
end;
$$;

-- recalcular_ranking: igual à 20261118000001, avaliando as conquistas no fim
create or replace function public.recalcular_ranking(p_modalidade text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  r regras%rowtype;
  m record;
  s record;
  v_sets int[];
  v_games int[];
  v_lado int;
  v_venc int;
  v_dif numeric;
  v_bonus int;
begin
  select * into r from regras where modalidade = p_modalidade;
  if not found then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('recalcular_ranking:' || p_modalidade));

  delete from pontos_partida where modalidade = p_modalidade;

  for m in
    select * from partidas
    where modalidade = p_modalidade and status = 'confirmada'
    order by data_jogo, created_at, id
  loop
    v_sets := array[0, 0];
    v_games := array[0, 0];
    for s in select * from partida_sets where partida_id = m.id order by ordem loop
      v_lado := case when s.games_lado1 > s.games_lado2 then 1 else 2 end;
      v_sets[v_lado] := v_sets[v_lado] + 1;
      if s.super_tiebreak then
        v_games[v_lado] := v_games[v_lado] + 1;
      else
        v_games[1] := v_games[1] + s.games_lado1;
        v_games[2] := v_games[2] + s.games_lado2;
      end if;
    end loop;
    v_venc := case when v_sets[1] > v_sets[2] then 1 else 2 end;

    -- Pontos no momento: só existem linhas de partidas já processadas (anteriores na ordem);
    -- dentro da janela, por semana, só as N melhores somam
    select coalesce(avg(antes) filter (where lado <> v_venc), 0)
         - coalesce(avg(antes) filter (where lado = v_venc), 0)
      into v_dif
    from (
      select pj.lado,
             coalesce((select sum(x.total) from (
                         select pp.pontos + pp.bonus as total,
                                row_number() over (
                                  partition by date_trunc('week', pp.data_jogo::timestamp)
                                  order by pp.pontos + pp.bonus desc, pp.data_jogo, pa.created_at, pp.partida_id
                                ) as rn
                         from pontos_partida pp
                         join partidas pa on pa.id = pp.partida_id
                         where pp.jogador_id = pj.jogador_id
                           and pp.modalidade = p_modalidade
                           and pp.data_jogo + make_interval(months => r.janela_meses) > m.data_jogo
                       ) x
                       where r.max_partidas_semana = 0 or x.rn <= r.max_partidas_semana), 0) as antes
      from partida_jogadores pj
      where pj.partida_id = m.id
    ) t;

    v_bonus := case when v_dif > 0 then least(floor(v_dif * r.bonus_pct), r.bonus_teto) else 0 end;

    insert into pontos_partida (partida_id, jogador_id, modalidade, data_jogo, vitoria, pontos, bonus)
    select m.id, pj.jogador_id, p_modalidade, m.data_jogo,
           pj.lado = v_venc,
           (case when pj.lado = v_venc then r.pts_vitoria else 0 end)
             + v_sets[pj.lado] * r.pts_set + v_games[pj.lado] * r.pts_game,
           case when pj.lado = v_venc then v_bonus else 0 end
    from partida_jogadores pj
    where pj.partida_id = m.id;
  end loop;

  -- Marca quais linhas contam: as N melhores do jogador em cada semana (todas quando N = 0)
  update pontos_partida pp
  set conta = (r.max_partidas_semana = 0 or c.rn <= r.max_partidas_semana)
  from (
    select pp2.partida_id, pp2.jogador_id,
           row_number() over (
             partition by pp2.jogador_id, date_trunc('week', pp2.data_jogo::timestamp)
             order by pp2.pontos + pp2.bonus desc, pp2.data_jogo, pa.created_at, pp2.partida_id
           ) as rn
    from pontos_partida pp2
    join partidas pa on pa.id = pp2.partida_id
    where pp2.modalidade = p_modalidade
  ) c
  where pp.partida_id = c.partida_id
    and pp.jogador_id = c.jogador_id
    and pp.modalidade = p_modalidade;

  perform avaliar_conquistas_todos();
end;
$$;

revoke execute on function public.recalcular_ranking(text) from public, anon, authenticated;
revoke execute on function public.conquistas_unidade(int, text) from public, anon, authenticated;
revoke execute on function public.calcular_conquistas_refs(uuid, date[], date) from public, anon, authenticated;
revoke execute on function public.estado_conquistas(uuid, date) from public, anon, authenticated;
revoke execute on function public.avaliar_conquistas_posicoes(uuid, boolean, date, text[], text[]) from public, anon, authenticated;
revoke execute on function public.avaliar_conquistas(uuid, boolean, date) from public, anon, authenticated;
revoke execute on function public.avaliar_conquistas_todos(boolean) from public, anon, authenticated;
revoke execute on function public.estrear_conquistas() from public, anon, authenticated;

-- Chamadas por jogador, muitas vezes seguidas: reaproveita o plano em vez de replanejar a cada chamada
alter function public.calcular_conquistas_refs(uuid, date[], date) set plan_cache_mode = force_generic_plan;
alter function public.estado_conquistas(uuid, date) set plan_cache_mode = force_generic_plan;
alter function public.avaliar_conquistas_posicoes(uuid, boolean, date, text[], text[]) set plan_cache_mode = force_generic_plan;

-- Cron diário: 09:00 de São Paulo (12:00 UTC) — faz as medalhas vencerem e manda o aviso de "vai vencer"
select cron.schedule('conquistas-diarias', '0 12 * * *', 'select public.avaliar_conquistas_todos()');

-- Estreia
select public.estrear_conquistas();
