-- =====================================================================
-- Vini Climatização — banco de dados (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- Fuso: America/Bahia (UTC-3).
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table if not exists tecnicos (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists servicos (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  duracao_min int not null check (duracao_min between 15 and 720),
  intervalo_retorno_meses int check (intervalo_retorno_meses between 1 and 60),
  preco_base numeric(10, 2),
  ordem int not null default 0,
  ativo boolean not null default true
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null unique,
  token uuid not null unique default gen_random_uuid(),
  criado_em timestamptz not null default now()
);

create table if not exists enderecos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  rua text not null,
  numero text not null default '',
  bairro text not null,
  complemento text not null default '',
  observacoes text not null default ''
);

create table if not exists aparelhos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo text not null default 'Split',
  marca text not null default '',
  btus int,
  foto_url text -- v1: foto reduzida em data URL
);

create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  servico_id text not null references servicos (id),
  endereco_id uuid not null references enderecos (id),
  aparelho_id uuid references aparelhos (id),
  inicio timestamptz not null,
  fim timestamptz not null,
  -- fim + intervalo de deslocamento: é o que a trava anti-conflito usa
  bloqueado_ate timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'concluido', 'cancelado', 'remarcado')),
  observacao_cliente text not null default '',
  criado_em timestamptz not null default now(),
  check (fim > inicio and bloqueado_ate >= fim),
  -- SEM CONFLITO: dois agendamentos ativos nunca se sobrepõem (validado no banco).
  constraint sem_conflito exclude using gist (tstzrange(inicio, bloqueado_ate) with &&)
    where (status in ('pendente', 'confirmado', 'remarcado'))
);
create index if not exists agendamentos_inicio_idx on agendamentos (inicio);
create index if not exists agendamentos_cliente_idx on agendamentos (cliente_id);

create table if not exists atendimentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null unique references agendamentos (id) on delete cascade,
  descricao text not null default '',
  pecas text not null default '',
  valor numeric(10, 2),
  fotos text[] not null default '{}',
  concluido_em timestamptz not null default now()
);

create table if not exists retornos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  aparelho_id uuid references aparelhos (id) on delete set null,
  servico_id text not null references servicos (id),
  data_prevista date not null,
  status text not null default 'pendente' check (status in ('pendente', 'avisado', 'agendado', 'dispensado'))
);
create index if not exists retornos_data_idx on retornos (data_prevista) where status in ('pendente', 'avisado');

create table if not exists disponibilidade (
  id serial primary key,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora_inicio time not null,
  hora_fim time not null,
  check (hora_fim > hora_inicio)
);

create table if not exists bloqueios (
  id uuid primary key default gen_random_uuid(),
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text not null default '',
  check (fim > inicio)
);

create table if not exists ajustes (
  id int primary key default 1 check (id = 1),
  whatsapp_tecnico text not null default '',
  nome_tecnico text not null default 'Vinícius',
  intervalo_deslocamento_min int not null default 60 check (intervalo_deslocamento_min between 0 and 240),
  antecedencia_minima_horas int not null default 12 check (antecedencia_minima_horas between 0 and 720),
  dias_a_frente int not null default 30 check (dias_a_frente between 1 and 365),
  passo_min int not null default 60 check (passo_min between 15 and 240)
);

-- Vários aparelhos na mesma visita e tempo extra para aparelho grande.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'servicos' and column_name = 'duracao_adicional_min') then
    alter table servicos add column duracao_adicional_min int not null default 60 check (duracao_adicional_min between 0 and 720);
    alter table servicos add column extra_grande_min int not null default 0 check (extra_grande_min between 0 and 240);
    -- marca para preencher os padrões depois que os serviços existirem
    create temp table if not exists _preencher_padroes (x int);
  end if;
end $$;
alter table agendamentos add column if not exists quantidade int not null default 1 check (quantidade between 1 and 6);

-- ---------------------------------------------------------------------
-- Dados iniciais (editáveis no painel do técnico)
-- ---------------------------------------------------------------------

