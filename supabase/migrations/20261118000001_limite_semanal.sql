-- Limite semanal: por jogador, modalidade e semana (segunda a domingo de data_jogo),
-- só as N melhores partidas (pontos + bônus) contam no ranking. N = regras.max_partidas_semana; 0 = sem limite.
-- Desempate: data_jogo mais cedo, depois partidas.created_at, depois partida_id.

alter table public.regras
  add column max_partidas_semana int not null default 2 check (max_partidas_semana >= 0);

update public.regras set max_partidas_semana = 2;

alter table public.pontos_partida
  add column conta boolean not null default true;

-- recalcular_ranking: igual à 0004, com pts_antes contando só as N melhores de cada semana
-- e marcando pontos_partida.conta ao final
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
end;
$$;

revoke execute on function public.recalcular_ranking(text) from public, anon, authenticated;

-- ranking: igual à 0008; pontos (e posição) somam só as partidas que contam;
-- vitorias e partidas seguem contando todas as partidas da janela
create or replace view public.ranking with (security_invoker = true) as
select pp.modalidade,
       p.id as jogador_id,
       p.nome,
       p.categoria,
       p.foto_url,
       coalesce(sum(pp.pontos + pp.bonus) filter (where pp.conta), 0)::int as pontos,
       (count(*) filter (where pp.vitoria))::int as vitorias,
       count(*)::int as partidas,
       (rank() over (partition by pp.modalidade
                     order by coalesce(sum(pp.pontos + pp.bonus) filter (where pp.conta), 0) desc))::int as posicao
from public.pontos_partida pp
join public.regras r on r.modalidade = pp.modalidade
join public.profiles p on p.id = pp.jogador_id
where p.ativo
  and not p.is_admin
  and pp.data_jogo + make_interval(months => r.janela_meses) > public.hoje()
group by pp.modalidade, p.id, p.nome, p.categoria, p.foto_url
order by pontos desc, vitorias desc, nome;

-- pontos_expirando: igual à 0004, somando só as partidas que contam
create or replace function public.pontos_expirando(p_jogador uuid, p_modalidade text, p_dias int default 30)
returns table (pontos int, expira_em date)
language sql stable
as $$
  select sum(pp.pontos + pp.bonus)::int,
         min((pp.data_jogo + make_interval(months => r.janela_meses))::date)
  from public.pontos_partida pp
  join public.regras r on r.modalidade = pp.modalidade
  where pp.jogador_id = p_jogador
    and pp.modalidade = p_modalidade
    and pp.conta
    and pp.data_jogo + make_interval(months => r.janela_meses) > public.hoje()
    and (pp.data_jogo + make_interval(months => r.janela_meses))::date <= public.hoje() + p_dias
  having count(*) > 0
$$;

-- atualizar_regras: igual à 0006, com p_max_partidas_semana
drop function public.atualizar_regras(text, int, int, int, numeric, int, int);

create function public.atualizar_regras(
  p_modalidade text, p_pts_vitoria int, p_pts_set int, p_pts_game int,
  p_bonus_pct numeric, p_bonus_teto int, p_janela_meses int, p_max_partidas_semana int
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_modalidade not in ('simples', 'duplas')
     or p_pts_vitoria is null or p_pts_vitoria < 0
     or p_pts_set is null or p_pts_set < 0
     or p_pts_game is null or p_pts_game < 0
     or p_bonus_pct is null or p_bonus_pct < 0 or p_bonus_pct >= 100
     or p_bonus_teto is null or p_bonus_teto < 0
     or p_janela_meses is null or p_janela_meses < 1
     or p_max_partidas_semana is null or p_max_partidas_semana < 0 then
    raise exception 'REGRA_INVALIDA';
  end if;

  update regras
  set pts_vitoria = p_pts_vitoria, pts_set = p_pts_set, pts_game = p_pts_game,
      bonus_pct = p_bonus_pct, bonus_teto = p_bonus_teto, janela_meses = p_janela_meses,
      max_partidas_semana = p_max_partidas_semana
  where modalidade = p_modalidade;

  perform recalcular_ranking(p_modalidade);
end;
$$;

revoke execute on function public.atualizar_regras(text, int, int, int, numeric, int, int, int) from public, anon;
grant execute on function public.atualizar_regras(text, int, int, int, numeric, int, int, int) to authenticated;

-- Recalcula o cache para aplicar o limite às partidas existentes
select public.recalcular_ranking('simples');
select public.recalcular_ranking('duplas');
