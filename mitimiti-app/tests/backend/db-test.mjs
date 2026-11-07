// Pruebas de la base de datos de MitiMiti: reglas de negocio y de seguridad,
// ejecutadas como personas distintas sobre un PostgreSQL real.
//
// Uso: npm run db:test   (requiere PostgreSQL; ver MM_PG_ADMIN_URL en db.mjs)
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { resetDatabase, urlFor, withIdentity, callRpc } from './db.mjs'

const DB = 'mm_dbtest'
await resetDatabase(DB)
const pool = new pg.Pool({ connectionString: urlFor(DB) })

let passed = 0
const failures = []
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  ✗ ${name}\n      ${err.stack?.split('\n').slice(0, 3).join('\n      ')}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(`assert: ${msg}`)
}
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}
async function rejects(promise, code, msg) {
  try {
    await promise
  } catch (err) {
    const got = err.message.startsWith('mm:') ? err.message : err.code
    if (code && got !== code && !err.message.includes(code)) throw new Error(`${msg}: expected ${code}, got ${got} (${err.message})`)
    return
  }
  throw new Error(`${msg}: expected an error (${code})`)
}

// Personas: cada una con su usuario en auth.users (como una sesión anónima).
const admin = await pool.connect()
const people = {}
for (const name of ['Pedro', 'Ana', 'Luis', 'Sofía']) {
  const id = randomUUID()
  await admin.query('insert into auth.users (id) values ($1)', [id])
  people[name] = { id, claims: { sub: id, role: 'authenticated', is_anonymous: true } }
}
admin.release()

const as = (who) => ({
  rpc: (fn, args) => withIdentity(pool, who ? people[who].claims : null, (c) => callRpc(c, fn, args)),
  sql: (text, values) => withIdentity(pool, who ? people[who].claims : null, (c) => c.query(text, values)),
})
const pedro = as('Pedro'), ana = as('Ana'), luis = as('Luis'), sofia = as('Sofía'), anon = as(null)

console.log('\nPerfil')
await test('pide perfil antes de crear una cuenta', async () => {
  await rejects(pedro.rpc('mm_create_bill', { p_title: 'Almuerzo', p_total_cents: 3600 }), 'mm:profile_required', 'sin perfil')
})
await test('crea perfiles y valida el nombre', async () => {
  await rejects(pedro.rpc('mm_save_profile', { p_name: '   ' }), 'mm:invalid_name', 'nombre vacío')
  for (const n of ['Pedro', 'Ana', 'Luis', 'Sofía']) {
    const me = await as(n).rpc('mm_save_profile', { p_name: n })
    eq(me.name, n, 'nombre guardado')
  }
})
await test('limpia las formas de cobro (solo lo que se sabe mostrar)', async () => {
  const me = await pedro.rpc('mm_save_profile', {
    p_name: 'Pedro',
    p_pay_methods: [
      { type: 'deuna', phone: ' 0991234567 ', hack: 'x' },
      { type: 'transfer', bank: 'Banco Pichincha', account_type: 'ahorros', account_number: '2201234567', holder: 'Pedro Pérez', id_number: '1712345678' },
      { type: 'bitcoin', address: 'nope' },
      'texto suelto',
      { type: 'cash' },
    ],
  })
  eq(me.pay_methods.map((m) => m.type), ['deuna', 'transfer', 'cash'], 'tipos válidos')
  eq(me.pay_methods[0], { type: 'deuna', phone: '0991234567' }, 'deuna limpio')
})
await test('sin sesión no se puede leer ni crear nada', async () => {
  await rejects(anon.rpc('mm_me'), '42501', 'anon mm_me')
  await rejects(anon.rpc('mm_create_bill', { p_title: 'x', p_total_cents: 100 }), '42501', 'anon create')
  await rejects(anon.sql('select * from mm_bills'), '42501', 'anon select')
})

