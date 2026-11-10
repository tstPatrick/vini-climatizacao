-- Lembretes automáticos (véspera às 18h e 1 hora antes). Cole tudo no SQL Editor do Supabase e clique em Run.
-- =====================================================================
-- Lembretes automáticos ao cliente (push): na véspera às 18h e 1 hora antes.
-- Só para agendamentos confirmados. A rotina roda a cada 5 minutos (pg_cron).
-- =====================================================================
alter table agendamentos add column if not exists lembrete_vespera_em timestamptz;
alter table agendamentos add column if not exists lembrete_1h_em timestamptz;

-- Se o horário mudar, os lembretes voltam a valer para o novo horário.
create or replace function zerar_lembretes() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.inicio is distinct from old.inicio then
    new.lembrete_vespera_em := null;
    new.lembrete_1h_em := null;
  end if;
  return new;
end $$;
drop trigger if exists zerar_lembretes on agendamentos;
create trigger zerar_lembretes before update on agendamentos
  for each row execute function zerar_lembretes();

create or replace function enviar_lembretes(p_agora timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  c notificacao_config;
  r record;
  v_total int := 0;
  v_local timestamp := p_agora at time zone 'America/Bahia';
begin
  select * into c from notificacao_config where id = 1;
  if c.url_funcao is null or c.segredo is null then return 0; end if;

  for r in
    -- Véspera: entre 18h e 22h do dia anterior, se foi agendado antes das 18h desse dia.
    update agendamentos g set lembrete_vespera_em = p_agora
    where g.status = 'confirmado' and g.lembrete_vespera_em is null
      and v_local::time >= time '18:00' and v_local::time < time '22:00'
      and (g.inicio at time zone 'America/Bahia')::date = v_local::date + 1
      and (g.criado_em at time zone 'America/Bahia') < v_local::date + time '18:00'
    returning g.id, 'lembrete_vespera'::text as evento
  loop
    perform net.http_post(url := c.url_funcao,
      body := jsonb_build_object('agendamento_id', r.id, 'evento', r.evento),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-vini-segredo', c.segredo));
    v_total := v_total + 1;
  end loop;

  for r in
    -- 1 hora antes (a rotina de 5 em 5 min manda entre 60 e 55 min antes).
    update agendamentos g set lembrete_1h_em = p_agora
    where g.status = 'confirmado' and g.lembrete_1h_em is null
      and g.inicio > p_agora + interval '10 minutes'
      and g.inicio <= p_agora + interval '60 minutes'
    returning g.id, 'lembrete_1h'::text as evento
  loop
    perform net.http_post(url := c.url_funcao,
      body := jsonb_build_object('agendamento_id', r.id, 'evento', r.evento),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-vini-segredo', c.segredo));
    v_total := v_total + 1;
  end loop;
  return v_total;
end $$;

revoke execute on function enviar_lembretes(timestamptz) from public, anon, authenticated;
revoke execute on function zerar_lembretes() from public, anon, authenticated;

-- Agenda a rotina (só no Supabase, onde existe a extensão pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('vini-lembretes', '*/5 * * * *', 'select public.enviar_lembretes()');
  end if;
end $$;
