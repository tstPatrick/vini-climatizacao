-- Pedidos de orçamento (sem horário) + lembrete diário ao técnico. Cole tudo no SQL Editor do Supabase e clique em Run.
-- =====================================================================
-- Pedidos de orçamento (sem horário): o cliente pede, o técnico combina a visita.
-- O técnico recebe push na hora e um lembrete diário às 8h enquanto houver
-- pedido "novo" (sem contato). Tocar em WhatsApp marca como "contatado".
-- =====================================================================
alter table enderecos add column if not exists cidade text not null default 'Salvador';

create table if not exists pedidos_orcamento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  endereco_id uuid not null references enderecos (id),
  descricao text not null default '',
  foto_url text,
  status text not null default 'novo' check (status in ('novo', 'contatado', 'agendado', 'dispensado')),
  agendamento_id uuid references agendamentos (id) on delete set null,
  criado_em timestamptz not null default now(),
  avisado_em date
);
create index if not exists pedidos_orcamento_status_idx on pedidos_orcamento (status);
alter table pedidos_orcamento enable row level security;
drop policy if exists tecnico_tudo on pedidos_orcamento;
create policy tecnico_tudo on pedidos_orcamento for all to authenticated using (eh_tecnico()) with check (eh_tecnico());

create or replace function pedido_json(p pedidos_orcamento) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object(
    'cliente', (select to_jsonb(c) - 'token' from clientes c where c.id = p.cliente_id),
    'endereco', (select to_jsonb(e) from enderecos e where e.id = p.endereco_id)
  );
$$;

