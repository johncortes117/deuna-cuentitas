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
import NewDebtView from './components/NewDebtView';
import ClaimDebtView from './components/ClaimDebtView';
import './MitiMiti.css';

/**
 * Traduce el hash a una ruta. Se usa también para el estado inicial: antes
 * la ruta arrancaba en 'create' y recién un efecto leía el hash, así que al
 * abrir un link directo se alcanzaba a ver un instante la pantalla equivocada.
 *
 *   #/mitimiti/room/<id>                 sala
 *   #/mitimiti/join/<token>              entrar con invitación
 *   #/mitimiti/debts?tab=owe|owed        deudas (en la pestaña indicada)
 *   #/mitimiti/debts/new?dir=lent|borrowed  anotar una deuda a mano
 *   #/mitimiti/deuda/<token>             link de una deuda anotada a mano
 *   #/mitimiti[/create][?amount=&name=]  crear (opcionalmente pre-llenada)
 */
function routeFromHash(hash: string): MitiMitiRoute {
  const roomMatch = hash.match(/^#\/mitimiti\/room\/([A-Za-z0-9-]+)/);
  if (roomMatch) return { page: 'room', roomId: roomMatch[1] };

  const joinMatch = hash.match(/^#\/mitimiti\/join\/([A-Za-z0-9]+)/);
  if (joinMatch) return { page: 'join', token: joinMatch[1] };

  const debtLinkMatch = hash.match(/^#\/mitimiti\/deuda\/([A-Za-z0-9]+)/);
  if (debtLinkMatch) return { page: 'debt_link', token: debtLinkMatch[1] };

  const [path, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);

  if (path === '#/mitimiti/debts/new') {
    const dir = params.get('dir');
    return { page: 'new_debt', direction: dir === 'lent' || dir === 'borrowed' ? dir : undefined };
  }

  if (path === '#/mitimiti/debts') {
    const tab = params.get('tab');
    return { page: 'debts', tab: tab === 'owe' || tab === 'owed' ? tab : undefined };
  }

  const amount = Number(params.get('amount'));
  return {
    page: 'create',
    commerceName: params.get('name') || undefined,
    totalCents: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : undefined,
  };
}

// ─── MitiMitiApp (Router principal) ──────────────────────────
export default function MitiMitiApp() {
  const [profile] = useState<UserProfile | null>(() => getUserProfile());
  const [route, setRoute] = useState<MitiMitiRoute>(() => routeFromHash(window.location.hash));

  // Escuchar hash changes para deep links
  useEffect(() => {
    function handleHash() {
      if (window.location.hash.startsWith('#/mitimiti')) {
        setRoute(routeFromHash(window.location.hash));
      }
    }
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const goHome = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  // Crear sala. Si falla, el error vuelve a la vista para mostrarlo (antes
  // solo iba a la consola y el botón parecía no hacer nada).
  const handleCreateRoom = useCallback(async (commerceName: string, amountStr: string) => {
    if (!profile) return;
    const totalCents = toCents(amountStr);
    if (totalCents <= 0) return;

    const room = await createRoom(
      profile.userId,
      profile.displayName,
      commerceName,
      totalCents,
    );
    window.location.hash = `#/mitimiti/room/${room.id}`;
  }, [profile]);

  // ─── Render ─────────────────────────────────────────────

  // Si no tiene perfil, debería haberse manejado en App.tsx, pero por si acaso redirigimos
  if (!profile) {
    window.location.hash = '#/';
    return null;
  }

  return (
    <div className="flex flex-col flex-1 relative bg-white h-full w-full min-h-0">
      {/* Router */}
      {route.page === 'scan_before_create' && (
        <ScannerBeforeCreate
          onScanComplete={(commerceName) => setRoute({ page: 'create', commerceName })}
          onBack={goHome}
        />
      )}

      {route.page === 'create' && (
        <CreateRoomView
          key={`${route.commerceName ?? ''}-${route.totalCents ?? ''}`}
          initialCommerceName={route.commerceName}
          initialAmount={route.totalCents ? fromCents(route.totalCents) : undefined}
          onCreateRoom={handleCreateRoom}
          onRejoinRoom={(roomId) => { window.location.hash = `#/mitimiti/room/${roomId}`; }}
          onBack={goHome}
        />
      )}

      {route.page === 'room' && (
        <RoomView
          key={route.roomId}
          roomId={route.roomId}
          onBack={goHome}
          onExit={goHome}
          onRecreate={(name, totalCents) => {
            window.location.hash = `#/mitimiti/create?amount=${totalCents}&name=${encodeURIComponent(name)}`;
          }}
          onOpenDebts={(tab) => { window.location.hash = `#/mitimiti/debts?tab=${tab}`; }}
        />
      )}

      {route.page === 'join' && (
        <JoinRoomView
          inviteToken={route.token}
          onJoined={(roomId) => {
            // Reemplazar (no apilar) el link de invitación por el de la sala:
            // recargar lleva a la sala, y "atrás" no vuelve a entrar.
            window.history.replaceState(null, '', `#/mitimiti/room/${roomId}`);
            setRoute({ page: 'room', roomId });
          }}
          onBack={goHome}
        />
      )}

      {route.page === 'debts' && (
        <DebtsView
          initialTab={route.tab}
          onBack={() => {
            // Volver al inicio: la vista de deudas se abre desde el banner del
            // dashboard, así que "atrás" debe regresar ahí, no al escáner.
            goHome();
          }}
          onNewDebt={(direction) => { window.location.hash = `#/mitimiti/debts/new?dir=${direction}`; }}
        />
      )}

      {route.page === 'new_debt' && (
        <NewDebtView
          initialDirection={route.direction}
          onBack={goHome}
          onOpenDebts={(tab) => { window.location.hash = `#/mitimiti/debts?tab=${tab}`; }}
        />
      )}

      {route.page === 'debt_link' && (
        <ClaimDebtView
          key={route.token}
          token={route.token}
          onBack={goHome}
          onOpenDebts={(tab) => { window.location.hash = `#/mitimiti/debts?tab=${tab}`; }}
        />
      )}
    </div>
  );
}
