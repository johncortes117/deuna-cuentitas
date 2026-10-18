// ─── Compartir por WhatsApp (invitar, recordar, presumir) ────
// WhatsApp es el canal donde ya vive el grupo de amigos. Cada mensaje lleva
// un link de vuelta a Deuna: así cada sala, recordatorio o pago terminado
// también es una invitación para quien todavía no usa MitiMiti.
import type { Debt, Room } from './types';
import { encodeInviteQR, encodeDebtLink, formatMoney, conceptEmoji } from './utils';
import { creatorLent } from './debtGroups';

export const APP_URL: string = (import.meta.env.VITE_APP_URL as string) || window.location.origin;

export function inviteLink(inviteToken: string): string {
  return encodeInviteQR(inviteToken, APP_URL);
}

/**
 * Abre WhatsApp con el mensaje listo. Devuelve false si el navegador bloqueó
 * la ventana (pasa cuando no viene directo de un toque), para ofrecer el
 * botón. Sin 'noopener' porque con él window.open siempre devuelve null; el
 * opener se corta a mano.
 */
export function openWhatsApp(text: string): boolean {
  const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  if (!win) return false;
  win.opener = null;
  return true;
}

/** Copia al portapapeles; false si el navegador no lo permite. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function debtLink(token: string): string {
  return encodeDebtLink(token, APP_URL);
}

/**
 * El mensaje que acompaña al link de una deuda anotada a mano. Amable y sin
 * tono de cobro: es un favor entre amigos que se anota para que no se olvide.
 */
export function debtLinkMessage(debt: Debt): string {
  const amount = formatMoney(debt.amount_cents);
  const what = debt.concept ? ` (${conceptEmoji(debt.concept)} ${debt.concept})` : '';
  const link = debt.invite_token ? debtLink(debt.invite_token) : APP_URL;
  return creatorLent(debt)
    ? `¡Hola! 👋 Te presté ${amount}${what} y lo anoté en Deuna para que no se nos olvide. Cuando puedas, me pagas en un toque desde aquí 💜 ${link}`
    : `¡Hola! 👋 Anoté en Deuna los ${amount}${what} que me prestaste, para no olvidarme de devolvértelos. Confírmalo aquí 💜 ${link}`;
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
