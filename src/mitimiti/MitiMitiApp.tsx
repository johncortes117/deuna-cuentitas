// ─── MitiMitiApp: Router principal del módulo MitiMiti ────────
import { useState, useEffect, useCallback } from 'react';
import type { MitiMitiRoute, UserProfile } from './types';
import { getUserProfile, toCents, fromCents } from './utils';
import { createRoom } from './supabase';
import ScannerBeforeCreate from './components/ScannerBeforeCreate';
import CreateRoomView from './components/CreateRoomView';
import RoomView from './components/RoomView';
import JoinRoomView from './components/JoinRoomView';
import DebtsView from './components/DebtsView';
import './MitiMiti.css';

// ─── MitiMitiApp (Router principal) ──────────────────────────
export default function MitiMitiApp() {
  const [profile] = useState<UserProfile | null>(() => getUserProfile());
  const [route, setRoute] = useState<MitiMitiRoute>({ page: 'scan_before_create' });

  // Escuchar hash changes para deep links
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash;
      const joinMatch = hash.match(/#\/mitimiti\/join\/([A-Za-z0-9]+)/);
      const roomMatch = hash.match(/#\/mitimiti\/room\/([A-Za-z0-9-]+)/);
      
      if (roomMatch) {
        setRoute({ page: 'room', roomId: roomMatch[1] });
      } else if (joinMatch) {
        setRoute({ page: 'join', token: joinMatch[1] });
      } else if (hash === '#/mitimiti/debts') {
        setRoute({ page: 'debts' });
      } else if (hash === '#/mitimiti/create' || hash === '#/mitimiti') {
        setRoute({ page: 'scan_before_create' });
      }
    }

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
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

  // Si no tiene perfil, debería haberse manejado en App.tsx, pero por si acaso redirigimos
  if (!profile) {
    window.location.hash = '#/';
    return null;
  }

  return (
    <div className="flex flex-col flex-1 relative bg-white h-full w-full">
      {/* Router */}
      {route.page === 'scan_before_create' && (
        <ScannerBeforeCreate
          onScanComplete={(commerceName) => setRoute({ page: 'create', commerceName })}
          onBack={() => {
            window.location.hash = '#/';
          }}
        />
      )}

      {route.page === 'create' && (
        <CreateRoomView
          initialCommerceName={route.commerceName}
          initialAmount={route.totalCents ? fromCents(route.totalCents) : undefined}
          onCreateRoom={handleCreateRoom}
          onRejoinRoom={(roomId) => setRoute({ page: 'room', roomId })}
          onBack={() => {
            window.location.hash = '#/';
          }}
        />
      )}

      {route.page === 'room' && (
        <RoomView
          roomId={route.roomId}
          onBack={() => {
            window.location.hash = '#/';
          }}
          onExit={() => {
            window.location.hash = '#/';
          }}
        />
      )}

      {route.page === 'join' && (
        <JoinRoomView
          inviteToken={route.token}
          onJoined={(roomId) => setRoute({ page: 'room', roomId })}
          onBack={() => {
            window.location.hash = '#/';
          }}
        />
      )}

      {route.page === 'debts' && (
        <DebtsView
          onBack={() => {
            // Volver al inicio: la vista de deudas se abre desde el banner del
            // dashboard, así que "atrás" debe regresar ahí, no al escáner.
            window.location.hash = '#/';
          }}
        />
      )}
    </div>
  );
}
