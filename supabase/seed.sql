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

grant execute on all functions in schema tests to authenticated;
