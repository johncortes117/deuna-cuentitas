// ─── Tú ──────────────────────────────────────────────────────
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, Download, Link2, LockKeyhole, Moon, Pencil, Share } from 'lucide-react'
import { useSession } from '../../state/session'
import { api, track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { methodSummary } from '../../lib/payMethods'
import { payCardLink, payCardMessage } from '../../lib/share'
import { getTheme, setTheme } from '../../state/theme'
import type { ThemeChoice } from '../../state/theme'
import { useInstall } from '../../hooks/useInstall'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Segmented, TextField } from '../../ui/Controls'
import { Card, Page, SectionTitle } from '../../ui/Layout'
import { LogoMark } from '../../ui/Logo'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { ShareButtons } from '../shared/ShareButtons'
import { ConfirmSheet } from '../shared/ConfirmSheet'
import { BackupSheet } from './BackupSheet'

export default function ProfilePage() {
  const { profile, email, isAnonymous, saveProfile, signOut } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const install = useInstall()
  const [sheet, setSheet] = useState<'name' | 'backup' | 'card' | 'ios' | 'signout' | null>(null)
  const [name, setName] = useState(profile?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme)
  const [payCode, setPayCode] = useState<string | null>(profile?.pay_code ?? null)
  const methods = profile?.pay_methods ?? []

  const openCard = async () => {
    try {
      const code = payCode ?? (await api.ensurePayCode())
      setPayCode(code)
      setSheet('card')
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
    }
  }

  return (
    <>
      <header className="px-5 pb-1 pt-safe">
        <h1 className="pt-4 text-[28px] font-extrabold tracking-[-0.035em] text-ink">Tú</h1>
      </header>
      <Page withNav className="pt-3">
        <Card className="flex items-center gap-4 px-5 py-4">
          <Avatar name={profile?.name ?? ''} color={profile?.color} size={60} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-bold text-ink">{profile?.name}</p>
            <p className="truncate text-[14px] text-muted">{email ? `Respaldada con ${email}` : 'Cuenta en este celular'}</p>
          </div>
          <button type="button" onClick={() => { setName(profile?.name ?? ''); setSheet('name') }} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink" aria-label="Cambiar tu nombre">
            <Pencil size={18} />
          </button>
        </Card>

        {isAnonymous && (
          <button type="button" onClick={() => setSheet('backup')} className="mt-3 flex w-full items-center gap-3.5 rounded-3xl border border-brand/30 bg-brand-soft px-5 py-4 text-left">
            <LockKeyhole size={24} className="shrink-0 text-brand-ink" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold text-ink">Respalda tu cuenta</span>
              <span className="block text-[13.5px] leading-snug text-ink-2">Si cambias de celular, recuperas tus cuentas con tu correo.</span>
            </span>
            <ChevronRight size={20} className="text-brand-ink" aria-hidden="true" />
          </button>
        )}

        <SectionTitle right={<Link to="/tu/cobros" className="text-[14px] font-semibold text-brand-ink">{methods.length ? 'Editar' : 'Agregar'}</Link>}>
          Cómo te pagan
        </SectionTitle>
        <Card className="overflow-hidden">
          {methods.length === 0 ? (
            <Link to="/tu/cobros" className="block px-5 py-4">
              <p className="text-[15px] font-semibold text-ink">Todavía no agregaste cómo te pagan</p>
              <p className="mt-0.5 text-[14px] text-muted">Tu cuenta del banco, Deuna, Payphone o efectivo: así te pagan sin preguntarte.</p>
            </Link>
          ) : (
            <ul className="divide-y divide-line">
              {methods.map((m, i) => (
                <li key={i} className="px-5 py-3 text-[15px] text-ink">
                  {methodSummary(m)}
                </li>
              ))}
            </ul>
          )}
          {methods.length > 0 && (
            <button type="button" onClick={openCard} className="flex w-full items-center gap-3 border-t border-line px-5 py-3.5 text-left hover:bg-surface-2">
              <Link2 size={19} className="text-ink" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-ink">Tu link de cobro</span>
                <span className="block text-[13.5px] text-muted">Mándalo cuando te pidan “pásame tus datos”</span>
              </span>
              <ChevronRight size={18} className="text-subtle" aria-hidden="true" />
            </button>
          )}
        </Card>

        <SectionTitle>Apariencia</SectionTitle>
        <Segmented
          label="Apariencia"
          value={theme}
          onChange={(v) => {
            setTheme(v)
            setThemeState(v)
          }}
          options={[
            { value: 'system', label: 'Automático' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro', icon: <Moon size={15} aria-hidden="true" /> },
          ]}
        />

        {!install.installed && (install.canPrompt || install.showIosHint) && (
          <button
            type="button"
            onClick={async () => {
              if (install.canPrompt) {
                if (await install.prompt()) track('pwa_installed', {})
              } else setSheet('ios')
            }}
            className="mt-6 flex w-full items-center gap-3.5 rounded-3xl border border-line bg-surface px-5 py-4 text-left shadow-card"
          >
            <Download size={22} className="text-ink" aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-[16px] font-bold text-ink">Agrega MitiMiti a tu inicio</span>
              <span className="block text-[13.5px] text-muted">Se abre como una app, sin descargar nada de la tienda.</span>
            </span>
          </button>
        )}

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <LogoMark size={28} className="text-ink" />
          <p className="text-[13px] text-muted">MitiMiti · Cuentas claras, amistades largas.</p>
          <p className="max-w-[300px] text-[12.5px] leading-snug text-subtle">MitiMiti no mueve tu dinero: te dice cuánto y a quién, y cada uno paga como prefiera.</p>
          {!isAnonymous && (
            <button type="button" onClick={() => setSheet('signout')} className="mt-3 px-3 py-2 text-[14px] font-semibold text-muted">
              Cerrar sesión en este celular
            </button>
          )}
        </div>
      </Page>

      <Sheet
        open={sheet === 'name'}
        onClose={() => setSheet(null)}
        dismissible={!busy}
        title="Tu nombre"
        description="Así te ven tus amigos. Cambia también en las cuentas que siguen abiertas."
        footer={
          <Button
            full
            disabled={!name.trim()}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await saveProfile(name.trim())
                setSheet(null)
              } catch (err) {
                toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
              } finally {
                setBusy(false)
              }
            }}
          >
            Guardar
          </Button>
        }
      >
        <TextField label="Nombre" hideLabel value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus data-autofocus className="pt-2" />
      </Sheet>

      <BackupSheet open={sheet === 'backup'} onClose={() => setSheet(null)} />

      <Sheet open={sheet === 'card'} onClose={() => setSheet(null)} title="Tu link de cobro" description="Tus datos para pagarte, listos para copiar. No muestra tus cuentas ni saldos.">
        {payCode && (
          <div className="flex flex-col gap-3 pb-3 pt-2">
            <ShareButtons message={payCardMessage(payCode)} link={payCardLink(payCode)} primaryLabel="Compartir por WhatsApp" onShared={(channel) => track('pay_card_shared', { channel })} />
            <Button variant="ghost" size="md" onClick={() => navigate(`/p/${payCode}`)}>
              Ver cómo lo ven los demás
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'ios'} onClose={() => setSheet(null)} title="Agrégala a tu inicio" description="En Safari, son dos toques:">
        <ol className="list-decimal space-y-2 pb-4 pl-5 pt-2 text-[15px] text-ink">
          <li>
            Toca <Share size={16} className="inline align-[-2px]" aria-label="Compartir" /> <b>Compartir</b> abajo.
          </li>
          <li>
            Elige <b>Agregar a inicio</b>.
          </li>
        </ol>
      </Sheet>

      <ConfirmSheet
        open={sheet === 'signout'}
        onClose={() => setSheet(null)}
        title="¿Cerrar sesión?"
        body={`Vuelves a entrar cuando quieras con ${email ?? 'tu correo'}.`}
        confirmLabel="Cerrar sesión"
        danger
        onConfirm={async () => {
          await signOut()
          navigate('/bienvenida', { replace: true })
        }}
      />
    </>
  )
}
