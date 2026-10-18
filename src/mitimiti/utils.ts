// ─── MitiMiti Pure Utility Functions ─────────────────────────
import type { UserProfile, PersonalQRData, InviteQRData, DebtLinkQRData, QRData, Room, RoomStatus, ActiveRoom } from './types';

/**
 * Divide un monto total en centavos entre N participantes.
 * El sobrante se distribuye de forma aleatoria (no siempre al primero).
 * Garantiza: sum(resultado) === totalCents
 */
export function dividirMonto(totalCents: number, participantCount: number): number[] {
  if (participantCount <= 0) return [];
  if (participantCount === 1) return [totalCents];

  const parteBase = Math.floor(totalCents / participantCount);
  const sobrante = totalCents % participantCount;

  const resultado: number[] = [];
  for (let i = 0; i < participantCount; i++) {
    resultado.push(i < sobrante ? parteBase + 1 : parteBase);
  }

  // Shuffle para que el sobrante no siempre caiga en los primeros
  // Usamos Fisher-Yates shuffle
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }

  return resultado;
}

/**
 * Convierte string de dólares a centavos enteros.
 * Acepta tanto coma como punto decimal.
 * "48,00" → 4800, "10.5" → 1050, "10" → 1000
 */
export function toCents(dollarStr: string): number {
  const normalized = dollarStr.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Convierte centavos a string formateado con coma decimal.
 * 4800 → "48,00", 1667 → "16,67"
 */
export function fromCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars},${remainder.toString().padStart(2, '0')}`;
}

/**
 * Formato dinero completo: "$48,00"
 */
export function formatMoney(cents: number): string {
  return `$${fromCents(cents)}`;
}

/**
 * Genera un UUID v4 simple (crypto-safe).
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Genera un token corto para invitaciones (6 caracteres alfanuméricos).
 */
export function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

/**
 * Color HSL determinístico basado en el nombre del usuario.
 * Siempre genera colores vibrantes y distinguibles.
 *
 * Luminosidad 45%: con 55% los tonos amarillos/verdes quedaban casi sin
 * contraste contra las iniciales blancas (difícil de leer para gente mayor).
 */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

/**
 * Obtiene las iniciales de un nombre (max 2 caracteres).
 * "María Andrade" → "MA", "Luis" → "LU"
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Verifica si una sala ha expirado.
 */
export function isRoomExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

// Estados en los que una sala sigue "viva" (se puede entrar, dividir o pagar).
export const OPEN_ROOM_STATUSES: RoomStatus[] = ['waiting', 'locked', 'confirming'];

export function isRoomOpen(room: Pick<Room, 'status'>): boolean {
  return OPEN_ROOM_STATUSES.includes(room.status);
}

/**
 * Sala que sigue abierta en la BD pero ya pasó su tiempo máximo: es la sala
 * "zombi" que seguía apareciendo en el inicio semanas después.
 */
export function isRoomStale(room: Pick<Room, 'status' | 'expires_at'>, now = Date.now()): boolean {
  return isRoomOpen(room) && new Date(room.expires_at).getTime() <= now;
}

/**
 * Qué está pasando en tu sala abierta, dicho en una línea, para el aviso del
 * inicio. Antes decía siempre "Toca para volver a la sala", estuvieras donde
 * estuvieras; ahora dice qué falta y quién lo tiene que hacer.
 */
export function activeRoomHint(active: ActiveRoom, userId: string): string {
  const { room, myStatus, myAmountCents } = active;
  const isHost = room.host_id === userId;
  if (room.status === 'waiting') {
    return isHost ? 'Esperando a que se unan' : `Esperando a que ${room.host_name} divida la cuenta`;
  }
  if (room.status === 'confirming') {
    return isHost ? '¡Todos aceptaron! Toca para pagar' : `Esperando a que ${room.host_name} pague`;
  }
  // locked
  if (myStatus === 'pending') {
    return myAmountCents ? `Falta que aceptes ${formatMoney(myAmountCents)}` : 'Falta que aceptes tu parte';
  }
  if (myStatus === 'requesting_loan') return 'Esperando que alguien te preste';
  return 'Esperando a que los demás acepten';
}

/**
 * Obtiene o crea el perfil del usuario en localStorage.
 */
export function getUserProfile(): UserProfile | null {
  const stored = localStorage.getItem('mitimiti_profile');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    return null;
  }
}

// Avisa a toda la app que el saldo cambió (pago de sala, deuda, recarga o un
// amigo que te pagó), para que el inicio y MitiMiti nunca muestren saldos
// distintos al mismo tiempo.
export const BALANCE_CHANGED_EVENT = 'mitimiti:balance-changed';

/**
 * Guarda el perfil del usuario en localStorage.
 */
export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem('mitimiti_profile', JSON.stringify(profile));
  window.dispatchEvent(new Event(BALANCE_CHANGED_EVENT));
}

/**
 * Genera un saldo simulado aleatorio entre $2.00 y $6.00 (200 - 600 centavos)
 */
export function generateRandomBalance(): number {
  return 200 + Math.floor(Math.random() * 401);
}

/**
 * Valida un split personalizado. La suma debe ser exactamente igual al total.
 */
export function validateCustomSplit(amounts: number[], totalCents: number): { valid: boolean; difference: number } {
  const sum = amounts.reduce((a, b) => a + b, 0);
  return {
    valid: sum === totalCents,
    difference: totalCents - sum, // > 0 faltan, < 0 sobran
  };
}

/**
 * Calcula cuánto le falta a un participante para pagar su parte.
 */
export function calculateDeficit(amountCents: number, balanceCents: number): number {
  return Math.max(0, amountCents - balanceCents);
}

/**
 * Crea un nuevo perfil con ID autogenerado y saldo simulado.
 */
export function createUserProfile(displayName: string): UserProfile {
  const profile: UserProfile = {
    userId: generateId(),
    displayName,
    balanceCents: generateRandomBalance(),
  };
  saveUserProfile(profile);
  return profile;
}

/**
 * Codifica datos de QR personal para mostrar en pantalla.
 */
export function encodePersonalQR(profile: UserProfile): string {
  const data: PersonalQRData = {
    type: 'deuna_personal',
    userId: profile.userId,
    displayName: profile.displayName,
  };
  return JSON.stringify(data);
}

/**
 * Codifica datos de invitación MitiMiti para QR.
 */
export function encodeInviteQR(token: string, appUrl: string): string {
  // Genera URL completa para que sea accesible desde cualquier dispositivo
  return `${appUrl}/#/mitimiti/join/${token}`;
}

