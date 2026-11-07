import { describe, expect, it } from 'vitest'
import { centsToInput, formatMoney, inputToCents, keypadInput, parsePrice, percentOf } from './money'
import { idNumberKind, isMethodComplete, isValidCedula, methodCopyText, methodSummary } from './payMethods'
import { buildBalances, originsLabel } from './ledger'
import type { Ledger, LedgerDebt } from './types'

describe('dinero', () => {
  it('se ve como en Ecuador', () => {
    expect(formatMoney(150)).toBe('$1,50')
    expect(formatMoney(123450)).toBe('$1.234,50')
    expect(formatMoney(0)).toBe('$0,00')
  })

  it('el teclado propio no deja escribir montos imposibles', () => {
    let v = '0'
    for (const k of ['1', '2', ',', '5', '0', '9']) v = keypadInput(v, k)
    expect(v).toBe('12,50')
    expect(inputToCents(v)).toBe(1250)
    expect(keypadInput('0', '0')).toBe('0')
    expect(keypadInput('0', ',')).toBe('0,')
    expect(keypadInput('12,', ',')).toBe('12,')
    expect(keypadInput('5', 'del')).toBe('0')
    expect(keypadInput('999999', '9')).toBe('999999')
    expect(inputToCents('0,5')).toBe(50)
  })

  it('entiende precios escritos de varias formas', () => {
    expect(parsePrice('4,50')).toBe(450)
    expect(parsePrice('4.50')).toBe(450)
    expect(parsePrice('$ 12')).toBe(1200)
    expect(parsePrice('1.234,50')).toBe(123450)
    expect(parsePrice('1.500')).toBe(150000)
    expect(parsePrice('0')).toBe(null)
    expect(parsePrice('abc')).toBe(null)
    expect(parsePrice('4,555')).toBe(null)
  })

  it('ida y vuelta entre centavos y lo que se escribe', () => {
    for (const c of [0, 5, 50, 100, 1205, 1250, 99999]) expect(inputToCents(centsToInput(c))).toBe(c)
    expect(percentOf(3600, 10)).toBe(360)
  })
})

describe('formas de cobro', () => {
  it('valida cédulas ecuatorianas con su dígito verificador', () => {
    expect(isValidCedula('1710034065')).toBe(true)
    expect(isValidCedula('1710034066')).toBe(false)
    expect(isValidCedula('9910034065')).toBe(false)
    expect(idNumberKind('1710034065001')).toBe('ruc')
    expect(idNumberKind('')).toBe('empty')
    expect(idNumberKind('12-3')).toBe('invalid')
  })

  it('arma el texto para pegar en la app del banco', () => {
    const t = { type: 'transfer' as const, bank: 'Banco Pichincha', account_type: 'ahorros', account_number: '2201234567', holder: 'Pedro Pérez', id_number: '1710034065' }
    expect(methodCopyText(t)).toBe('Banco Pichincha · Cuenta de ahorros\nN.º 2201234567\nPedro Pérez\nC.I./RUC 1710034065')
    expect(methodSummary(t)).toBe('Banco Pichincha · Ahorros ···4567')
    expect(isMethodComplete({ ...t, account_number: '' })).toBe(false)
    expect(methodSummary({ type: 'deuna', phone: '0991234567' })).toBe('Deuna · 099 123 4567')
    expect(isMethodComplete({ type: 'deuna', phone: '12' })).toBe(false)
  })
})

describe('saldos por persona', () => {
  const me = 'me'
  const base = { kind: 'direct' as const, bill_id: null, member_id: null, bill_code: null, bill_title: null, currency: 'USD', created_by: me, settlement_id: null, link_token: 't', responded_at: null, settled_at: null }
  const debt = (over: Partial<LedgerDebt>): LedgerDebt => ({
    id: Math.random().toString(36).slice(2), concept: null, debtor_id: null, debtor_name: '', creditor_id: null, creditor_name: '',
    amount_cents: 0, status: 'open', created_at: '2026-11-01T10:00:00Z', ...base, ...over,
  })

  it('netea lo que te deben con lo que debes a la misma persona', () => {
    const ledger: Ledger = {
      people: { juan: { name: 'Juan', color: 3, pay_methods: [] } },
      settlements: [],
      debts: [
        debt({ kind: 'bill', bill_title: 'Almuerzo', creditor_id: me, debtor_id: 'juan', debtor_name: 'Juan', amount_cents: 1000 }),
        debt({ concept: 'Taxi', creditor_id: 'juan', debtor_id: me, creditor_name: 'Juan', amount_cents: 300 }),
        debt({ creditor_id: me, debtor_id: 'juan', amount_cents: 500, status: 'settled' }),
      ],
    }
    const b = buildBalances(ledger, me)
    expect(b.people).toHaveLength(1)
    expect(b.people[0]).toMatchObject({ name: 'Juan', net: 700, kind: 'person' })
    expect(b.owedToMe).toBe(700)
    expect(b.iOwe).toBe(0)
    expect(b.history).toHaveLength(1)
    expect(originsLabel(b.people[0].debts)).toBe('Almuerzo y Taxi')
  })

  it('los links sin abrir y los invitados sin la app van aparte', () => {
    const ledger: Ledger = {
      people: {},
      settlements: [],
      debts: [
        debt({ status: 'pending', creditor_id: me, amount_cents: 150, concept: 'Taxi' }),
        debt({ kind: 'bill', member_id: 'm1', creditor_id: me, debtor_name: 'Abuela', amount_cents: 920 }),
      ],
    }
    const b = buildBalances(ledger, me)
    expect(b.people.map((p) => [p.kind, p.net])).toEqual([['guest', 920], ['link', 150]])
    expect(b.owedToMe).toBe(1070)
  })

  it('un aviso de pago por confirmar va primero', () => {
    const ledger: Ledger = {
      people: { ana: { name: 'Ana', color: 1, pay_methods: [] }, luis: { name: 'Luis', color: 2, pay_methods: [] } },
      settlements: [{ id: 's', from_id: 'ana', from_name: 'Ana', to_id: me, to_name: 'Yo', amount_cents: 200, currency: 'USD', method: 'deuna', status: 'reported', debt_ids: [], created_at: '2026-11-02T00:00:00Z', resolved_at: null }],
      debts: [
        debt({ creditor_id: me, debtor_id: 'luis', amount_cents: 5000 }),
        debt({ creditor_id: me, debtor_id: 'ana', amount_cents: 200, status: 'reported', settlement_id: 's' }),
      ],
    }
    const b = buildBalances(ledger, me)
    expect(b.people.map((p) => p.name)).toEqual(['Ana', 'Luis'])
    expect(b.toConfirmCount).toBe(1)
    expect(b.people[0].net).toBe(0)
  })
})
