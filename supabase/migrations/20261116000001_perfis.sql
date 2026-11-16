-- Perfis, helpers, fotos

create function public.hoje() returns date
language sql stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  nome text not null,
  data_nascimento date not null,
  telefone text not null,
  genero text check (genero in ('masculino', 'feminino')),
  categoria text check (categoria in ('A', 'B', 'C', 'D')),
  foto_url text,
  forehand smallint not null default 3 check (forehand between 1 and 5),
  backhand smallint not null default 3 check (backhand between 1 and 5),
  saque smallint not null default 3 check (saque between 1 and 5),
  voleio smallint not null default 3 check (voleio between 1 and 5),
  velocidade smallint not null default 3 check (velocidade between 1 and 5),
  resistencia smallint not null default 3 check (resistencia between 1 and 5),
  disponibilidade text[] not null default '{}',
  ativo boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- Cria o perfil a partir do cadastro no Auth
create function public.criar_perfil_do_cadastro() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, data_nascimento, telefone, genero, categoria)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nome',
    (new.raw_user_meta_data ->> 'data_nascimento')::date,
    new.raw_user_meta_data ->> 'telefone',
    nullif(new.raw_user_meta_data ->> 'genero', ''),
    nullif(new.raw_user_meta_data ->> 'categoria', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.criar_perfil_do_cadastro();

-- Campos protegidos: só admin (ou papéis internos, ex. postgres) altera is_admin, ativo, email
create function public.proteger_campos_perfil() returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.ativo := old.ativo;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_proteger_campos
before update on public.profiles
for each row execute function public.proteger_campos_perfil();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (ativo or id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

grant select, update on public.profiles to authenticated;
grant execute on function public.hoje() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Fotos
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict do nothing;

create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_update on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
