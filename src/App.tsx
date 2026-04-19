import React, { useState } from 'react';

// ─── Tipos ───
type Screen = 'login' | 'dashboard';
type Tab = 'cobrar' | 'gestionar';
type PayMode = 'qr' | 'manual';
type BottomTab = 'inicio' | 'micaja' | 'menu' | 'ia';

import { ChatbotView } from './chatbot/ChatbotView';
import MisCuentitas from './components/dashboard/MisCuentitas';
import { mockMisCuentitas } from './data/mockData';

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════
function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [commerce, setCommerce] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 flex justify-center items-center font-sans py-8">
      {/* Marco de iPhone 15 */}
      <div className="relative w-[393px] h-[852px] bg-[#0a0a0a] rounded-[55px] shadow-[0_0_0_2px_#1f1f1f,0_20px_40px_rgba(0,0,0,0.5)] p-[12px]">
        {/* Botones de Hardware */}
        <div className="absolute -left-[3px] top-[115px] w-[3px] h-[26px] bg-[#1f1f1f] rounded-l-md" /> {/* Mute */}
        <div className="absolute -left-[3px] top-[165px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" /> {/* Vol+ */}
        <div className="absolute -left-[3px] top-[230px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" /> {/* Vol- */}
        <div className="absolute -right-[3px] top-[200px] w-[3px] h-[75px] bg-[#1f1f1f] rounded-r-md" /> {/* Power */}

        {/* Pantalla Interna */}
        <div
          className="bg-white w-full h-full rounded-[43px] overflow-hidden flex flex-col relative"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {/* Dynamic Island */}
          <div className="absolute top-[11px] left-1/2 -translate-x-1/2 w-[122px] h-[34px] bg-[#0a0a0a] rounded-[24px] z-50 flex items-center justify-end px-3">
            {/* Lente de la cámara invisible */}
            <div className="w-3 h-3 rounded-full bg-[#111] shadow-inner" />
          </div>

          {screen === 'login' ? (
            <LoginScreen onIngresar={(c) => {
              setCommerce(c);
              setScreen('dashboard');
            }} />
          ) : (
            <DashboardScreen commerce={commerce} onBack={() => {
              setCommerce(null);
              setScreen('login');
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pantalla de Login (vista original)
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onIngresar }: { onIngresar: (commerce: { id: string, name: string }) => void }) {
  const [role, setRole] = useState<'admin' | 'vendedor'>('admin');
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');

  const handleLogin = () => {
    const term = name.trim().toLowerCase();

    let commerceId = 'NEG001';
    let displayName = name.trim() || 'Jervin';

    if (term.includes('carmita')) {
      commerceId = 'NEG001';
      displayName = 'Carmita';
    } else if (term.includes('roberto')) {
      commerceId = 'NEG002';
      displayName = 'Don Roberto';
    } else if (term.includes('luc')) {
      commerceId = 'NEG003';
      displayName = 'Lucía';
    }

    onIngresar({ id: commerceId, name: displayName });
  };

  const accountNumber = '1234556443';
  const displayNumber = visible
    ? `${accountNumber.slice(0, 4)} ${accountNumber.slice(4)}`
    : `••••••${accountNumber.slice(-4)}`;

  return (
    <>
      {/* Status Bar */}
      <StatusBar />

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 px-6 pb-13">
        {/* Logo */}
        <div className="flex flex-col items-center mt-3 mb-3">
          <h1 className="text-[48px] font-black text-[#4C1D80] leading-none tracking-[-2px]">
            deuna!
          </h1>
          <span className="bg-[#2FD9A9] text-white text-[11px] font-bold px-3 py-0.5 rounded mt-1 tracking-wide">
            Negocios
          </span>
        </div>

        {/* QR */}
        <div className="relative w-[210px] h-[210px] mx-auto mb-4 flex items-center justify-center">
          <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-gray-300 rounded-tl-sm" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-gray-300 rounded-tr-sm" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-gray-300 rounded-bl-sm" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-gray-300 rounded-br-sm" />
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://deuna.com/negocios&color=000000&bgcolor=ffffff&margin=0"
            alt="Código QR de Deuna Negocios"
            className="w-[180px] h-[180px] object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-full w-12 h-12 flex items-center justify-center shadow-[0_0_0_5px_white]">
              <span className="text-[#4C1D80] font-black text-xl italic tracking-tighter">d!</span>
            </div>
          </div>
        </div>

        {/* Número de cuenta */}
        <div className="text-center mb-5">
          <p className="text-[#1a1a1a] font-medium text-sm">Cobra con este QR o Nro de cuenta</p>
          <div className="flex items-center justify-center gap-2.5 mt-1.5">
            <span className="text-gray-400 text-sm">
              Nro. <span className="text-[#4C1D80] font-bold">{displayNumber}</span>
            </span>
            <button
              onClick={() => setVisible(v => !v)}
              className="text-[#4C1D80] p-1.5 rounded-full hover:bg-purple-50 transition-colors"
            >
              {visible ? <EyeIcon /> : <EyeOffIcon />}
            </button>
            <button className="text-[#4C1D80] p-1.5 rounded-full hover:bg-purple-50 transition-colors">
              <ShareIcon />
            </button>
          </div>
        </div>

        {/* Toggle de rol */}
        <div className="flex bg-[#F4F4F6] rounded-[30px] p-1 mb-5">
          {(['admin', 'vendedor'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-3 text-[13px] rounded-[26px] transition-all font-medium ${role === r ? 'bg-white text-[#4C1D80] font-semibold shadow-sm' : 'text-gray-400'
                }`}
            >
              {r === 'admin' ? 'Administrador' : 'Vendedor'}
            </button>
          ))}
        </div>

        <div className="h-px bg-gray-100 mb-4" />

        {/* Input Usuario (Añadido para las demos) */}
        <div className="mb-5 relative">
          <input
            type="text"
            placeholder="Usuario (Ej. Carmita, Roberto, Lucía)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#F4F4F6] border border-gray-200 rounded-[16px] py-3.5 px-4 text-[14px] text-[#1a1a1a] focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors"
          />
        </div>

        {/* Verificar cobro */}
        <div className="text-center mb-5">
          <p className="text-[#4C1D80] font-semibold text-sm mb-3.5">Verificar un cobro</p>
          <div className="flex justify-center gap-9">
            <ActionButton label="Por whatsapp" icon={<ChatIcon />} />
            <ActionButton label="Escaneando QR" icon={<ScanIcon />} />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleLogin}
          disabled={!name.trim()}
          className={`mt-auto w-full py-4 rounded-[14px] text-[17px] font-bold active:scale-[0.98] transition-all tracking-tight shrink-0 ${name.trim() ? 'bg-[#4C1D80] text-white hover:bg-[#3d1766]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          Ingresar
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pantalla Dashboard / Cobrar
// ═══════════════════════════════════════════════════════════════
function DashboardScreen({ onBack, commerce }: { onBack: () => void, commerce: { id: string, name: string } | null }) {
  const [tab, setTab] = useState<Tab>('cobrar');
  const [payMode, setPayMode] = useState<PayMode>('qr');
  const [bottomTab, setBottomTab] = useState<BottomTab>('inicio');
  const [amount, setAmount] = useState('0');
  const [showSaldo, setShowSaldo] = useState(false);

  const handleKey = (key: string) => {
    if (key === 'del') {
      setAmount(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === ',') {
      if (amount.includes(',')) return;
      setAmount(prev => prev + ',');
      return;
    }
    // Limitar decimales a 2
    if (amount.includes(',')) {
      const decimals = amount.split(',')[1];
      if (decimals && decimals.length >= 2) return;
    }
    setAmount(prev => (prev === '0' ? key : prev + key));
  };

  const hasAmount = amount !== '0' && amount !== '';

  return (
    <>
      {/* ── Status Bar ── */}
      {!showSaldo && <StatusBar />}

      {/* ── Contenido Principal ── */}
      {showSaldo ? (
        <div className="flex flex-col flex-1 overflow-hidden" style={{ backgroundColor: '#F5F4F0' }}>
          <MisCuentitas
            data={mockMisCuentitas}
            onClose={() => setShowSaldo(false)}
            onOpenChat={() => {
              setShowSaldo(false);
              setBottomTab('ia');
            }}
          />
        </div>
      ) : bottomTab === 'ia' ? (
        <ChatbotView commerceId={commerce?.id || 'NEG001'} />
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-2 pb-0 shrink-0">
            <div className="flex items-center justify-between">
              {/* Perfil */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onBack}
                  className="w-9 h-9 bg-[#4C1D80] rounded-lg flex items-center justify-center shrink-0"
                >
                  <HomeIcon />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-[#1a1a1a] truncate">Hola! {commerce?.name || 'Jervin'}</span>
                    <span className="bg-[#4C1D80] text-white text-[9px] font-bold px-2 py-[1px] rounded">
                      Admin
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">Intriago Andrade Jervin...</p>
                </div>
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-3">
                <button className="text-[#4C1D80]">
                  <QrSmallIcon />
                </button>
                <button className="text-[#4C1D80] relative">
                  <BellIcon />
                </button>
                <button className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <UserIcon />
                </button>
              </div>
            </div>

            {/* Tabs Cobrar / Gestionar */}
            <div className="flex mt-4 border-b border-gray-100">
              {(['cobrar', 'gestionar'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 pb-3 text-[14px] font-semibold transition-colors relative ${tab === t ? 'text-[#4C1D80]' : 'text-gray-400'
                    }`}
                >
                  {t === 'cobrar' ? 'Cobrar' : 'Gestionar'}
                  {tab === t && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido del tab */}
          {tab === 'cobrar' ? (
            <div className="flex flex-col flex-1 px-5 overflow-hidden">
              {/* Monto */}
              <div className="text-center mt-6 mb-4">
                <p className="text-[#4C1D80] text-[13px] font-medium mb-1">Monto</p>
                <p className="text-[48px] font-bold text-[#1a1a1a] leading-none tracking-tight">
                  $ {amount}
                </p>
              </div>

              {/* Toggle QR / Manual */}
              <div className="flex bg-[#F4F4F6] rounded-full p-[3px] mx-auto w-[220px] mb-4">
                {(['qr', 'manual'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMode(m)}
                    className={`flex-1 py-2.5 text-[13px] rounded-full transition-all font-semibold ${payMode === m
                      ? 'bg-[#4C1D80] text-white shadow-sm'
                      : 'text-gray-400'
                      }`}
                  >
                    {m === 'qr' ? 'QR' : 'Manual'}
                  </button>
                ))}
              </div>

              {/* Agregar motivo */}
              <button className="flex items-center justify-between w-full py-3 border-b border-gray-100 mb-2">
                <span className="text-[13px] text-gray-400">Agregar motivo (opcional)</span>
                <ChevronRightIcon />
              </button>

              {/* Teclado numérico */}
              <div className="grid grid-cols-3 gap-y-1 mt-2 flex-1 content-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map(key => (
                  <button
                    key={key}
                    onClick={() => handleKey(key)}
                    className="flex items-center justify-center py-3.5 rounded-xl text-[28px] font-semibold text-[#4C1D80] active:bg-gray-100 transition-colors"
                  >
                    {key === 'del' ? <BackspaceIcon /> : key}
                  </button>
                ))}
              </div>

              {/* CTA */}
              <button
                className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all mt-2 mb-1 shrink-0 ${hasAmount
                  ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                disabled={!hasAmount}
              >
                Continuar para Cobrar
              </button>
            </div>
          ) : (
            /* ── Tab Gestionar ── */
            <div className="flex flex-col flex-1 px-5 overflow-y-auto pb-4">
              {/* Mi Saldo */}
              <button
                onClick={() => setShowSaldo(true)}
                className="bg-[#F8F8FA] rounded-2xl p-5 mt-5 mb-6 flex items-center justify-between border border-gray-100 w-full text-left shrink-0"
              >
                <div>
                  <p className="text-gray-500 text-[13px] font-medium mb-1">Mis Cuentitas</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[32px] font-bold text-[#1a1a1a] leading-none">$0,80</span>
                    <span className="text-gray-400">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </span>
                  </div>
                </div>
                <ChevronRightIcon />
              </button>

              {/* Accesos rápidos */}
              <h3 className="text-[16px] font-bold text-[#1a1a1a] mb-4 shrink-0">Accesos rápidos</h3>
              <div className="grid grid-cols-4 gap-3 mb-6 shrink-0">
                <QuickAction icon={<ArrowDownIcon />} label="Recargar saldo" />
                <QuickAction icon={<ArrowUpIcon />} label="Transferir saldo" />
                <QuickAction icon={<DollarIcon />} label="Venta Manual" />
                <QuickAction icon={<VerifyIcon />} label="Verificar pago" />
              </div>

              {/* Novedades */}
              <h3 className="text-[16px] font-bold text-[#1a1a1a] mb-4 shrink-0">Novedades Deuna Negocios</h3>
              <div className="flex gap-3 shrink-0">
                <div className="flex-1 bg-[#F8F8FA] rounded-2xl p-4 border border-gray-100 flex flex-col justify-between min-h-[140px]">
                  <p className="text-[13px] font-semibold text-[#1a1a1a] leading-snug">
                    Agrega vendedores<br />a tu equipo
                  </p>
                  <div className="w-9 h-9 bg-[#0d9b7a] rounded-lg flex items-center justify-center mt-3">
                    <span className="text-white font-black text-sm italic">d!</span>
                  </div>
                </div>
                <div className="flex-1 bg-[#F8F8FA] rounded-2xl p-4 border border-gray-100 flex flex-col justify-between min-h-[140px]">
                  <p className="text-[13px] font-semibold text-[#1a1a1a] leading-snug">
                    Administra<br />tus ventas<br />con tu caja
                  </p>
                  <div className="w-9 h-9 bg-[#0d9b7a] rounded-lg flex items-center justify-center mt-3">
                    <span className="text-white font-black text-sm italic">d!</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="flex items-center justify-around border-t border-gray-100 py-2.5 px-4 shrink-0">
        {([
          { id: 'inicio' as BottomTab, label: 'Inicio', icon: <BottomHomeIcon active={bottomTab === 'inicio'} /> },
          { id: 'micaja' as BottomTab, label: 'Mi Caja', icon: <CashRegisterIcon active={bottomTab === 'micaja'} /> },
          { id: 'ia' as BottomTab, label: 'Cuentitas', icon: <IAIcon active={bottomTab === 'ia'} /> },
          { id: 'menu' as BottomTab, label: 'Menú', icon: <MenuIcon active={bottomTab === 'menu'} /> },
        ]).map(item => (
          <button
            key={item.id}
            onClick={() => setBottomTab(item.id)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 ${bottomTab === item.id ? 'text-[#4C1D80]' : 'text-gray-400'
              }`}
          >
            {item.icon}
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componentes auxiliares
// ═══════════════════════════════════════════════════════════════
function StatusBar() {
  return (
    <div className="flex justify-between items-center px-7 pt-14 pb-0 shrink-0">
      <span className="text-[15px] font-semibold text-[#1a1a1a] tracking-tight">12:13</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
          <rect x="0" y="7" width="3" height="5" rx="1" fill="#1a1a1a" />
          <rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="#1a1a1a" />
          <rect x="9" y="2" width="3" height="10" rx="1" fill="#1a1a1a" />
          <rect x="13.5" y="0" width="3" height="12" rx="1" fill="#e0e0e0" />
        </svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M7 2.5C8.8 2.5 10.4 3.2 11.6 4.4L12.8 3.2C11.2 1.6 9.2 .7 7 .7 4.8.7 2.8 1.6 1.2 3.2L2.4 4.4C3.6 3.2 5.2 2.5 7 2.5Z" fill="#1a1a1a" />
          <path d="M7 5.2C8.2 5.2 9.3 5.7 10.1 6.5L11.3 5.3C10.2 4.2 8.7 3.5 7 3.5 5.3 3.5 3.8 4.2 2.7 5.3L3.9 6.5C4.7 5.7 5.8 5.2 7 5.2Z" fill="#1a1a1a" />
          <circle cx="7" cy="9" r="1.2" fill="#1a1a1a" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x=".5" y=".5" width="21" height="11" rx="3.5" stroke="#1a1a1a" strokeOpacity=".35" />
          <rect x="2" y="2" width="17" height="8" rx="2" fill="#1a1a1a" />
          <path d="M23 4.5C23.8 4.9 23.8 7.1 23 7.5V4.5Z" fill="#1a1a1a" fillOpacity=".4" />
        </svg>
      </div>
    </div>
  );
}

function ActionButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
      <div className="w-12 h-12 bg-[#F4F4F6] rounded-full flex items-center justify-center group-hover:bg-purple-50 transition-colors">
        {icon}
      </div>
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════════════════════
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const ChatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const ScanIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </svg>
);

// ── Dashboard Icons ──
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const QrSmallIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" />
    <path d="M21 14h-3v3" /><path d="M21 21h-3v-3" />
  </svg>
);
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const BackspaceIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);

const BottomHomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#4C1D80' : 'none'} stroke={active ? '#4C1D80' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const CashRegisterIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4C1D80' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M2 10h20" /><path d="M6 14h.01" /><path d="M10 14h.01" /><path d="M14 14h.01" /><path d="M18 14h.01" />
    <path d="M6 2h12v4H6z" />
  </svg>
);
const MenuIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4C1D80' : 'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);
const IAIcon = ({ active }: { active: boolean }) => {
  const color = active ? '#4C1D80' : 'currentColor';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <rect x="1.5" y="12" width="5.5" height="10" rx="2.5" />
      <rect x="9" y="8" width="5.5" height="14" rx="2.5" />
      <rect x="16.5" y="3" width="5.5" height="19" rx="2.5" />
      <path d="M2.5 9c3.5-1 6.5-3 8-5.5l-1.5-1.5h6v6l-1.5-1.5c-2 3-5.5 5-9.5 4.5z" />
    </svg>
  );
};

// ── Gestionar Icons & Components ──
function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <div className="w-14 h-14 bg-[#F4F4F6] rounded-full flex items-center justify-center group-hover:bg-purple-50 transition-colors border border-gray-100">
        {icon}
      </div>
      <span className="text-[11px] text-gray-600 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

const ArrowDownIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);
const DollarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const VerifyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export default App;