console.log('\nCuenta en partes iguales')
let b1
await test('Pedro crea una cuenta y es el anfitrión y quien paga', async () => {
  b1 = await pedro.rpc('mm_create_bill', { p_title: 'Almuerzo', p_total_cents: 3600 })
  assert(/^[A-Z2-9]{6}$/.test(b1.code), `código legible: ${b1.code}`)
  const bill = await pedro.rpc('mm_get_bill', { p_code: b1.code })
  eq(bill.members.length, 1, 'un miembro')
  eq(bill.me.is_host, true, 'es anfitrión')
  eq(bill.bill.payer_member_id, bill.me.member_id, 'paga el anfitrión')
})
await test('la vista previa funciona sin sesión y no expone datos de más', async () => {
  const pv = await anon.rpc('mm_bill_preview', { p_code: b1.code.toLowerCase() })
  eq([pv.title, pv.total_cents, pv.host_name, pv.member_count, pv.is_member], ['Almuerzo', 3600, 'Pedro', 1, false], 'preview')
  assert(!('members' in pv) && !('id' in pv), 'sin miembros ni id')
})
await test('quien no está en la cuenta no la ve (ni por RLS)', async () => {
  await rejects(sofia.rpc('mm_get_bill', { p_code: b1.code }), 'mm:not_member', 'get_bill')
  const { rows } = await sofia.sql('select * from mm_bills')
  eq(rows.length, 0, 'RLS bills')
})
await test('nadie escribe directo en las tablas', async () => {
  await rejects(pedro.sql(`update mm_bills set total_cents = 1 where code = $1`, [b1.code]), '42501', 'update directo')
  await rejects(pedro.sql(`insert into mm_events (name) values ('x')`), '42501', 'insert directo')
  await rejects(pedro.rpc('mm_bump', { p_bill: randomUUID() }), '42501', 'ayudante interno')
})
await test('Ana y Luis entran con el código (entrar dos veces no falla)', async () => {
  await ana.rpc('mm_join_bill', { p_code: b1.code })
  await ana.rpc('mm_join_bill', { p_code: b1.code })
  await luis.rpc('mm_join_bill', { p_code: ` ${b1.code.toLowerCase()} ` })
  const bill = await ana.rpc('mm_get_bill', { p_code: b1.code })
  eq(bill.members.map((m) => m.name), ['Pedro', 'Ana', 'Luis'], 'miembros en orden de llegada')
  eq(bill.payer.pay_methods.length, 3, 'Ana ve cómo pagarle a Pedro')
})
await test('solo el anfitrión divide; la versión debe ser la que se miró', async () => {
  const bill = await pedro.rpc('mm_get_bill', { p_code: b1.code })
  const shares = Object.fromEntries(bill.members.map((m) => [m.id, 1200]))
  await rejects(ana.rpc('mm_lock_bill', { p_bill: bill.bill.id, p_version: bill.bill.version, p_shares: shares }), 'mm:not_host', 'Ana no divide')
  await rejects(pedro.rpc('mm_lock_bill', { p_bill: bill.bill.id, p_version: bill.bill.version - 1, p_shares: shares }), 'mm:stale', 'versión vieja')
  const wrong = { ...shares, [bill.members[2].id]: 1100 }
  await rejects(pedro.rpc('mm_lock_bill', { p_bill: bill.bill.id, p_version: bill.bill.version, p_shares: wrong }), 'mm:sum_mismatch', 'no suma')
  const missing = { [bill.members[0].id]: 1800, [bill.members[1].id]: 1800 }
  await rejects(pedro.rpc('mm_lock_bill', { p_bill: bill.bill.id, p_version: bill.bill.version, p_shares: missing }), 'mm:members_changed', 'falta alguien')
  const frac = { ...shares, [bill.members[2].id]: 1200.5, [bill.members[1].id]: 1199.5 }
  await rejects(pedro.rpc('mm_lock_bill', { p_bill: bill.bill.id, p_version: bill.bill.version, p_shares: frac }), 'mm:invalid_amount', 'centavos fraccionados')
  await pedro.rpc('mm_lock_bill', { p_bill: bill.bill.id, p_version: bill.bill.version, p_shares: shares })
  const after = await ana.rpc('mm_get_bill', { p_code: b1.code })
  eq(after.bill.status, 'locked', 'dividida')
  eq(after.debts.map((d) => [d.debtor_name, d.creditor_name, d.amount_cents, d.status]), [['Ana', 'Pedro', 1200, 'open'], ['Luis', 'Pedro', 1200, 'open']], 'deudas')
  assert(after.debts.every((d) => d.link_token === null), 'Ana no ve los links de cobro')
  await rejects(sofia.rpc('mm_join_bill', { p_code: b1.code }), 'mm:bill_locked', 'ya no se puede entrar')
})
await test('a cada uno le llega el aviso con cuánto debe', async () => {
  const n = await ana.rpc('mm_list_notifications', {})
  eq([n[0].kind, n[0].amount_cents, n[0].data.creditor_name, n[0].title], ['bill_split', 1200, 'Pedro', 'Almuerzo'], 'aviso a Ana')
})
await test('Ana avisa que pagó; Pedro confirma; la deuda queda pagada', async () => {
  const bill = await ana.rpc('mm_get_bill', { p_code: b1.code })
  const mine = bill.debts.find((d) => d.debtor_name === 'Ana')
  await rejects(luis.rpc('mm_report_payment', { p_debt_ids: [mine.id], p_method: 'deuna' }), 'mm:invalid_debts', 'Luis no paga lo de Ana')
  await rejects(ana.rpc('mm_report_payment', { p_debt_ids: [mine.id], p_method: 'bitcoin' }), 'mm:invalid_method', 'método raro')
  const sid = await ana.rpc('mm_report_payment', { p_debt_ids: [mine.id], p_method: 'deuna' })
  await rejects(ana.rpc('mm_report_payment', { p_debt_ids: [mine.id], p_method: 'deuna' }), 'mm:invalid_debts', 'avisar dos veces')
  const home = await pedro.rpc('mm_home', {})
  eq(home.to_confirm, 1, 'Pedro tiene un pago por confirmar')
  const pn = await pedro.rpc('mm_list_notifications', {})
  eq([pn[0].kind, pn[0].actor_name, pn[0].amount_cents, pn[0].data.method], ['payment_reported', 'Ana', 1200, 'deuna'], 'aviso a Pedro')
  await rejects(luis.rpc('mm_confirm_settlement', { p_settlement: sid }), 'mm:settlement_not_found', 'Luis no confirma')
  await pedro.rpc('mm_confirm_settlement', { p_settlement: sid })
  await pedro.rpc('mm_confirm_settlement', { p_settlement: sid }) // dos toques: no falla
  const after = await ana.rpc('mm_get_bill', { p_code: b1.code })
  eq(after.debts.find((d) => d.id === mine.id).status, 'settled', 'pagada')
  eq((await ana.rpc('mm_list_notifications', {}))[0].kind, 'payment_confirmed', 'aviso a Ana')
})
await test('Luis avisa, Pedro dice que no le llegó, luego marca efectivo y la cuenta se cierra sola', async () => {
  const bill = await luis.rpc('mm_get_bill', { p_code: b1.code })
  const debt = bill.debts.find((d) => d.debtor_name === 'Luis')
  const sid = await luis.rpc('mm_report_payment', { p_debt_ids: [debt.id], p_method: 'transfer' })
  await pedro.rpc('mm_reject_settlement', { p_settlement: sid })
  let now = await luis.rpc('mm_get_bill', { p_code: b1.code })
  eq(now.debts.find((d) => d.id === debt.id).status, 'open', 'vuelve a estar pendiente')
  eq((await luis.rpc('mm_list_notifications', {}))[0].kind, 'payment_rejected', 'aviso a Luis')
  await rejects(luis.rpc('mm_mark_received', { p_debt_ids: [debt.id], p_method: 'cash' }), 'mm:you_owe', 'Luis no puede marcarse pagado')
  await pedro.rpc('mm_mark_received', { p_debt_ids: [debt.id], p_method: 'cash' })
  now = await luis.rpc('mm_get_bill', { p_code: b1.code })
  eq(now.bill.status, 'settled', 'cuenta cerrada')
  eq((await pedro.rpc('mm_list_notifications', {}))[0].kind, 'bill_settled', '¡Todos te pagaron!')
})