/**
 * Link de una deuda anotada a mano (el que se manda por WhatsApp).
 */
export function encodeDebtLink(token: string, appUrl: string): string {
  return `${appUrl}/#/mitimiti/deuda/${token}`;
}

/**
 * Decodifica un string de QR y determina su tipo.
 * Retorna null si el QR no es reconocido.
 */
export function decodeQR(raw: string): QRData | null {
  // Intentar como URL de invitación MitiMiti
  const inviteMatch = raw.match(/\/#\/mitimiti\/join\/([A-Za-z0-9]+)$/);
  if (inviteMatch) {
    return { type: 'mitimiti_invite', token: inviteMatch[1] } as InviteQRData;
  }

  // Link de una deuda anotada a mano
  const debtMatch = raw.match(/\/#\/mitimiti\/deuda\/([A-Za-z0-9]+)$/);
  if (debtMatch) {
    return { type: 'mitimiti_debt', token: debtMatch[1] } as DebtLinkQRData;
  }

  // Intentar como JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === 'deuna_personal' && parsed.userId && parsed.displayName) {
      return parsed as PersonalQRData;
    }
    if (parsed.type === 'mitimiti_invite' && parsed.token) {
      return parsed as InviteQRData;
    }
  } catch {
    // No es JSON válido
  }

  return null;
}

/**
 * Calcula los segundos restantes hasta la expiración.
 */
