-- ═══════════════════════════════════════════════════════════════
-- MitiMiti · métricas del negocio (solo lectura)
--
-- Para correr en el SQL Editor de Supabase. Ninguna consulta cambia datos.
-- North Star: cuentas que terminan saldadas por semana ("¡Cuentas claras!").
-- ═══════════════════════════════════════════════════════════════

-- 1) Embudo semanal de cuentas: creadas → divididas → saldadas.
select
  date_trunc('week', b.created_at)::date                                as semana,
  count(*)                                                              as creadas,
  count(*) filter (where b.locked_at is not null)                       as divididas,
  count(*) filter (where b.status = 'settled')                          as saldadas,
  round(100.0 * count(*) filter (where b.status = 'settled') / nullif(count(*) filter (where b.locked_at is not null), 0), 1)
                                                                        as pct_saldadas_de_divididas,
  percentile_cont(0.5) within group (order by extract(epoch from (b.settled_at - b.locked_at)) / 3600)
    filter (where b.settled_at is not null)                             as horas_mediana_hasta_saldar
from public.mm_bills b
where b.status <> 'cancelled'
group by 1
order by 1 desc;

-- 2) Tamaño de mesa y forma de dividir (¿qué se usa de verdad?).
select
  b.split_mode,
  count(*)                                         as cuentas,
  round(avg(m.personas), 1)                        as personas_promedio,
  round(avg((b.total_cents + b.tip_cents) / 100.0), 2) as total_promedio_usd
from public.mm_bills b
join (select bill_id, count(*) as personas from public.mm_bill_members group by 1) m on m.bill_id = b.id
where b.locked_at is not null
group by 1
order by 2 desc;

-- 3) Crecimiento por invitación: de quienes entraron a una cuenta ajena,
--    cuántos eran nuevos (su perfil nació ese mismo día, por el link).
select
  date_trunc('week', m.joined_at)::date                                       as semana,
  count(*)                                                                    as entradas_a_cuentas_ajenas,
  count(*) filter (where p.created_at > m.joined_at - interval '1 hour')      as nuevos_por_el_link,
  round(100.0 * count(*) filter (where p.created_at > m.joined_at - interval '1 hour') / nullif(count(*), 0), 1)
                                                                              as pct_nuevos
from public.mm_bill_members m
join public.mm_bills b on b.id = m.bill_id
join public.mm_profiles p on p.id = m.user_id
where m.user_id is not null and m.user_id <> b.host_id
group by 1
order by 1 desc;

-- 4) Los nuevos que vuelven: crean su propia cuenta o préstamo después de
--    haber entrado como invitados (el ciclo viral se cierra).
with invitados as (
  select m.user_id, min(m.joined_at) as primera_vez
  from public.mm_bill_members m
  join public.mm_bills b on b.id = m.bill_id
  where m.user_id is not null and m.user_id <> b.host_id
  group by 1
),
propios as (
  select host_id as user_id, min(created_at) as primera_propia from public.mm_bills group by 1
  union all
  select created_by, min(created_at) from public.mm_debts where kind = 'direct' group by 1
)
select
  count(distinct i.user_id)                                                          as invitados,
  count(distinct i.user_id) filter (where p.primera_propia > i.primera_vez)          as luego_crearon_la_suya,
  round(100.0 * count(distinct i.user_id) filter (where p.primera_propia > i.primera_vez) / nullif(count(distinct i.user_id), 0), 1)
                                                                                     as pct_conversion
from invitados i
left join propios p on p.user_id = i.user_id;

-- 5) Cómo se paga: avisos "ya te pagué" (y si se confirman) vs. "ya me pagó".
select
  coalesce(s.method, '—')                                          as medio,
  count(*) filter (where s.created_by = s.from_id)                 as avisados_por_quien_debe,
  count(*) filter (where s.created_by = s.from_id and s.status = 'confirmed') as confirmados,
  count(*) filter (where s.created_by = s.from_id and s.status = 'rejected')  as no_le_llego,
  count(*) filter (where s.created_by = s.to_id)                   as anotados_por_quien_cobra
from public.mm_settlements s
group by 1
order by 2 desc;

-- 6) Préstamos con link: cuántos se abren y se aceptan.
select
  date_trunc('week', d.created_at)::date                         as semana,
  count(*)                                                       as anotados,
  count(*) filter (where d.status <> 'pending' and d.status <> 'cancelled') as respondidos,
  count(*) filter (where d.status in ('open', 'reported', 'settled', 'forgiven')) as aceptados,
  count(*) filter (where d.status = 'declined')                  as no_reconocidos,
  count(*) filter (where d.status = 'settled')                   as pagados
from public.mm_debts d
where d.kind = 'direct'
group by 1
order by 1 desc;

-- 7) Respaldo de cuentas: qué tanto se protege la gente de perder el celular.
select
  count(*)                                                 as personas,
  count(*) filter (where not u.is_anonymous)               as respaldadas_con_correo,
  round(100.0 * count(*) filter (where not u.is_anonymous) / nullif(count(*), 0), 1) as pct_respaldadas
from public.mm_profiles p
join auth.users u on u.id = p.id;

-- 8) Eventos de la app (pantallas y acciones) de los últimos 7 días.
select name, count(*) as veces, count(distinct user_id) as personas
from public.mm_events
where created_at > now() - interval '7 days'
group by 1
order by 2 desc;
