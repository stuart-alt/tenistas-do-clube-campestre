-- Ajustes finais: validação da sala em registrar_partida, desativação libera vagas,
-- cancelamento de partida pelo admin notifica os jogadores

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'sala_entrou', 'sala_saiu', 'sala_completa', 'sala_cancelada',
  'partida_pendente', 'partida_confirmada', 'partida_contestada', 'partida_cancelada',
  'aviso_novo', 'contestacao_admin'));

-- registrar_partida: igual à 0005, acrescentando a validação de p_sala_id
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

-- definir_ativo: igual à 0006; ao desativar, tira o jogador das salas abertas/confirmadas sem partida
create or replace function public.definir_ativo(p_jogador uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v salas%rowtype;
  v_nome text;
begin
  if auth.uid() is null or not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  update profiles set ativo = p_ativo where id = p_jogador;
  if not found then
    raise exception 'JOGADOR_NAO_ENCONTRADO';
  end if;

  if p_ativo then
    return;
  end if;

  select nome into v_nome from profiles where id = p_jogador;
  for v in
    select s.* from salas s
    where s.status in ('aberta', 'confirmada') and s.partida_id is null
      and exists (select 1 from sala_vagas sv where sv.sala_id = s.id and sv.jogador_id = p_jogador)
    order by s.id
    for update
  loop
    delete from sala_vagas where sala_id = v.id and jogador_id = p_jogador;
    if not exists (select 1 from sala_vagas where sala_id = v.id) then
      update salas set status = 'cancelada' where id = v.id;
      continue;
    end if;
    if v.status = 'confirmada' then
      update salas set status = 'aberta' where id = v.id;
    end if;
    perform notificar_sala(v.id, null, 'sala_saiu', coalesce(v_nome, 'Alguém') || ' saiu da sala.');
  end loop;
end;
$$;

-- admin_cancelar_partida: igual à 0004, notificando os jogadores da partida
create or replace function public.admin_cancelar_partida(p_id uuid) returns void
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

  perform notificar_jogadores_partida(p_id, auth.uid(), 'partida_cancelada',
    'Uma partida sua foi cancelada pelo administrador.', '/partidas');
end;
$$;
