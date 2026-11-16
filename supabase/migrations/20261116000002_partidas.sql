-- Partidas, jogadores, sets e registro com validação de placar

create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  modalidade text not null check (modalidade in ('simples', 'duplas')),
  data_jogo date not null,
  sala_id uuid null, -- FK para salas adicionada na Task 5
  lancado_por uuid not null references public.profiles (id),
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmada', 'contestada', 'cancelada')),
  motivo_contestacao text,
  confirmado_por uuid references public.profiles (id),
  confirmado_em timestamptz,
  created_at timestamptz not null default now()
);

create table public.partida_jogadores (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  jogador_id uuid not null references public.profiles (id),
  lado smallint not null check (lado in (1, 2)),
  primary key (partida_id, jogador_id)
);

create table public.partida_sets (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 3),
  games_lado1 smallint not null check (games_lado1 >= 0),
  games_lado2 smallint not null check (games_lado2 >= 0),
  super_tiebreak boolean not null default false,
  primary key (partida_id, ordem)
);

create index partidas_modalidade_status_idx on public.partidas (modalidade, status, data_jogo);
create index partida_jogadores_jogador_idx on public.partida_jogadores (jogador_id);

alter table public.partidas enable row level security;
alter table public.partida_jogadores enable row level security;
alter table public.partida_sets enable row level security;

create policy partidas_select on public.partidas for select to authenticated using (true);
create policy partida_jogadores_select on public.partida_jogadores for select to authenticated using (true);
create policy partida_sets_select on public.partida_sets for select to authenticated using (true);

grant select on public.partidas, public.partida_jogadores, public.partida_sets to authenticated;

create function public.registrar_partida(
  p_modalidade text,
  p_data_jogo date,
  p_lado1 uuid[],
  p_lado2 uuid[],
  p_sets jsonb,
  p_sala_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tam int := case p_modalidade when 'simples' then 1 when 'duplas' then 2 end;
  v_todos uuid[] := coalesce(p_lado1, '{}') || coalesce(p_lado2, '{}');
  v_n int;
  v_set jsonb;
  v_i int := 0;
  v_l1 int;
  v_l2 int;
  v_stb boolean;
  v_sets_l1 int := 0;
  v_sets_l2 int := 0;
  v_id uuid;
begin
  -- Jogadores: tamanho por lado, sem repetição, todos ativos
  if v_tam is null
     or coalesce(cardinality(p_lado1), 0) <> v_tam
     or coalesce(cardinality(p_lado2), 0) <> v_tam
     or (select count(distinct j) from unnest(v_todos) j) <> 2 * v_tam
     or (select count(*) from profiles where id = any (v_todos) and ativo) <> 2 * v_tam then
    raise exception 'JOGADORES_INVALIDOS';
  end if;

  if not (auth.uid() = any (v_todos) or is_admin()) then
    raise exception 'NAO_PARTICIPANTE';
  end if;

  if p_data_jogo is null or p_data_jogo > hoje()
     or (p_data_jogo < hoje() - 7 and not is_admin()) then
    raise exception 'DATA_INVALIDA';
  end if;

  -- Placar
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'SETS_INVALIDOS';
  end if;
  v_n := jsonb_array_length(p_sets);
  if v_n < 1 or v_n > 3 then
    raise exception 'SETS_INVALIDOS';
  end if;

  for v_set in select e from jsonb_array_elements(p_sets) e loop
    v_i := v_i + 1;
    if jsonb_typeof(v_set) <> 'object'
       or jsonb_typeof(v_set -> 'l1') is distinct from 'number'
       or jsonb_typeof(v_set -> 'l2') is distinct from 'number'
       or coalesce(jsonb_typeof(v_set -> 'stb'), 'boolean') not in ('boolean', 'null') then
      raise exception 'SETS_INVALIDOS';
    end if;
    if (v_set ->> 'l1')::numeric not between 0 and 99
       or (v_set ->> 'l2')::numeric not between 0 and 99
       or (v_set ->> 'l1')::numeric <> trunc((v_set ->> 'l1')::numeric)
       or (v_set ->> 'l2')::numeric <> trunc((v_set ->> 'l2')::numeric) then
      raise exception 'SETS_INVALIDOS';
    end if;
    v_l1 := (v_set ->> 'l1')::int;
    v_l2 := (v_set ->> 'l2')::int;
    v_stb := coalesce((v_set ->> 'stb')::boolean, false);
    if v_l1 = v_l2 then
      raise exception 'SET_EMPATADO';
    end if;
    if v_stb and v_i < v_n then
      raise exception 'SUPER_TIEBREAK_NAO_FINAL';
    end if;
    if v_l1 > v_l2 then v_sets_l1 := v_sets_l1 + 1; else v_sets_l2 := v_sets_l2 + 1; end if;
  end loop;

  if v_sets_l1 = v_sets_l2 then
    raise exception 'PLACAR_EMPATADO';
  end if;

  insert into partidas (modalidade, data_jogo, sala_id, lancado_por)
  values (p_modalidade, p_data_jogo, p_sala_id, auth.uid())
  returning id into v_id;

  insert into partida_jogadores (partida_id, jogador_id, lado)
  select v_id, j, 1 from unnest(p_lado1) j
  union all
  select v_id, j, 2 from unnest(p_lado2) j;

  insert into partida_sets (partida_id, ordem, games_lado1, games_lado2, super_tiebreak)
  select v_id, o, (e ->> 'l1')::smallint, (e ->> 'l2')::smallint, coalesce((e ->> 'stb')::boolean, false)
  from jsonb_array_elements(p_sets) with ordinality t (e, o);

  return v_id;
end;
$$;

revoke execute on function public.registrar_partida(text, date, uuid[], uuid[], jsonb, uuid) from public, anon;
grant execute on function public.registrar_partida(text, date, uuid[], uuid[], jsonb, uuid) to authenticated;
