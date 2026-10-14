// ─── Compartir por WhatsApp (invitar, recordar, presumir) ────
// WhatsApp es el canal donde ya vive el grupo de amigos. Cada mensaje lleva
// un link de vuelta a Deuna: así cada sala, recordatorio o pago terminado
// también es una invitación para quien todavía no usa MitiMiti.
import type { Room } from './types';
import { encodeInviteQR, formatMoney } from './utils';

export const APP_URL: string = (import.meta.env.VITE_APP_URL as string) || window.location.origin;

export function inviteLink(inviteToken: string): string {
  return encodeInviteQR(inviteToken, APP_URL);
}

export function openWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

export function inviteMessage(room: Room): string {
  return `¡Hola! 👋 Únete a mi sala «${room.commerce_name}» para dividir la cuenta (${formatMoney(room.total_cents)}) con MitiMiti de Deuna. Entras con un toque: ${inviteLink(room.invite_token)}`;
}

export function reminderMessage(name: string, amountCents: number, roomNames: string[]): string {
  const firstName = name.trim().split(/\s+/)[0];
  const origin = roomNames.length === 1 ? `de «${roomNames[0]}»` : `de ${roomNames.map(r => `«${r}»`).join(' y ')}`;
  return `¡Hola ${firstName}! 👋 Te recuerdo los ${formatMoney(amountCents)} ${origin}. Cuando puedas, págame en un toque desde Deuna 💜 ${APP_URL}/#/mitimiti/debts`;
}

export function successMessage(roomName: string, totalCents: number, people: number, duration: string | null): string {
  const speed = duration ? ` en ${duration}` : '';
  return `✅ Dividimos «${roomName}» (${formatMoney(totalCents)}) entre ${people}${speed} con MitiMiti de Deuna, sin calculadora ni "te transfiero luego" 💜 ${APP_URL}`;
}
