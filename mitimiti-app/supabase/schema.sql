-- ═══════════════════════════════════════════════════════════════
-- MitiMiti · esquema de base de datos para Supabase
--
-- Ejecuta este archivo completo en el SQL Editor de tu proyecto de Supabase.
-- Se puede volver a correr: crea lo que falta y actualiza las funciones.
--
-- Antes: Authentication → Sign In / Providers → activa "Anonymous sign-ins".
-- Cada persona que abre la app recibe una sesión anónima (sin correo ni
-- contraseña) y todo lo que ve o cambia pasa por las reglas de este archivo.
--
-- Principios:
--   • Las tablas solo se leen (RLS: cada quien ve lo suyo y lo que comparte
--     con otros). Nadie escribe en ellas directamente.
--   • Toda escritura pasa por una función (mm_*) que valida quién la hace,
--     bloquea la fila que cambia y deja la base consistente en una sola
--     transacción. Los errores salen como 'mm:<código>' para que la app los
--     traduzca a un mensaje humano.
--   • El dinero siempre en centavos (integer).
-- ═══════════════════════════════════════════════════════════════

-- ─── Tablas ──────────────────────────────────────────────────

create table if not exists public.mm_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  color        smallint not null default 0 check (color between 0 and 11),
  pay_methods  jsonb not null default '[]'::jsonb check (jsonb_typeof(pay_methods) = 'array'),
  pay_code     text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.mm_bills (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  title            text not null check (char_length(btrim(title)) between 1 and 40),
  currency         text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  total_cents      integer not null check (total_cents between 1 and 100000000),
  tip_cents        integer not null default 0 check (tip_cents between 0 and 100000000),
  split_mode       text not null default 'equal' check (split_mode in ('equal', 'amounts', 'items')),
  status           text not null default 'open' check (status in ('open', 'locked', 'settled', 'cancelled')),
  host_id          uuid not null references public.mm_profiles (id) on delete cascade,
  payer_member_id  uuid,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  locked_at        timestamptz,
  settled_at       timestamptz
);

