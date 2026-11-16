-- Regras de pontuação, cache de pontos, recálculo, view de ranking e pontos expirando

create table public.regras (
  modalidade text primary key check (modalidade in ('simples', 'duplas')),
  pts_vitoria int not null,
  pts_set int not null,
  pts_game int not null,
  bonus_pct numeric(4, 2) not null,
  bonus_teto int not null,
  janela_meses int not null
);

insert into public.regras (modalidade, pts_vitoria, pts_set, pts_game, bonus_pct, bonus_teto, janela_meses) values
  ('simples', 50, 10, 1, 0.20, 50, 6),
  ('duplas', 50, 10, 1, 0.20, 50, 6);

create table public.pontos_partida (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  jogador_id uuid not null references public.profiles (id),
  modalidade text not null,
  data_jogo date not null,
  vitoria boolean not null,
  pontos int not null,
  bonus int not null,
  primary key (partida_id, jogador_id)
);

create index pontos_partida_jogador_idx on public.pontos_partida (jogador_id, modalidade, data_jogo);

alter table public.regras enable row level security;
alter table public.pontos_partida enable row level security;

create policy regras_select on public.regras for select to authenticated using (true);
create policy pontos_partida_select on public.pontos_partida for select to authenticated using (true);

grant select on public.regras, public.pontos_partida to authenticated;

-- Recria o cache de pontos da modalidade, processando partidas confirmadas em ordem cronológica.
create function public.recalcular_ranking(p_modalidade text) returns void
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

    -- Pontos no momento: só existem linhas de partidas já processadas (anteriores na ordem)
    select coalesce(avg(antes) filter (where lado <> v_venc), 0)
         - coalesce(avg(antes) filter (where lado = v_venc), 0)
      into v_dif
    from (
      select pj.lado,
             coalesce((select sum(pp.pontos + pp.bonus) from pontos_partida pp
                       where pp.jogador_id = pj.jogador_id
                         and pp.modalidade = p_modalidade
                         and pp.data_jogo > m.data_jogo - make_interval(months => r.janela_meses)), 0) as antes
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
end;
$$;

revoke execute on function public.recalcular_ranking(text) from public, anon, authenticated;

create view public.ranking with (security_invoker = true) as
select pp.modalidade,
       p.id as jogador_id,
       p.nome,
       p.categoria,
       p.foto_url,
       sum(pp.pontos + pp.bonus)::int as pontos,
       (count(*) filter (where pp.vitoria))::int as vitorias,
       count(*)::int as partidas,
       (rank() over (partition by pp.modalidade order by sum(pp.pontos + pp.bonus) desc))::int as posicao
from public.pontos_partida pp
join public.regras r on r.modalidade = pp.modalidade
join public.profiles p on p.id = pp.jogador_id
where p.ativo
  and pp.data_jogo > public.hoje() - make_interval(months => r.janela_meses)
group by pp.modalidade, p.id, p.nome, p.categoria, p.foto_url
order by pontos desc, vitorias desc, nome;

grant select on public.ranking to authenticated;

-- Pontos (com bônus) na janela que expiram nos próximos p_dias; zero linhas se nada expira.
create function public.pontos_expirando(p_jogador uuid, p_modalidade text, p_dias int default 30)
returns table (pontos int, expira_em date)
language sql stable
as $$
  select sum(pp.pontos + pp.bonus)::int,
         min((pp.data_jogo + make_interval(months => r.janela_meses))::date)
  from public.pontos_partida pp
  join public.regras r on r.modalidade = pp.modalidade
  where pp.jogador_id = p_jogador
    and pp.modalidade = p_modalidade
    and pp.data_jogo > public.hoje() - make_interval(months => r.janela_meses)
    and (pp.data_jogo + make_interval(months => r.janela_meses))::date <= public.hoje() + p_dias
  having count(*) > 0
$$;

grant execute on function public.pontos_expirando(uuid, text, int) to authenticated;
