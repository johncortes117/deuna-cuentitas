// ─── JoinRoomView: Entrada directa a una sala MitiMiti ───────
import { useState, useEffect, useRef } from 'react';
import { enterRoomByToken } from '../supabase';
import { getUserProfile } from '../utils';

interface JoinRoomViewProps {
  inviteToken: string;
  onJoined: (roomId: string) => void;
  onBack: () => void;
}

// Cuánto esperamos antes de dibujar NADA. Entrar son dos consultas y casi
// siempre termina antes de este umbral, así que el usuario pasa del escáner
// a la sala sin ver ninguna pantalla intermedia. El spinner es solo el plan
// B para una red lenta: sin esta espera aparecía y desaparecía de golpe, que
// es el parpadeo que se veía.
const LOADER_DELAY_MS = 450;

export default function JoinRoomView({ inviteToken, onJoined, onBack }: JoinRoomViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Perfil estable: getUserProfile() crea un objeto NUEVO en cada render;
  // tenerlo como dependencia del efecto causaba un loop infinito de fetches.
  const [profile] = useState(() => getUserProfile());
  const onJoinedRef = useRef(onJoined);
  useEffect(() => {
    onJoinedRef.current = onJoined;
  }, [onJoined]);

  // Escanear el QR YA es la aceptación: entramos solos, sin pedir un tap más.
  // El ref evita una segunda entrada si el efecto se re-ejecuta (StrictMode).
  const isEntering = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), LOADER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  useEffect(() => {
    async function enter() {
      if (isEntering.current) return;
      isEntering.current = true;

      try {
        if (!profile) {
          setError('No encontramos tu perfil');
          return;
        }

        const room = await enterRoomByToken(inviteToken, profile.userId, profile.displayName);
        onJoinedRef.current(room.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al entrar a la sala');
      } finally {
        isEntering.current = false;
      }
    }

    enter();
  }, [inviteToken, profile, attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <div className="w-16 h-16 bg-[#FCEBEB] rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-[#1a1a1a] mb-2 text-center">{error}</p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[14px] font-bold"
          >
            Volver
          </button>
          <button
            onClick={() => {
              setError(null);
              setShowLoader(false);
              setAttempt(a => a + 1);
            }}
            className="px-6 py-3 rounded-[14px] bg-[#4C1D80] text-white text-[14px] font-bold active:scale-[0.98]"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Todavía entrando y aún dentro del umbral: no dibujamos nada, para que la
  // transición escáner → sala sea directa y sin pantalla de por medio.
  if (!showLoader) return null;

  // Red lenta: recién aquí mostramos algo, con salida disponible por si se
  // quedó colgado.
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center px-5 pt-14 pb-3 shrink-0">
        <button onClick={onBack} className="mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">MitiMiti</h1>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <div className="mitimiti-spin w-8 h-8 border-3 border-gray-200 border-t-[#4C1D80] rounded-full" />
        <p className="text-[14px] text-gray-400">Entrando a la sala...</p>
      </div>
    </div>
  );
}
