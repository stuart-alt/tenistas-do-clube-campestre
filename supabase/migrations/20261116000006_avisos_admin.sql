-- Avisos do clube, edição de regras de pontuação e (des)ativação de jogadores pelo admin

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo_md text not null,
  fixado boolean not null default false,
  autor uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.avisos enable row level security;

create policy avisos_select on public.avisos for select to authenticated using (true);
create policy avisos_insert on public.avisos for insert to authenticated with check (public.is_admin());
create policy avisos_update on public.avisos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy avisos_delete on public.avisos for delete to authenticated using (public.is_admin());

-- Os defaults do Supabase concedem ALL: o RLS limita a escrita a admins; aqui sobra só o necessário
revoke all on public.avisos from anon, authenticated;
grant select, insert, update, delete on public.avisos to authenticated;

create function public.avisos_touch() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger avisos_touch before update on public.avisos
  for each row execute function public.avisos_touch();

-- Notifica todos os perfis ativos sobre um aviso novo
create function public.avisos_notificar() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_j uuid;
begin
  for v_j in select id from profiles where ativo loop
    perform notificar(v_j, 'aviso_novo', 'Novo aviso: ' || new.titulo, '/avisos');
  end loop;
  return new;
end;
$$;

revoke execute on function public.avisos_notificar() from public, anon, authenticated;

create trigger avisos_notificar after insert on public.avisos
  for each row execute function public.avisos_notificar();

create function public.atualizar_regras(
  p_modalidade text, p_pts_vitoria int, p_pts_set int, p_pts_game int,
  p_bonus_pct numeric, p_bonus_teto int, p_janela_meses int
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_modalidade not in ('simples', 'duplas')
     or p_pts_vitoria is null or p_pts_vitoria < 0
     or p_pts_set is null or p_pts_set < 0
     or p_pts_game is null or p_pts_game < 0
     or p_bonus_pct is null or p_bonus_pct < 0 or p_bonus_pct >= 100
     or p_bonus_teto is null or p_bonus_teto < 0
     or p_janela_meses is null or p_janela_meses < 1 then
    raise exception 'REGRA_INVALIDA';
  end if;

  update regras
  set pts_vitoria = p_pts_vitoria, pts_set = p_pts_set, pts_game = p_pts_game,
      bonus_pct = p_bonus_pct, bonus_teto = p_bonus_teto, janela_meses = p_janela_meses
  where modalidade = p_modalidade;

  perform recalcular_ranking(p_modalidade);
end;
$$;

create function public.definir_ativo(p_jogador uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  update profiles set ativo = p_ativo where id = p_jogador;
  if not found then
    raise exception 'JOGADOR_NAO_ENCONTRADO';
  end if;
end;
$$;

revoke execute on function public.atualizar_regras(text, int, int, int, numeric, int, int),
  public.definir_ativo(uuid, boolean) from public, anon;
grant execute on function public.atualizar_regras(text, int, int, int, numeric, int, int),
  public.definir_ativo(uuid, boolean) to authenticated;

-- sair_sala: igual à 0005, mas cancela a sala vazia mesmo que quem saiu por último não seja o criador
create or replace function public.sair_sala(p_sala uuid) returns void
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

  if not exists (select 1 from sala_vagas where sala_id = p_sala) then
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
