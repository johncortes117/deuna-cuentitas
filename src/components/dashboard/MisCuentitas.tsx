import { useState } from 'react';
import type { MisCuentitasData } from '../../data/mockData';
import './MisCuentitas.css';

// ─── Props ──────────────────────────────────────────────────────
export interface MisCuentitasProps {
  data: MisCuentitasData;
  onClose: () => void;
  onOpenChat?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────
function fmt(n: number): string {
  const a = Math.abs(n);
  return a === Math.floor(a) ? `$${a}` : `$${a.toFixed(2).replace('.', ',')}`;
}

const IcoBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white"
    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export default function MisCuentitas({ data, onClose, onOpenChat }: MisCuentitasProps) {
  const { summary, peakHours, topClients, vendors } = data;

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Calc chart data
  const maxVal = Math.max(...summary.last7Days, 0.01);
  const sumAvg = summary.last7Days.reduce((a, b) => a + b, 0) / (summary.last7Days.length || 1);
  // Cap visually between 10% and 90% so the dashed line doesn't go off-chart
  const avgLineY = Math.max(10, Math.min(90, (sumAvg / maxVal) * 100));

  const isTodayTarget = selectedDayIndex === null || selectedDayIndex === summary.last7Days.length - 1;
  const dayIncome = selectedDayIndex === null ? summary.totalToday : (summary.last7Days[selectedDayIndex] || 0);
  
  const selectedDayLabel = isTodayTarget ? 'Hoy' : summary.dayLabels[selectedDayIndex!];
  
  // Format the title logic for grammar "Ingresos de Hoy" vs "Ingresos del Dom"
  const titlePrefix = isTodayTarget ? 'Ingresos de' : 'Ingresos del';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F4F0]">
        {/* ══ Header morado original ══════════════ */}
        <div style={{ backgroundColor: '#452757', flexShrink: 0, paddingBottom: 24, paddingTop: 60 }}>
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

        {/* ══ Contenido envolvente original ══════════════ */}
        <div className="flex-1 bg-[#F5F4F0] -mt-5 rounded-t-[20px] relative flex flex-col overflow-y-auto shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
            <div className="mis-cuentitas-container !bg-transparent !p-0 mx-4 mt-4">
                
                <main className="main-content !mt-0 !p-0">
                    {/* SALDO CARD */}
                    <section className="card">
                        <div className="balance-title">{titlePrefix} {selectedDayLabel}</div>
                        <div className="balance-amount-wrapper">
                            <div className="main-amount">{fmt(dayIncome)}</div>
                            <svg className="eye-icon" viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                            </svg>
                        </div>

                        <div className="quick-stats">
                            <div className="stat-box">
                                <div className="stat-label">Cobros hoy</div>
                                <div className="stat-value">{summary.cobrosCount} cobros</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-label">Hora pico</div>
                                <div className="stat-value">{peakHours.peakLabel && peakHours.peakLabel !== '' ? peakHours.peakLabel : '-'}</div>
                            </div>
                        </div>
                    </section>

                    {/* CHART CARD */}
                    <section className="card">
                        <div className="section-header">
                            <h2 className="section-title">Esta semana</h2>
                            <span className="average-badge">Media: {fmt(sumAvg)}</span>
                        </div>
                        <div className="chart-container">
                            <div className="average-line-visual" style={{ bottom: `${avgLineY}%` }}></div>
                            {summary.last7Days.map((val, i) => {
                                const isSelected = i === selectedDayIndex;
                                const isToday = i === summary.last7Days.length - 1;
                                const h = Math.max((val / maxVal) * 100, 4); 
                                
                                let barClass = 'mid';
                                if (val > sumAvg * 1.3) barClass = 'high';
                                else if (val < sumAvg * 0.7) barClass = val === 0 ? 'very-low' : 'low';
                                
                                // All opaque by default (when null). Only dim non-selected when a day is selected.
                                const opacityStyle = selectedDayIndex === null || isSelected ? 1 : 0.4;
                                // Subtle scale
                                const transformStyle = isSelected ? 'scaleY(1.05) translateY(-2px)' : 'none';

                                return (
                                    <div 
                                        className="bar-group" 
                                        key={i} 
                                        onClick={() => setSelectedDayIndex(isSelected ? null : i)}
                                    >
                                        <div 
                                            className={`bar ${barClass} transition-all duration-300`} 
                                            style={{ height: `${h}%`, opacity: opacityStyle, transform: transformStyle }}
                                        ></div>
                                        <span className={`day-label ${isSelected ? 'active' : ''}`}>{summary.dayLabels[i]}</span>
                                        {isToday && <span className="absolute -bottom-4 text-[9px] text-[#A0A0B5] font-bold">Hoy</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* TOP CLIENTS CARD */}
                    <section className="card">
                        <div className="section-header">
                            <h2 className="section-title">Tus mejores clientes este mes</h2>
                        </div>
                        <div>
                        {topClients.map((client, i) => {
                            const colorClass = ['bg-purple', 'bg-green', 'bg-orange'][i % 3];
                            return (
                                <div className="list-item" key={client.name}>
                                    <div className="item-rank">{i + 1}</div>
                                    <div className={`avatar ${colorClass}`}>
                                        {client.initials}
                                    </div>
                                    <div className="item-info">
                                        <h3 className="item-name">{client.name}</h3>
                                        <p className="item-sub">{client.visits} visitas</p>
                                    </div>
                                    <div className="item-value">{fmt(client.totalAmount)}</div>
                                </div>
                            );
                        })}
                        {topClients.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-gray)' }}>Aún no hay suficientes datos registrados este mes.</p>}
                        </div>
                    </section>

                    {/* TOP VENDORS CARD */}
                    {vendors && vendors.length >= 2 && (
                    <section className="card">
                        <div className="section-header">
                            <h2 className="section-title">Tu equipo este mes</h2>
                        </div>
                        <div>
                        {vendors.map((v, i) => {
                            const colorClass = ['bg-purple', 'bg-green', 'bg-orange'][i % 3];
                            return (
                                <div className="list-item" key={v.name}>
                                    <div className="item-rank">{i + 1}</div>
                                    <div className={`avatar ${colorClass}`}>
                                        {v.initials}
                                    </div>
                                    <div className="item-info">
                                        <h3 className="item-name">{v.name}</h3>
                                        <p className="item-sub">{v.transactions} cobros</p>
                                    </div>
                                    <div className="item-value">{fmt(v.totalAmount)}</div>
                                </div>
                            );
                        })}
                        </div>
                    </section>
                    )}
                </main>

                <div className="ai-button-container !mt-4 mb-8">
                    <button className="ai-button" onClick={onOpenChat}>
                        <svg viewBox="0 0 24 24">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                            <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
                        </svg>
                        Pregúntale a Cuentitas
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}