insert into servicos (id, nome, descricao, duracao_min, intervalo_retorno_meses, ordem) values
  ('instalacao', 'Instalação', 'Split e janela', 180, null, 1),
  ('limpeza', 'Limpeza', 'Higienização completa', 90, 6, 2),
  ('manutencao', 'Manutenção', 'Diagnóstico e reparo', 120, 12, 3),
  ('carga-gas', 'Carga de gás', 'Recarga e teste', 60, null, 4),
  ('orcamento', 'Orçamento', 'Avaliação no local', 60, null, 5)
on conflict (id) do nothing;

insert into ajustes (id, whatsapp_tecnico) values (1, '5571999999999') on conflict (id) do nothing;

do $$
begin
  if to_regclass('pg_temp._preencher_padroes') is not null then
    update servicos s set duracao_adicional_min = v.adicional, extra_grande_min = v.extra
    from (values ('instalacao', 120, 30), ('limpeza', 45, 15), ('manutencao', 60, 15), ('carga-gas', 30, 15), ('orcamento', 15, 0))
      v(id, adicional, extra)
    where s.id = v.id;
    drop table pg_temp._preencher_padroes;
  end if;
end $$;

insert into disponibilidade (dia_semana, hora_inicio, hora_fim)
select d, h.i, h.f
from generate_series(1, 5) d, (values (time '08:00', time '12:00'), (time '13:00', time '18:00')) h(i, f)
where not exists (select 1 from disponibilidade);
insert into disponibilidade (dia_semana, hora_inicio, hora_fim)
select 6, '08:00', '12:00' where not exists (select 1 from disponibilidade where dia_semana = 6);

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

create or replace function eh_tecnico() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tecnicos where user_id = auth.uid());
$$;

create or replace function exigir_tecnico() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_tecnico() then raise exception 'Acesso restrito ao técnico.' using errcode = '42501'; end if;
end $$;

create or replace function normalizar_whats(w text) returns text
language sql immutable set search_path = public as $$
  select case when length(d) in (10, 11) then '55' || d else d end
  from (select regexp_replace(coalesce(w, ''), '\D', '', 'g') d) x;
$$;

-- Tempo da visita: 1º aparelho = duração; cada um a mais = duração adicional;
-- aparelho grande (18 mil BTUs ou mais) soma o extra em cada unidade. Igual a src/lib/horarios.ts.
create or replace function duracao_visita(p_servico text, p_quantidade int, p_aparelho uuid)
returns int
language sql stable security definer set search_path = public as $$
  select s.duracao_min + x.extra + (least(greatest(coalesce(p_quantidade, 1), 1), 6) - 1) * (s.duracao_adicional_min + x.extra)
  from servicos s
  cross join lateral (
    select case when (select btus from aparelhos where id = p_aparelho) >= 18000 then s.extra_grande_min else 0 end as extra
  ) x
  where s.id = p_servico;
$$;

-- Valida se o horário pode ser reservado (mesma regra do app: src/lib/horarios.ts).
drop function if exists validar_horario(text, timestamptz, uuid);
create or replace function validar_horario(p_servico text, p_inicio timestamptz, p_ignorar uuid default null, p_duracao_min int default null)
returns timestamptz -- devolve o fim
language plpgsql stable security definer set search_path = public as $$
declare
  s servicos;
  a ajustes;
  v_dur int;
  v_fim timestamptz;
  v_local timestamp := p_inicio at time zone 'America/Bahia';
  v_hoje date := (now() at time zone 'America/Bahia')::date;
  v_t time := v_local::time;
