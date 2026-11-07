// ─── Una cuenta: /c/<código> ─────────────────────────────────
// Es lo que abre quien recibe el link o escanea el QR. Si es nuevo, ve a qué
// lo invitaron y solo escribe su nombre: entra directo. Si ya estaba, ve la
// cuenta en vivo en el estado en que esté.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSession } from '../../state/session'
import { useData } from '../../hooks/useData'
import { useBill } from '../../hooks/useBill'
import { api, track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import type { BillPreview } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Card, ErrorScreen, Skeleton, TopBar } from '../../ui/Layout'
import { Logo } from '../../ui/Logo'
import { useToast } from '../../ui/Toast'
import { Splash } from '../../AppFrame'
import { NameForm } from '../shared/NameForm'
import { titleEmoji } from '../shared/titles'
import { HostOpenView, MemberOpenView } from './OpenViews'
import { LockedView } from './LockedView'
import { CancelledView, SettledView } from './SettledView'

export default function BillPage() {
  const { code: raw = '' } = useParams()
  const code = raw.toUpperCase()
  const { ready, profile } = useSession()
  const [joined, setJoined] = useState(false)
  const preview = useData(() => api.billPreview(code), `${code}:${profile?.id ?? 'anon'}`)
  const isMember = Boolean(preview.data?.is_member || joined)
  const live = useBill(code, Boolean(profile && isMember))
  const navigate = useNavigate()

  if (!ready || (preview.loading && !preview.data)) return <Splash />
  if (preview.error && !preview.data) {
    return (
      <ErrorScreen
        title="No pudimos abrir la cuenta"
        body={errorMessage(preview.error)}
        action={<Button full onClick={() => void preview.reload()}>Reintentar</Button>}
      />
    )
  }
  if (!preview.data) {
    return (
      <>
        <TopBar back="/" />
        <ErrorScreen
          title="No encontramos esta cuenta"
          body="Revisa que el link esté completo, o pídele a quien la creó que te lo envíe otra vez."
          action={<Button full onClick={() => navigate('/')}>Ir al inicio</Button>}
        />
      </>
    )
  }

  if (!profile || !isMember) {
    return <JoinGate preview={preview.data} onJoined={() => setJoined(true)} />
  }

  const { bundle, error, refresh, mutate } = live
  if (!bundle) {
    if (error) {
      return (
        <ErrorScreen title="No pudimos cargar la cuenta" body={errorMessage(error)} action={<Button full onClick={() => void refresh()}>Reintentar</Button>} />
      )
    }
    return (
      <div className="flex min-h-dvh flex-col px-5">
        <TopBar back="/" />
        <Skeleton className="h-[132px] rounded-3xl" />
        <Skeleton className="mt-3 h-[220px] rounded-3xl" />
        <Skeleton className="mt-6 h-[180px] rounded-3xl" />
      </div>
    )
  }

  const props = { bundle, live: live.live, refresh, mutate }
  switch (bundle.bill.status) {
    case 'open':
      return bundle.me.is_host ? <HostOpenView {...props} /> : <MemberOpenView {...props} />
    case 'locked':
      return <LockedView {...props} />
    case 'settled':
      return <SettledView bundle={bundle} />
    case 'cancelled':
      return <CancelledView bundle={bundle} />
  }
}

// ─── Entrar a la cuenta ──────────────────────────────────────

function JoinGate({ preview, onJoined }: { preview: BillPreview; onJoined: () => void }) {
  const { profile, start } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const join = async (name?: string) => {
    if (name) await start(name)
    await api.joinBill(preview.code)
    track('bill_join', { new_user: Boolean(name) })
    onJoined()
  }

  const closed = preview.status !== 'open'

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-safe pt-safe">
      <div className="flex items-center justify-between pt-5">
        <Logo size={24} />
      </div>

      <Card className="mt-8 animate-rise overflow-hidden">
        <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
          <Avatar name={preview.host_name} color={preview.host_color} size={56} />
          <p className="mt-3 text-[15px] text-muted">
            <b className="text-ink">{preview.host_name}</b> {closed ? 'dividió' : 'te invitó a dividir'}
          </p>
          <p className="mt-2 text-[22px] font-bold text-ink">
            <span aria-hidden="true">{titleEmoji(preview.title)}</span> {preview.title}
          </p>
          <p className="mt-1 text-[38px] font-extrabold tracking-[-0.045em] text-ink tabular">{formatMoney(preview.total_cents, preview.currency)}</p>
          <p className="mt-1 text-[14px] text-muted">
            {preview.member_count === 1 ? 'Solo está ' + firstName(preview.host_name) : `Ya hay ${preview.member_count} personas`}
          </p>
        </div>
      </Card>

      {closed ? (
        <div className="mt-8 text-center">
          <p className="text-[18px] font-bold text-ink">
            {preview.status === 'locked' ? 'Esta cuenta ya se dividió' : preview.status === 'settled' ? 'Esta cuenta ya está pagada' : 'Esta cuenta se canceló'}
          </p>
          <p className="mt-1.5 text-[15px] leading-snug text-muted text-balance">
            {preview.status === 'locked'
              ? `Si estabas en la mesa, pídele a ${firstName(preview.host_name)} que te envíe tu parte o que corrija la división para sumarte.`
              : 'No hay nada que hacer aquí.'}
          </p>
          <Button className="mt-6" full variant="secondary" onClick={() => navigate('/')}>
            Ir a MitiMiti
          </Button>
        </div>
      ) : profile ? (
        <div className="mt-8 flex flex-col gap-3">
          <Button
            full
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await join()
              } catch (err) {
                toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
                setBusy(false)
              }
            }}
          >
            Entrar a la cuenta
          </Button>
          <p className="text-center text-[14px] text-muted">Entras como {profile.name}.</p>
        </div>
      ) : (
        <div className="mt-8">
          <NameForm cta="Entrar a la cuenta" hint={`Así te verá ${firstName(preview.host_name)} en la cuenta. No necesitas descargar nada.`} onSubmit={(name) => join(name)} />
        </div>
      )}

      <p className="mt-auto pt-10 text-center text-[13px] text-muted">MitiMiti divide la cuenta sin calculadora. Cuentas claras, amistades largas.</p>
    </div>
  )
}