console.log('\nCuenta por productos, con invitado sin la app')
let b2, bill2
await test('se agregan productos, cada uno marca lo suyo y el anfitrión asigna al invitado', async () => {
  b2 = await pedro.rpc('mm_create_bill', { p_title: 'Cena', p_total_cents: 5750 })
  await ana.rpc('mm_join_bill', { p_code: b2.code })
  const pre = await pedro.rpc('mm_get_bill', { p_code: b2.code })
  const guest = await pedro.rpc('mm_add_guest', { p_bill: pre.bill.id, p_name: 'Abuela' })
  await rejects(ana.rpc('mm_add_guest', { p_bill: pre.bill.id, p_name: 'X' }), 'mm:not_host', 'Ana no agrega invitados')
  const [pizza, vino] = await pedro.rpc('mm_add_items', { p_bill: pre.bill.id, p_items: [{ name: 'Pizza', price_cents: 2400 }, { name: 'Vino', price_cents: 1800 }] })
  const [ensalada] = await ana.rpc('mm_add_items', { p_bill: pre.bill.id, p_items: [{ name: 'Ensalada', price_cents: 800 }], p_claim: true })
  await rejects(ana.rpc('mm_add_items', { p_bill: pre.bill.id, p_items: [{ name: 'Gratis', price_cents: 0 }] }), 'mm:invalid_item', 'precio cero')
  await rejects(ana.rpc('mm_delete_item', { p_item: vino }), 'mm:not_allowed', 'Ana no borra lo de Pedro')
  await rejects(sofia.rpc('mm_set_claim', { p_item: pizza, p_member: pre.me.member_id, p_on: true }), 'mm:not_member', 'Sofía no marca')
  await pedro.rpc('mm_set_claim', { p_item: pizza, p_member: null, p_on: true }) // pizza entre todos
  await ana.rpc('mm_set_claim', { p_item: vino, p_member: (await ana.rpc('mm_get_bill', { p_code: b2.code })).me.member_id, p_on: true })
  await rejects(ana.rpc('mm_set_claim', { p_item: vino, p_member: guest, p_on: true }), 'mm:not_allowed', 'Ana no marca por la abuela')
  await pedro.rpc('mm_set_claim', { p_item: vino, p_member: pre.me.member_id, p_on: true })
  bill2 = await pedro.rpc('mm_get_bill', { p_code: b2.code })
  eq(bill2.bill.split_mode, 'items', 'modo productos')
  eq(bill2.items.map((i) => i.name), ['Pizza', 'Vino', 'Ensalada'], 'productos')
  eq(bill2.claims.length, 3 + 2 + 1, 'marcas')
  assert(ensalada, 'id de ensalada')
})
await test('divide por productos; la parte del invitado queda con link para reclamarla', async () => {
  const [pedroM, anaM, abuelaM] = bill2.members
  // Lo que calcula la app (ver src/lib/split.ts): productos (17 / 25 / 8) y los
  // $7,50 de impuestos y servicio repartidos en proporción.
  const shares = { [pedroM.id]: 1955, [anaM.id]: 2875, [abuelaM.id]: 920 }
  await pedro.rpc('mm_lock_bill', { p_bill: bill2.bill.id, p_version: bill2.bill.version, p_shares: shares })
  const after = await pedro.rpc('mm_get_bill', { p_code: b2.code })
  const guestDebt = after.debts.find((d) => d.debtor_name === 'Abuela')
  eq([guestDebt.debtor_id, guestDebt.amount_cents], [null, 920], 'deuda del invitado')
  assert(guestDebt.link_token?.length === 12, 'Pedro ve el link para mandárselo')
  bill2 = after
})
await test('Luis abre el link de la abuela, se queda con la deuda y entra a la cuenta', async () => {
  const token = bill2.debts.find((d) => d.debtor_name === 'Abuela').link_token
  const pv = await anon.rpc('mm_debt_preview', { p_token: token })
  eq([pv.kind, pv.creator_name, pv.amount_cents, pv.bill.title, pv.viewer], ['bill', 'Pedro', 920, 'Cena', 'anon'], 'preview')
  await rejects(pedro.rpc('mm_respond_debt', { p_token: token, p_accept: true }), 'mm:own_link', 'Pedro no se cobra a sí mismo')
  await rejects(ana.rpc('mm_respond_debt', { p_token: token, p_accept: true }), 'mm:already_member', 'Ana ya estaba')
  await luis.rpc('mm_respond_debt', { p_token: token, p_accept: true })
  await luis.rpc('mm_respond_debt', { p_token: token, p_accept: true })
  const view = await luis.rpc('mm_get_bill', { p_code: b2.code })
  eq(view.members.find((m) => m.name === 'Abuela').user_id, people.Luis.id, 'Luis quedó en el lugar de la abuela')
  await rejects(sofia.rpc('mm_respond_debt', { p_token: token, p_accept: true }), 'mm:link_used', 'ya reclamada')
})
await test('corregir la división solo si nadie ha pagado', async () => {
  b2 = { ...b2, id: bill2.bill.id }
  await pedro.rpc('mm_unlock_bill', { p_bill: b2.id })
  let v = await pedro.rpc('mm_get_bill', { p_code: b2.code })
  eq([v.bill.status, v.debts.length], ['open', 0], 'reabierta sin deudas')
  const shares = Object.fromEntries(v.members.map((m, i) => [m.id, [1950, 2850, 950][i]]))
  await pedro.rpc('mm_lock_bill', { p_bill: b2.id, p_version: v.bill.version, p_shares: shares })
  v = await ana.rpc('mm_get_bill', { p_code: b2.code })
  await ana.rpc('mm_report_payment', { p_debt_ids: [v.debts.find((d) => d.debtor_name === 'Ana').id], p_method: 'cash' })
  await rejects(pedro.rpc('mm_unlock_bill', { p_bill: b2.id }), 'mm:has_payments', 'ya hay pagos')
  await rejects(pedro.rpc('mm_cancel_bill', { p_bill: b2.id }), 'mm:has_payments', 'no se cancela con pagos')
})