begin
  select * into s from servicos where id = p_servico and ativo;
  if not found then raise exception 'Serviço não encontrado.'; end if;
  select * into a from ajustes where id = 1;
  v_dur := coalesce(p_duracao_min, s.duracao_min);
  v_fim := p_inicio + make_interval(mins => v_dur);

  if p_inicio < now() + make_interval(hours => a.antecedencia_minima_horas) then
    raise exception 'Esse horário está muito próximo. Escolha outro, por favor.';
  end if;
  if v_local::date - v_hoje > a.dias_a_frente then
    raise exception 'Data além do limite de agendamento.';
  end if;
  if not exists (
    select 1 from disponibilidade d
    where d.dia_semana = extract(dow from v_local)::int
      and v_t >= d.hora_inicio
      and v_t + make_interval(mins => v_dur) <= d.hora_fim
      and v_local::date + v_t + make_interval(mins => v_dur) <= v_local::date + d.hora_fim -- não passa da meia-noite
      and (extract(epoch from (v_t - d.hora_inicio)) / 60)::int % a.passo_min = 0
  ) then
    raise exception 'Fora do horário de atendimento.';
  end if;
  if exists (select 1 from bloqueios b where b.inicio < v_fim and b.fim > p_inicio) then
    raise exception 'Data indisponível.';
  end if;
  if exists (
    select 1 from agendamentos g
    where g.status in ('pendente', 'confirmado', 'remarcado')
      and g.id is distinct from p_ignorar
      and g.inicio < v_fim + make_interval(mins => a.intervalo_deslocamento_min)
      and p_inicio < g.fim + make_interval(mins => a.intervalo_deslocamento_min)
  ) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro, por favor.';
  end if;
  return v_fim;
end $$;

create or replace function deslocamento() returns interval
language sql stable security definer set search_path = public as $$
  select make_interval(mins => intervalo_deslocamento_min) from ajustes where id = 1;
$$;

create or replace function agendamento_json(g agendamentos) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(g) - 'bloqueado_ate' || jsonb_build_object(
    'servico', (select to_jsonb(s) from servicos s where s.id = g.servico_id),
    'cliente', (select to_jsonb(c) - 'token' from clientes c where c.id = g.cliente_id),
    'endereco', (select to_jsonb(e) from enderecos e where e.id = g.endereco_id),
    'aparelho', (select to_jsonb(x) from aparelhos x where x.id = g.aparelho_id),
    'atendimento', (select to_jsonb(t) from atendimentos t where t.agendamento_id = g.id)
  );
$$;

create or replace function perfil_json(p_cliente uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'cliente', to_jsonb(c) - 'token',
    'enderecos', coalesce((select jsonb_agg(to_jsonb(e)) from enderecos e where e.cliente_id = c.id), '[]'),
    'aparelhos', coalesce((select jsonb_agg(to_jsonb(x)) from aparelhos x where x.cliente_id = c.id), '[]'),
    'agendamentos', coalesce((select jsonb_agg(agendamento_json(g) order by g.inicio desc) from agendamentos g where g.cliente_id = c.id), '[]')
  ) from clientes c where c.id = p_cliente;
$$;

create or replace function retorno_json(r retornos) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(r) || jsonb_build_object(
    'cliente', (select to_jsonb(c) - 'token' from clientes c where c.id = r.cliente_id),
    'servico', (select to_jsonb(s) from servicos s where s.id = r.servico_id),
    'aparelho', (select to_jsonb(x) from aparelhos x where x.id = r.aparelho_id)
  );
$$;

