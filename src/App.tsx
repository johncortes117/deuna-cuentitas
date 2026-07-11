import { useState, useEffect } from 'react';
import MitiMitiApp from './mitimiti/MitiMitiApp';
import { getUserProfile, createUserProfile, saveUserProfile, decodeQR, formatMoney, toCents } from './mitimiti/utils';
import type { UserProfile } from './mitimiti/types';
import QRScanner from './mitimiti/components/QRScanner';
import SimulatedPaymentView from './mitimiti/components/SimulatedPaymentView';
import { createRoom } from './mitimiti/supabase';
import {
  getFullscreenElement,
  isVisuallyFullscreen,
  isCameraActive,
  exitFullscreen,
  forceFullscreen,
} from './fullscreen';

type Screen = 'home' | 'setup' | 'dashboard' | 'mitimiti' | 'scanner';
type BottomTab = 'inicio' | 'beneficios' | 'billetera' | 'tu';

// ═══════════════════════════════════════════════════════════════
// Main App Component
// ═══════════════════════════════════════════════════════════════
function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (window.location.hash.startsWith('#/mitimiti')) return 'mitimiti';
    return 'home';
  });
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);

  // Show the real fullscreen failure reason (helps diagnose mobile quirks).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onErr = (e: Event) => {
      setFsError((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setFsError(null), 8000);
    };
    window.addEventListener('fs-error', onErr as EventListener);
    return () => {
      window.removeEventListener('fs-error', onErr as EventListener);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    setProfile(getUserProfile());

    // Ensure fullscreen on user interactions to recover from keyboard breaks
    // and from the browser exiting fullscreen (e.g. after the camera permission prompt).
    const ensureFullscreen = (e: Event) => {
      try {
        if (window.innerWidth >= 768) return;
        // NUNCA forzar fullscreen mientras la cámara del escáner está viva:
        // entrar en fullscreen con la cámara encendida es lo que crea el
        // estado "zombi" irrecuperable en Android Chrome.
        if (isCameraActive()) return;
        // Only skip when we are REALLY fullscreen. `fullscreenElement` alone
        // lies after the camera permission prompt (stale fullscreen state).
        if (getFullscreenElement() && isVisuallyFullscreen()) return;

        const target = e.target as HTMLElement | null;
        if (!target) return;

        // The manual fullscreen button toggles fullscreen itself. If we also
        // react to its tap here we enter fullscreen on `touchstart` and then the
        // button exits it on `click`, cancelling each other out. Let it be.
        if (target.closest('[data-fullscreen-toggle]')) return;

        // If the user is tapping on an input to type, do not force fullscreen right now
        // as forcing it can cause the keyboard to glitch in some Android browsers.
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('input, textarea')
        ) {
          return;
        }

        void forceFullscreen();
      } catch (err) {
        // Ignore errors
      }
    };

    window.addEventListener('click', ensureFullscreen);
    window.addEventListener('touchstart', ensureFullscreen, { passive: true });

    return () => {
      window.removeEventListener('click', ensureFullscreen);
      window.removeEventListener('touchstart', ensureFullscreen);
    };
  }, []);

  useEffect(() => {
    function handleHash() {
      if (window.location.hash.startsWith('#/mitimiti')) {
        setScreen('mitimiti');
      } else if (screen === 'mitimiti') {
        setScreen(profile ? 'dashboard' : 'home');
      }
    }
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [profile, screen]);

  // Fullscreen components (No iPhone frame for MitiMiti and Scanner)
  if (screen === 'mitimiti') {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center font-sans md:py-8">
        <div className="relative w-full h-[100dvh] md:w-[393px] md:h-[852px] bg-black md:bg-[#0a0a0a] md:rounded-[55px] md:shadow-[0_0_0_2px_#1f1f1f,0_20px_40px_rgba(0,0,0,0.5)] md:p-[12px]">
          <div className="hidden md:block absolute -left-[3px] top-[115px] w-[3px] h-[26px] bg-[#1f1f1f] rounded-l-md" />
          <div className="hidden md:block absolute -left-[3px] top-[165px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" />
          <div className="hidden md:block absolute -left-[3px] top-[230px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" />
          <div className="hidden md:block absolute -right-[3px] top-[200px] w-[3px] h-[75px] bg-[#1f1f1f] rounded-r-md" />
          <div className="bg-white w-full h-full md:rounded-[43px] overflow-hidden flex flex-col relative font-sans">
            <div className="hidden md:flex absolute top-[11px] left-1/2 -translate-x-1/2 w-[122px] h-[34px] bg-[#0a0a0a] rounded-[24px] z-50 items-center justify-end px-3">
              <div className="w-3 h-3 rounded-full bg-[#111] shadow-inner" />
            </div>
            <FullscreenButton />
            <FullscreenErrorToast message={fsError} />
            <MitiMitiApp />
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'scanner') {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center font-sans md:py-8">
        <div className="relative w-full h-[100dvh] md:w-[393px] md:h-[852px] bg-black md:bg-[#0a0a0a] md:rounded-[55px] md:shadow-[0_0_0_2px_#1f1f1f,0_20px_40px_rgba(0,0,0,0.5)] md:p-[12px]">
          <div className="hidden md:block absolute -left-[3px] top-[115px] w-[3px] h-[26px] bg-[#1f1f1f] rounded-l-md" />
          <div className="hidden md:block absolute -left-[3px] top-[165px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" />
          <div className="hidden md:block absolute -left-[3px] top-[230px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" />
          <div className="hidden md:block absolute -right-[3px] top-[200px] w-[3px] h-[75px] bg-[#1f1f1f] rounded-r-md" />
          <div className="bg-black w-full h-full md:rounded-[43px] overflow-hidden flex flex-col relative font-sans">
            <div className="hidden md:flex absolute top-[11px] left-1/2 -translate-x-1/2 w-[122px] h-[34px] bg-[#0a0a0a] rounded-[24px] z-50 items-center justify-end px-3">
              <div className="w-3 h-3 rounded-full bg-[#111] shadow-inner" />
            </div>
            <FullscreenButton />
            <FullscreenErrorToast message={fsError} />
            {/* Unmount the scanner once a QR is captured so the camera stream is
                fully released — a live camera keeps the browser from re-entering
                fullscreen on Android. */}
            {!scannedData && (
              <QRScanner
                onScan={(data) => {
                  setScannedData(data);
                }}
                onBack={() => setScreen('dashboard')}
              />
            )}
            {scannedData && (() => {
              const data = decodeQR(scannedData);
              if (!data) return null;
              
              if (data.type === 'mitimiti_invite') {
                window.location.hash = `#/mitimiti/join/${data.token}`;
                return null;
              }

              return (
                <SimulatedPaymentView
                  targetName={data.displayName || 'Comercio'}
                  onClose={() => setScannedData(null)}
                  onPayAlone={(amountStr) => {
                    alert(`Simulación: Pago directo realizado por $${amountStr}.`);
                    setScannedData(null);
                    setScreen('dashboard');
                  }}
                  onPayMitiMiti={async (roomName, amountStr) => {
                    setScannedData(null);
                    try {
                      if (!profile) return;
                      const cents = toCents(amountStr);
                      const room = await createRoom(profile.userId, profile.displayName, roomName, cents);
                      window.location.hash = `#/mitimiti/room/${room.id}`;
                    } catch (err) {
                      console.error("Error creando sala:", err);
                      window.location.hash = '#/mitimiti';
                    }
                  }}
                />
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex justify-center items-center font-sans md:py-8">
      {/* Marco de iPhone 15 en desktop, fullscreen en mobile */}
      <div className="relative w-full h-[100dvh] md:w-[393px] md:h-[852px] bg-black md:bg-[#0a0a0a] md:rounded-[55px] md:shadow-[0_0_0_2px_#1f1f1f,0_20px_40px_rgba(0,0,0,0.5)] md:p-[12px]">
        {/* Botones de Hardware */}
        <div className="hidden md:block absolute -left-[3px] top-[115px] w-[3px] h-[26px] bg-[#1f1f1f] rounded-l-md" />
        <div className="hidden md:block absolute -left-[3px] top-[165px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" />
        <div className="hidden md:block absolute -left-[3px] top-[230px] w-[3px] h-[50px] bg-[#1f1f1f] rounded-l-md" />
        <div className="hidden md:block absolute -right-[3px] top-[200px] w-[3px] h-[75px] bg-[#1f1f1f] rounded-r-md" />

        {/* Pantalla Interna */}
        <div className="bg-white w-full h-full md:rounded-[43px] overflow-hidden flex flex-col relative font-sans">
          {/* Dynamic Island */}
          <div className="hidden md:flex absolute top-[11px] left-1/2 -translate-x-1/2 w-[122px] h-[34px] bg-[#0a0a0a] rounded-[24px] z-50 items-center justify-end px-3">
            <div className="w-3 h-3 rounded-full bg-[#111] shadow-inner" />
          </div>
          <FullscreenButton />
          <FullscreenErrorToast message={fsError} />

          {screen === 'home' && (
            <ConsumerHomeScreen onEnter={() => setScreen(profile ? 'dashboard' : 'setup')} />
          )}
          
          {screen === 'setup' && (
            <SetupScreen onComplete={(p) => {
              setProfile(p);
              setScreen('dashboard');
            }} />
          )}

          {screen === 'dashboard' && profile && (
            <DashboardScreen profile={profile} onScanQR={() => setScreen('scanner')} onUpdateProfile={setProfile} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Consumer Home Screen (Pre-login)
// ═══════════════════════════════════════════════════════════════
function ConsumerHomeScreen({ onEnter }: { onEnter: () => void }) {
  const [visible, setVisible] = useState(false);
  const accountNumber = '0987657833';
  const displayNumber = visible
    ? accountNumber
    : `******${accountNumber.slice(-4)}`;

  return (
    <div className="flex flex-col flex-1 px-6 pt-16 pb-10 bg-white">
      {/* Logo */}
      <div className="flex justify-center mb-10">
        <h1 className="text-[44px] font-black text-[#4C1D80] tracking-[-2.5px] italic">
          deuna!
        </h1>
      </div>

      {/* QR Code central */}
      <div className="flex justify-center mb-6">
        <div className="relative p-6">
          {/* Esquinas moradas */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-[#4C1D80]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-[#4C1D80]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-[#4C1D80]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-[#4C1D80]" />
          
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://deuna.com/pay&color=000000&bgcolor=ffffff&margin=0"
            alt="QR Code"
            className="w-[200px] h-[200px]"
          />
          
          {/* Círculo central con d! */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_0_4px_white]">
              <span className="text-[#2FD9A9] font-black text-2xl italic tracking-tighter">d!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nro de cuenta */}
      <div className="text-center mb-16">
        <p className="text-gray-500 text-[15px] mb-1">Usa este QR o Nro de cuenta para cobrar</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[#1a1a1a] text-[18px]">
            Nro. <span className="font-bold">{displayNumber}</span>
          </span>
          <button onClick={() => setVisible(!visible)} className="text-[#1a1a1a]">
            {visible ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        </div>
      </div>

      {/* Botones secundarios */}
      <div className="flex justify-center gap-12 mb-auto">
        <button className="flex flex-col items-center gap-3">
          <div className="w-[72px] h-[72px] bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex items-center justify-center">
            <TrainIcon />
          </div>
          <span className="text-[14px] text-gray-700 font-medium">Metro UIO</span>
        </button>
        <button className="flex flex-col items-center gap-3">
          <div className="w-[72px] h-[72px] bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#4C1D80]">
            <QrSmallIcon size={32} />
          </div>
          <span className="text-[14px] text-gray-700 font-medium">Escanear QR</span>
        </button>
      </div>

      {/* CTA Principal */}
      <button
        onClick={onEnter}
        className="w-full bg-[#4C1D80] text-white py-[18px] rounded-[20px] text-[18px] font-bold active:scale-[0.98] transition-all tracking-wide"
      >
        Ingresar a Deuna
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Setup Screen (Pedir nombre, extraído de MitiMiti)
// ═══════════════════════════════════════════════════════════════
function SetupScreen({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    const profile = createUserProfile(name.trim());
    onComplete(profile);
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-24 pb-10 bg-white">
      <div className="flex flex-col items-center mb-10">
        <h1 className="text-[44px] font-black text-[#4C1D80] leading-none tracking-[-2px] italic">
          deuna!
        </h1>
      </div>
      <h2 className="text-[22px] font-bold text-[#1a1a1a] text-center mb-2">
        ¿Cómo te llamas?
      </h2>
      <p className="text-[15px] text-gray-500 text-center mb-8">
        Queremos conocerte para personalizar tu experiencia
      </p>
      <input
        type="text"
        placeholder="Ej. María Andrade"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        className="w-full bg-[#F4F4F6] border-none rounded-[16px] py-4 px-4 text-[16px] text-center focus:outline-none focus:ring-2 focus:ring-[#4C1D80] transition-shadow placeholder:text-gray-400 mb-4"
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className={`w-full py-[18px] rounded-[20px] text-[18px] font-bold transition-all mt-auto ${
          name.trim()
            ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        Continuar
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Screen (Consumer)
// ═══════════════════════════════════════════════════════════════
function DashboardScreen({ profile, onScanQR, onUpdateProfile }: { profile: UserProfile, onScanQR: () => void, onUpdateProfile: (p: UserProfile) => void }) {
  const [showSaldo, setShowSaldo] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>('inicio');

  const gridItems = [
    { label: 'Transferir', icon: <TransferIcon /> },
    { label: 'Transferir a\notro banco', icon: <BankIcon /> },
    { label: 'Recargar', icon: <TopUpIcon /> },
    { label: 'Cobrar', icon: <ReceiveIcon /> },
    { label: 'Retirar', icon: <WithdrawIcon /> },
    { label: 'Recarga\ncelular', icon: <PhoneTopUpIcon /> },
    { label: 'Pagar\nservicios', icon: <PayBillsIcon /> },
    { label: 'Metro de\nQuito', icon: <TrainIconSmall /> },
    { label: 'Deuna\nJóvenes', icon: <YouthIcon /> },
    { label: 'Invita y\nGana', icon: <GiftIcon /> },
    { label: 'MitiMiti', icon: <MitiIcon /> },
  ];

  return (
    <div className="flex flex-col flex-1 bg-white pt-14 pb-0 h-full">
      {/* Header / Saldo */}
      <div className="px-5 mb-4">
        <p className="text-gray-500 text-[15px] mb-1">Saldo disponible</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[34px] font-bold text-[#1a1a1a] tracking-tight">
              {showSaldo ? formatMoney(profile.balanceCents) : '••••'}
            </h2>
            <button onClick={() => setShowSaldo(!showSaldo)} className="text-[#1a1a1a]">
              {showSaldo ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          <ChevronRightIcon />
        </div>
      </div>

      {/* Banner Gastos */}
      <div className="bg-[#F6F0FE] px-5 py-3 flex items-center gap-2 mb-4 cursor-pointer">
        <ChartIcon />
        <span className="text-[#4C1D80] font-semibold text-[13px] underline decoration-[#4C1D80]/30">Gastaste $ 24,95 los últimos 30 días</span>
      </div>

      {/* Recargar Card */}
      <div 
        onClick={() => {
          const addedAmount = Math.floor(Math.random() * 401) + 200;
          const newProfile = { ...profile, balanceCents: profile.balanceCents + addedAmount };
          saveUserProfile(newProfile);
          onUpdateProfile(newProfile);
        }}
        className="mx-5 border border-gray-100 rounded-[20px] p-4 flex items-center justify-between shadow-sm mb-6 cursor-pointer active:scale-95 transition-transform"
      >
        <div>
          <p className="text-gray-500 text-[14px]">Recargar desde</p>
          <p className="text-[#1a1a1a] font-bold text-[14px]">Principal ******2213</p>
        </div>
        <button className="border border-gray-200 rounded-full py-2 px-4 flex items-center gap-2 pointer-events-none">
          <span className="text-[#4C1D80] font-bold text-[15px]">Aleatorio</span>
          <span className="text-gray-300">»</span>
          <span className="text-[#4C1D80] font-black italic text-[16px]">d!</span>
        </button>
      </div>

      {/* Grid de Funcionalidades */}
      <div className="grid grid-cols-4 gap-y-6 px-4 flex-1 content-start overflow-y-auto pb-24">
        {gridItems.map((item, i) => (
          <div 
            key={i} 
            className="flex flex-col items-center gap-2 cursor-pointer group"
            onClick={() => {
              if (item.label === 'MitiMiti') {
                window.location.hash = '#/mitimiti';
              }
            }}
          >
            <div className="w-[60px] h-[60px] bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-50 transition-transform group-active:scale-95">
              {item.icon}
            </div>
            <span className="text-[12px] text-gray-700 font-medium text-center leading-[1.1] whitespace-pre-line">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Botón Flotante Escanear QR */}
      <div className="absolute bottom-[80px] left-5 right-5 z-10">
        <button 
          onClick={onScanQR}
          className="w-full bg-[#4C1D80] text-white py-[16px] rounded-[18px] text-[17px] font-bold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(76,29,128,0.25)] active:scale-[0.98] transition-all"
        >
          <QrSmallIcon size={20} />
          Escanear QR
        </button>
      </div>

      {/* Bottom Nav */}
      <div className="bg-white border-t border-gray-100 flex items-center justify-around py-3 px-2 z-20 pb-5">
        <NavButton active={bottomTab === 'inicio'} icon={<BottomHomeIcon active={bottomTab === 'inicio'}/>} label="Inicio" onClick={() => setBottomTab('inicio')} />
        <NavButton active={bottomTab === 'beneficios'} icon={<GiftNavIcon active={bottomTab === 'beneficios'}/>} label="Beneficios" onClick={() => setBottomTab('beneficios')} />
        <NavButton active={bottomTab === 'billetera'} icon={<WalletIcon active={bottomTab === 'billetera'}/>} label="Billetera" onClick={() => setBottomTab('billetera')} />
        <NavButton active={bottomTab === 'tu'} icon={<UserIcon active={bottomTab === 'tu'}/>} label="Tú" onClick={() => setBottomTab('tu')} />
      </div>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 min-w-[64px]">
      {icon}
      <span className={`text-[11px] ${active ? 'text-[#4C1D80] font-semibold' : 'text-gray-400 font-medium'}`}>{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// Iconos (Mocks rápidos de la interfaz de DeUna)
// ═══════════════════════════════════════════════════════════════
const EyeIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const TrainIcon = () => <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><line x1="12" y1="3" x2="12" y2="11"/><line x1="8" y1="19" x2="10" y2="23"/><line x1="16" y1="19" x2="14" y2="23"/><line x1="6" y1="23" x2="18" y2="23"/></svg>;
const TrainIconSmall = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><line x1="12" y1="3" x2="12" y2="11"/><line x1="8" y1="19" x2="10" y2="23"/><line x1="16" y1="19" x2="14" y2="23"/><line x1="6" y1="23" x2="18" y2="23"/></svg>;
const QrSmallIcon = ({size=24}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3"/><path d="M21 21h-3v-3"/></svg>;
const ChevronRightIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const ChartIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;

// Grid Icons (approximate representations)
const TransferIcon = () => <div className="text-[28px]">💸</div>;
const BankIcon = () => <div className="text-[28px]">🏦</div>;
const TopUpIcon = () => <div className="text-[28px]">👝</div>;
const ReceiveIcon = () => <div className="text-[28px]">💳</div>;
const WithdrawIcon = () => <div className="text-[28px]">🏪</div>;
const PhoneTopUpIcon = () => <div className="text-[28px]">📱</div>;
const PayBillsIcon = () => <div className="text-[28px]">🧾</div>;
const YouthIcon = () => <div className="text-[28px]">👥</div>;
const GiftIcon = () => <div className="text-[28px]">🎁</div>;
const MitiIcon = () => <div className="text-[28px]">🤝</div>;

// Bottom Nav Icons
const BottomHomeIcon = ({active}:{active:boolean}) => <svg width="24" height="24" viewBox="0 0 24 24" fill={active?"#4C1D80":"none"} stroke={active?"#4C1D80":"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const GiftNavIcon = ({active}:{active:boolean}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active?"#4C1D80":"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>;
const WalletIcon = ({active}:{active:boolean}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active?"#4C1D80":"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const UserIcon = ({active}:{active:boolean}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active?"#4C1D80":"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

// ═══════════════════════════════════════════════════════════════
// Fullscreen Toggle Button (For Demos)
// ═══════════════════════════════════════════════════════════════
// Small, auto-dismissing toast that reveals why fullscreen failed on-device.
function FullscreenErrorToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] max-w-[90vw] px-4 py-2 rounded-xl bg-black/85 text-white text-[12px] font-medium shadow-lg text-center pointer-events-none md:hidden">
      Pantalla completa: {message}
    </div>
  );
}

function FullscreenButton() {
  return (
    <button
      data-fullscreen-toggle
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Con la cámara encendida NO se puede entrar a fullscreen sin crear
        // el estado zombi de Android Chrome. El escáner ya es inmersivo.
        if (isCameraActive()) return;
        // Decide by the VISUAL state, not by `fullscreenElement` — that flag
        // can stay stale ("zombie fullscreen") after the camera permission
        // prompt, which made this button call exit when the user wanted enter.
        if (getFullscreenElement() && isVisuallyFullscreen()) {
          void exitFullscreen();
        } else {
          void forceFullscreen();
        }
      }}
      className="absolute top-4 right-4 z-[9999] p-[10px] bg-black/20 backdrop-blur-md rounded-full text-white/90 hover:bg-black/40 transition-all shadow-md md:hidden"
      title="Pantalla completa"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    </button>
  );
}

export default App;