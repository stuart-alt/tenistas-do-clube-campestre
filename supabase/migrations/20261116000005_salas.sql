-- Salas: marcação de jogos com vagas, notificações e vínculo com a partida registrada

create table public.salas (
  id uuid primary key default gen_random_uuid(),
  criador uuid not null references public.profiles (id),
  modalidade text not null check (modalidade in ('simples', 'duplas')),
  data_hora timestamptz not null,
  recado text,
  status text not null default 'aberta' check (status in ('aberta', 'confirmada', 'cancelada')),
  partida_id uuid null references public.partidas (id),
  created_at timestamptz not null default now()
);

create index salas_data_hora_idx on public.salas (data_hora);

-- Simples: posições 1-2. Duplas: 1-2 = Dupla 1, 3-4 = Dupla 2.
create table public.sala_vagas (
  sala_id uuid not null references public.salas (id) on delete cascade,
  posicao smallint not null check (posicao between 1 and 4),
  jogador_id uuid not null references public.profiles (id),
  primary key (sala_id, posicao),
  constraint sala_vagas_jogador_unico unique (sala_id, jogador_id)
);

alter table public.partidas
  add constraint partidas_sala_id_fkey foreign key (sala_id) references public.salas (id);

alter table public.salas enable row level security;
alter table public.sala_vagas enable row level security;

create policy salas_select on public.salas for select to authenticated using (true);
create policy sala_vagas_select on public.sala_vagas for select to authenticated using (true);

-- Escrita só via RPC (os defaults do Supabase concedem ALL)
revoke insert, update, delete, truncate on public.salas, public.sala_vagas from anon, authenticated;

-- Número de vagas pela modalidade (interno)
create function public.sala_total_vagas(p_modalidade text) returns int
language sql immutable
as $$ select case p_modalidade when 'simples' then 2 when 'duplas' then 4 end $$;

revoke execute on function public.sala_total_vagas(text) from public, anon, authenticated;

-- Notifica ocupantes da sala, exceto p_exceto (interno)
create function public.notificar_sala(p_sala uuid, p_exceto uuid, p_tipo text, p_texto text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_j uuid;
begin
  for v_j in
    select jogador_id from sala_vagas
    where sala_id = p_sala and jogador_id is distinct from p_exceto
  loop
    perform notificar(v_j, p_tipo, p_texto, '/salas');
  end loop;
end;
$$;

revoke execute on function public.notificar_sala(uuid, uuid, text, text) from public, anon, authenticated;

create function public.criar_sala(
  p_modalidade text, p_data_hora timestamptz, p_recado text, p_posicao smallint
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid() and ativo) then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'DATA_INVALIDA';
  end if;
  if p_posicao is null or p_posicao < 1 or p_posicao > coalesce(sala_total_vagas(p_modalidade), 0) then
    raise exception 'POSICAO_INVALIDA';
  end if;

  insert into salas (criador, modalidade, data_hora, recado)
  values (auth.uid(), p_modalidade, p_data_hora, nullif(trim(p_recado), ''))
  returning id into v_id;

  insert into sala_vagas (sala_id, posicao, jogador_id) values (v_id, p_posicao, auth.uid());
  return v_id;
end;
$$;

create function public.entrar_sala(p_sala uuid, p_posicao smallint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v salas%rowtype;
  v_nome text;
  v_constraint text;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid() and ativo) then
    raise exception 'SEM_PERMISSAO';
  end if;

  -- Trava a sala: entradas simultâneas se serializam
  select * into v from salas where id = p_sala for update;
  if not found then
    raise exception 'SALA_NAO_ENCONTRADA';
  end if;
  if v.status = 'cancelada' or v.partida_id is not null then
    raise exception 'SALA_FECHADA';
  end if;
  if p_posicao is null or p_posicao < 1 or p_posicao > sala_total_vagas(v.modalidade) then
    raise exception 'POSICAO_INVALIDA';
  end if;
  if exists (select 1 from sala_vagas where sala_id = p_sala and jogador_id = auth.uid()) then
    raise exception 'JA_NA_SALA';
  end if;

  begin
    insert into sala_vagas (sala_id, posicao, jogador_id) values (p_sala, p_posicao, auth.uid());
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'sala_vagas_jogador_unico' then
      raise exception 'JA_NA_SALA';
    end if;
    raise exception 'VAGA_OCUPADA';
  end;

  select nome into v_nome from profiles where id = auth.uid();
  perform notificar_sala(p_sala, auth.uid(), 'sala_entrou',
    coalesce(v_nome, 'Alguém') || ' entrou na sala.');

  if (select count(*) from sala_vagas where sala_id = p_sala) = sala_total_vagas(v.modalidade) then
    update salas set status = 'confirmada' where id = p_sala;
    perform notificar_sala(p_sala, null, 'sala_completa', 'A sala está completa. Bom jogo!');
  end if;
end;
$$;

create function public.sair_sala(p_sala uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v salas%rowtype;
  v_nome text;
begin
  select * into v from salas where id = p_sala for update;
  if not found then
    raise exception 'SALA_NAO_ENCONTRADA';
  end if;
  if v.status = 'cancelada' or v.partida_id is not null then
    raise exception 'SALA_FECHADA';
  end if;

  delete from sala_vagas where sala_id = p_sala and jogador_id = auth.uid();
  if not found then
    raise exception 'SEM_PERMISSAO';
  end if;

  select nome into v_nome from profiles where id = auth.uid();

  if auth.uid() = v.criador and not exists (select 1 from sala_vagas where sala_id = p_sala) then
    update salas set status = 'cancelada' where id = p_sala;
    return;
  end if;

  if v.status = 'confirmada' then
    update salas set status = 'aberta' where id = p_sala;
  end if;
  perform notificar_sala(p_sala, null, 'sala_saiu',
    coalesce(v_nome, 'Alguém') || ' saiu da sala.');
end;
$$;

create function public.cancelar_sala(p_sala uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v salas%rowtype;
  v_nome text;
begin
  select * into v from salas where id = p_sala for update;
  if not found then
    raise exception 'SALA_NAO_ENCONTRADA';
  end if;
  if auth.uid() is null or not (auth.uid() = v.criador or is_admin()) then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v.status = 'cancelada' or v.partida_id is not null then
    raise exception 'SALA_FECHADA';
  end if;

  update salas set status = 'cancelada' where id = p_sala;
  select nome into v_nome from profiles where id = auth.uid();
  perform notificar_sala(p_sala, auth.uid(), 'sala_cancelada',
    'A sala foi cancelada por ' || coalesce(v_nome, 'quem a criou') || '.');
end;
$$;

revoke execute on function public.criar_sala(text, timestamptz, text, smallint),
  public.entrar_sala(uuid, smallint), public.sair_sala(uuid), public.cancelar_sala(uuid)
  from public, anon;
grant execute on function public.criar_sala(text, timestamptz, text, smallint),
  public.entrar_sala(uuid, smallint), public.sair_sala(uuid), public.cancelar_sala(uuid)
  to authenticated;

create view public.salas_lista with (security_invoker = true) as
select s.id, s.criador, s.modalidade, s.data_hora, s.recado, s.status, s.partida_id, s.created_at,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'posicao', sv.posicao, 'jogador_id', sv.jogador_id,
                  'nome', p.nome, 'foto_url', p.foto_url) order by sv.posicao)
         from public.sala_vagas sv
         join public.profiles p on p.id = sv.jogador_id
         where sv.sala_id = s.id and p.ativo
       ), '[]'::jsonb) as vagas