create or replace function cliente_do_token(p_token uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from clientes where token = p_token;
  if v is null then raise exception 'Cadastro não encontrado. Informe seus dados novamente.'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- API pública (cliente sem senha)
-- ---------------------------------------------------------------------

create or replace function horarios_ocupados(p_de timestamptz, p_ate timestamptz)
returns table (tipo text, inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  select 'agendamento', g.inicio, g.fim from agendamentos g
  where g.status in ('pendente', 'confirmado', 'remarcado') and g.fim > p_de and g.inicio < p_ate
  union all
  select 'bloqueio', b.inicio, b.fim from bloqueios b where b.fim > p_de and b.inicio < p_ate;
$$;

create or replace function entrar_cliente(p_whatsapp text) returns uuid
language sql stable security definer set search_path = public as $$
  select token from clientes where whatsapp = normalizar_whats(p_whatsapp);
$$;

create or replace function perfil_cliente(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select perfil_json(id) from clientes where token = p_token;
$$;

create or replace function salvar_dados_cliente(p_token uuid, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_whats text := normalizar_whats(p_dados ->> 'whatsapp');
  v_nome text := trim(p_dados ->> 'nome');
  c clientes;
  e jsonb := p_dados -> 'endereco';
  x jsonb := p_dados -> 'aparelho';
  v_end uuid;
  v_apa uuid;
begin
  if length(v_whats) < 12 then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
  if coalesce(v_nome, '') = '' then raise exception 'Informe seu nome.'; end if;
  if coalesce(trim(e ->> 'rua'), '') = '' or coalesce(trim(e ->> 'bairro'), '') = '' then
    raise exception 'Informe rua e bairro.';
  end if;

  if p_token is not null then select * into c from clientes where token = p_token; end if;
  if c.id is null then select * into c from clientes where whatsapp = v_whats; end if;
  if c.id is null then
    insert into clientes (nome, whatsapp) values (v_nome, v_whats) returning * into c;
  else
    update clientes set nome = v_nome, whatsapp = v_whats where id = c.id returning * into c;
  end if;

  update enderecos set rua = e ->> 'rua', numero = coalesce(e ->> 'numero', ''), bairro = e ->> 'bairro',
    complemento = coalesce(e ->> 'complemento', ''), observacoes = coalesce(e ->> 'observacoes', '')
  where id = nullif(e ->> 'id', '')::uuid and cliente_id = c.id returning id into v_end;
  if v_end is null then
    insert into enderecos (cliente_id, rua, numero, bairro, complemento, observacoes)
    values (c.id, e ->> 'rua', coalesce(e ->> 'numero', ''), e ->> 'bairro', coalesce(e ->> 'complemento', ''), coalesce(e ->> 'observacoes', ''))
    returning id into v_end;
  end if;

  update aparelhos set tipo = coalesce(x ->> 'tipo', 'Split'), marca = coalesce(x ->> 'marca', ''),
    btus = nullif(x ->> 'btus', '')::int, foto_url = nullif(x ->> 'foto_url', '')
  where id = nullif(x ->> 'id', '')::uuid and cliente_id = c.id returning id into v_apa;
  if v_apa is null then
    insert into aparelhos (cliente_id, tipo, marca, btus, foto_url)
    values (c.id, coalesce(x ->> 'tipo', 'Split'), coalesce(x ->> 'marca', ''), nullif(x ->> 'btus', '')::int, nullif(x ->> 'foto_url', ''))
    returning id into v_apa;
  end if;

  return jsonb_build_object('token', c.token, 'endereco_id', v_end, 'aparelho_id', v_apa);
end $$;

drop function if exists criar_agendamento(uuid, text, uuid, uuid, timestamptz, text);
create or replace function criar_agendamento(
  p_token uuid, p_servico text, p_endereco uuid, p_aparelho uuid, p_inicio timestamptz, p_observacao text default '',
  p_quantidade int default 1
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cliente uuid := cliente_do_token(p_token);
  v_fim timestamptz;
  g agendamentos;
begin
  if not exists (select 1 from enderecos where id = p_endereco and cliente_id = v_cliente) then
    raise exception 'Informe o endereço.';
  end if;
  if p_aparelho is not null and not exists (select 1 from aparelhos where id = p_aparelho and cliente_id = v_cliente) then
    raise exception 'Aparelho não encontrado.';
  end if;
  -- trava de concorrência: um agendamento por vez
  perform pg_advisory_xact_lock(hashtext('vini-agenda'));
  if coalesce(p_quantidade, 1) not between 1 and 6 then raise exception 'Quantidade de aparelhos entre 1 e 6.'; end if;
  v_fim := validar_horario(p_servico, p_inicio, null, duracao_visita(p_servico, p_quantidade, p_aparelho));
  insert into agendamentos (cliente_id, servico_id, endereco_id, aparelho_id, inicio, fim, bloqueado_ate, observacao_cliente, quantidade)
  values (v_cliente, p_servico, p_endereco, p_aparelho, p_inicio, v_fim, v_fim + deslocamento(), coalesce(p_observacao, ''),
    coalesce(p_quantidade, 1))
  returning * into g;
  update retornos set status = 'agendado'
  where cliente_id = v_cliente and servico_id = p_servico and status in ('pendente', 'avisado');
  return to_jsonb(g) - 'bloqueado_ate';
exception when exclusion_violation then
  raise exception 'Esse horário acabou de ser ocupado. Escolha outro, por favor.';
end $$;

create or replace function cliente_responder_remarcacao(p_token uuid, p_id uuid, p_aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_aceitar then
    update agendamentos set status = 'confirmado'
    where id = p_id and cliente_id = cliente_do_token(p_token) and status = 'remarcado';
    if not found then raise exception 'Este agendamento não tem sugestão de novo horário.'; end if;
  end if;
end $$;

create or replace function cliente_remarcar(p_token uuid, p_id uuid, p_inicio timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare g agendamentos; v_fim timestamptz;
begin
  select * into g from agendamentos where id = p_id and cliente_id = cliente_do_token(p_token)
    and status in ('pendente', 'confirmado', 'remarcado') for update;
  if not found then raise exception 'Este agendamento não pode mais ser alterado.'; end if;
  perform pg_advisory_xact_lock(hashtext('vini-agenda'));
  v_fim := validar_horario(g.servico_id, p_inicio, g.id, (extract(epoch from g.fim - g.inicio) / 60)::int);
  update agendamentos set inicio = p_inicio, fim = v_fim, bloqueado_ate = v_fim + deslocamento(), status = 'pendente'
  where id = g.id;
exception when exclusion_violation then
  raise exception 'Esse horário acabou de ser ocupado. Escolha outro, por favor.';
end $$;

create or replace function cliente_cancelar(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update agendamentos set status = 'cancelado'
  where id = p_id and cliente_id = cliente_do_token(p_token) and status in ('pendente', 'confirmado', 'remarcado');
  if not found then raise exception 'Este agendamento não pode mais ser cancelado.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- API do técnico (exige login)
-- ---------------------------------------------------------------------

create or replace function tec_agendamentos(p_de timestamptz, p_ate timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  return coalesce((select jsonb_agg(agendamento_json(g) order by g.inicio)
    from agendamentos g where g.inicio >= p_de and g.inicio < p_ate), '[]');
end $$;

create or replace function tec_agendamento(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  return (select agendamento_json(g) from agendamentos g where g.id = p_id);
end $$;

create or replace function tec_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  if p_status not in ('confirmado', 'cancelado') then raise exception 'Status inválido.'; end if;
  update agendamentos set status = p_status
  where id = p_id and status in ('pendente', 'confirmado', 'remarcado');
  if not found then raise exception 'Agendamento não pode ser alterado.'; end if;
exception when exclusion_violation then
  raise exception 'Já existe outro agendamento nesse horário.';
end $$;

create or replace function tec_remarcar(p_id uuid, p_inicio timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare g agendamentos; v_fim timestamptz;
begin
  perform exigir_tecnico();
  select * into g from agendamentos where id = p_id and status in ('pendente', 'confirmado', 'remarcado') for update;
  if not found then raise exception 'Agendamento não pode ser remarcado.'; end if;
  perform pg_advisory_xact_lock(hashtext('vini-agenda'));
  v_fim := validar_horario(g.servico_id, p_inicio, g.id, (extract(epoch from g.fim - g.inicio) / 60)::int);
  update agendamentos set inicio = p_inicio, fim = v_fim, bloqueado_ate = v_fim + deslocamento(), status = 'remarcado'
  where id = g.id;
exception when exclusion_violation then
  raise exception 'Esse horário acabou de ser ocupado. Escolha outro, por favor.';
end $$;

create or replace function tec_concluir(p_id uuid, p_descricao text, p_pecas text, p_valor numeric, p_fotos text[])
returns void
language plpgsql security definer set search_path = public as $$
declare g agendamentos; s servicos;
begin
  perform exigir_tecnico();
  update agendamentos set status = 'concluido'
  where id = p_id and status in ('pendente', 'confirmado', 'remarcado') returning * into g;
  if not found then raise exception 'Agendamento não pode ser concluído.'; end if;
  insert into atendimentos (agendamento_id, descricao, pecas, valor, fotos)
  values (g.id, coalesce(p_descricao, ''), coalesce(p_pecas, ''), p_valor, coalesce(p_fotos, '{}'));
  update retornos set status = 'agendado'
  where cliente_id = g.cliente_id and servico_id = g.servico_id
    and aparelho_id is not distinct from g.aparelho_id and status in ('pendente', 'avisado');
  select * into s from servicos where id = g.servico_id;
  if s.intervalo_retorno_meses is not null then
    insert into retornos (cliente_id, aparelho_id, servico_id, data_prevista)
    values (g.cliente_id, g.aparelho_id, g.servico_id,
      ((now() at time zone 'America/Bahia')::date + make_interval(months => s.intervalo_retorno_meses))::date);
  end if;
end $$;

create or replace function tec_clientes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  return coalesce((
    select jsonb_agg(linha order by ordem desc) from (
      select jsonb_build_object(
        'cliente', to_jsonb(c) - 'token',
        'ultimo_servico', (
          select jsonb_build_object('nome', s.nome, 'data', (g.inicio at time zone 'America/Bahia')::date)
          from agendamentos g join servicos s on s.id = g.servico_id
          where g.cliente_id = c.id and g.status = 'concluido' order by g.inicio desc limit 1),
        'proximo_retorno', (
          select to_jsonb(r) from retornos r
          where r.cliente_id = c.id and r.status in ('pendente', 'avisado') order by r.data_prevista limit 1),
        'bairro', (select e.bairro from enderecos e where e.cliente_id = c.id limit 1)
      ) linha,
      coalesce((select max(g.inicio) from agendamentos g where g.cliente_id = c.id), c.criado_em) ordem
      from clientes c
    ) t), '[]');
end $$;

create or replace function tec_cliente(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  return perfil_json(p_id) || jsonb_build_object('retornos',
    coalesce((select jsonb_agg(retorno_json(r) order by r.data_prevista) from retornos r where r.cliente_id = p_id), '[]'));
end $$;

create or replace function tec_retornos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  return coalesce((select jsonb_agg(retorno_json(r) order by r.data_prevista)
    from retornos r where r.status in ('pendente', 'avisado')), '[]');
end $$;

-- ---------------------------------------------------------------------
-- Segurança por linha (RLS)
-- Público lê só serviços, horários de trabalho e ajustes. O resto passa pelas
-- funções acima. O técnico (tabela "tecnicos") pode tudo.
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['tecnicos', 'servicos', 'clientes', 'enderecos', 'aparelhos', 'agendamentos',
    'atendimentos', 'retornos', 'disponibilidade', 'bloqueios', 'ajustes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tecnico_tudo on %I', t);
    execute format('create policy tecnico_tudo on %I for all to authenticated using (eh_tecnico()) with check (eh_tecnico())', t);
  end loop;
end $$;

drop policy if exists publico_le on servicos;
create policy publico_le on servicos for select to anon, authenticated using (ativo);
drop policy if exists publico_le on disponibilidade;
create policy publico_le on disponibilidade for select to anon, authenticated using (true);
drop policy if exists publico_le on ajustes;
create policy publico_le on ajustes for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- Permissões das funções
-- Internas: só usadas por dentro das outras funções (ninguém chama pela API).
-- Do técnico: só quem está logado (e elas ainda conferem se é o técnico).
-- Do cliente: públicas, é assim que o cliente agenda sem senha.
-- ---------------------------------------------------------------------
revoke execute on function validar_horario(text, timestamptz, uuid, int) from public, anon, authenticated;
revoke execute on function duracao_visita(text, int, uuid) from public, anon, authenticated;
revoke execute on function agendamento_json(agendamentos) from public, anon, authenticated;
revoke execute on function perfil_json(uuid) from public, anon, authenticated;
revoke execute on function retorno_json(retornos) from public, anon, authenticated;
revoke execute on function cliente_do_token(uuid) from public, anon, authenticated;
revoke execute on function deslocamento() from public, anon, authenticated;
revoke execute on function normalizar_whats(text) from public, anon, authenticated;
revoke execute on function exigir_tecnico() from public, anon, authenticated;

revoke execute on function eh_tecnico() from public, anon;
grant execute on function eh_tecnico() to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'tec_agendamentos(timestamptz, timestamptz)', 'tec_agendamento(uuid)', 'tec_status(uuid, text)',
    'tec_remarcar(uuid, timestamptz)', 'tec_concluir(uuid, text, text, numeric, text[])',
    'tec_clientes()', 'tec_cliente(uuid)', 'tec_retornos()']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'horarios_ocupados(timestamptz, timestamptz)', 'entrar_cliente(text)', 'perfil_cliente(uuid)',
    'salvar_dados_cliente(uuid, jsonb)', 'criar_agendamento(uuid, text, uuid, uuid, timestamptz, text, int)',
    'cliente_responder_remarcacao(uuid, uuid, boolean)', 'cliente_remarcar(uuid, uuid, timestamptz)',
    'cliente_cancelar(uuid, uuid)']
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- =====================================================================
-- Notificações push (técnico: novo pedido; cliente: confirmação etc.)
-- O gatilho chama a Edge Function "notificar" (supabase/functions/notificar).
-- As chaves ficam na tabela privada notificacao_config (preencher à parte).
-- =====================================================================

create extension if not exists pg_net;

alter table ajustes add column if not exists vapid_publica text not null default '';

create table if not exists push_inscricoes (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  cliente_id uuid references clientes (id) on delete cascade,
  tecnico boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists notificacao_config (
  id int primary key default 1 check (id = 1),
  url_funcao text,
  segredo text,
  vapid_publica text,
  vapid_privada text,
  contato text
);

alter table push_inscricoes enable row level security;
alter table notificacao_config enable row level security;
revoke all on push_inscricoes from anon, authenticated;
revoke all on notificacao_config from anon, authenticated;

create or replace function salvar_push_cliente(p_token uuid, p_inscricao jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid := cliente_do_token(p_token);
begin
  insert into push_inscricoes (endpoint, p256dh, auth, cliente_id)
  values (p_inscricao ->> 'endpoint', p_inscricao -> 'keys' ->> 'p256dh', p_inscricao -> 'keys' ->> 'auth', v_cliente)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, cliente_id = excluded.cliente_id;
end $$;

create or replace function tec_salvar_push(p_inscricao jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_tecnico();
  insert into push_inscricoes (endpoint, p256dh, auth, tecnico)
  values (p_inscricao ->> 'endpoint', p_inscricao -> 'keys' ->> 'p256dh', p_inscricao -> 'keys' ->> 'auth', true)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, tecnico = true;
end $$;

-- Decide quem avisar e chama a Edge Function. Nunca impede o agendamento se falhar.
create or replace function notificar_agendamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_evento text;
  c notificacao_config;
  v_cliente_agindo boolean := auth.uid() is null; -- cliente não tem login
begin
  if tg_op = 'INSERT' then
    v_evento := 'novo';
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

drop trigger if exists notificar_agendamento on agendamentos;
create trigger notificar_agendamento after insert or update on agendamentos
  for each row execute function notificar_agendamento();

revoke execute on function notificar_agendamento() from public, anon, authenticated;
revoke execute on function salvar_push_cliente(uuid, jsonb) from public;
grant execute on function salvar_push_cliente(uuid, jsonb) to anon, authenticated;
revoke execute on function tec_salvar_push(jsonb) from public, anon;
grant execute on function tec_salvar_push(jsonb) to authenticated;
