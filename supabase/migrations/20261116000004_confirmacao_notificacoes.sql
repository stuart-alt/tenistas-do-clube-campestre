-- Notificações, confirmação/contestação de partidas, auto-confirmação e correções de admin

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in (
    'sala_entrou', 'sala_saiu', 'sala_completa', 'sala_cancelada',
    'partida_pendente', 'partida_confirmada', 'partida_contestada',
    'aviso_novo', 'contestacao_admin')),
  texto text not null,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notificacoes_usuario_idx on public.notificacoes (usuario_id, lida, created_at desc);

alter table public.notificacoes enable row level security;

create policy notificacoes_select on public.notificacoes for select to authenticated
  using (usuario_id = auth.uid());
create policy notificacoes_update on public.notificacoes for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

revoke all on public.notificacoes from anon, authenticated;
grant select on public.notificacoes to authenticated;
grant update (lida) on public.notificacoes to authenticated;

create function public.notificar(p_usuario uuid, p_tipo text, p_texto text, p_link text)
returns void
language sql security definer set search_path = public
as $$
  insert into notificacoes (usuario_id, tipo, texto, link) values (p_usuario, p_tipo, p_texto, p_link);
$$;

revoke execute on function public.notificar(uuid, text, text, text) from public, anon, authenticated;

-- Validação de placar (interna), compartilhada por registrar_partida e admin_corrigir_partida
create function public.validar_sets(p_sets jsonb) returns void
language plpgsql set search_path = public
as $$
declare
  v_n int;
  v_set jsonb;
  v_i int := 0;
  v_l1 int;
  v_l2 int;
  v_stb boolean;
  v_sets_l1 int := 0;
  v_sets_l2 int := 0;
begin
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
end;
$$;

revoke execute on function public.validar_sets(jsonb) from public, anon, authenticated;

