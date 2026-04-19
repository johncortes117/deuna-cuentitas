import React from 'react';
import type { MisCuentitasData } from '../../data/mockData';

// ─── Props ──────────────────────────────────────────────────────
export interface MisCuentitasProps {
  data: MisCuentitasData;
  onClose: () => void;
  onOpenChat?: () => void;
}

// ─── Design tokens Deuna ────────────────────────────────────────
const D = {
  primary:   '#452757', // Morado Deuna
  accent:    '#00D3A4', // Verde Deuna
  barLight:  '#C0F5EA', // Verde Deuna claro para barras inactivas
  badgeUp:   { bg: '#EAF3DE', fg: '#3B6D11' },
  badgeDown: { bg: '#FFF0F0', fg: '#D54C4C' }, // Ajustado para ser rosado suave/rojo pastel
  cardBg:    '#FFFFFF',
  screenBg:  '#F5F4F0',
  textMain:  '#1A1A2E',
  textSub:   '#8F96A3',
  textMuted: '#B0B5C0',
  border:    'rgba(0,0,0,0.06)',
  rowDiv:    'rgba(0,0,0,0.04)',
  avatars: [
    { bg: '#EEEDFE', fg: '#5E54B9' },
    { bg: '#E1F5EE', fg: '#1C755E' },
    { bg: '#FAECE7', fg: '#A24A2E' },
  ],
} as const;

// ─── Helpers ────────────────────────────────────────────────────
function fmt(n: number): string {
  const a = Math.abs(n);
  return a === Math.floor(a) ? `$${a}` : `$${a.toFixed(2).replace('.', ',')}`;
}

function fmtVs(vs: number): string {
  return `${vs >= 0 ? '+' : '−'}${fmt(vs)} vs ayer`;
}

// ─── Íconos ─────────────────────────────────────────────────────
const IcoBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white"
    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IcoChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// ─── Card base ──────────────────────────────────────────────────
function Card({ children, mb = 8 }: { children: React.ReactNode; mb?: number }) {
  return (
    <div style={{
      backgroundColor: D.cardBg,
      borderRadius: 18,
      border: `0.5px solid ${D.border}`,
      padding: '12px 14px',
      marginBottom: mb,
      boxShadow: '0 2px 8px rgba(0,0,0,0.015)'
    }}>
      {children}
    </div>
  );
}

function Divider({ my = 10 }: { my?: number }) {
  return <div style={{ height: '0.5px', backgroundColor: D.border, margin: `${my}px 0` }} />;
}

