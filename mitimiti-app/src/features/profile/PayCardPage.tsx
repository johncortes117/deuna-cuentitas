// ─── Link de cobro: /p/<código> ──────────────────────────────
// Para cuando alguien te dice "pásame tus datos": en vez de escribir banco,
// tipo de cuenta, número y cédula, mandas este link con todo listo para copiar.
import { useNavigate, useParams } from 'react-router'
import { useData } from '../../hooks/useData'
import { api, track } from '../../lib/api'
import { firstName } from '../../lib/avatar'
import { payCardLink, payCardMessage } from '../../lib/share'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Card, ErrorScreen, Page, TopBar } from '../../ui/Layout'
import { Logo } from '../../ui/Logo'
import { Splash } from '../../AppFrame'
import { PayOptions } from '../shared/PayOptions'
import { ShareButtons } from '../shared/ShareButtons'

export default function PayCardPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { data: card, loading } = useData(() => api.payCard(code), code)

  if (loading && !card) return <Splash />
  if (!card) {
    return (
      <ErrorScreen
        title="Este link de cobro no existe"
        body="Puede que lo hayan copiado incompleto."
        action={<Button full onClick={() => navigate('/')}>Ir a MitiMiti</Button>}
      />
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {card.is_me ? <TopBar back="/tu" title="Tu link de cobro" /> : <div className="px-6 pt-safe"><div className="pt-5"><Logo size={24} /></div></div>}
      <Page className="flex flex-col pt-6">
        <div className="flex flex-col items-center text-center">
          <Avatar name={card.name} color={card.color} size={76} />
          <h1 className="mt-3 text-[24px] font-extrabold tracking-[-0.03em] text-ink">Cómo pagarle a {firstName(card.name)}</h1>
          <p className="mt-1 text-[15px] text-muted">Toca para copiar y pégalo en la app de tu banco.</p>
        </div>
        <Card className="mt-6 px-4 py-1">
          <PayOptions name={card.name} methods={card.pay_methods} onCopy={(type) => track('pay_card_copied', { type })} />
        </Card>
        <div className="mt-auto pt-8">
          {card.is_me ? (
            <>
              <p className="mb-3 text-center text-[14px] text-muted">Así ven tus datos los demás. Mándalo cuando te pidan “pásame tus datos”.</p>
              <ShareButtons message={payCardMessage(code)} link={payCardLink(code)} primaryLabel="Compartir por WhatsApp" />
            </>
          ) : (
            <div className="rounded-3xl bg-surface-2 px-5 py-4 text-center">
              <p className="text-[15px] font-bold text-ink">¿Dividen cuentas seguido?</p>
              <p className="mt-1 text-[14px] text-muted">Con MitiMiti cada uno ve cuánto le toca y a quién pagarle. Sin descargar nada.</p>
              <Button className="mt-3" size="md" variant="secondary" onClick={() => navigate('/')}>
                Probar MitiMiti
              </Button>
            </div>
          )}
        </div>
      </Page>
    </div>
  )
}