from public.salas s
where s.status <> 'cancelada'
  and s.partida_id is null
  and s.data_hora > now() - interval '3 days'
order by s.data_hora;

grant select on public.salas_lista to authenticated;

-- registrar_partida: corpo idêntico ao da 0004, acrescentando apenas a gravação de salas.partida_id
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

  if p_sala_id is not null then
    update salas set partida_id = v_id where id = p_sala_id;
  end if;

  insert into partida_jogadores (partida_id, jogador_id, lado)
  select v_id, j, 1 from unnest(p_lado1) j
  union all
  select v_id, j, 2 from unnest(p_lado2) j;

  insert into partida_sets (partida_id, ordem, games_lado1, games_lado2, super_tiebreak)
  select v_id, o, (e ->> 'l1')::smallint, (e ->> 'l2')::smallint, coalesce((e ->> 'stb')::boolean, false)
  from jsonb_array_elements(p_sets) with ordinality t (e, o);

  select nome into v_nome from profiles where id = auth.uid();

  -- Admin de fora lançando: ninguém poderia confirmar/contestar, então nasce confirmada
  if not (auth.uid() = any (v_todos)) then
    update partidas set status = 'confirmada', confirmado_por = auth.uid(), confirmado_em = now()
    where id = v_id;
    perform recalcular_ranking(p_modalidade);
    perform notificar_jogadores_partida(v_id, null, 'partida_confirmada',
      'Uma partida foi registrada por ' || coalesce(v_nome, 'um administrador') || '. Seus pontos foram atualizados.',
      '/ranking');
    return v_id;
  end if;

  -- Adversários de quem lançou
  for v_j in
    select pj.jogador_id
    from partida_jogadores pj
    where pj.partida_id = v_id
      and pj.lado <> (select lado from partida_jogadores
                      where partida_id = v_id and jogador_id = auth.uid())
  loop
    perform notificar(v_j.jogador_id, 'partida_pendente',
      coalesce(v_nome, 'Alguém') || ' lançou uma partida contra você. Confirme ou conteste o placar.',
      '/partidas');
  end loop;

  return v_id;
end;
$$;
