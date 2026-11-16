-- Somente local (db reset). Nunca roda em produção.
create schema if not exists tests;
grant usage on schema tests to authenticated;

create function tests.criar_usuario(p_email text, p_nome text default 'Jogador', p_admin boolean default false)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    jsonb_build_object(
      'nome', p_nome, 'data_nascimento', '1990-01-01', 'telefone', '11987654321',
      'genero', 'masculino', 'categoria', 'C'),
    now(), now());
  if p_admin then
    update public.profiles set is_admin = true where id = v_id;
  end if;
  return v_id;
end;
$$;

create function tests.logar_como(p_id uuid) returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function tests.deslogar() returns void
language plpgsql
as $$
begin
  reset role;
end;
$$;

-- Insere partida já confirmada (sem validação de data) e recalcula o ranking da modalidade
create function tests.partida_confirmada(p_modalidade text, p_data date, p_lado1 uuid[], p_lado2 uuid[], p_sets jsonb)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid;
begin
  insert into public.partidas (modalidade, data_jogo, lancado_por, status, confirmado_por, confirmado_em, created_at)
  values (p_modalidade, p_data, p_lado1[1], 'confirmada', p_lado2[1], clock_timestamp(), clock_timestamp())
  returning id into v_id;

  insert into public.partida_jogadores (partida_id, jogador_id, lado)
  select v_id, j, 1 from unnest(p_lado1) j
  union all
  select v_id, j, 2 from unnest(p_lado2) j;

  insert into public.partida_sets (partida_id, ordem, games_lado1, games_lado2, super_tiebreak)
  select v_id, o, (e ->> 'l1')::smallint, (e ->> 'l2')::smallint, coalesce((e ->> 'stb')::boolean, false)
  from jsonb_array_elements(p_sets) with ordinality t (e, o);

  perform public.recalcular_ranking(p_modalidade);
  return v_id;
end;
$$;

grant execute on all functions in schema tests to authenticated;
