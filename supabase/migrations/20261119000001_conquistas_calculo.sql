-- Conquistas (medalhas): catálogo, retrato e cálculo puro a partir das partidas confirmadas da janela

create table public.conquistas_catalogo (
  chave text primary key,
  nome text not null,
  emoji text not null,
  descricao text not null,
  unidade text not null,
  limites int[] not null,
  por_modalidade boolean not null default false,
  ordem int not null
);

insert into public.conquistas_catalogo (chave, nome, emoji, descricao, unidade, limites, por_modalidade, ordem) values
  ('sequencia', 'Sequência', '🔥', 'Maior série de semanas seguidas com pelo menos uma partida.', 'semanas', '{2,4,8,12}', false, 1),
  ('partidas', 'Partidas', '🎾', 'Número de partidas confirmadas.', 'partidas', '{1,10,25,50}', false, 2),
  ('vitorias', 'Vitórias', '🥇', 'Número de vitórias.', 'vitórias', '{1,5,15}', false, 3),
  ('adversarios', 'Enturmado', '🤝', 'Número de adversários diferentes.', 'adversários', '{3,6,12}', false, 4),
  ('parceiros', 'Bom parceiro', '👥', 'Número de parceiros diferentes em duplas.', 'parceiros', '{2,4,8}', false, 5),
  ('anfitriao', 'Anfitrião', '🏠', 'Salas criadas pelo jogador que viraram partida confirmada.', 'salas', '{1,5,10}', false, 6),
  ('zebra', 'Zebra', '🦓', 'Vitórias contra alguém mais bem colocado, com bônus no ranking.', 'vitórias', '{1,3,5}', false, 7),
  ('virada', 'Virada', '🔄', 'Vitórias de virada (perdeu o 1º set e venceu).', 'viradas', '{1,3}', false, 8),
  ('pneu', 'Pneu', '🍩', 'Sets vencidos por 6–0.', 'sets', '{1,3}', false, 9),
  ('podio', 'Pódio', '🏆', 'Estar hoje entre os 3 primeiros do ranking.', 'posição', '{1}', true, 10),
  ('numero1', 'Nº 1', '👑', 'Estar hoje em 1º lugar no ranking.', 'posição', '{1}', true, 11);

create table public.conquistas_jogador (
  jogador_id uuid not null references public.profiles (id) on delete cascade,
  conquista text not null references public.conquistas_catalogo (chave),
  modalidade text null check (modalidade in ('simples', 'duplas')),
  nivel int not null check (nivel >= 1),
  valor int not null,
  desde timestamptz not null default now(),
  valida_ate date null,
  expira_em date null,
  avisado_vencimento boolean not null default false
);

create unique index conquistas_jogador_uq
  on public.conquistas_jogador (jogador_id, conquista, coalesce(modalidade, ''));

create table public.conquistas_avisos (
  jogador_id uuid not null references public.profiles (id) on delete cascade,
  conquista text not null,
  modalidade text not null,
  ultimo_aviso_ganho timestamptz not null,
  primary key (jogador_id, conquista, modalidade)
);

alter table public.conquistas_catalogo enable row level security;
alter table public.conquistas_jogador enable row level security;
alter table public.conquistas_avisos enable row level security;

create policy conquistas_catalogo_select on public.conquistas_catalogo for select to authenticated using (true);
create policy conquistas_jogador_select on public.conquistas_jogador for select to authenticated using (true);

revoke all on public.conquistas_catalogo, public.conquistas_jogador from anon, authenticated;
grant select on public.conquistas_catalogo, public.conquistas_jogador to authenticated;
revoke all on public.conquistas_avisos from anon, authenticated;

