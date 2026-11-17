-- Salas incompletas encerradas no horário, "Fale com o administrador"

-- Novos tipos de notificação (mantém todos os existentes)
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'sala_entrou', 'sala_saiu', 'sala_completa', 'sala_cancelada',
  'partida_pendente', 'partida_confirmada', 'partida_contestada', 'partida_cancelada',
  'aviso_novo', 'contestacao_admin', 'mensagem_admin', 'mensagem_respondida'));

-- A. Sala aberta (incompleta) cujo horário chegou é encerrada; salas confirmadas não mudam
create function public.encerrar_salas_incompletas() returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_qtd int;
begin
  with encerradas as (
    update salas set status = 'cancelada'
    where status = 'aberta' and data_hora <= now()
    returning id, data_hora
  ), avisos as (
    select notificar(
             sv.jogador_id, 'sala_cancelada',
             'Sua sala de ' || to_char(e.data_hora at time zone 'America/Sao_Paulo', 'DD/MM')
               || ' às ' || to_char(e.data_hora at time zone 'America/Sao_Paulo', 'HH24:MI')
               || ' não completou e foi encerrada.',
             '/salas') as n
    from encerradas e
    join sala_vagas sv on sv.sala_id = e.id
  )
  select (select count(*) from encerradas), (select count(*) from avisos) into v_qtd;
  return v_qtd;
end;
$$;

revoke execute on function public.encerrar_salas_incompletas() from public, anon, authenticated;

select cron.schedule('encerrar-salas', '*/5 * * * *', 'select public.encerrar_salas_incompletas()');

-- Efeito imediato: a lista esconde sala aberta já vencida
create or replace view public.salas_lista with (security_invoker = true) as
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
  and not (s.status = 'aberta' and s.data_hora <= now())
  and s.data_hora > now() - interval '3 days'
order by s.data_hora;

-- entrar_sala: igual à 0008, recusando sala cujo horário já chegou
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
  if v.status = 'cancelada' or v.partida_id is not null or v.data_hora <= now() then
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

-- C. Fale com o administrador
create table public.mensagens_admin (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('duvida', 'sugestao', 'problema')),
  texto text not null check (char_length(texto) between 1 and 2000),
  resposta text check (resposta is null or char_length(resposta) between 1 and 2000),
  respondido_por uuid references public.profiles (id),
  respondido_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mensagens_admin enable row level security;
create policy mensagens_admin_select on public.mensagens_admin for select to authenticated
  using (autor = auth.uid() or public.is_admin());
revoke insert, update, delete, truncate on public.mensagens_admin from anon, authenticated;

create function public.enviar_mensagem_admin(p_tipo text, p_texto text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_id uuid;
  v_nome text;
  v_rotulo text;
  a record;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid() and ativo) then
    raise exception 'SEM_PERMISSAO';
  end if;
  v_rotulo := case p_tipo when 'duvida' then 'Dúvida' when 'sugestao' then 'Sugestão' when 'problema' then 'Problema' end;
  if v_rotulo is null or char_length(v_texto) not between 1 and 2000 then
    raise exception 'MENSAGEM_INVALIDA';
  end if;

  insert into mensagens_admin (autor, tipo, texto) values (auth.uid(), p_tipo, v_texto)
  returning id into v_id;

  select nome into v_nome from profiles where id = auth.uid();
  for a in select id from profiles where is_admin and ativo loop
    perform notificar(a.id, 'mensagem_admin',
      'Nova mensagem de ' || coalesce(v_nome, 'um jogador') || ': ' || v_rotulo, '/admin');
  end loop;
  return v_id;
end;
$$;

create function public.responder_mensagem_admin(p_id uuid, p_resposta text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_resposta text := trim(coalesce(p_resposta, ''));
  v_autor uuid;
begin
  if not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  select autor into v_autor from mensagens_admin where id = p_id for update;
  if not found then
    raise exception 'MENSAGEM_NAO_ENCONTRADA';
  end if;
  if char_length(v_resposta) not between 1 and 2000 then
    raise exception 'MENSAGEM_INVALIDA';
  end if;

  update mensagens_admin
  set resposta = v_resposta, respondido_por = auth.uid(), respondido_em = now()
  where id = p_id;
  perform notificar(v_autor, 'mensagem_respondida', 'O administrador respondeu sua mensagem.', '/contato');
end;
$$;

revoke execute on function public.enviar_mensagem_admin(text, text),
  public.responder_mensagem_admin(uuid, text) from public, anon;
grant execute on function public.enviar_mensagem_admin(text, text),
  public.responder_mensagem_admin(uuid, text) to authenticated;