create table if not exists public.mm_bill_members (
  id            uuid primary key default gen_random_uuid(),
  bill_id       uuid not null references public.mm_bills (id) on delete cascade,
  user_id       uuid references public.mm_profiles (id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  color         smallint not null default 0,
  is_host       boolean not null default false,
  custom_cents  integer check (custom_cents >= 0),
  share_cents   integer check (share_cents >= 0),
  added_by      uuid,
  joined_at     timestamptz not null default clock_timestamp(),
  unique (bill_id, user_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mm_bills_payer_fk') then
    alter table public.mm_bills
      add constraint mm_bills_payer_fk foreign key (payer_member_id)
      references public.mm_bill_members (id) on delete set null;
  end if;
end $$;

create table if not exists public.mm_bill_items (
  id           uuid primary key default gen_random_uuid(),
  bill_id      uuid not null references public.mm_bills (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  price_cents  integer not null check (price_cents between 1 and 100000000),
  added_by     uuid,
  position     integer not null default 0,
  created_at   timestamptz not null default clock_timestamp()
);

create table if not exists public.mm_item_claims (
  item_id     uuid not null references public.mm_bill_items (id) on delete cascade,
  member_id   uuid not null references public.mm_bill_members (id) on delete cascade,
  bill_id     uuid not null references public.mm_bills (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_id, member_id)
);

create table if not exists public.mm_settlements (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid references public.mm_profiles (id) on delete set null,
  from_name    text not null,
  to_id        uuid references public.mm_profiles (id) on delete set null,
  to_name      text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency     text not null default 'USD',
  method       text check (method in ('transfer', 'deuna', 'payphone', 'cash', 'other')),
  status       text not null check (status in ('reported', 'confirmed', 'rejected')),
  debt_ids     uuid[] not null,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- Una deuda es una sola fila, nazca en una cuenta dividida (kind 'bill') o
-- anotada a mano con un link (kind 'direct'). En una anotada a mano, el lado
-- del amigo queda vacío hasta que abre el link.
--
--   pending ──acepta──▶ open ──"ya te pagué"──▶ reported ──"recibido"──▶ settled
--      │ └──no la reconoce──▶ declined            └──"no me llegó"──▶ open
--      └──quien la anotó la anula──▶ cancelled      open ──perdonar──▶ forgiven
create table if not exists public.mm_debts (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('bill', 'direct')),
  bill_id        uuid references public.mm_bills (id) on delete cascade,
  member_id      uuid references public.mm_bill_members (id) on delete set null,
  debtor_id      uuid references public.mm_profiles (id) on delete set null,
  debtor_name    text not null default '',
  creditor_id    uuid references public.mm_profiles (id) on delete set null,
  creditor_name  text not null default '',
  amount_cents   integer not null check (amount_cents between 1 and 100000000),
  currency       text not null default 'USD',
  concept        text check (concept is null or char_length(concept) <= 40),
  status         text not null check (status in ('pending', 'open', 'reported', 'settled', 'forgiven', 'declined', 'cancelled')),
  link_token     text unique,
  created_by     uuid not null,
  settlement_id  uuid references public.mm_settlements (id) on delete set null,
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  settled_at     timestamptz,
  constraint mm_debts_kind_ck check (
    (kind = 'bill' and bill_id is not null)
    or (kind = 'direct' and bill_id is null and link_token is not null)
  )
);

create table if not exists public.mm_notifications (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.mm_profiles (id) on delete cascade,
  kind           text not null,
  actor_id       uuid,
  actor_name     text,
  amount_cents   integer,
  currency       text,
  bill_id        uuid references public.mm_bills (id) on delete cascade,
  debt_id        uuid references public.mm_debts (id) on delete cascade,
  settlement_id  uuid references public.mm_settlements (id) on delete cascade,
  title          text,
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);

create table if not exists public.mm_events (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  name        text not null check (char_length(name) <= 60),
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists mm_members_bill_idx on public.mm_bill_members (bill_id);
create index if not exists mm_members_user_idx on public.mm_bill_members (user_id);
create index if not exists mm_items_bill_idx on public.mm_bill_items (bill_id);
create index if not exists mm_claims_bill_idx on public.mm_item_claims (bill_id);
create index if not exists mm_claims_member_idx on public.mm_item_claims (member_id);
create index if not exists mm_debts_debtor_idx on public.mm_debts (debtor_id);
create index if not exists mm_debts_creditor_idx on public.mm_debts (creditor_id);
create index if not exists mm_debts_bill_idx on public.mm_debts (bill_id);
create index if not exists mm_debts_created_by_idx on public.mm_debts (created_by);
create index if not exists mm_debts_settlement_idx on public.mm_debts (settlement_id);
create index if not exists mm_settlements_from_idx on public.mm_settlements (from_id);
create index if not exists mm_settlements_to_idx on public.mm_settlements (to_id);
create index if not exists mm_notifications_user_idx on public.mm_notifications (user_id, id desc);
create index if not exists mm_events_name_idx on public.mm_events (name, created_at);

-- ─── Ayudantes internos ──────────────────────────────────────

-- Quién está llamando. Sin sesión no hay nada que hacer.
create or replace function public.mm_uid()
returns uuid
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise exception 'mm:auth_required';
  end if;
  return v;
end $$;

-- El perfil de quien llama; casi todo lo que se hace en la app lo necesita
-- (el nombre con el que te ven los demás).
create or replace function public.mm_my_profile()
returns public.mm_profiles
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v public.mm_profiles;
begin
  select * into v from public.mm_profiles where id = public.mm_uid();
  if not found then
    raise exception 'mm:profile_required';
  end if;
  return v;
end $$;

-- Códigos al azar con un alfabeto sin caracteres que se confunden (0/O, 1/I/L).
-- Los bytes salen de gen_random_uuid(), que usa el generador seguro del
-- sistema, así no hace falta la extensión pgcrypto.
create or replace function public.mm_random_code(p_len integer, p_alphabet text)
returns text
language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  v_bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  v_out   text := '';
  i       integer;
begin
  for i in 0 .. p_len - 1 loop
    v_out := v_out || substr(p_alphabet, (get_byte(v_bytes, i) % length(p_alphabet)) + 1, 1);
  end loop;
  return v_out;
end $$;

create or replace function public.mm_color_for(p_name text)
returns smallint
language sql immutable
as $$ select (abs(hashtext(lower(btrim(p_name)))) % 12)::smallint $$;

-- Cada cambio en una cuenta sube su versión: la app escucha esa fila (un solo
-- canal de tiempo real por cuenta) y vuelve a pedir el resto.
create or replace function public.mm_bump(p_bill uuid)
returns void
language sql
set search_path = public, pg_temp
as $$
  update public.mm_bills set version = version + 1, updated_at = now() where id = p_bill;
$$;

create or replace function public.mm_notify(
  p_user uuid,
  p_kind text,
  p_actor_id uuid,
  p_actor_name text,
  p_amount integer default null,
  p_currency text default null,
  p_bill uuid default null,
  p_debt uuid default null,
  p_settlement uuid default null,
  p_title text default null,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_user is null or p_user = p_actor_id then
    return;
  end if;
  insert into public.mm_notifications
    (user_id, kind, actor_id, actor_name, amount_cents, currency, bill_id, debt_id, settlement_id, title, data)
  values
    (p_user, p_kind, p_actor_id, p_actor_name, p_amount, p_currency, p_bill, p_debt, p_settlement, p_title, coalesce(p_data, '{}'::jsonb));
end $$;

-- Deja solo lo que la app sabe mostrar de cada forma de cobro, con largos
-- razonables. Lo que llegue de más se descarta.
create or replace function public.mm_clean_pay_methods(p jsonb)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_out  jsonb := '[]'::jsonb;
  v_item jsonb;
  v_type text;
  v_clean jsonb;
  f text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    return '[]'::jsonb;
  end if;
  for v_item in select value from jsonb_array_elements(p) limit 8 loop
    if jsonb_typeof(v_item) <> 'object' then
      continue;
    end if;
    v_type := v_item ->> 'type';
    v_clean := jsonb_build_object('type', v_type);
    if v_type in ('deuna', 'payphone') then
      v_clean := v_clean || jsonb_build_object('phone', left(btrim(coalesce(v_item ->> 'phone', '')), 20));
    elsif v_type = 'transfer' then
      foreach f in array array['bank', 'account_type', 'account_number', 'holder', 'id_number'] loop
        v_clean := v_clean || jsonb_build_object(f, left(btrim(coalesce(v_item ->> f, '')), 60));
      end loop;
    elsif v_type = 'other' then
      v_clean := v_clean || jsonb_build_object(
        'label', left(btrim(coalesce(v_item ->> 'label', '')), 30),
        'value', left(btrim(coalesce(v_item ->> 'value', '')), 80)
      );
    elsif v_type <> 'cash' then
      continue;
    end if;
    v_out := v_out || jsonb_build_array(v_clean);
  end loop;
  return v_out;
end $$;

-- Para las políticas de lectura (RLS).
create or replace function public.mm_member_of(p_bill uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.mm_bill_members where bill_id = p_bill and user_id = auth.uid()
  );
$$;

-- Dos personas "se conocen" si comparten una cuenta o una deuda: solo así una
-- ve el nombre y los datos de cobro de la otra.
create or replace function public.mm_knows(p_other uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_other = auth.uid()
    or exists (
      select 1
      from public.mm_bill_members a
      join public.mm_bill_members b on b.bill_id = a.bill_id
      where a.user_id = auth.uid() and b.user_id = p_other
    )
    or exists (
      select 1 from public.mm_debts d
      where (d.debtor_id = auth.uid() and d.creditor_id = p_other)
         or (d.creditor_id = auth.uid() and d.debtor_id = p_other)
    );
$$;

-- ─── Perfil ──────────────────────────────────────────────────

create or replace function public.mm_me()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select to_jsonb(p) - 'updated_at' from public.mm_profiles p where p.id = auth.uid();
$$;

-- Crea o actualiza el perfil. p_pay_methods null = no tocar las formas de cobro.
create or replace function public.mm_save_profile(p_name text, p_pay_methods jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public.mm_uid();
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'mm:invalid_name';
  end if;

  insert into public.mm_profiles as p (id, name, color, pay_methods)
  values (v_uid, v_name, public.mm_color_for(v_name), public.mm_clean_pay_methods(coalesce(p_pay_methods, '[]'::jsonb)))
  on conflict (id) do update
    set name = excluded.name,
        pay_methods = case when p_pay_methods is null then p.pay_methods else excluded.pay_methods end,
        updated_at = now();

  -- El nombre nuevo se ve en las cuentas abiertas y en lo que todavía se debe;
  -- lo ya cerrado queda como estaba.
  update public.mm_bill_members m set name = v_name
  from public.mm_bills b
  where m.bill_id = b.id and m.user_id = v_uid and b.status in ('open', 'locked');
  update public.mm_debts set debtor_name = v_name
  where debtor_id = v_uid and status in ('pending', 'open', 'reported');
  update public.mm_debts set creditor_name = v_name
  where creditor_id = v_uid and status in ('pending', 'open', 'reported');

  return public.mm_me();
end $$;

-- Tu link de cobro (/p/<código>): tus formas de cobro en una página que
-- puedes mandar cuando alguien te pide "pásame tus datos".
create or replace function public.mm_ensure_pay_code()
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me   public.mm_profiles := public.mm_my_profile();
  v_code text := v_me.pay_code;
begin
  while v_code is null loop
    v_code := public.mm_random_code(8, 'abcdefghjkmnpqrstuvwxyz23456789');
    begin
      update public.mm_profiles set pay_code = v_code where id = v_me.id;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;
  return v_code;
end $$;

create or replace function public.mm_pay_card(p_code text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('name', p.name, 'color', p.color, 'pay_methods', p.pay_methods, 'is_me', coalesce(p.id = auth.uid(), false))
  from public.mm_profiles p
  where p.pay_code = lower(btrim(p_code));
$$;

-- ─── Cuentas: crear, entrar, ver ─────────────────────────────

create or replace function public.mm_create_bill(p_title text, p_total_cents integer, p_currency text default 'USD')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me     public.mm_profiles := public.mm_my_profile();
  v_title  text := btrim(coalesce(p_title, ''));
  v_bill   uuid;
  v_member uuid;
  v_code   text;
begin
  if char_length(v_title) not between 1 and 40 then
    raise exception 'mm:invalid_title';
  end if;
  if p_total_cents is null or p_total_cents not between 1 and 100000000 then
    raise exception 'mm:invalid_amount';
  end if;

  loop
    v_code := public.mm_random_code(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    begin
      insert into public.mm_bills (code, title, currency, total_cents, host_id)
      values (v_code, v_title, upper(coalesce(p_currency, 'USD')), p_total_cents, v_me.id)
      returning id into v_bill;
      exit;
    exception when unique_violation then
      -- Código repetido: se intenta con otro.
    end;
  end loop;

  insert into public.mm_bill_members (bill_id, user_id, name, color, is_host, added_by)
  values (v_bill, v_me.id, v_me.name, v_me.color, true, v_me.id)
  returning id into v_member;

  update public.mm_bills set payer_member_id = v_member where id = v_bill;

  insert into public.mm_events (user_id, name, props)
  values (v_me.id, 'bill_created', jsonb_build_object('bill_id', v_bill, 'total_cents', p_total_cents));

  return jsonb_build_object('id', v_bill, 'code', v_code);
end $$;

-- Lo mínimo para que quien abre el link sepa a qué lo invitan, antes de entrar
-- (se puede llamar sin sesión).
create or replace function public.mm_bill_preview(p_code text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'code', b.code,
    'title', b.title,
    'currency', b.currency,
    'total_cents', b.total_cents + b.tip_cents,
    'status', b.status,
    'host_name', h.name,
    'host_color', h.color,
    'member_count', (select count(*) from public.mm_bill_members m where m.bill_id = b.id),
    'is_member', exists (select 1 from public.mm_bill_members m where m.bill_id = b.id and m.user_id = auth.uid())
  )
  from public.mm_bills b
  join public.mm_profiles h on h.id = b.host_id
  where b.code = upper(btrim(p_code));
$$;

create or replace function public.mm_join_bill(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me   public.mm_profiles := public.mm_my_profile();
  v_bill public.mm_bills;
begin
  select * into v_bill from public.mm_bills where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'mm:bill_not_found';
  end if;

  if exists (select 1 from public.mm_bill_members where bill_id = v_bill.id and user_id = v_me.id) then
    return jsonb_build_object('id', v_bill.id, 'code', v_bill.code);
  end if;

  if v_bill.status <> 'open' then
    raise exception 'mm:bill_%', v_bill.status;  -- bill_locked | bill_settled | bill_cancelled
  end if;
  if (select count(*) from public.mm_bill_members where bill_id = v_bill.id) >= 30 then
    raise exception 'mm:bill_full';
  end if;

  insert into public.mm_bill_members (bill_id, user_id, name, color, added_by)
  values (v_bill.id, v_me.id, v_me.name, v_me.color, v_me.id);
  perform public.mm_bump(v_bill.id);

  insert into public.mm_events (user_id, name, props)
  values (v_me.id, 'bill_joined', jsonb_build_object('bill_id', v_bill.id));

  return jsonb_build_object('id', v_bill.id, 'code', v_bill.code);
end $$;

-- Todo lo de una cuenta en una sola foto consistente: la cuenta, quiénes están,
-- los productos, quién marcó qué, las deudas y los pagos por confirmar.
create or replace function public.mm_get_bill(p_code text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public.mm_uid();
  v_bill public.mm_bills;
  v_me   public.mm_bill_members;
  v_payer public.mm_bill_members;
begin
  select * into v_bill from public.mm_bills where code = upper(btrim(p_code));
  if not found then
    raise exception 'mm:bill_not_found';
  end if;
  select * into v_me from public.mm_bill_members where bill_id = v_bill.id and user_id = v_uid;
  if not found then
    raise exception 'mm:not_member';
  end if;
  select * into v_payer from public.mm_bill_members where id = v_bill.payer_member_id;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'me', jsonb_build_object('member_id', v_me.id, 'is_host', v_me.is_host),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'user_id', m.user_id, 'name', m.name, 'color', m.color, 'is_host', m.is_host,
        'custom_cents', m.custom_cents, 'share_cents', m.share_cents, 'joined_at', m.joined_at
      ) order by m.joined_at, m.id)
      from public.mm_bill_members m where m.bill_id = v_bill.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'price_cents', i.price_cents, 'added_by', i.added_by
      ) order by i.position, i.created_at, i.id)
      from public.mm_bill_items i where i.bill_id = v_bill.id
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', c.item_id, 'member_id', c.member_id))
      from public.mm_item_claims c where c.bill_id = v_bill.id
    ), '[]'::jsonb),
    'debts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'member_id', d.member_id, 'debtor_id', d.debtor_id, 'debtor_name', d.debtor_name,
        'creditor_id', d.creditor_id, 'creditor_name', d.creditor_name, 'amount_cents', d.amount_cents,
        'status', d.status, 'settlement_id', d.settlement_id, 'settled_at', d.settled_at,
        -- El link para reclamar la parte de alguien sin la app: solo para quien cobra.
        'link_token', case when d.creditor_id = v_uid or v_me.is_host then d.link_token end
      ) order by m.joined_at nulls last, d.created_at, d.id)
      from public.mm_debts d
      left join public.mm_bill_members m on m.id = d.member_id
      where d.bill_id = v_bill.id and d.status <> 'cancelled'
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'from_id', s.from_id, 'from_name', s.from_name, 'to_id', s.to_id,
        'amount_cents', s.amount_cents, 'method', s.method, 'status', s.status, 'created_at', s.created_at
      ) order by s.created_at)
      from public.mm_settlements s
      where s.status = 'reported'
        and (s.from_id = v_uid or s.to_id = v_uid)
        and exists (select 1 from public.mm_debts d where d.settlement_id = s.id and d.bill_id = v_bill.id)
    ), '[]'::jsonb),
    'payer', case when v_payer.id is null then null else jsonb_build_object(
      'member_id', v_payer.id, 'user_id', v_payer.user_id, 'name', v_payer.name, 'color', v_payer.color,
      'pay_methods', coalesce((select p.pay_methods from public.mm_profiles p where p.id = v_payer.user_id), '[]'::jsonb)
    ) end
  );