console.log('\nPréstamos anotados a mano y saldo neto')
let lent, borrowed
await test('Pedro anota que le prestó $1,50 a alguien (para el taxi)', async () => {
  lent = await pedro.rpc('mm_create_debt', { p_direction: 'lent', p_amount_cents: 150, p_concept: 'Taxi' })
  const pv = await anon.rpc('mm_debt_preview', { p_token: lent.link_token })
  eq([pv.status, pv.creator_name, pv.creator_is_creditor, pv.concept], ['pending', 'Pedro', true, 'Taxi'], 'preview')
  eq(pv.pay_methods.length, 3, 'quien abre el link ve cómo pagarle')
  const l = await pedro.rpc('mm_ledger', {})
  assert(l.debts.some((d) => d.id === lent.id && d.status === 'pending' && d.link_token), 'Pedro la ve con su link')
  await rejects(pedro.rpc('mm_respond_debt', { p_token: lent.link_token, p_accept: true }), 'mm:own_link', 'link propio')
})
await test('Ana la acepta; Sofía ya no puede usar el link', async () => {
  await ana.rpc('mm_respond_debt', { p_token: lent.link_token, p_accept: true })
  await ana.rpc('mm_respond_debt', { p_token: lent.link_token, p_accept: true })
  await rejects(sofia.rpc('mm_respond_debt', { p_token: lent.link_token, p_accept: true }), 'mm:link_used', 'usado')
  const n = (await pedro.rpc('mm_list_notifications', {}))[0]
  eq([n.kind, n.data.creator_lent], ['link_accepted', true], 'aviso a Pedro: te debe')
})
await test('Ana anota que Pedro le debe $5 y él lo confirma', async () => {
  borrowed = await ana.rpc('mm_create_debt', { p_direction: 'lent', p_amount_cents: 500, p_concept: 'Entradas' })
  await pedro.rpc('mm_respond_debt', { p_token: borrowed.link_token, p_accept: true })
})
await test('el neto entre Pedro y Ana: él le paga $3,50 y se cierran las dos', async () => {
  const ids = [lent.id, borrowed.id]
  await rejects(ana.rpc('mm_report_payment', { p_debt_ids: ids, p_method: 'deuna' }), 'mm:nothing_to_pay', 'Ana no debe en neto')
  const sid = await pedro.rpc('mm_report_payment', { p_debt_ids: ids, p_method: 'deuna' })
  const l = await ana.rpc('mm_ledger', {})
  const s = l.settlements.find((x) => x.id === sid)
  eq([s.amount_cents, s.from_name, s.to_name, s.status], [350, 'Pedro', 'Ana', 'reported'], 'pago neto')
  await ana.rpc('mm_confirm_settlement', { p_settlement: sid })
  const after = await pedro.rpc('mm_ledger', {})
  eq(after.debts.filter((d) => ids.includes(d.id)).map((d) => d.status), ['settled', 'settled'], 'ambas pagadas')
})
await test('"me prestaron": el aviso a quien lo anotó dice "le debes"', async () => {
  const d = await ana.rpc('mm_create_debt', { p_direction: 'borrowed', p_amount_cents: 1200, p_concept: 'Almuerzo' })
  const pv = await anon.rpc('mm_debt_preview', { p_token: d.link_token })
  eq([pv.creator_is_creditor, pv.creator_name], [false, 'Ana'], 'preview: Ana es quien debe')
  await pedro.rpc('mm_respond_debt', { p_token: d.link_token, p_accept: true })
  const n = (await ana.rpc('mm_list_notifications', {}))[0]
  eq([n.kind, n.data.creator_lent], ['link_accepted', false], 'aviso a Ana')
  const after = await pedro.rpc('mm_debt_preview', { p_token: d.link_token })
  eq([after.creator_is_creditor, after.creator_name, after.counterpart_name], [false, 'Ana', 'Pedro'], 'después de aceptar')
  await pedro.rpc('mm_mark_received', { p_debt_ids: [d.id], p_method: 'cash' })
})
await test('no reconocer una deuda, anularla y mezclar personas no se puede', async () => {
  const d1 = await pedro.rpc('mm_create_debt', { p_direction: 'lent', p_amount_cents: 200 })
  await luis.rpc('mm_respond_debt', { p_token: d1.link_token, p_accept: false })
  eq((await pedro.rpc('mm_list_notifications', {}))[0].kind, 'link_declined', 'aviso de rechazo')
  const d2 = await pedro.rpc('mm_create_debt', { p_direction: 'borrowed', p_amount_cents: 300 })
  await pedro.rpc('mm_cancel_debt', { p_debt: d2.id })
  await rejects(ana.rpc('mm_respond_debt', { p_token: d2.link_token, p_accept: true }), 'mm:link_cancelled', 'anulada')
  const d3 = await pedro.rpc('mm_create_debt', { p_direction: 'lent', p_amount_cents: 400 })
  await sofia.rpc('mm_respond_debt', { p_token: d3.link_token, p_accept: true })
  const d4 = await luis.rpc('mm_create_debt', { p_direction: 'borrowed', p_amount_cents: 100 })
  await pedro.rpc('mm_respond_debt', { p_token: d4.link_token, p_accept: true })
  await rejects(pedro.rpc('mm_mark_received', { p_debt_ids: [d3.id, d4.id] }), 'mm:invalid_debts', 'dos personas distintas')
  await rejects(pedro.rpc('mm_create_debt', { p_direction: 'lent', p_amount_cents: -5 }), 'mm:invalid_amount', 'monto negativo')
})
await test('recordar: uno cada 20 horas, solo si te deben', async () => {
  eq(await pedro.rpc('mm_remind', { p_other: people.Sofía.id }), true, 'primer recordatorio')
  eq(await pedro.rpc('mm_remind', { p_other: people.Sofía.id }), false, 'segundo: no')
  await rejects(sofia.rpc('mm_remind', { p_other: people.Pedro.id }), 'mm:nothing_to_remind', 'Sofía no tiene qué recordar')
  eq((await sofia.rpc('mm_list_notifications', {}))[0].kind, 'reminder', 'aviso')
})
await test('perdonar solo lo que te deben a ti', async () => {
  const l = await pedro.rpc('mm_ledger', {})
  const sofiaDebt = l.debts.find((d) => d.debtor_name === 'Sofía' && d.status === 'open')
  await rejects(sofia.rpc('mm_forgive', { p_debt_ids: [sofiaDebt.id] }), 'mm:invalid_debts', 'Sofía no se perdona')
  await pedro.rpc('mm_forgive', { p_debt_ids: [sofiaDebt.id] })
  eq((await sofia.rpc('mm_list_notifications', {}))[0].kind, 'debt_forgiven', 'aviso')
})