-- Cliente (sem senha): salva nome/WhatsApp/endereço e cria o pedido.
create or replace function pedir_orcamento(p_token uuid, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_whats text := normalizar_whats(p_dados ->> 'whatsapp');
  v_nome text := trim(p_dados ->> 'nome');
  e jsonb := p_dados -> 'endereco';
  c clientes;
  v_end uuid;
  v_pedido uuid;
begin
  if length(v_whats) < 12 then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
  if coalesce(v_nome, '') = '' then raise exception 'Informe seu nome.'; end if;
  if coalesce(trim(e ->> 'rua'), '') = '' or coalesce(trim(e ->> 'bairro'), '') = '' or coalesce(trim(e ->> 'cidade'), '') = '' then
    raise exception 'Informe rua, bairro e cidade.';
  end if;
  if coalesce(trim(p_dados ->> 'descricao'), '') = '' then raise exception 'Conte o que você precisa.'; end if;

  if p_token is not null then select * into c from clientes where token = p_token; end if;
  if c.id is null then select * into c from clientes where whatsapp = v_whats; end if;
  if c.id is null then
    insert into clientes (nome, whatsapp) values (v_nome, v_whats) returning * into c;
  else
    update clientes set nome = v_nome, whatsapp = v_whats where id = c.id returning * into c;
  end if;

  update enderecos set rua = e ->> 'rua', numero = coalesce(e ->> 'numero', ''), bairro = e ->> 'bairro',
    complemento = coalesce(e ->> 'complemento', ''), observacoes = coalesce(e ->> 'observacoes', ''), cidade = trim(e ->> 'cidade')
  where id = nullif(e ->> 'id', '')::uuid and cliente_id = c.id returning id into v_end;
  if v_end is null then
    insert into enderecos (cliente_id, rua, numero, bairro, complemento, observacoes, cidade)
    values (c.id, e ->> 'rua', coalesce(e ->> 'numero', ''), e ->> 'bairro', coalesce(e ->> 'complemento', ''),
      coalesce(e ->> 'observacoes', ''), trim(e ->> 'cidade'))
    returning id into v_end;
  end if;

  insert into pedidos_orcamento (cliente_id, endereco_id, descricao, foto_url)
  values (c.id, v_end, trim(p_dados ->> 'descricao'), nullif(p_dados ->> 'foto_url', ''))
  returning id into v_pedido;

  return jsonb_build_object('token', c.token, 'pedido_id', v_pedido);
end $$;

-- Perfil do cliente passa a trazer os pedidos em aberto.
create or replace function perfil_json(p_cliente uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'cliente', to_jsonb(c) - 'token',
    'enderecos', coalesce((select jsonb_agg(to_jsonb(e)) from enderecos e where e.cliente_id = c.id), '[]'),
    'aparelhos', coalesce((select jsonb_agg(to_jsonb(x)) from aparelhos x where x.cliente_id = c.id), '[]'),
    'agendamentos', coalesce((select jsonb_agg(agendamento_json(g) order by g.inicio desc) from agendamentos g where g.cliente_id = c.id), '[]'),
    'pedidos', coalesce((select jsonb_agg(to_jsonb(p) order by p.criado_em desc) from pedidos_orcamento p
      where p.cliente_id = c.id and p.status in ('novo', 'contatado')), '[]')
  ) from clientes c where c.id = p_cliente;
$$;

-- Técnico
create or replace function tec_pedidos_orcamento() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  return coalesce((select jsonb_agg(pedido_json(p) order by p.criado_em)
    from pedidos_orcamento p where p.status in ('novo', 'contatado')), '[]');
end $$;

create or replace function tec_pedido_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  if p_status not in ('contatado', 'dispensado') then raise exception 'Status inválido.'; end if;
  update pedidos_orcamento set status = p_status
  where id = p_id and status in ('novo', 'contatado') and not (status = 'contatado' and p_status = 'contatado');
end $$;

-- Marcar a visita: cria o agendamento de orçamento já confirmado (o cliente é avisado).
create or replace function tec_agendar_pedido(p_id uuid, p_inicio timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare p pedidos_orcamento; v_fim timestamptz; v_ag uuid;
begin
  perform exigir_tecnico();
  select * into p from pedidos_orcamento where id = p_id and status in ('novo', 'contatado') for update;
  if not found then raise exception 'Pedido não encontrado ou já resolvido.'; end if;
  perform pg_advisory_xact_lock(hashtext('vini-agenda'));
  v_fim := validar_horario('orcamento', p_inicio);
  insert into agendamentos (cliente_id, servico_id, endereco_id, inicio, fim, bloqueado_ate, status, observacao_cliente)
  values (p.cliente_id, 'orcamento', p.endereco_id, p_inicio, v_fim, v_fim + deslocamento(), 'confirmado', p.descricao)
  returning id into v_ag;
  update pedidos_orcamento set status = 'agendado', agendamento_id = v_ag where id = p.id;
  return v_ag;
exception when exclusion_violation then
  raise exception 'Esse horário acabou de ser ocupado. Escolha outro, por favor.';
end $$;

-- Push na hora em que o cliente pede.
create or replace function notificar_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare c notificacao_config;
begin
  select * into c from notificacao_config where id = 1;
  if c.url_funcao is null or c.segredo is null then return new; end if;
  perform net.http_post(url := c.url_funcao,
    body := jsonb_build_object('pedido_id', new.id, 'evento', 'novo_orcamento'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-vini-segredo', c.segredo));
  update pedidos_orcamento set avisado_em = (now() at time zone 'America/Bahia')::date where id = new.id;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists notificar_pedido on pedidos_orcamento;
create trigger notificar_pedido after insert on pedidos_orcamento
  for each row execute function notificar_pedido();

-- Agendamento criado já confirmado (visita de orçamento) avisa o cliente, não o técnico.
create or replace function notificar_agendamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_evento text;
  c notificacao_config;
  v_cliente_agindo boolean := auth.uid() is null;
begin
  if tg_op = 'INSERT' then
    v_evento := case when new.status = 'confirmado' then 'confirmado' else 'novo' end;
  elsif new.status is distinct from old.status or new.inicio is distinct from old.inicio then
    v_evento := case
      when new.status = 'confirmado' and v_cliente_agindo then 'cliente_aceitou'
      when new.status = 'confirmado' then 'confirmado'
      when new.status = 'remarcado' then 'remarcado'
      when new.status = 'cancelado' and v_cliente_agindo then 'cancelado_pelo_cliente'
      when new.status = 'cancelado' then 'cancelado'
      when new.status = 'pendente' and v_cliente_agindo then 'mudou_horario'
      else null end;
  end if;
  if v_evento is null then return new; end if;
  select * into c from notificacao_config where id = 1;
  if c.url_funcao is null or c.segredo is null then return new; end if;
  perform net.http_post(
    url := c.url_funcao,
    body := jsonb_build_object('agendamento_id', new.id, 'evento', v_evento),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-vini-segredo', c.segredo)
  );
  return new;
exception when others then
  return new;
end $$;

-- Lembrete diário (8h) ao técnico enquanto houver pedido sem contato.
create or replace function avisar_pedidos_pendentes(p_agora timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  c notificacao_config;
  v_local timestamp := p_agora at time zone 'America/Bahia';
  v_n int;
begin
  if v_local::time < time '08:00' or v_local::time >= time '09:00' then return 0; end if;
  select * into c from notificacao_config where id = 1;
  if c.url_funcao is null or c.segredo is null then return 0; end if;
  update pedidos_orcamento set avisado_em = v_local::date
  where status = 'novo' and (avisado_em is null or avisado_em < v_local::date);
  get diagnostics v_n = row_count;
  if v_n = 0 then return 0; end if;
  select count(*) into v_n from pedidos_orcamento where status = 'novo';
  perform net.http_post(url := c.url_funcao,
    body := jsonb_build_object('evento', 'orcamentos_pendentes', 'total', v_n),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-vini-segredo', c.segredo));
  return v_n;
end $$;

-- A rotina de 5 em 5 minutos passa a cuidar dos dois lembretes.
create or replace function rotina_lembretes() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform enviar_lembretes();
  perform avisar_pedidos_pendentes();
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vini-lembretes', '*/5 * * * *', 'select public.rotina_lembretes()');
  end if;
end $$;

revoke execute on function pedido_json(pedidos_orcamento) from public, anon, authenticated;
revoke execute on function notificar_pedido() from public, anon, authenticated;
revoke execute on function avisar_pedidos_pendentes(timestamptz) from public, anon, authenticated;
revoke execute on function rotina_lembretes() from public, anon, authenticated;
revoke execute on function pedir_orcamento(uuid, jsonb) from public;
grant execute on function pedir_orcamento(uuid, jsonb) to anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['tec_pedidos_orcamento()', 'tec_pedido_status(uuid, text)', 'tec_agendar_pedido(uuid, timestamptz)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