end $$;

-- ─── Cuentas: armar la división (solo mientras está abierta) ──

-- Bloquea la cuenta y verifica que quien llama sea el anfitrión y que todavía
-- se pueda editar.
create or replace function public.mm_host_open_bill(p_bill uuid)
returns public.mm_bills
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bill public.mm_bills;
begin
  select * into v_bill from public.mm_bills where id = p_bill for update;
  if not found then
    raise exception 'mm:bill_not_found';
  end if;
  if v_bill.host_id <> public.mm_uid() then
    raise exception 'mm:not_host';
  end if;
  if v_bill.status <> 'open' then
    raise exception 'mm:bill_not_open';
  end if;
  return v_bill;
end $$;

create or replace function public.mm_update_bill(
  p_bill uuid,
  p_title text default null,
  p_total_cents integer default null,
  p_tip_cents integer default null,
  p_split_mode text default null,
  p_payer_member_id uuid default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.mm_bills := public.mm_host_open_bill(p_bill);
begin
  if p_title is not null and char_length(btrim(p_title)) not between 1 and 40 then
    raise exception 'mm:invalid_title';
  end if;
  if p_total_cents is not null and p_total_cents not between 1 and 100000000 then
    raise exception 'mm:invalid_amount';
  end if;
  if p_tip_cents is not null and p_tip_cents not between 0 and 100000000 then
    raise exception 'mm:invalid_amount';
  end if;
  if p_split_mode is not null and p_split_mode not in ('equal', 'amounts', 'items') then
    raise exception 'mm:invalid_mode';
  end if;
  if p_payer_member_id is not null and not exists (
    select 1 from public.mm_bill_members
    where id = p_payer_member_id and bill_id = p_bill and user_id is not null
  ) then
    raise exception 'mm:invalid_payer';
  end if;

  update public.mm_bills set
    title = coalesce(btrim(p_title), title),
    total_cents = coalesce(p_total_cents, total_cents),
    tip_cents = coalesce(p_tip_cents, tip_cents),
    split_mode = coalesce(p_split_mode, split_mode),
    payer_member_id = coalesce(p_payer_member_id, payer_member_id)
  where id = v_bill.id;
  perform public.mm_bump(v_bill.id);
end $$;

-- Alguien que está en la mesa pero no va a abrir el link (la abuela, el que
-- no tiene datos): el anfitrión lo agrega con su nombre.
create or replace function public.mm_add_guest(p_bill uuid, p_name text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.mm_bills := public.mm_host_open_bill(p_bill);
  v_name text := btrim(coalesce(p_name, ''));
  v_id   uuid;
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'mm:invalid_name';
  end if;
  if (select count(*) from public.mm_bill_members where bill_id = v_bill.id) >= 30 then
    raise exception 'mm:bill_full';
  end if;
  insert into public.mm_bill_members (bill_id, user_id, name, color, added_by)
  values (v_bill.id, null, v_name, public.mm_color_for(v_name), v_bill.host_id)
  returning id into v_id;
  perform public.mm_bump(v_bill.id);
  return v_id;
end $$;

-- El anfitrión saca a alguien, o alguien se sale solo (no el anfitrión).
create or replace function public.mm_remove_member(p_member uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public.mm_uid();
  v_member public.mm_bill_members;
  v_bill   public.mm_bills;
begin
  select * into v_member from public.mm_bill_members where id = p_member;
  if not found then
    raise exception 'mm:member_not_found';
  end if;
  select * into v_bill from public.mm_bills where id = v_member.bill_id for update;
  if v_bill.status <> 'open' then
    raise exception 'mm:bill_not_open';
  end if;
  if v_member.is_host then
    raise exception 'mm:cannot_remove_host';
  end if;
  if v_bill.host_id <> v_uid and v_member.user_id is distinct from v_uid then
    raise exception 'mm:not_host';
  end if;

  if v_bill.payer_member_id = v_member.id then
    update public.mm_bills
    set payer_member_id = (select id from public.mm_bill_members where bill_id = v_bill.id and is_host)
    where id = v_bill.id;
  end if;
  delete from public.mm_bill_members where id = v_member.id;
  perform public.mm_bump(v_bill.id);
end $$;

-- "Montos diferentes": el anfitrión va guardando el borrador para que todos
-- vean en vivo cuánto les toca. p_amounts = {"<member_id>": centavos}.
create or replace function public.mm_set_amounts(p_bill uuid, p_amounts jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.mm_bills := public.mm_host_open_bill(p_bill);
begin
  if p_amounts is null or jsonb_typeof(p_amounts) <> 'object' then
    raise exception 'mm:invalid_amount';
  end if;
  if exists (
    select 1 from jsonb_each(p_amounts) e
    where case
      when jsonb_typeof(e.value) <> 'number' then true
      else (e.value)::numeric < 0 or (e.value)::numeric <> trunc((e.value)::numeric)
    end
  ) then
    raise exception 'mm:invalid_amount';
  end if;

  update public.mm_bill_members m
  set custom_cents = (p_amounts ->> m.id::text)::integer
  where m.bill_id = v_bill.id;
  update public.mm_bills set split_mode = 'amounts' where id = v_bill.id;
  perform public.mm_bump(v_bill.id);
end $$;

-- ─── Cuentas: productos ("lo que pidió cada uno") ─────────────

-- Cualquiera en la mesa puede agregar lo que pidió; el anfitrión, todo.
create or replace function public.mm_member_open_bill(p_bill uuid)
returns public.mm_bill_members
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bill   public.mm_bills;
  v_member public.mm_bill_members;
begin
  select * into v_bill from public.mm_bills where id = p_bill for update;
  if not found then
    raise exception 'mm:bill_not_found';
  end if;
  select * into v_member from public.mm_bill_members where bill_id = p_bill and user_id = public.mm_uid();
  if not found then
    raise exception 'mm:not_member';
  end if;
  if v_bill.status <> 'open' then
    raise exception 'mm:bill_not_open';
  end if;
  return v_member;
end $$;

create or replace function public.mm_add_items(p_bill uuid, p_items jsonb, p_claim boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.mm_bill_members := public.mm_member_open_bill(p_bill);
  v_item   jsonb;
  v_name   text;
  v_price  integer;
  v_pos    integer;
  v_id     uuid;
  v_ids    jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'mm:invalid_item';
  end if;
  if (select count(*) from public.mm_bill_items where bill_id = p_bill) + jsonb_array_length(p_items) > 200 then
    raise exception 'mm:too_many_items';
  end if;
  select coalesce(max(position), 0) into v_pos from public.mm_bill_items where bill_id = p_bill;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_name := btrim(coalesce(v_item ->> 'name', ''));
    begin
      v_price := (v_item ->> 'price_cents')::integer;
    exception when others then
      raise exception 'mm:invalid_item';
    end;
    if char_length(v_name) not between 1 and 60 or v_price is null or v_price not between 1 and 100000000 then
      raise exception 'mm:invalid_item';
    end if;
    v_pos := v_pos + 1;
    insert into public.mm_bill_items (bill_id, name, price_cents, added_by, position)
    values (p_bill, v_name, v_price, v_member.user_id, v_pos)
    returning id into v_id;
    if p_claim then
      insert into public.mm_item_claims (item_id, member_id, bill_id) values (v_id, v_member.id, p_bill);
    end if;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;

  update public.mm_bills set split_mode = 'items' where id = p_bill and split_mode <> 'items';
  perform public.mm_bump(p_bill);
  return v_ids;
end $$;

create or replace function public.mm_update_item(p_item uuid, p_name text, p_price_cents integer)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_item   public.mm_bill_items;
  v_member public.mm_bill_members;
begin
  select * into v_item from public.mm_bill_items where id = p_item;
  if not found then
    raise exception 'mm:item_not_found';
  end if;
  v_member := public.mm_member_open_bill(v_item.bill_id);
  if not v_member.is_host and v_item.added_by is distinct from v_member.user_id then
    raise exception 'mm:not_allowed';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 or p_price_cents is null or p_price_cents not between 1 and 100000000 then
    raise exception 'mm:invalid_item';
  end if;
  update public.mm_bill_items set name = btrim(p_name), price_cents = p_price_cents where id = p_item;
  perform public.mm_bump(v_item.bill_id);
end $$;

create or replace function public.mm_delete_item(p_item uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_item   public.mm_bill_items;
  v_member public.mm_bill_members;
begin
  select * into v_item from public.mm_bill_items where id = p_item;
  if not found then
    raise exception 'mm:item_not_found';
  end if;
  v_member := public.mm_member_open_bill(v_item.bill_id);
  if not v_member.is_host and v_item.added_by is distinct from v_member.user_id then
    raise exception 'mm:not_allowed';
  end if;
  delete from public.mm_bill_items where id = p_item;
  perform public.mm_bump(v_item.bill_id);
end $$;

-- Marcar (o desmarcar) que alguien comió de un producto. Cada quien marca lo
-- suyo; el anfitrión puede marcar por cualquiera. p_member null = todos
-- ("lo compartimos entre todos"), solo el anfitrión.
create or replace function public.mm_set_claim(p_item uuid, p_member uuid, p_on boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_item   public.mm_bill_items;
  v_me     public.mm_bill_members;
  v_target public.mm_bill_members;
begin
  select * into v_item from public.mm_bill_items where id = p_item;
  if not found then
    raise exception 'mm:item_not_found';
  end if;
  v_me := public.mm_member_open_bill(v_item.bill_id);

  if p_member is null then
    if not v_me.is_host then
      raise exception 'mm:not_host';
    end if;
    if p_on then
      insert into public.mm_item_claims (item_id, member_id, bill_id)
      select p_item, m.id, v_item.bill_id from public.mm_bill_members m where m.bill_id = v_item.bill_id
      on conflict do nothing;
    else
      delete from public.mm_item_claims where item_id = p_item;
    end if;
  else
    select * into v_target from public.mm_bill_members where id = p_member and bill_id = v_item.bill_id;
    if not found then
      raise exception 'mm:member_not_found';
    end if;
    if v_target.id <> v_me.id and not v_me.is_host then
      raise exception 'mm:not_allowed';
    end if;
    if p_on then
      insert into public.mm_item_claims (item_id, member_id, bill_id)
      values (p_item, v_target.id, v_item.bill_id)
      on conflict do nothing;
    else
      delete from public.mm_item_claims where item_id = p_item and member_id = v_target.id;
    end if;
  end if;
  perform public.mm_bump(v_item.bill_id);
end $$;

-- ─── Cuentas: dividir, corregir, cancelar ─────────────────────

-- El anfitrión cierra la división. La app calcula las partes (la misma lógica
-- que todos ven en vivo) y aquí se verifica que sean de la versión que se
-- estaba mirando, que estén todos y que sumen exacto. Cada uno queda debiendo
-- su parte a quien pagó la cuenta en el local.
create or replace function public.mm_lock_bill(p_bill uuid, p_version integer, p_shares jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bill   public.mm_bills := public.mm_host_open_bill(p_bill);
  v_payer  public.mm_bill_members;
  v_member public.mm_bill_members;
  v_share  integer;
  v_sum    bigint := 0;
  v_debt   uuid;
  v_count  integer := 0;
begin
  if v_bill.version <> p_version then
    raise exception 'mm:stale';
  end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'mm:invalid_amount';
  end if;
  if (select count(*) from jsonb_object_keys(p_shares)) <> (select count(*) from public.mm_bill_members where bill_id = p_bill) then
    raise exception 'mm:members_changed';
  end if;
  if (select count(*) from public.mm_bill_members where bill_id = p_bill) < 2 then
    raise exception 'mm:need_two';
  end if;

  select * into v_payer from public.mm_bill_members where id = v_bill.payer_member_id;
  if not found or v_payer.user_id is null then
    select * into v_payer from public.mm_bill_members where bill_id = p_bill and is_host;
  end if;

  for v_member in select * from public.mm_bill_members where bill_id = p_bill order by joined_at loop
    if not (p_shares ? v_member.id::text) or jsonb_typeof(p_shares -> v_member.id::text) <> 'number' then
      raise exception 'mm:members_changed';
    end if;
    v_share := (p_shares ->> v_member.id::text)::numeric;
    if v_share < 0 or v_share::numeric <> (p_shares ->> v_member.id::text)::numeric then
      raise exception 'mm:invalid_amount';
    end if;
    v_sum := v_sum + v_share;
  end loop;
  if v_sum <> v_bill.total_cents + v_bill.tip_cents then
    raise exception 'mm:sum_mismatch';
  end if;

  for v_member in select * from public.mm_bill_members where bill_id = p_bill order by joined_at loop
    v_share := (p_shares ->> v_member.id::text)::integer;
    update public.mm_bill_members set share_cents = v_share where id = v_member.id;
    if v_member.id <> v_payer.id and v_share > 0 then
      insert into public.mm_debts (
        kind, bill_id, member_id, debtor_id, debtor_name, creditor_id, creditor_name,
        amount_cents, currency, concept, status, link_token, created_by
      ) values (
        'bill', p_bill, v_member.id, v_member.user_id, v_member.name, v_payer.user_id, v_payer.name,
        v_share, v_bill.currency, v_bill.title, 'open',
        public.mm_random_code(12, 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'), v_bill.host_id
      ) returning id into v_debt;
      v_count := v_count + 1;
      perform public.mm_notify(
        v_member.user_id, 'bill_split', v_bill.host_id,
        (select name from public.mm_profiles where id = v_bill.host_id),
        v_share, v_bill.currency, p_bill, v_debt, null, v_bill.title,
        jsonb_build_object('creditor_name', v_payer.name, 'code', v_bill.code)
      );
    end if;
  end loop;

  update public.mm_bills
  set status = case when v_count = 0 then 'settled' else 'locked' end,
      payer_member_id = v_payer.id,
      locked_at = now(),
      settled_at = case when v_count = 0 then now() end
  where id = p_bill;
  perform public.mm_bump(p_bill);

  insert into public.mm_events (user_id, name, props)
  values (v_bill.host_id, 'bill_locked', jsonb_build_object(
    'bill_id', p_bill, 'mode', v_bill.split_mode,
    'members', (select count(*) from public.mm_bill_members where bill_id = p_bill),
    'seconds', extract(epoch from now() - v_bill.created_at)::integer
  ));
end $$;

-- Corregir después de dividir: vuelve a quedar abierta para cambiar montos o
-- sumar a alguien. Solo si nadie ha pagado todavía.
create or replace function public.mm_unlock_bill(p_bill uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public.mm_uid();
  v_bill public.mm_bills;
  v_debt public.mm_debts;
begin
  select * into v_bill from public.mm_bills where id = p_bill for update;
  if not found then
    raise exception 'mm:bill_not_found';
  end if;
  if v_bill.host_id <> v_uid then
    raise exception 'mm:not_host';
  end if;
  if v_bill.status <> 'locked' then
    raise exception 'mm:bill_not_locked';
  end if;
  if exists (select 1 from public.mm_debts where bill_id = p_bill and status in ('reported', 'settled', 'forgiven')) then
    raise exception 'mm:has_payments';
  end if;

  for v_debt in select * from public.mm_debts where bill_id = p_bill loop
    perform public.mm_notify(v_debt.debtor_id, 'bill_reopened', v_uid,
      (select name from public.mm_profiles where id = v_uid), v_debt.amount_cents, v_debt.currency,
      p_bill, null, null, v_bill.title, jsonb_build_object('code', v_bill.code));
  end loop;
  delete from public.mm_debts where bill_id = p_bill;
  update public.mm_bill_members set share_cents = null where bill_id = p_bill;
  update public.mm_bills set status = 'open', locked_at = null where id = p_bill;
  perform public.mm_bump(p_bill);
end $$;

create or replace function public.mm_cancel_bill(p_bill uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public.mm_uid();
  v_bill public.mm_bills;
  v_m    public.mm_bill_members;
begin
  select * into v_bill from public.mm_bills where id = p_bill for update;
  if not found then
    raise exception 'mm:bill_not_found';
  end if;
  if v_bill.host_id <> v_uid then
    raise exception 'mm:not_host';
  end if;
  if v_bill.status not in ('open', 'locked') then
    raise exception 'mm:bill_not_open';
  end if;
  if exists (select 1 from public.mm_debts where bill_id = p_bill and status in ('reported', 'settled', 'forgiven')) then
    raise exception 'mm:has_payments';
  end if;

  for v_m in select * from public.mm_bill_members where bill_id = p_bill and user_id is not null loop
    perform public.mm_notify(v_m.user_id, 'bill_cancelled', v_uid,
      (select name from public.mm_profiles where id = v_uid), null, v_bill.currency,
      p_bill, null, null, v_bill.title, jsonb_build_object('code', v_bill.code));
  end loop;
  update public.mm_debts set status = 'cancelled' where bill_id = p_bill;
  update public.mm_bills set status = 'cancelled' where id = p_bill;
  perform public.mm_bump(p_bill);
end $$;

-- ─── Deudas anotadas a mano (préstamos con link) ─────────────

create or replace function public.mm_create_debt(
  p_direction text,
  p_amount_cents integer,
  p_concept text default null,
  p_currency text default 'USD'
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me      public.mm_profiles := public.mm_my_profile();
  v_lent    boolean;
  v_token   text;
  v_id      uuid;
  v_concept text := nullif(btrim(coalesce(p_concept, '')), '');
begin
  if p_direction not in ('lent', 'borrowed') then
    raise exception 'mm:invalid_direction';
  end if;
  if p_amount_cents is null or p_amount_cents not between 1 and 100000000 then
    raise exception 'mm:invalid_amount';
  end if;
  if v_concept is not null and char_length(v_concept) > 40 then
    raise exception 'mm:invalid_concept';
  end if;
  v_lent := p_direction = 'lent';

  loop
    v_token := public.mm_random_code(12, 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789');
    begin
      insert into public.mm_debts (
        kind, debtor_id, debtor_name, creditor_id, creditor_name, amount_cents, currency,
        concept, status, link_token, created_by
      ) values (
        'direct',
        case when v_lent then null else v_me.id end,
        case when v_lent then '' else v_me.name end,
        case when v_lent then v_me.id else null end,
        case when v_lent then v_me.name else '' end,
        p_amount_cents, upper(coalesce(p_currency, 'USD')), v_concept, 'pending', v_token, v_me.id
      ) returning id into v_id;
      exit;
    exception when unique_violation then
      -- Token repetido: otro intento.
    end;
  end loop;

  insert into public.mm_events (user_id, name, props)
  values (v_me.id, 'debt_link_created', jsonb_build_object('debt_id', v_id, 'direction', p_direction, 'amount_cents', p_amount_cents));

  return jsonb_build_object('id', v_id, 'link_token', v_token);
end $$;

-- Lo que ve quien abre el link de una deuda (se puede llamar sin sesión).
create or replace function public.mm_debt_preview(p_token text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', d.id,
    'kind', d.kind,
    'status', d.status,
    'amount_cents', d.amount_cents,
    'currency', d.currency,
    'concept', d.concept,
    'created_at', d.created_at,
    -- En una anotada a mano, quien la anotó; en la de una cuenta, quien cobra.
    'creator_is_creditor', case when d.kind = 'bill' then true else d.creditor_id is not distinct from d.created_by end,
    'creator_name', case when d.kind = 'bill' or d.creditor_id is not distinct from d.created_by then d.creditor_name else d.debtor_name end,
    'creator_color', (select p.color from public.mm_profiles p
                      where p.id = case when d.kind = 'bill' then d.creditor_id else d.created_by end),
    'counterpart_name', case when d.kind = 'bill' or d.creditor_id is not distinct from d.created_by then nullif(d.debtor_name, '') else nullif(d.creditor_name, '') end,
    -- Ya lo tomó alguien (en una de cuenta: quien estaba sin la app ya entró).
    'claimed', d.debtor_id is not null and d.creditor_id is not null,
    'bill', case when d.kind = 'bill' then (
      select jsonb_build_object('title', b.title, 'code', b.code) from public.mm_bills b where b.id = d.bill_id
    ) end,
    'viewer', case
      when auth.uid() is null then 'anon'
      when (d.kind = 'direct' and d.created_by = auth.uid()) or (d.kind = 'bill' and d.creditor_id = auth.uid()) then 'creator'
      when d.debtor_id = auth.uid() or d.creditor_id = auth.uid() then 'counterparty'
      else 'other'
    end,
    -- Para pagar hace falta saber cómo: los datos de quien cobra.
    'pay_methods', coalesce((select p.pay_methods from public.mm_profiles p where p.id = d.creditor_id), '[]'::jsonb)
  )
  from public.mm_debts d
  where d.link_token = btrim(p_token);
$$;

create or replace function public.mm_respond_debt(p_token text, p_accept boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me     public.mm_profiles := public.mm_my_profile();
  v_debt   public.mm_debts;
  v_member public.mm_bill_members;
begin
  select * into v_debt from public.mm_debts where link_token = btrim(p_token) for update;
  if not found then
    raise exception 'mm:debt_not_found';
  end if;

  -- Ya respondida por mí: no falla (doble toque, otra pestaña).
  if v_debt.status <> 'pending' and (v_debt.debtor_id = v_me.id or v_debt.creditor_id = v_me.id)
     and v_debt.created_by <> v_me.id and v_debt.kind = 'direct' then
    return jsonb_build_object('id', v_debt.id, 'status', v_debt.status);
  end if;

  if v_debt.kind = 'bill' then
    -- La parte de alguien que estaba en la mesa sin la app: al abrir el link
    -- se queda con ella (y con la cuenta).
    if v_debt.debtor_id = v_me.id then
      return jsonb_build_object('id', v_debt.id, 'status', v_debt.status);
    end if;
    if v_debt.creditor_id = v_me.id then
      raise exception 'mm:own_link';
    end if;
    if v_debt.debtor_id is not null then
      raise exception 'mm:link_used';
    end if;
    if v_debt.status not in ('open', 'reported') then
      raise exception 'mm:link_closed';
    end if;
    if not p_accept then
      raise exception 'mm:cannot_decline';
    end if;
    if exists (select 1 from public.mm_bill_members where bill_id = v_debt.bill_id and user_id = v_me.id) then
      raise exception 'mm:already_member';
    end if;
    update public.mm_debts set debtor_id = v_me.id, responded_at = now() where id = v_debt.id;
    select * into v_member from public.mm_bill_members where id = v_debt.member_id;
    if found and v_member.user_id is null then
      update public.mm_bill_members set user_id = v_me.id where id = v_member.id;
    end if;
    perform public.mm_notify(v_debt.creditor_id, 'guest_claimed', v_me.id, v_me.name,
      v_debt.amount_cents, v_debt.currency, v_debt.bill_id, v_debt.id, null, v_debt.concept,
      jsonb_build_object('guest_name', v_debt.debtor_name));
    perform public.mm_bump(v_debt.bill_id);
    return jsonb_build_object('id', v_debt.id, 'status', v_debt.status);
  end if;

  if v_debt.created_by = v_me.id then
    raise exception 'mm:own_link';
  end if;
  if v_debt.status = 'cancelled' then
    raise exception 'mm:link_cancelled';
  end if;
  if v_debt.status <> 'pending' then
    raise exception 'mm:link_used';
  end if;

  if v_debt.debtor_id is null then
    update public.mm_debts set debtor_id = v_me.id, debtor_name = v_me.name where id = v_debt.id;
  else
    update public.mm_debts set creditor_id = v_me.id, creditor_name = v_me.name where id = v_debt.id;
  end if;
  update public.mm_debts
  set status = case when p_accept then 'open' else 'declined' end, responded_at = now()
  where id = v_debt.id;

  perform public.mm_notify(v_debt.created_by,
    case when p_accept then 'link_accepted' else 'link_declined' end,
    v_me.id, v_me.name, v_debt.amount_cents, v_debt.currency, null, v_debt.id, null, v_debt.concept,
    jsonb_build_object('creator_lent', v_debt.creditor_id is not distinct from v_debt.created_by));

  insert into public.mm_events (user_id, name, props)
  values (v_me.id, case when p_accept then 'debt_link_accepted' else 'debt_link_declined' end, jsonb_build_object('debt_id', v_debt.id));

  return jsonb_build_object('id', v_debt.id, 'status', case when p_accept then 'open' else 'declined' end);
end $$;

create or replace function public.mm_cancel_debt(p_debt uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_debt public.mm_debts;
begin
  select * into v_debt from public.mm_debts where id = p_debt for update;
  if not found or v_debt.kind <> 'direct' or v_debt.created_by <> public.mm_uid() then
    raise exception 'mm:debt_not_found';
  end if;
  if v_debt.status <> 'pending' then
    raise exception 'mm:link_used';
  end if;
  update public.mm_debts set status = 'cancelled' where id = p_debt;
end $$;

-- ─── Pagos: "ya te pagué", "recibido", "ya me pagó" ───────────

-- Revisa que un grupo de deudas sea entre quien llama y una sola otra persona
-- (o un mismo invitado sin la app) y devuelve cuánto le debe quien llama en
-- neto (positivo) o cuánto le deben (negativo).
create or replace function public.mm_pair_net(p_debt_ids uuid[], p_statuses text[])
returns table (net bigint, other_id uuid, other_name text, other_key text, currency text)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public.mm_uid();
  v_rows integer;
begin
  if p_debt_ids is null or array_length(p_debt_ids, 1) is null then
    raise exception 'mm:invalid_debts';
  end if;
  perform 1 from public.mm_debts where id = any (p_debt_ids) for update;
  get diagnostics v_rows = row_count;
  if v_rows <> (select count(distinct x) from unnest(p_debt_ids) x) then
    raise exception 'mm:invalid_debts';
  end if;
  if exists (
    select 1 from public.mm_debts
    where id = any (p_debt_ids)
      and (status <> all (p_statuses) or (debtor_id is distinct from v_uid and creditor_id is distinct from v_uid))
  ) then
    raise exception 'mm:invalid_debts';
  end if;

  return query
  with sides as (
    select
      case when d.debtor_id = v_uid then d.amount_cents else -d.amount_cents end as delta,
      case when d.debtor_id = v_uid then d.creditor_id else d.debtor_id end as oid,
      case when d.debtor_id = v_uid then d.creditor_name else d.debtor_name end as oname,
      case
        when d.debtor_id = v_uid then coalesce(d.creditor_id::text, 'debt:' || d.id)
        else coalesce(d.debtor_id::text, 'member:' || coalesce(d.member_id::text, d.id::text))
      end as okey,
      d.currency as cur
    from public.mm_debts d
    where d.id = any (p_debt_ids)
  )
  select sum(delta)::bigint, (array_agg(oid))[1], (array_agg(oname))[1], min(okey), min(cur)
  from sides
  having count(distinct okey) = 1 and count(distinct cur) = 1;

  if not found then
    raise exception 'mm:invalid_debts';
  end if;
end $$;

-- Si un pago cubre deudas de una sola cuenta, su código (para que el aviso
-- lleve directo a esa cuenta). Si mezcla cuentas o préstamos, null.
create or replace function public.mm_debts_bill_code(p_debt_ids uuid[])
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select case when count(*) > 0 and count(*) = count(d.bill_id) and count(distinct d.bill_id) = 1
              then min(b.code) end
  from public.mm_debts d
  left join public.mm_bills b on b.id = d.bill_id
  where d.id = any (p_debt_ids);
$$;

-- Quien debe avisa que pagó (por transferencia, Deuna, efectivo…). Puede
-- abarcar varias deudas con la misma persona: se paga el neto.
create or replace function public.mm_report_payment(p_debt_ids uuid[], p_method text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me   public.mm_profiles := public.mm_my_profile();
  v_pair record;
  v_id   uuid;
  v_bill uuid;
  v_title text;
begin
  if p_method is null or p_method not in ('transfer', 'deuna', 'payphone', 'cash', 'other') then
    raise exception 'mm:invalid_method';
  end if;
  select * into v_pair from public.mm_pair_net(p_debt_ids, array['open']);
  if v_pair.net <= 0 then
    raise exception 'mm:nothing_to_pay';
  end if;
  if v_pair.other_id is null then
    raise exception 'mm:invalid_debts';
  end if;

  insert into public.mm_settlements (from_id, from_name, to_id, to_name, amount_cents, currency, method, status, debt_ids, created_by)
  values (v_me.id, v_me.name, v_pair.other_id, v_pair.other_name, v_pair.net, v_pair.currency, p_method, 'reported', p_debt_ids, v_me.id)
  returning id into v_id;
  update public.mm_debts set status = 'reported', settlement_id = v_id where id = any (p_debt_ids);

  select case when count(*) = count(bill_id) and count(distinct bill_id) = 1 then min(bill_id::text)::uuid end,
         case when count(*) = 1 then min(concept) end
  into v_bill, v_title
  from public.mm_debts where id = any (p_debt_ids);

  perform public.mm_notify(v_pair.other_id, 'payment_reported', v_me.id, v_me.name, v_pair.net::integer,
    v_pair.currency, v_bill, null, v_id, v_title,
    jsonb_strip_nulls(jsonb_build_object('method', p_method, 'code', public.mm_debts_bill_code(p_debt_ids))));
  perform public.mm_bump(b) from (select distinct bill_id as b from public.mm_debts where id = any (p_debt_ids) and bill_id is not null) x;

  insert into public.mm_events (user_id, name, props)
  values (v_me.id, 'payment_reported', jsonb_build_object('settlement_id', v_id, 'method', p_method, 'amount_cents', v_pair.net));
  return v_id;
end $$;

create or replace function public.mm_settle_debts(p_settlement uuid)
returns void
language sql
set search_path = public, pg_temp
as $$
  update public.mm_debts set status = 'settled', settled_at = now()
  where settlement_id = p_settlement and status = 'reported';
$$;

create or replace function public.mm_confirm_settlement(p_settlement uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me public.mm_profiles := public.mm_my_profile();
  v_s  public.mm_settlements;
begin
  select * into v_s from public.mm_settlements where id = p_settlement for update;
  if not found or v_s.to_id is distinct from v_me.id then
    raise exception 'mm:settlement_not_found';
  end if;
  if v_s.status = 'confirmed' then
    return;
  end if;
  if v_s.status <> 'reported' then
    raise exception 'mm:settlement_closed';
  end if;
  update public.mm_settlements set status = 'confirmed', resolved_at = now() where id = p_settlement;
  perform public.mm_settle_debts(p_settlement);
  perform public.mm_notify(v_s.from_id, 'payment_confirmed', v_me.id, v_me.name, v_s.amount_cents, v_s.currency,
    null, null, p_settlement, null,
    jsonb_strip_nulls(jsonb_build_object('method', v_s.method, 'code', public.mm_debts_bill_code(v_s.debt_ids))));
  perform public.mm_bump(b) from (select distinct bill_id as b from public.mm_debts where settlement_id = p_settlement and bill_id is not null) x;
end $$;

create or replace function public.mm_reject_settlement(p_settlement uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me public.mm_profiles := public.mm_my_profile();
  v_s  public.mm_settlements;
begin
  select * into v_s from public.mm_settlements where id = p_settlement for update;
  if not found or v_s.to_id is distinct from v_me.id then
    raise exception 'mm:settlement_not_found';
  end if;
  if v_s.status <> 'reported' then
    raise exception 'mm:settlement_closed';
  end if;
  update public.mm_settlements set status = 'rejected', resolved_at = now() where id = p_settlement;
  perform public.mm_bump(b) from (select distinct bill_id as b from public.mm_debts where settlement_id = p_settlement and bill_id is not null) x;
  update public.mm_debts set status = 'open', settlement_id = null where settlement_id = p_settlement and status = 'reported';
  perform public.mm_notify(v_s.from_id, 'payment_rejected', v_me.id, v_me.name, v_s.amount_cents, v_s.currency,
    null, null, p_settlement, null,
    jsonb_strip_nulls(jsonb_build_object('method', v_s.method, 'code', public.mm_debts_bill_code(v_s.debt_ids))));
end $$;

-- Quien cobra anota que ya le pagaron (en efectivo, o le llegó y nadie avisó).
-- Si el otro ya había avisado, confirma ese aviso.
create or replace function public.mm_mark_received(p_debt_ids uuid[], p_method text default 'cash')
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me    public.mm_profiles := public.mm_my_profile();
  v_pair  record;
  v_sid   uuid;
  v_open  uuid[];
  v_net   bigint;
  v_all   uuid[];
begin
  if p_method is null or p_method not in ('transfer', 'deuna', 'payphone', 'cash', 'other') then
    raise exception 'mm:invalid_method';
  end if;
  select * into v_pair from public.mm_pair_net(p_debt_ids, array['open', 'reported']);
  if v_pair.net > 0 then
    raise exception 'mm:you_owe';
  end if;

  -- Avisos de pago que ya estaban esperando: se confirman completos.
  for v_sid in
    select distinct settlement_id from public.mm_debts
    where id = any (p_debt_ids) and status = 'reported' and settlement_id is not null
  loop
    update public.mm_settlements set status = 'confirmed', resolved_at = now() where id = v_sid and status = 'reported';
    perform public.mm_settle_debts(v_sid);
  end loop;

  select array_agg(id) into v_open from public.mm_debts where id = any (p_debt_ids) and status = 'open';
  v_sid := null;
  if v_open is not null then
    select coalesce(sum(case when creditor_id = v_me.id then amount_cents else -amount_cents end), 0)
    into v_net from public.mm_debts where id = any (v_open);
    insert into public.mm_settlements (from_id, from_name, to_id, to_name, amount_cents, currency, method, status, debt_ids, created_by, resolved_at)
    values (v_pair.other_id, v_pair.other_name, v_me.id, v_me.name, greatest(v_net, 0), v_pair.currency, p_method, 'confirmed', v_open, v_me.id, now())
    returning id into v_sid;
    update public.mm_debts set status = 'settled', settled_at = now(), settlement_id = v_sid where id = any (v_open);
  end if;

  select array_agg(distinct bill_id) into v_all from public.mm_debts where id = any (p_debt_ids) and bill_id is not null;
  perform public.mm_bump(b) from unnest(coalesce(v_all, '{}'::uuid[])) b;
  perform public.mm_notify(v_pair.other_id, 'payment_marked', v_me.id, v_me.name, (-v_pair.net)::integer,
    v_pair.currency, null, null, v_sid, null,
    jsonb_strip_nulls(jsonb_build_object('method', p_method, 'code', public.mm_debts_bill_code(p_debt_ids))));

  insert into public.mm_events (user_id, name, props)
  values (v_me.id, 'payment_marked', jsonb_build_object('method', p_method, 'amount_cents', -v_pair.net));
  return v_sid;
end $$;

create or replace function public.mm_forgive(p_debt_ids uuid[])
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me    public.mm_profiles := public.mm_my_profile();
  v_pair  record;
  v_bills uuid[];
begin
  select * into v_pair from public.mm_pair_net(p_debt_ids, array['open']);
  if exists (select 1 from public.mm_debts where id = any (p_debt_ids) and creditor_id is distinct from v_me.id) then
    raise exception 'mm:invalid_debts';
  end if;
  update public.mm_debts set status = 'forgiven', settled_at = now() where id = any (p_debt_ids);
  select array_agg(distinct bill_id) into v_bills from public.mm_debts where id = any (p_debt_ids) and bill_id is not null;
  perform public.mm_bump(b) from unnest(coalesce(v_bills, '{}'::uuid[])) b;
  perform public.mm_notify(v_pair.other_id, 'debt_forgiven', v_me.id, v_me.name, (-v_pair.net)::integer,
    v_pair.currency, null, null, null, null,
    jsonb_strip_nulls(jsonb_build_object('code', public.mm_debts_bill_code(p_debt_ids))));
end $$;

-- Recordatorio dentro de la app (además del de WhatsApp). Como mucho uno cada
-- 20 horas a la misma persona: recordar no es acosar.
create or replace function public.mm_remind(p_other uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me  public.mm_profiles := public.mm_my_profile();
  v_net bigint;
  v_cur text;
begin
  select coalesce(sum(amount_cents), 0), min(currency) into v_net, v_cur
  from public.mm_debts
  where creditor_id = v_me.id and debtor_id = p_other and status = 'open';
  v_net := v_net - coalesce((
    select sum(amount_cents) from public.mm_debts
    where debtor_id = v_me.id and creditor_id = p_other and status = 'open'
  ), 0);
  if v_net <= 0 then
    raise exception 'mm:nothing_to_remind';
  end if;
  if exists (
    select 1 from public.mm_notifications
    where user_id = p_other and actor_id = v_me.id and kind = 'reminder' and created_at > now() - interval '20 hours'
  ) then
    return false;
  end if;
  perform public.mm_notify(p_other, 'reminder', v_me.id, v_me.name, v_net::integer, v_cur, null, null, null, null, '{}'::jsonb);
  return true;
end $$;

-- Cuando ya no queda nada por pagar en una cuenta, se cierra sola.
create or replace function public.mm_after_debt_status()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.mm_bills;
begin
  if new.bill_id is null or new.status = old.status then
    return new;
  end if;
  if new.status in ('settled', 'forgiven') and not exists (
    select 1 from public.mm_debts where bill_id = new.bill_id and status in ('open', 'reported')
  ) then
    update public.mm_bills set status = 'settled', settled_at = now()
    where id = new.bill_id and status = 'locked'
    returning * into v_bill;
    if found then
      perform public.mm_notify(new.creditor_id, 'bill_settled', null, null,
        v_bill.total_cents + v_bill.tip_cents, v_bill.currency, v_bill.id, null, null, v_bill.title,
        jsonb_build_object('code', v_bill.code));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists mm_debts_status_trg on public.mm_debts;
create trigger mm_debts_status_trg
  after update of status on public.mm_debts
  for each row execute function public.mm_after_debt_status();

-- ─── Lecturas para las pantallas ─────────────────────────────

-- Inicio: cuentas en curso, cuánto te deben y cuánto debes (neto por persona)
-- y lo último que pasó.
create or replace function public.mm_home()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.mm_uid();
begin
  return jsonb_build_object(
    'bills', coalesce((
      select jsonb_agg(x.j order by x.updated_at desc)
      from (
        select b.updated_at, jsonb_build_object(
          'code', b.code, 'title', b.title, 'status', b.status, 'currency', b.currency,
          'total_cents', b.total_cents + b.tip_cents, 'is_host', m.is_host,
          'member_count', (select count(*) from public.mm_bill_members mm where mm.bill_id = b.id),
          'i_am_payer', b.payer_member_id = m.id,
          'payer_name', (select p.name from public.mm_bill_members p where p.id = b.payer_member_id),
          'my_debt', (select jsonb_build_object('amount_cents', d.amount_cents, 'status', d.status)
                      from public.mm_debts d where d.bill_id = b.id and d.member_id = m.id and d.status <> 'cancelled' limit 1),
          'owed', case when b.payer_member_id = m.id then (
            select jsonb_build_object(
              'pending', count(*) filter (where d.status in ('open', 'reported')),
              'reported', count(*) filter (where d.status = 'reported'),
              'done', count(*) filter (where d.status in ('settled', 'forgiven')),
              'pending_cents', coalesce(sum(d.amount_cents) filter (where d.status in ('open', 'reported')), 0)
            ) from public.mm_debts d where d.bill_id = b.id and d.status <> 'cancelled'
          ) end,
          'updated_at', b.updated_at
        ) as j
        from public.mm_bills b
        join public.mm_bill_members m on m.bill_id = b.id and m.user_id = v_uid
        where b.status in ('open', 'locked')
           or (b.status = 'settled' and b.settled_at > now() - interval '3 days')
        order by b.updated_at desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'unread', (select count(*) from public.mm_notifications n where n.user_id = v_uid and n.read_at is null),
    'to_confirm', (select count(*) from public.mm_settlements s where s.to_id = v_uid and s.status = 'reported')
  );
end $$;

-- Saldos: todas tus deudas vivas (y lo reciente ya cerrado), los avisos de
-- pago por confirmar y lo necesario de cada persona (nombre, color y cómo
-- pagarle). La app arma el neto por persona.
create or replace function public.mm_ledger()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.mm_uid();
begin
  return jsonb_build_object(
    'debts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'bill_id', d.bill_id, 'member_id', d.member_id,
        'bill_code', b.code, 'bill_title', b.title, 'concept', d.concept,
        'debtor_id', d.debtor_id, 'debtor_name', d.debtor_name,
        'creditor_id', d.creditor_id, 'creditor_name', d.creditor_name,
        'amount_cents', d.amount_cents, 'currency', d.currency, 'status', d.status,
        'created_by', d.created_by, 'settlement_id', d.settlement_id,
        'link_token', case when d.created_by = v_uid or d.creditor_id = v_uid then d.link_token end,
        'created_at', d.created_at, 'responded_at', d.responded_at, 'settled_at', d.settled_at
      ) order by d.created_at desc)
      from public.mm_debts d
      left join public.mm_bills b on b.id = d.bill_id
      where (d.debtor_id = v_uid or d.creditor_id = v_uid or (d.kind = 'direct' and d.created_by = v_uid))
        and (
          d.status in ('pending', 'open', 'reported')
          or (d.status in ('settled', 'forgiven', 'declined') and coalesce(d.settled_at, d.responded_at, d.created_at) > now() - interval '180 days')
        )
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'from_id', s.from_id, 'from_name', s.from_name, 'to_id', s.to_id, 'to_name', s.to_name,
        'amount_cents', s.amount_cents, 'currency', s.currency, 'method', s.method, 'status', s.status,
        'debt_ids', to_jsonb(s.debt_ids), 'created_at', s.created_at, 'resolved_at', s.resolved_at
      ) order by s.created_at desc)
      from public.mm_settlements s
      where (s.from_id = v_uid or s.to_id = v_uid)
        and (s.status = 'reported' or s.created_at > now() - interval '180 days')
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object('name', p.name, 'color', p.color, 'pay_methods', p.pay_methods))
      from public.mm_profiles p
      where p.id <> v_uid and p.id in (
        select debtor_id from public.mm_debts where creditor_id = v_uid and debtor_id is not null
        union
        select creditor_id from public.mm_debts where debtor_id = v_uid and creditor_id is not null
      )
    ), '{}'::jsonb)
  );
end $$;

create or replace function public.mm_list_notifications(p_limit integer default 40)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(n) - 'user_id' order by n.id desc), '[]'::jsonb)
  from (
    select * from public.mm_notifications
    where user_id = auth.uid()
    order by id desc
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  ) n;
$$;

create or replace function public.mm_mark_read(p_up_to bigint default null)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update public.mm_notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_up_to is null or id <= p_up_to);
$$;

-- Métricas de producto (embudo, tiempos, viralidad). No guarda datos
-- personales: solo el nombre del evento y propiedades simples.
create or replace function public.mm_track(p_name text, p_props jsonb default '{}'::jsonb)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.mm_events (user_id, name, props)
  select auth.uid(), left(p_name, 60), coalesce(p_props, '{}'::jsonb)
  where char_length(coalesce(p_name, '')) between 1 and 60
    and pg_column_size(coalesce(p_props, '{}'::jsonb)) < 2000;
$$;

-- ─── Seguridad: RLS y permisos ───────────────────────────────

alter table public.mm_profiles enable row level security;
alter table public.mm_bills enable row level security;
alter table public.mm_bill_members enable row level security;
alter table public.mm_bill_items enable row level security;
alter table public.mm_item_claims enable row level security;
alter table public.mm_debts enable row level security;
alter table public.mm_settlements enable row level security;
alter table public.mm_notifications enable row level security;
alter table public.mm_events enable row level security;

drop policy if exists mm_profiles_read on public.mm_profiles;
create policy mm_profiles_read on public.mm_profiles for select to authenticated
  using (public.mm_knows(id));

drop policy if exists mm_bills_read on public.mm_bills;
create policy mm_bills_read on public.mm_bills for select to authenticated
  using (public.mm_member_of(id));

drop policy if exists mm_members_read on public.mm_bill_members;
create policy mm_members_read on public.mm_bill_members for select to authenticated
  using (public.mm_member_of(bill_id));

drop policy if exists mm_items_read on public.mm_bill_items;
create policy mm_items_read on public.mm_bill_items for select to authenticated
  using (public.mm_member_of(bill_id));

drop policy if exists mm_claims_read on public.mm_item_claims;
create policy mm_claims_read on public.mm_item_claims for select to authenticated
  using (public.mm_member_of(bill_id));

drop policy if exists mm_debts_read on public.mm_debts;
create policy mm_debts_read on public.mm_debts for select to authenticated
  using (
    debtor_id = auth.uid() or creditor_id = auth.uid()
    or (kind = 'direct' and created_by = auth.uid())
    or (bill_id is not null and public.mm_member_of(bill_id))
  );

drop policy if exists mm_settlements_read on public.mm_settlements;
create policy mm_settlements_read on public.mm_settlements for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists mm_notifications_read on public.mm_notifications;
create policy mm_notifications_read on public.mm_notifications for select to authenticated
  using (user_id = auth.uid());

-- Las tablas solo se leen (y solo con las políticas de arriba); se escribe
-- únicamente a través de las funciones.
revoke all on table
  public.mm_profiles, public.mm_bills, public.mm_bill_members, public.mm_bill_items,
  public.mm_item_claims, public.mm_debts, public.mm_settlements, public.mm_notifications, public.mm_events
from anon, authenticated;

grant select on table
  public.mm_profiles, public.mm_bills, public.mm_bill_members, public.mm_bill_items,
  public.mm_item_claims, public.mm_debts, public.mm_settlements, public.mm_notifications
to authenticated;

-- Funciones: nada se puede llamar salvo lo que se habilita aquí.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'mm\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Las políticas de lectura las usan con el rol de quien consulta.
grant execute on function public.mm_member_of(uuid), public.mm_knows(uuid) to authenticated;

-- Sin sesión: solo ver a qué te invitaron y los datos de cobro públicos.
grant execute on function
  public.mm_bill_preview(text),
  public.mm_debt_preview(text),
  public.mm_pay_card(text),
  public.mm_track(text, jsonb)
to anon, authenticated;

grant execute on function
  public.mm_me(),
  public.mm_save_profile(text, jsonb),
  public.mm_ensure_pay_code(),
  public.mm_create_bill(text, integer, text),
  public.mm_join_bill(text),
  public.mm_get_bill(text),
  public.mm_update_bill(uuid, text, integer, integer, text, uuid),
  public.mm_add_guest(uuid, text),
  public.mm_remove_member(uuid),
  public.mm_set_amounts(uuid, jsonb),
  public.mm_add_items(uuid, jsonb, boolean),
  public.mm_update_item(uuid, text, integer),
  public.mm_delete_item(uuid),
  public.mm_set_claim(uuid, uuid, boolean),
  public.mm_lock_bill(uuid, integer, jsonb),
  public.mm_unlock_bill(uuid),
  public.mm_cancel_bill(uuid),
  public.mm_create_debt(text, integer, text, text),
  public.mm_respond_debt(text, boolean),
  public.mm_cancel_debt(uuid),
  public.mm_report_payment(uuid[], text),
  public.mm_confirm_settlement(uuid),
  public.mm_reject_settlement(uuid),
  public.mm_mark_received(uuid[], text),
  public.mm_forgive(uuid[]),
  public.mm_remind(uuid),
  public.mm_home(),
  public.mm_ledger(),
  public.mm_list_notifications(integer),
  public.mm_mark_read(bigint)
to authenticated;

-- ─── Tiempo real ─────────────────────────────────────────────
-- La app escucha dos cosas: la versión de la cuenta que tiene abierta y tus
-- notificaciones nuevas. Ambas respetan las políticas de lectura.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mm_bills') then
      alter publication supabase_realtime add table public.mm_bills;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mm_notifications') then
      alter publication supabase_realtime add table public.mm_notifications;
    end if;
  end if;
end $$;
