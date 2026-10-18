// ─── Vercel Web Analytics ────────────────────────────────────
// La app navega con el hash (#/mitimiti/room/<id>), que Vercel no ve: sin
// esto todas las pantallas contarían como "/". Cada cambio de hash se
// reporta como una página, con los IDs y tokens reemplazados por un
// marcador: así las visitas se agrupan por pantalla y nunca se manda el
// token de un link de deuda o de invitación (quien lo tiene puede usarlo).
import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';

function routeFromHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  return path
    .replace(/^\/mitimiti\/room\/[^/]+/, '/mitimiti/room/[id]')
    .replace(/^\/mitimiti\/join\/[^/]+/, '/mitimiti/join/[token]')
    .replace(/^\/mitimiti\/deuda\/[^/]+/, '/mitimiti/deuda/[token]');
}

export default function VercelAnalytics() {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return <Analytics route={route} path={route} mode={import.meta.env.DEV ? 'development' : 'production'} />;
}
