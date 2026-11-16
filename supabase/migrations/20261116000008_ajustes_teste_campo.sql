-- Ajustes do teste de campo: celular brasileiro válido e administradores fora do jogo

-- 1. Telefone: normaliza os existentes (só dígitos, sem o 55 inicial) e passa a exigir celular BR
update public.profiles
set telefone = case
  when length(regexp_replace(telefone, '\D', '', 'g')) = 13
       and regexp_replace(telefone, '\D', '', 'g') like '55%'
    then substr(regexp_replace(telefone, '\D', '', 'g'), 3)
  else regexp_replace(telefone, '\D', '', 'g')
end;

-- NOT VALID: linhas antigas inválidas não bloqueiam a migração; inserts/updates novos são checados
alter table public.profiles
  add constraint profiles_telefone_celular_br check (telefone ~ '^[1-9]{2}9[0-9]{8}$') not valid;

-- 2. Administradores não aparecem no ranking
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
  and not p.is_admin
  and pp.data_jogo + make_interval(months => r.janela_meses) > public.hoje()
group by pp.modalidade, p.id, p.nome, p.categoria, p.foto_url
order by pontos desc, vitorias desc, nome;

-- 3. registrar_partida: igual à 0007, recusando administradores como jogadores
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
  v_sala salas%rowtype;
begin
  -- Jogadores: tamanho por lado, sem repetição, todos ativos
  if v_tam is null
     or coalesce(cardinality(p_lado1), 0) <> v_tam
     or coalesce(cardinality(p_lado2), 0) <> v_tam
     or (select count(distinct j) from unnest(v_todos) j) <> 2 * v_tam
     or (select count(*) from profiles where id = any (v_todos) and ativo) <> 2 * v_tam then
    raise exception 'JOGADORES_INVALIDOS';
  end if;

  -- Administradores não jogam
  if exists (select 1 from profiles where id = any (v_todos) and is_admin) then
    raise exception 'ADMIN_NAO_JOGA';
  end if;

  if auth.uid() is null or not (auth.uid() = any (v_todos) or is_admin()) then
    raise exception 'NAO_PARTICIPANTE';
  end if;

  if p_data_jogo is null or p_data_jogo > hoje()
     or (p_data_jogo < hoje() - 7 and not is_admin()) then
    raise exception 'DATA_INVALIDA';
  end if;

  perform validar_sets(p_sets);

  -- Sala: precisa existir, estar confirmada sem partida e ter exatamente os jogadores da partida
  if p_sala_id is not null then
    select * into v_sala from salas where id = p_sala_id for update;
    if not found then
      raise exception 'SALA_NAO_ENCONTRADA';
    end if;
    if v_sala.status <> 'confirmada' or v_sala.partida_id is not null then
      raise exception 'SALA_FECHADA';
    end if;
    if array(select j from unnest(v_todos) j order by j)
       is distinct from array(select jogador_id from sala_vagas where sala_id = p_sala_id order by jogador_id) then
      raise exception 'JOGADORES_INVALIDOS';
    end if;
  end if;

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

-- criar_sala: igual à 0005, recusando administradores
create or replace function public.criar_sala(
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
  if is_admin() then
    raise exception 'ADMIN_NAO_JOGA';
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

-- entrar_sala: igual à 0005, recusando administradores
create or replace function public.entrar_sala(p_sala uuid, p_posicao smallint) returns void
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
  if is_admin() then
    raise exception 'ADMIN_NAO_JOGA';
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
