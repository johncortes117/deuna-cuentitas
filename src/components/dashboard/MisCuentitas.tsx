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
  primary:   '#6B5CE7',
  barLight:  '#EEEDFE',
  badgeUp:   { bg: '#EAF3DE', fg: '#3B6D11' },
  badgeDown: { bg: '#FCEBEB', fg: '#A32D2D' },
  cardBg:    '#FFFFFF',
  screenBg:  '#F5F4F0',
  textMain:  '#1A1A2E',
  textSub:   '#999999',
  textMuted: '#BBBBBB',
  border:    'rgba(0,0,0,0.08)',
  rowDiv:    'rgba(0,0,0,0.06)',
  avatars: [
    { bg: '#EEEDFE', fg: '#534AB7' },
    { bg: '#E1F5EE', fg: '#0F6E56' },
    { bg: '#FAECE7', fg: '#993C1D' },
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
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
function Card({ children, mb = 10 }: { children: React.ReactNode; mb?: number }) {
  return (
    <div style={{
      backgroundColor: D.cardBg,
      borderRadius: 16,
      border: `0.5px solid ${D.border}`,
      padding: 16,
      marginBottom: mb,
    }}>
      {children}
    </div>
  );
}

function Divider({ my = 12 }: { my?: number }) {
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
          <p style={{ fontSize: 28, fontWeight: 500, color: D.textMain, lineHeight: 1, margin: 0 }}>
            {fmt(s.totalToday)}
          </p>
          <p style={{ fontSize: 12, color: D.textSub, margin: '5px 0 0' }}>
            {s.cobrosCount} {s.cobrosCount === 1 ? 'cobro' : 'cobros'} · hasta ahora
          </p>
        </div>
        <span style={{
          backgroundColor: badge.bg,
          color: badge.fg,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {fmtVs(s.vsYesterday)}
        </span>
      </div>

      <Divider my={14} />

      {/* Dos columnas: gráfica de días | hora pico */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>

        {/* ── Columna izquierda: gráfica 7 días ── */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: D.textMuted, margin: '0 0 10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Esta semana
          </p>

          {/* Barras verticales */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
            {s.last7Days.map((val, i) => {
              const isToday = i === s.last7Days.length - 1;
              const h = Math.max((val / max) * 40, 3);
              return (
                <div key={i} style={{ flex: 1, height: 40, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: h,
                    borderRadius: '3px 3px 0 0',
                    backgroundColor: isToday ? D.primary : D.barLight,
                  }} />
                </div>
              );
            })}
          </div>

          {/* Etiquetas de días */}
          <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
            {s.dayLabels.map((d, i) => (
              <span key={i} style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 9,
                color: i === s.dayLabels.length - 1 ? D.primary : D.textMuted,
                fontWeight: i === s.dayLabels.length - 1 ? 700 : 400,
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
          margin: '0 16px',
        }} />

        {/* ── Columna derecha: hora pico ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <p style={{ fontSize: 10, color: D.textMuted, margin: '0 0 10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Hora pico
          </p>
          <p style={{ fontSize: 24, fontWeight: 600, color: D.primary, lineHeight: 1, margin: '0 0 6px' }}>
            {ph.peakLabel}
          </p>
          <p style={{ fontSize: 12, color: D.textSub, margin: 0 }}>
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
      <p style={{ fontSize: 11, color: D.textSub, margin: '0 0 4px' }}>{title}</p>

      {rows.slice(0, 3).map((row, i) => {
        const av = D.avatars[i] ?? D.avatars[D.avatars.length - 1];
        return (
          <React.Fragment key={row.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
              <span style={{ width: 14, flexShrink: 0, textAlign: 'center', fontSize: 11, color: D.textMuted }}>
                {i + 1}
              </span>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                backgroundColor: av.bg, color: av.fg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>
                {row.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 500, color: D.textMain, margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.name}
                </p>
                <p style={{ fontSize: 11, color: D.textSub, margin: 0 }}>
                  {row.count} {row.countLabel}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: D.primary, flexShrink: 0 }}>
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
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-[40px]">

      {/* ══ Header morado — sin notificación ══════════════ */}
      <div style={{ backgroundColor: D.primary, flexShrink: 0 }}>

        {/* Status bar */}
        <div className="flex justify-between items-center px-7 pt-14 pb-0">
          <span style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '-0.3px' }}>
            12:13
          </span>
          <div className="flex items-center gap-1.5">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
              <rect x="0"    y="7"   width="3" height="5"    rx="1" fill="white" />
              <rect x="4.5"  y="4.5" width="3" height="7.5"  rx="1" fill="white" />
              <rect x="9"    y="2"   width="3" height="10"   rx="1" fill="white" />
              <rect x="13.5" y="0"   width="3" height="12"   rx="1" fill="rgba(255,255,255,0.3)" />
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x=".5" y=".5" width="21" height="11" rx="3.5" stroke="rgba(255,255,255,0.5)" />
              <rect x="2"  y="2"  width="17" height="8"  rx="2"   fill="white" />
              <path d="M23 4.5C23.8 4.9 23.8 7.1 23 7.5V4.5Z" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>
        </div>

        {/* Nav: volver + título */}
        <div className="flex items-center px-5 pt-3 pb-5">
          <button onClick={onClose} className="p-1 -ml-1" aria-label="Volver">
            <IcoBack />
          </button>
          <div className="flex-1 text-center">
            <p style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '-0.5px', margin: 0 }}>
              Mis Cuentitas
            </p>
          </div>
          <div style={{ width: 30 }} />
        </div>
      </div>

      {/* ══ Área desplazable ══════════════════════════════ */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: D.screenBg }}>
        <div style={{ padding: 16, paddingBottom: 32 }}>

          {/* Resumen del día + hora pico (juntos) */}
          <CardResumen s={summary} ph={peakHours} />

          {/* Ranking clientes */}
          <CardRanking title="Tus mejores clientes este mes" rows={clientRows} />

          {/* Ranking vendedores (solo si ≥ 2) */}
          {vendors.length >= 2 && (
            <CardRanking title="Tu equipo este mes" rows={vendorRows} />
          )}

          {/* Botón chatbot */}
          <button
            onClick={onOpenChat}
            className="w-full flex items-center justify-center gap-2"
            style={{
              marginTop: 8,
              backgroundColor: D.primary,
              color: 'white',
              borderRadius: 14,
              padding: '13px 16px',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.2px',
            }}
          >
            <IcoChat />
            Pregúntame algo
          </button>
        </div>
      </div>
    </div>
  );
}