// ═══════════════════════════════════════════════════════════════
// Tarjeta 1 — Resumen + Hora pico (lado a lado)
// ═══════════════════════════════════════════════════════════════
function CardResumen({ s, ph }: {
  s: MisCuentitasData['summary'];
  ph: MisCuentitasData['peakHours'];
}) {
  if (s.cobrosCount === 0) {
    return (
      <Card>
        <p style={{ fontSize: 11, color: D.textSub, margin: '0 0 6px' }}>Resumen del día</p>
        <p style={{ fontSize: 13, color: D.textSub, margin: 0 }}>
          Hoy todavía no hay cobros registrados.
        </p>
      </Card>
    );
  }

  const max = Math.max(...s.last7Days, 0.01);
  const badge = s.vsYesterday >= 0 ? D.badgeUp : D.badgeDown;

  return (
    <Card>
      {/* Monto grande + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontSize: 26, fontWeight: 700, color: D.textMain, lineHeight: 1, margin: 0, letterSpacing: '-0.5px' }}>
            {fmt(s.totalToday)}
          </p>
          <p style={{ fontSize: 11, color: D.textSub, margin: '5px 0 0' }}>
            {s.cobrosCount} {s.cobrosCount === 1 ? 'cobro' : 'cobros'} · hasta ahora
          </p>
        </div>
        <span style={{
          backgroundColor: badge.bg,
          color: badge.fg,
          padding: '4px 8px',
          borderRadius: 14,
          fontSize: 10,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {fmtVs(s.vsYesterday)}
        </span>
      </div>

      <Divider my={10} />

      {/* Dos columnas: gráfica de días | hora pico */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>

        {/* ── Columna izquierda: gráfica 7 días ── */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 9, color: D.textMuted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Esta semana
          </p>

          {/* Barras verticales */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
            {s.last7Days.map((val, i) => {
              const isToday = i === s.last7Days.length - 1;
              const h = Math.max((val / max) * 32, 2);
              return (
                <div key={i} style={{ flex: 1, height: 32, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: h,
                    borderRadius: '2px 2px 0 0',
                    backgroundColor: isToday ? D.accent : D.barLight,
                  }} />
                </div>
              );
            })}
          </div>

          {/* Etiquetas de días */}
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {s.dayLabels.map((d, i) => (
              <span key={i} style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 8,
                color: i === s.dayLabels.length - 1 ? D.accent : D.textMuted,
                fontWeight: i === s.dayLabels.length - 1 ? 700 : 500,
              }}>
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Separador vertical */}
        <div style={{
          width: '0.5px',
          backgroundColor: D.border,
          alignSelf: 'stretch',
          margin: '0 14px',
        }} />

        {/* ── Columna derecha: hora pico ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <p style={{ fontSize: 9, color: D.textMuted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Hora pico
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: D.primary, lineHeight: 1, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            {ph.peakLabel}
          </p>
          <p style={{ fontSize: 11, color: D.textSub, margin: 0 }}>
            {ph.peakCount} cobros
          </p>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tarjeta ranking — reutilizable (clientes y vendedores)
// ═══════════════════════════════════════════════════════════════
interface RankRow {
  name: string;
  initials: string;
  totalAmount: number;
  count: number;
  countLabel: string;
}

function CardRanking({ title, rows }: { title: string; rows: RankRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <p style={{ fontSize: 11, color: D.textSub, margin: '0 0 4px', fontWeight: 500 }}>{title}</p>

      {rows.slice(0, 3).map((row, i) => {
        const av = D.avatars[i] ?? D.avatars[D.avatars.length - 1];
        return (
          <React.Fragment key={row.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0' }}>
              <span style={{ width: 12, flexShrink: 0, textAlign: 'center', fontSize: 10, color: D.textMuted, fontWeight: 500 }}>
                {i + 1}
              </span>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                backgroundColor: av.bg, color: av.fg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>
                {row.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 11, fontWeight: 600, color: D.textMain, margin: '0 0 1px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.name}
                </p>
                <p style={{ fontSize: 10, color: D.textSub, margin: 0 }}>
                  {row.count} {row.countLabel}
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: D.primary, flexShrink: 0 }}>
                {fmt(row.totalAmount)}
              </span>
            </div>
            {i < Math.min(rows.length, 3) - 1 && (
              <div style={{ height: '0.5px', backgroundColor: D.rowDiv }} />
            )}
          </React.Fragment>
        );
      })}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componente principal — MisCuentitas
// ═══════════════════════════════════════════════════════════════
export default function MisCuentitas({ data, onClose, onOpenChat }: MisCuentitasProps) {
  const { summary, peakHours, topClients, vendors } = data;

  const clientRows: RankRow[] = topClients.map(c => ({
    name: c.name, initials: c.initials, totalAmount: c.totalAmount,
    count: c.visits, countLabel: c.visits === 1 ? 'visita' : 'visitas',
  }));

  const vendorRows: RankRow[] = vendors.map(v => ({
    name: v.name, initials: v.initials, totalAmount: v.totalAmount,
    count: v.transactions, countLabel: v.transactions === 1 ? 'transacción' : 'transacciones',
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F4F0]">
      {/* ══ Header morado ══════════════ */}
      <div style={{ backgroundColor: D.primary, flexShrink: 0, paddingBottom: 24, paddingTop: 60 }}>
        {/* Nav: volver + título */}
        <div className="flex items-center px-4">
          <button onClick={onClose} className="p-1 -ml-1 active:opacity-70 transition-opacity" aria-label="Volver">
            <IcoBack />
          </button>
          <div className="flex-1 text-center pr-6">
            <p style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.3px' }}>
              Mis Cuentitas
            </p>
          </div>
        </div>
      </div>

      {/* ══ Área de contenido solapado ══════════════════ */}
      {/* Superposición (-mt-4) y flex-1 sin scroll automático */}
      <div className="flex-1 bg-[#F5F4F0] -mt-5 rounded-t-[20px] relative px-4 pt-4 pb-2 flex flex-col overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
        
        {/* Contenedor estricto para fijar layout sin overflow */}
        <div className="flex flex-col flex-1 h-full max-h-full">
          
          {/* Resumen del día + hora pico */}
          <CardResumen s={summary} ph={peakHours} />

          {/* Ranking clientes */}
          <CardRanking title="Tus mejores clientes este mes" rows={clientRows} />

          {/* Ranking vendedores (solo si ≥ 2) */}
          {vendors.length >= 2 && (
            <CardRanking title="Tu equipo este mes" rows={vendorRows} />
          )}

          {/* Botón CTA al final flotando/anclado abajo */}
          <div className="mt-auto pt-1 mb-2 shrink-0">
            <button
              onClick={onOpenChat}
              className="w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{
                backgroundColor: D.primary,
                color: 'white',
                borderRadius: 16,
                padding: '12px 16px',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '-0.1px',
                boxShadow: '0 4px 14px rgba(116, 100, 236, 0.25)'
              }}
            >
              <IcoChat />
              Pregúntame algo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