-- Valor e nível de cada conquista do jogador, olhando as partidas confirmadas que estão na janela em p_ref.
-- podio/numero1 vêm da view ranking (hoje) e só fazem sentido com p_ref = p_hoje.
create function public.calcular_conquistas(p_jogador uuid, p_ref date, p_hoje date default public.hoje())
returns table (conquista text, modalidade text, valor int, nivel int)
language sql stable security definer set search_path = public
as $$
  with ok as (
    select 1 from public.profiles where id = p_jogador and ativo and not is_admin
  ),
  jan as (
    select janela_meses as meses from public.regras where modalidade = 'simples'
  ),
  m as (
    select pa.id, pa.modalidade, pa.data_jogo, pj.lado,
           coalesce(pp.vitoria, false) as vitoria,
           coalesce(pp.bonus, 0) as bonus
    from public.partidas pa
    join public.partida_jogadores pj on pj.partida_id = pa.id and pj.jogador_id = p_jogador
    left join public.pontos_partida pp on pp.partida_id = pa.id and pp.jogador_id = p_jogador
    where pa.status = 'confirmada'
      and pa.data_jogo <= p_hoje
      and pa.data_jogo + make_interval(months => (select meses from jan)) > p_ref
      and exists (select 1 from ok)
  ),
  semanas as (
    select distinct date_trunc('week', data_jogo::timestamp)::date as semana from m
  ),
  series as (
    select count(*) as tam
    from (select semana - (row_number() over (order by semana))::int * 7 as grupo from semanas) s
    group by grupo
  ),
  v as (
    select 'sequencia'::text as chave, null::text as modal, coalesce((select max(tam) from series), 0)::int as valor
    union all select 'partidas', null, (select count(*) from m)::int
    union all select 'vitorias', null, (select count(*) from m where vitoria)::int
    union all select 'adversarios', null, (
      select count(distinct o.jogador_id) from m
      join public.partida_jogadores o on o.partida_id = m.id and o.lado <> m.lado)::int
    union all select 'parceiros', null, (
      select count(distinct o.jogador_id) from m
      join public.partida_jogadores o on o.partida_id = m.id and o.lado = m.lado and o.jogador_id <> p_jogador
      where m.modalidade = 'duplas')::int
    union all select 'anfitriao', null, (
      select count(distinct s.partida_id) from public.salas s
      join public.partidas pa on pa.id = s.partida_id
      where s.criador = p_jogador
        and pa.status = 'confirmada'
        and pa.data_jogo <= p_hoje
        and pa.data_jogo + make_interval(months => (select meses from jan)) > p_ref
        and exists (select 1 from ok))::int
    union all select 'zebra', null, (select count(*) from m where vitoria and bonus > 0)::int
    union all select 'virada', null, (
      select count(*) from m
      join public.partida_sets s on s.partida_id = m.id and s.ordem = 1
      where m.vitoria
        and case when m.lado = 1 then s.games_lado1 < s.games_lado2 else s.games_lado2 < s.games_lado1 end)::int
    union all select 'pneu', null, (
      select count(*) from m
      join public.partida_sets s on s.partida_id = m.id
      where not s.super_tiebreak
        and case when m.lado = 1 then s.games_lado1 = 6 and s.games_lado2 = 0
                 else s.games_lado2 = 6 and s.games_lado1 = 0 end)::int
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

-- Datas em que o nível de cada medalha (não por modalidade) cai ou some, sem partidas novas
create function public.validades_conquistas(p_jogador uuid, p_hoje date default public.hoje())
returns table (conquista text, valida_ate date, expira_em date)
language sql stable security definer set search_path = public
as $$
  with jan as (
    select janela_meses as meses from public.regras where modalidade = 'simples'
  ),
  dias as (
    select distinct (pa.data_jogo + make_interval(months => jan.meses))::date as dia
    from public.partidas pa
    cross join jan
    where (exists (select 1 from public.partida_jogadores pj
                   where pj.partida_id = pa.id and pj.jogador_id = p_jogador)
           or exists (select 1 from public.salas s
                      where s.partida_id = pa.id and s.criador = p_jogador))
      and pa.status = 'confirmada'
      and pa.data_jogo <= p_hoje
      and (pa.data_jogo + make_interval(months => jan.meses))::date > p_hoje
  ),
  base as (
    select b.conquista, b.nivel
    from public.calcular_conquistas(p_jogador, p_hoje, p_hoje) b
    join public.conquistas_catalogo cc on cc.chave = b.conquista
    where not cc.por_modalidade and b.nivel > 0
  ),
  fut as (
    select d.dia, c.conquista, c.nivel
    from dias d
    cross join lateral public.calcular_conquistas(p_jogador, d.dia, p_hoje) c
  )
  select b.conquista,
         (select min(f.dia) from fut f where f.conquista = b.conquista and f.nivel < b.nivel) - 1,
         (select min(f.dia) from fut f where f.conquista = b.conquista and f.nivel = 0) - 1
  from base b
$$;

create function public.validade_conquista(p_jogador uuid, p_conquista text, p_hoje date default public.hoje())
returns table (valida_ate date, expira_em date)
language sql stable security definer set search_path = public
as $$
  select v.valida_ate, v.expira_em
  from (select 1) x
  left join public.validades_conquistas(p_jogador, p_hoje) v on v.conquista = p_conquista
$$;

create function public.sequencia_atual(p_jogador uuid)
returns table (semanas int, jogou_esta_semana boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_semanas date[];
  v_atual date := date_trunc('week', public.hoje()::timestamp)::date;
  v_esta boolean;
  v_w date;
  v_n int := 0;
begin
  if p_jogador is distinct from auth.uid() then
    raise exception 'SEM_PERMISSAO';
  end if;

  select array_agg(distinct date_trunc('week', pa.data_jogo::timestamp)::date)
    into v_semanas
  from public.partidas pa
  join public.partida_jogadores pj on pj.partida_id = pa.id and pj.jogador_id = p_jogador
  join public.regras r on r.modalidade = 'simples'
  where pa.status = 'confirmada'
    and pa.data_jogo <= public.hoje()
    and pa.data_jogo + make_interval(months => r.janela_meses) > public.hoje();

  v_esta := coalesce(v_atual = any (v_semanas), false);
  v_w := case when v_esta then v_atual else v_atual - 7 end;
  while coalesce(v_w = any (v_semanas), false) loop
    v_n := v_n + 1;
    v_w := v_w - 7;
  end loop;

  return query select v_n, v_esta;
end;
$$;

create function public.progresso_conquistas(p_jogador uuid)
returns table (conquista text, modalidade text, nivel int, valor int, proximo_limite int, valida_ate date)
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_jogador is distinct from auth.uid() then
    raise exception 'SEM_PERMISSAO';
  end if;

  return query
  select c.conquista, c.modalidade, c.nivel, c.valor, cc.limites[c.nivel + 1], v.valida_ate
  from public.calcular_conquistas(p_jogador, public.hoje(), public.hoje()) c
  join public.conquistas_catalogo cc on cc.chave = c.conquista
  left join public.validades_conquistas(p_jogador, public.hoje()) v on v.conquista = c.conquista
  order by cc.ordem, c.modalidade;
end;
$$;

revoke execute on function public.calcular_conquistas(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.validades_conquistas(uuid, date) from public, anon, authenticated;
revoke execute on function public.validade_conquista(uuid, text, date) from public, anon, authenticated;
revoke execute on function public.sequencia_atual(uuid) from public, anon;
revoke execute on function public.progresso_conquistas(uuid) from public, anon;
grant execute on function public.sequencia_atual(uuid) to authenticated;
grant execute on function public.progresso_conquistas(uuid) to authenticated;