-- registrar_partida: assinatura inalterada; exige usuário logado e notifica adversários
create or replace function public.registrar_partida(
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
  v_id uuid;
  v_nome text;
  v_j record;
begin
  -- Jogadores: tamanho por lado, sem repetição, todos ativos
  if v_tam is null
     or coalesce(cardinality(p_lado1), 0) <> v_tam
     or coalesce(cardinality(p_lado2), 0) <> v_tam
     or (select count(distinct j) from unnest(v_todos) j) <> 2 * v_tam
     or (select count(*) from profiles where id = any (v_todos) and ativo) <> 2 * v_tam then
    raise exception 'JOGADORES_INVALIDOS';
  end if;

  if auth.uid() is null or not (auth.uid() = any (v_todos) or is_admin()) then
    raise exception 'NAO_PARTICIPANTE';
  end if;

  if p_data_jogo is null or p_data_jogo > hoje()
     or (p_data_jogo < hoje() - 7 and not is_admin()) then
    raise exception 'DATA_INVALIDA';
  end if;

  perform validar_sets(p_sets);

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

  -- Adversários de quem lançou (se o lançador é admin de fora, todos os jogadores)
  select nome into v_nome from profiles where id = auth.uid();
  for v_j in
    select pj.jogador_id
    from partida_jogadores pj
    where pj.partida_id = v_id
      and pj.jogador_id <> auth.uid()
      and pj.lado is distinct from (select lado from partida_jogadores
                                    where partida_id = v_id and jogador_id = auth.uid())
  loop
    perform notificar(v_j.jogador_id, 'partida_pendente',
      coalesce(v_nome, 'Alguém') || ' lançou uma partida contra você. Confirme ou conteste o placar.',
      '/partidas');
  end loop;

  return v_id;
end;
$$;

-- Janela de pontos: uma partida conta na data D sse data_jogo + janela > D
create or replace view public.ranking with (security_invoker = true) as
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
  and pp.data_jogo + make_interval(months => r.janela_meses) > public.hoje()
group by pp.modalidade, p.id, p.nome, p.categoria, p.foto_url
order by pontos desc, vitorias desc, nome;

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
    and pp.data_jogo + make_interval(months => r.janela_meses) > public.hoje()
    and (pp.data_jogo + make_interval(months => r.janela_meses))::date <= public.hoje() + p_dias
  having count(*) > 0
$$;

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

    -- Pontos no momento: só existem linhas de partidas já processadas (anteriores na ordem)
    select coalesce(avg(antes) filter (where lado <> v_venc), 0)
         - coalesce(avg(antes) filter (where lado = v_venc), 0)
      into v_dif
    from (
      select pj.lado,
             coalesce((select sum(pp.pontos + pp.bonus) from pontos_partida pp
                       where pp.jogador_id = pj.jogador_id
                         and pp.modalidade = p_modalidade
                         and pp.data_jogo + make_interval(months => r.janela_meses) > m.data_jogo), 0) as antes
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

-- Notifica todos os jogadores da partida, exceto p_exceto
create function public.notificar_jogadores_partida(p_partida uuid, p_exceto uuid, p_tipo text, p_texto text, p_link text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_j uuid;
begin
  for v_j in
    select jogador_id from partida_jogadores
    where partida_id = p_partida and jogador_id is distinct from p_exceto
  loop
    perform notificar(v_j, p_tipo, p_texto, p_link);
  end loop;
end;
$$;

revoke execute on function public.notificar_jogadores_partida(uuid, uuid, text, text, text) from public, anon, authenticated;

create function public.confirmar_partida(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v partidas%rowtype;
  v_oponente boolean;
  v_nome text;
begin
  select * into v from partidas where id = p_id for update;
  if not found then
    raise exception 'PARTIDA_NAO_ENCONTRADA';
  end if;

  v_oponente := exists (
    select 1 from partida_jogadores pj
    where pj.partida_id = p_id and pj.jogador_id = auth.uid()
      and pj.lado <> (select lado from partida_jogadores where partida_id = p_id and jogador_id = v.lancado_por));

  if is_admin() then
    if v.status not in ('pendente', 'contestada') then
      raise exception 'STATUS_INVALIDO';
    end if;
  elsif v_oponente then
    if v.status <> 'pendente' then
      raise exception 'STATUS_INVALIDO';
    end if;
  else
    raise exception 'SEM_PERMISSAO';
  end if;

  update partidas set status = 'confirmada', confirmado_por = auth.uid(), confirmado_em = now()
  where id = p_id;
  perform recalcular_ranking(v.modalidade);

  select nome into v_nome from profiles where id = auth.uid();
  perform notificar_jogadores_partida(p_id, auth.uid(), 'partida_confirmada',
    'Partida confirmada por ' || coalesce(v_nome, 'um administrador') || '. Seus pontos foram atualizados.',
    '/ranking');
end;
$$;

create function public.contestar_partida(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v partidas%rowtype;
  v_nome text;
  v_adm uuid;
begin
  select * into v from partidas where id = p_id for update;
  if not found then
    raise exception 'PARTIDA_NAO_ENCONTRADA';
  end if;

  if not exists (
    select 1 from partida_jogadores pj
    where pj.partida_id = p_id and pj.jogador_id = auth.uid()
      and pj.lado <> (select lado from partida_jogadores where partida_id = p_id and jogador_id = v.lancado_por)) then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v.status <> 'pendente' then
    raise exception 'STATUS_INVALIDO';
  end if;

  update partidas set status = 'contestada', motivo_contestacao = p_motivo where id = p_id;

  select nome into v_nome from profiles where id = auth.uid();
  perform notificar(v.lancado_por, 'partida_contestada',
    coalesce(v_nome, 'Seu adversário') || ' contestou a partida que você lançou.', '/partidas');
  for v_adm in select id from profiles where is_admin and ativo loop
    perform notificar(v_adm, 'contestacao_admin',
      'Partida contestada por ' || coalesce(v_nome, 'um jogador') || ' aguarda decisão.', '/admin');
  end loop;
end;
$$;

create function public.admin_corrigir_partida(p_id uuid, p_data_jogo date, p_sets jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v partidas%rowtype;
begin
  if not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v from partidas where id = p_id for update;
  if not found then
    raise exception 'PARTIDA_NAO_ENCONTRADA';
  end if;
  if v.status = 'cancelada' then
    raise exception 'STATUS_INVALIDO';
  end if;
  if p_data_jogo is null or p_data_jogo > hoje() then
    raise exception 'DATA_INVALIDA';
  end if;
  perform validar_sets(p_sets);

  delete from partida_sets where partida_id = p_id;
  insert into partida_sets (partida_id, ordem, games_lado1, games_lado2, super_tiebreak)
  select p_id, o, (e ->> 'l1')::smallint, (e ->> 'l2')::smallint, coalesce((e ->> 'stb')::boolean, false)
  from jsonb_array_elements(p_sets) with ordinality t (e, o);

  update partidas set data_jogo = p_data_jogo, status = 'confirmada',
    confirmado_por = auth.uid(), confirmado_em = now()
  where id = p_id;
  perform recalcular_ranking(v.modalidade);

  perform notificar_jogadores_partida(p_id, auth.uid(), 'partida_confirmada',
    'Um administrador corrigiu e confirmou a partida.', '/ranking');
end;
$$;

create function public.admin_cancelar_partida(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v partidas%rowtype;
begin
  if not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v from partidas where id = p_id for update;
  if not found then
    raise exception 'PARTIDA_NAO_ENCONTRADA';
  end if;
  if v.status = 'cancelada' then
    raise exception 'STATUS_INVALIDO';
  end if;
  update partidas set status = 'cancelada' where id = p_id;
  perform recalcular_ranking(v.modalidade);
end;
$$;

create function public.auto_confirmar_partidas() returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[];
  v_mod text;
  v_id uuid;
begin
  select coalesce(array_agg(id), '{}') into v_ids from partidas
  where status = 'pendente' and created_at < now() - interval '48 hours';

  update partidas set status = 'confirmada', confirmado_em = now()
  where id = any (v_ids);

  for v_mod in select distinct modalidade from partidas where id = any (v_ids) loop
    perform recalcular_ranking(v_mod);
  end loop;

  foreach v_id in array v_ids loop
    perform notificar_jogadores_partida(v_id, null, 'partida_confirmada',
      'Partida confirmada automaticamente após 48 horas.', '/ranking');
  end loop;

  return cardinality(v_ids);
end;
$$;

revoke execute on function public.auto_confirmar_partidas() from public, anon, authenticated;

revoke execute on function public.confirmar_partida(uuid), public.contestar_partida(uuid, text),
  public.admin_corrigir_partida(uuid, date, jsonb), public.admin_cancelar_partida(uuid) from public, anon;
grant execute on function public.confirmar_partida(uuid), public.contestar_partida(uuid, text),
  public.admin_corrigir_partida(uuid, date, jsonb), public.admin_cancelar_partida(uuid) to authenticated;

create extension if not exists pg_cron;
select cron.schedule('auto-confirmar', '0 * * * *', 'select public.auto_confirmar_partidas()');
