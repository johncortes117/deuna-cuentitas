import { describe, expect, it } from 'vitest'
import {
  amountsDifference,
  amountsFromEqual,
  amountsFromSaved,
  computeBillSplit,
  releaseAmount,
  setAmount,
  splitEqual,
  splitItems,
  spreadProportionally,
  stepCents,
} from './split'

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

describe('partes iguales', () => {
  it('suma exacto y el centavo extra lo pone quien pagó', () => {
    const shares = splitEqual(1000, ['ana', 'pedro', 'luis'], 'pedro')
    expect(shares).toEqual({ pedro: 334, ana: 333, luis: 333 })
    expect(sum(shares)).toBe(1000)
  })

  it('sin pagador, los centavos van a los primeros en llegar', () => {
    expect(splitEqual(1001, ['a', 'b', 'c'])).toEqual({ a: 334, b: 334, c: 333 })
  })

  it('aguanta montos y grupos grandes sin perder centavos', () => {
    for (let n = 2; n <= 30; n++) {
      const ids = Array.from({ length: n }, (_, i) => `m${i}`)
      for (const total of [1, 99, 100, 3599, 123457, 99999999]) {
        const shares = splitEqual(total, ids, 'm1')
        expect(sum(shares)).toBe(total)
        const values = Object.values(shares)
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('por productos', () => {
  const members = ['pedro', 'ana', 'abuela']
  const items = [
    { id: 'pizza', priceCents: 2400 },
    { id: 'vino', priceCents: 1800 },
    { id: 'ensalada', priceCents: 800 },
  ]
  const claims = [
    ...members.map((memberId) => ({ itemId: 'pizza', memberId })),
    { itemId: 'vino', memberId: 'pedro' },
    { itemId: 'vino', memberId: 'ana' },
    { itemId: 'ensalada', memberId: 'ana' },
  ]

  it('cada uno paga lo suyo y el IVA/servicio se reparte en proporción', () => {
    const r = splitItems(5750, members, items, claims)
    expect(r.subtotals).toEqual({ pedro: 1700, ana: 2500, abuela: 800 })
    expect(r.extrasCents).toBe(750)
    expect(r.extras).toEqual({ pedro: 255, ana: 375, abuela: 120 })
    expect(r.shares).toEqual({ pedro: 1955, ana: 2875, abuela: 920 })
    expect(r.unassigned).toEqual([])
  })

  it('avisa lo que nadie marcó y lo que se pasa del total', () => {
    const r = splitItems(4000, members, items, claims.filter((c) => c.itemId !== 'ensalada'))
    expect(r.unassigned).toEqual(['ensalada'])
    expect(r.extrasCents).toBe(-1000)
  })

  it('los centavos de un producto compartido no se pierden', () => {
    const r = splitItems(1000, ['a', 'b', 'c'], [{ id: 'x', priceCents: 1000 }], ['a', 'b', 'c'].map((memberId) => ({ itemId: 'x', memberId })))
    expect(r.shares).toEqual({ a: 334, b: 333, c: 333 })
  })

  it('quien no comió nada no paga extras', () => {
    const r = splitItems(1150, ['a', 'b'], [{ id: 'x', priceCents: 1000 }], [{ itemId: 'x', memberId: 'a' }])
    expect(r.shares).toEqual({ a: 1150, b: 0 })
  })

  it('reparto proporcional: suma exacta con miles de casos al azar', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let t = 0; t < 3000; t++) {
      const n = 2 + Math.floor(rand() * 8)
      const ids = Array.from({ length: n }, (_, i) => `m${i}`)
      const weights = Object.fromEntries(ids.map((id) => [id, Math.floor(rand() * 5000)]))
      const cents = Math.floor(rand() * 100000)
      const out = spreadProportionally(cents, ids, weights)
      expect(sum(out)).toBe(cents)
      for (const id of ids) expect(out[id]).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('montos diferentes con auto-reparto', () => {
  const ids = ['pedro', 'ana', 'luis']

  it('al cambiar a uno, los demás se reparten lo que falta', () => {
    let s = amountsFromEqual(2400, ids)
    s = setAmount(s, ids, 2400, 'ana', 1500)
    expect(s.amounts).toEqual({ pedro: 450, ana: 1500, luis: 450 })
    expect(amountsDifference(s, ids, 2400)).toBe(0)
  })

  it('siempre queda alguien libre que absorbe la diferencia', () => {
    let s = amountsFromEqual(3000, ids)
    s = setAmount(s, ids, 3000, 'pedro', 1000)
    s = setAmount(s, ids, 3000, 'ana', 1200)
    s = setAmount(s, ids, 3000, 'luis', 500)
    // Se liberó a pedro (el más antiguo) para que cuadre.
    expect(s.amounts).toEqual({ pedro: 1300, ana: 1200, luis: 500 })
    expect(s.touched).toEqual(['ana', 'luis'])
  })

  it('si un monto solo se pasa del total, queda el exceso para corregir', () => {
    const s = setAmount(amountsFromEqual(2000, ids), ids, 2000, 'ana', 2500)
    expect(amountsDifference(s, ids, 2000)).toBe(-500)
  })

  it('deshacer devuelve a la persona al reparto automático', () => {
    let s = setAmount(amountsFromEqual(2400, ids), ids, 2400, 'ana', 1500)
    s = releaseAmount(s, ids, 2400, 'ana')
    expect(s.amounts).toEqual({ pedro: 800, ana: 800, luis: 800 })
  })

  it('−/+ van primero al dólar entero', () => {
    expect(stepCents(1667, 1)).toBe(1700)
    expect(stepCents(1700, 1)).toBe(1800)
    expect(stepCents(1667, -1)).toBe(1600)
    expect(stepCents(0, -1)).toBe(0)
  })

  it('retoma lo guardado sin cambiar los montos', () => {
    const s = amountsFromSaved(3000, ids, { pedro: 1000, ana: 1500, luis: 500 })
    expect(s.amounts).toEqual({ pedro: 1000, ana: 1500, luis: 500 })
    const next = setAmount(s, ids, 3000, 'pedro', 1200)
    expect(sum(next.amounts)).toBe(3000)
  })
})

describe('división de la cuenta completa', () => {
  it('marca los problemas que impiden dividir', () => {
    const r = computeBillSplit({
      mode: 'items', totalCents: 1000, memberIds: ['a'], payerId: 'a', customCents: {},
      items: [{ id: 'x', priceCents: 1200 }], claims: [],
    })
    expect(r.problems.map((p) => p.kind)).toEqual(['need_two', 'unassigned', 'items_exceed'])
  })

  it('montos diferentes incompletos caen en partes iguales', () => {
    const r = computeBillSplit({
      mode: 'amounts', totalCents: 900, memberIds: ['a', 'b', 'c'], payerId: 'b', customCents: { a: 100 },
      items: [], claims: [],
    })
    expect(r.shares).toEqual({ b: 300, a: 300, c: 300 })
    expect(r.problems).toEqual([])
  })
})