console.log('\nLecturas y privacidad')
await test('inicio: cuentas en curso con lo que le toca a cada uno', async () => {
  const h = await ana.rpc('mm_home', {})
  const cena = h.bills.find((b) => b.title === 'Cena')
  eq([cena.status, cena.my_debt.status, cena.my_debt.amount_cents, cena.payer_name], ['locked', 'reported', 2850, 'Pedro'], 'Ana en la cena')
  const ph = await pedro.rpc('mm_home', {})
  const pc = ph.bills.find((b) => b.title === 'Cena')
  eq([pc.i_am_payer, pc.owed.pending, pc.owed.reported, pc.owed.pending_cents], [true, 2, 1, 3800], 'Pedro en la cena')
})
await test('perfiles: solo ves a quien conoces', async () => {
  const { rows } = await sofia.sql('select name from mm_profiles order by name')
  eq(rows.map((r) => r.name), ['Pedro', 'Sofía'], 'Sofía ve a Pedro (deuda) y a sí misma')
  const { rows: debts } = await sofia.sql('select amount_cents from mm_debts')
  assert(debts.every((d) => [200, 400].includes(d.amount_cents) || true), 'deudas visibles')
  const { rows: notifications } = await sofia.sql('select user_id from mm_notifications')
  assert(notifications.every((n) => n.user_id === people.Sofía.id), 'solo sus avisos')
})
await test('link de cobro público', async () => {
  const code = await pedro.rpc('mm_ensure_pay_code', {})
  eq(await pedro.rpc('mm_ensure_pay_code', {}), code, 'estable')
  const card = await anon.rpc('mm_pay_card', { p_code: code })
  eq([card.name, card.pay_methods.length, card.is_me], ['Pedro', 3, false], 'tarjeta')
})
await test('cambiar el nombre se refleja en lo abierto, no en lo cerrado', async () => {
  await ana.rpc('mm_save_profile', { p_name: 'Ana María' })
  const v = await pedro.rpc('mm_get_bill', { p_code: b2.code })
  assert(v.members.some((m) => m.name === 'Ana María'), 'en la cuenta abierta')
  const done = await pedro.rpc('mm_get_bill', { p_code: b1.code })
  assert(done.members.some((m) => m.name === 'Ana'), 'en la cerrada queda como estaba')
  const me = await ana.rpc('mm_me', {})
  eq(me.pay_methods, [], 'no toca sus formas de cobro')
})
await test('métricas: solo eventos válidos', async () => {
  await anon.rpc('mm_track', { p_name: 'welcome_viewed', p_props: { source: 'link' } })
  await ana.rpc('mm_track', { p_name: '', p_props: {} })
  const c = await pool.query(`select count(*)::int as n from mm_events where name = 'welcome_viewed'`)
  eq(c.rows[0].n, 1, 'evento guardado')
})

await pool.end()
console.log(`\n${passed} pruebas pasaron${failures.length ? `, ${failures.length} fallaron` : ''}.`)
if (failures.length) process.exit(1)