export function getSecondsRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Formatea segundos como MM:SS.
 */
export function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Duración humana corta: 72000 → "1 min 12 s", 45000 → "45 s".
 */
export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

// ─── Fechas (copy humano, sin abreviaturas ambiguas) ─────────
// Antes salía "11 ago": para mucha gente se lee como el "ago" inglés
// ("hace 11") y no como "11 de agosto". Ahora el mes va completo.

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysSince(iso: string, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
}

export function relativeDate(iso: string, now = new Date()): string {
  const days = daysSince(iso, now);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 14) return 'Hace 1 semana';
  if (days < 28) return `Hace ${Math.floor(days / 7)} semanas`;
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es-EC', opts);
}

// "31 de julio de 2026": para el detalle de una deuda (sin la hora, que solo
// era ruido para decidir si pagar o recordar).
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Recargas simuladas desde la cuenta principal ───────────
// Misma cuenta que muestra la tarjeta "Recargar desde" del inicio.
export const PRINCIPAL_ACCOUNT_LABEL = 'Principal ••2213';
export const TOP_UP_STEP_CENTS = 1000;

/**
 * Cuánto recargar para cubrir lo que falta, en saltos de $10 (como el botón
 * del inicio): falta $7,26 → $10; falta $13 → $20.
 */
export function topUpAmountFor(shortfallCents: number): number {
  if (shortfallCents <= 0) return 0;
  return Math.ceil(shortfallCents / TOP_UP_STEP_CENTS) * TOP_UP_STEP_CENTS;
}

/**
 * Suma saldo al perfil local (simula la recarga desde la cuenta principal).
 */
export function addToBalance(cents: number): UserProfile | null {
  const profile = getUserProfile();
  if (!profile) return null;
  const updated = { ...profile, balanceCents: profile.balanceCents + cents };
  saveUserProfile(updated);
  return updated;
}

// ─── Nombres de sala sugeridos ──────────────────────────────
// Cubren los casos más comunes de un pago compartido para que el usuario no
// tenga que escribir nada.
export const ROOM_NAME_SUGGESTIONS = [
  { emoji: '🍔', label: 'Almuerzo' },
  { emoji: '🍽️', label: 'Cena' },
  { emoji: '☕', label: 'Café' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🚕', label: 'Taxi' },
  { emoji: '🎂', label: 'Cumpleaños' },
  { emoji: '🎉', label: 'Salida' },
  { emoji: '🛒', label: 'Mercado' },
  { emoji: '🎬', label: 'Cine' },
];

export function roomEmoji(name: string): string {
  return ROOM_NAME_SUGGESTIONS.find(s => s.label === name.trim())?.emoji ?? '🧾';
}

// Un buen valor por defecto ahorra un paso: casi siempre basta con tocar
// "Crear sala" sin escribir nada.
export function suggestRoomName(date = new Date()): string {
  const h = date.getHours();
  if (h >= 11 && h < 16) return 'Almuerzo';
  if (h >= 19 || h < 4) return 'Cena';
  return 'Café';
}

// ─── Para qué fue una deuda anotada a mano ──────────────────
// Los préstamos chicos entre amigos casi siempre son por lo mismo: con un
// toque queda claro sin escribir nada. Es opcional; sin concepto se ve como
// "Préstamo".
export const DEBT_CONCEPTS = [
  { emoji: '🍔', label: 'Comida' },
  { emoji: '🚕', label: 'Taxi' },
  { emoji: '🛒', label: 'Compras' },
  { emoji: '🚌', label: 'Pasaje' },
  { emoji: '📱', label: 'Recarga' },
  { emoji: '🎟️', label: 'Entradas' },
  { emoji: '⛽', label: 'Gasolina' },
];

export const DEFAULT_DEBT_CONCEPT = 'Préstamo';

export function conceptEmoji(concept: string | null | undefined): string {
  return DEBT_CONCEPTS.find(c => c.label === concept?.trim())?.emoji ?? '💵';
}
