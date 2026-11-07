// ─── Cómo te pagan ───────────────────────────────────────────
// Se cargan una vez y aparecen (con botón de copiar) cada vez que alguien te
// debe: nadie vuelve a preguntarte "pásame tus datos".
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Banknote, Building2, ChevronRight, Plus, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '../../state/session'
import { track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { ACCOUNT_TYPES, BANKS, idNumberKind, isMethodComplete, isValidPhone, METHOD_LABEL, methodDetail } from '../../lib/payMethods'
import type { PayMethod, PayMethodType } from '../../lib/types'
import { Button } from '../../ui/Button'
import { Segmented, TextField } from '../../ui/Controls'
import { BottomBar, Card, Page, SectionTitle, TopBar } from '../../ui/Layout'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'

const TYPES: { type: PayMethodType; icon: ReactNode; title: string; body: string }[] = [
  { type: 'deuna', icon: <Smartphone size={20} />, title: 'Deuna', body: 'Tu número de celular' },
  { type: 'transfer', icon: <Building2 size={20} />, title: 'Transferencia', body: 'Banco, cuenta y cédula' },
  { type: 'payphone', icon: <Smartphone size={20} />, title: 'Payphone', body: 'Tu número de celular' },
  { type: 'cash', icon: <Banknote size={20} />, title: 'Efectivo', body: 'Te pueden pagar en persona' },
  { type: 'other', icon: <Sparkles size={20} />, title: 'Otro', body: 'PayPal, otra billetera…' },
]

function blank(type: PayMethodType, holder: string): PayMethod {
  switch (type) {
    case 'deuna':
    case 'payphone':
      return { type, phone: '' }
    case 'transfer':
      return { type, bank: '', account_type: 'ahorros', account_number: '', holder, id_number: '' }
    case 'cash':
      return { type }
    case 'other':
      return { type, label: '', value: '' }
  }
}

export default function PayMethodsPage() {
  const { profile, saveProfile } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const toast = useToast()
  const [methods, setMethods] = useState<PayMethod[]>(profile?.pay_methods ?? [])
  const [editing, setEditing] = useState<{ index: number; method: PayMethod } | null>(null)
  const [busy, setBusy] = useState(false)

  const persist = async (list: PayMethod[]) => {
    setBusy(true)
    try {
      const saved = await saveProfile(profile!.name, list)
      setMethods(saved.pay_methods)
      success()
      track('pay_methods_saved', { count: saved.pay_methods.length })
      return true
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const has = (t: PayMethodType) => methods.some((m) => m.type === t)

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back={next ?? '/tu'} title="Cómo te pagan" />
      <Page className="flex flex-col pt-2">
        <p className="px-1 text-[15px] leading-snug text-muted">
          Aparecen, con un botón para copiar, cuando alguien te debe. Solo los ve quien comparte una cuenta o una deuda contigo.
        </p>

        {methods.length > 0 && (
          <>
            <SectionTitle>Tus datos</SectionTitle>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {methods.map((m, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setEditing({ index: i, method: m })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-2" aria-hidden="true">
                        {TYPES.find((t) => t.type === m.type)?.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{METHOD_LABEL[m.type]}</span>
                        <span className="block truncate text-[13.5px] text-muted">{methodDetail(m)}</span>
                      </span>
                      <ChevronRight size={18} className="text-subtle" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        <SectionTitle>{methods.length ? 'Agregar otro' : 'Agrega al menos uno'}</SectionTitle>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {TYPES.filter((t) => t.type === 'transfer' || t.type === 'other' || !has(t.type)).map((t) => (
              <li key={t.type}>
                <button
                  type="button"
                  onClick={() => (t.type === 'cash' ? void persist([...methods, { type: 'cash' }]) : setEditing({ index: -1, method: blank(t.type, profile?.name ?? '') }))}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-2" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{t.title}</span>
                    <span className="block text-[13.5px] text-muted">{t.body}</span>
                  </span>
                  <Plus size={20} className="text-ink" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {next && (
          <BottomBar>
            <Button full onClick={() => navigate(next, { replace: true })} disabled={busy}>
              {methods.length ? 'Listo, volver a la cuenta' : 'Volver sin agregar'}
            </Button>
          </BottomBar>
        )}
      </Page>

      {editing && (
        <MethodSheet
          method={editing.method}
          isNew={editing.index < 0}
          busy={busy}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            if (await persist(methods.filter((_, i) => i !== editing.index))) setEditing(null)
          }}
          onSave={async (m) => {
            const list = editing.index < 0 ? [...methods, m] : methods.map((x, i) => (i === editing.index ? m : x))
            if (await persist(list)) setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function MethodSheet({ method, isNew, busy, onClose, onSave, onDelete }: { method: PayMethod; isNew: boolean; busy: boolean; onClose: () => void; onSave: (m: PayMethod) => Promise<void>; onDelete: () => Promise<void> }) {
  const [m, setM] = useState<PayMethod>(method)
  const complete = isMethodComplete(m)
  const title = isNew ? `Agregar ${METHOD_LABEL[m.type]}` : METHOD_LABEL[m.type]

  let fields: ReactNode = null
  if (m.type === 'deuna' || m.type === 'payphone') {
    fields = (
      <TextField
        label="Número de celular"
        inputMode="tel"
        autoComplete="tel"
        placeholder="099 123 4567"
        value={m.phone}
        onChange={(e) => setM({ ...m, phone: e.target.value.replace(/[^\d+\s]/g, '') })}
        error={m.phone && !isValidPhone(m.phone) ? 'Revisa el número (10 dígitos, empieza con 09).' : null}
        autoFocus
        data-autofocus
      />
    )
  } else if (m.type === 'transfer') {
    const idKind = idNumberKind(m.id_number)
    fields = (
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="bank" className="mb-1.5 block text-[14px] font-semibold text-ink-2">Banco o cooperativa</label>
          <input
            id="bank"
            list="banks"
            value={m.bank}
            onChange={(e) => setM({ ...m, bank: e.target.value })}
            placeholder="Banco Pichincha"
            className="h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[17px] text-ink outline-none focus:border-ink focus:ring-4 focus:ring-ink/10"
          />
          <datalist id="banks">
            {BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <Segmented label="Tipo de cuenta" value={m.account_type} onChange={(v) => setM({ ...m, account_type: v })} options={ACCOUNT_TYPES} />
        <TextField label="Número de cuenta" inputMode="numeric" value={m.account_number} onChange={(e) => setM({ ...m, account_number: e.target.value.replace(/[^\d]/g, '') })} placeholder="2201234567" />
        <TextField label="Nombre del titular" value={m.holder} onChange={(e) => setM({ ...m, holder: e.target.value })} autoComplete="name" />
        <TextField
          label="Cédula o RUC del titular"
          inputMode="numeric"
          value={m.id_number}
          onChange={(e) => setM({ ...m, id_number: e.target.value.replace(/[^\dA-Za-z]/g, '') })}
          hint="Muchos bancos la piden para transferir. Es opcional."
          error={idKind === 'invalid' ? 'Esa cédula no parece válida: revísala.' : null}
        />
      </div>
    )
  } else if (m.type === 'other') {
    fields = (
      <div className="flex flex-col gap-3">
        <TextField label="¿Qué es?" placeholder="Ej. PayPal" value={m.label} onChange={(e) => setM({ ...m, label: e.target.value })} autoFocus data-autofocus />
        <TextField label="Dato para pagarte" placeholder="Ej. pedro@correo.com" value={m.value} onChange={(e) => setM({ ...m, value: e.target.value })} />
      </div>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title={title}
      footer={
        <div className="flex gap-2.5">
          {!isNew && (
            <Button variant="danger" size="md" icon={<Trash2 size={18} />} onClick={() => void onDelete()} disabled={busy}>
              Quitar
            </Button>
          )}
          <Button className="flex-1" size={isNew ? 'lg' : 'md'} disabled={!complete} loading={busy} onClick={() => void onSave(m)}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="pb-2 pt-2">{fields ?? <p className="text-[15px] text-muted">Te pueden pagar en persona.</p>}</div>
    </Sheet>
  )
}

