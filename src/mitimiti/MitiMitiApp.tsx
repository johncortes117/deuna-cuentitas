// ─── MitiMitiApp: Router principal del módulo MitiMiti ────────
import { useState, useEffect, useCallback } from 'react';
import type { MitiMitiRoute, UserProfile } from './types';
import { getUserProfile, createUserProfile, decodeQR, encodePersonalQR, toCents, fromCents } from './utils';
import { createRoom } from './supabase';
import QRScanner from './components/QRScanner';
import PaymentModeModal from './components/PaymentModeModal';
import CreateRoomView from './components/CreateRoomView';
import RoomView from './components/RoomView';
import JoinRoomView from './components/JoinRoomView';
import './MitiMiti.css';

// ─── QR personal en el Home ──────────────────────────────────
import { useEffect as useEffectRef, useRef } from 'react';
import QRCode from 'qrcode';

function PersonalQR({ profile }: { profile: UserProfile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffectRef(() => {
    if (!canvasRef.current) return;
    const data = encodePersonalQR(profile);
    QRCode.toCanvas(canvasRef.current, data, {
      width: 180,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }, [profile]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-gray-300 rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-gray-300 rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-gray-300 rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-gray-300 rounded-br-sm" />
      <canvas ref={canvasRef} className="rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-[0_0_0_4px_white]">
          <span className="text-[#4C1D80] font-black text-lg italic tracking-tighter">d!</span>
        </div>
      </div>
    </div>
  );
}

// ─── Setup Screen (crear perfil) ─────────────────────────────
function SetupScreen({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    const profile = createUserProfile(name.trim());
    onComplete(profile);
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-20 pb-6">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-[40px] font-black text-[#4C1D80] leading-none tracking-[-2px]">
          deuna!
        </h1>
        <span className="bg-[#2FD9A9] text-white text-[11px] font-bold px-3 py-0.5 rounded mt-1 tracking-wide">
          MitiMiti
        </span>
      </div>

      <h2 className="text-[20px] font-bold text-[#1a1a1a] text-center mb-2">
        ¿Cómo te llamas?
      </h2>
      <p className="text-[14px] text-gray-400 text-center mb-6">
        Tu nombre aparecerá en los pagos grupales
      </p>

      <input
        type="text"
        placeholder="Ej. María Andrade"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        className="w-full bg-[#F8F8FA] border border-gray-100 rounded-2xl py-4 px-4 text-[16px] text-[#1a1a1a] text-center focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors placeholder:text-gray-400 mb-4"
        autoFocus
      />

      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all mt-auto ${
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

// ─── Home Screen ─────────────────────────────────────────────
function HomeScreen({ profile, onScan }: { profile: UserProfile; onScan: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="px-5 pt-14 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `hsl(${Math.abs(profile.displayName.charCodeAt(0) * 37) % 360}, 65%, 55%)` }}
            >
              <span className="text-white font-bold text-[13px]">
                {profile.displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-[15px] font-bold text-[#1a1a1a]">
                Hola {profile.displayName.split(' ')[0]} 👋
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QR Personal */}
      <div className="flex flex-col items-center flex-1 px-6 pt-4">
        <PersonalQR profile={profile} />

        <p className="text-[14px] text-gray-400 text-center mt-4 mb-6">
          Muestra este QR para que te paguen
        </p>

        {/* Sección MitiMiti */}
        <div className="w-full bg-[#F8F8FA] rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#EEEDFE] rounded-full flex items-center justify-center">
              <span className="text-xl">🤝</span>
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#1a1a1a]">MitiMiti</p>
              <p className="text-[12px] text-gray-400">Divide y paga en grupo</p>
            </div>
          </div>

          <p className="text-[13px] text-gray-500 leading-relaxed">
            Escanea el QR de alguien para iniciar un pago grupal, 
            o espera a que te escaneen para unirte.
          </p>
        </div>
      </div>

      {/* CTA Escanear */}
      <div className="px-5 pb-4 shrink-0">
        <button
          onClick={onScan}
          className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          </svg>
          Escanear QR
        </button>
      </div>
    </div>
  );
}

// ─── MitiMitiApp (Router principal) ──────────────────────────
export default function MitiMitiApp() {
  const [profile, setProfile] = useState<UserProfile | null>(() => getUserProfile());
  const [route, setRoute] = useState<MitiMitiRoute>({ page: 'home' });
  const [paymentModal, setPaymentModal] = useState<{
    targetName: string;
    targetUserId: string;
    amount: string;
  } | null>(null);

  // Escuchar hash changes para deep links
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash;
      const joinMatch = hash.match(/#\/mitimiti\/join\/([A-Za-z0-9]+)/);
      if (joinMatch) {
        setRoute({ page: 'join', token: joinMatch[1] });
      }
    }

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Manejar resultado del escáner QR
  const handleQRScanned = useCallback((raw: string) => {
    const data = decodeQR(raw);
    if (!data) {
      // QR no reconocido, volver al home
      setRoute({ page: 'home' });
      return;
    }

    if (data.type === 'deuna_personal') {
      // Es un QR personal → mostrar modal de pago
      setRoute({ page: 'home' });
      setPaymentModal({
        targetName: data.displayName,
        targetUserId: data.userId,
        amount: '0',
      });
    } else if (data.type === 'mitimiti_invite') {
      // Es una invitación MitiMiti → ir a JoinRoomView
      setRoute({ page: 'join', token: data.token });
    }
  }, []);

  // Crear sala
  const handleCreateRoom = useCallback(async (commerceName: string, amountStr: string) => {
    if (!profile) return;

    try {
      const totalCents = toCents(amountStr);
      if (totalCents <= 0) return;

      const room = await createRoom(
        profile.userId,
        profile.displayName,
        commerceName,
        totalCents,
      );

      setRoute({ page: 'room', roomId: room.id });
    } catch (err) {
      console.error('Error creating room:', err);
    }
  }, [profile]);

  // ─── Render ─────────────────────────────────────────────

  // Si no tiene perfil, mostrar setup
  if (!profile) {
    return <SetupScreen onComplete={setProfile} />;
  }

  return (
    <div className="flex flex-col flex-1 relative">
      {/* Router */}
      {route.page === 'home' && (
        <HomeScreen
          profile={profile}
          onScan={() => setRoute({ page: 'scanner' })}
        />
      )}

      {route.page === 'scanner' && (
        <QRScanner
          onScan={handleQRScanned}
          onBack={() => setRoute({ page: 'home' })}
        />
      )}

      {route.page === 'create' && (
        <CreateRoomView
          initialCommerceName={route.commerceName}
          initialAmount={fromCents(route.totalCents)}
          onCreateRoom={handleCreateRoom}
          onBack={() => setRoute({ page: 'home' })}
        />
      )}

      {route.page === 'room' && (
        <RoomView
          roomId={route.roomId}
          onBack={() => setRoute({ page: 'home' })}
          onExit={() => {
            window.location.hash = '#/mitimiti';
            setRoute({ page: 'home' });
          }}
        />
      )}

      {route.page === 'join' && (
        <JoinRoomView
          inviteToken={route.token}
          onJoined={(roomId) => setRoute({ page: 'room', roomId })}
          onBack={() => {
            window.location.hash = '#/mitimiti';
            setRoute({ page: 'home' });
          }}
        />
      )}

      {/* Payment Mode Modal (aparece sobre cualquier pantalla) */}
      {paymentModal && (
        <PaymentModeModal
          targetName={paymentModal.targetName}
          amount={paymentModal.amount === '0' ? '0' : paymentModal.amount}
          onPayAlone={() => {
            setPaymentModal(null);
            // En un app real, aquí iría el flujo de pago individual
          }}
          onMitiMiti={() => {
            const name = paymentModal.targetName;
            setPaymentModal(null);
            // Ir a crear sala con los datos del QR escaneado
            setRoute({
              page: 'create',
              commerceName: name,
              totalCents: toCents(paymentModal.amount),
            });
          }}
          onClose={() => setPaymentModal(null)}
        />
      )}
    </div>
  );
}
