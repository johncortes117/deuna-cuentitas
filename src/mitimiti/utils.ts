// ─── MitiMiti Pure Utility Functions ─────────────────────────
import type { UserProfile, PersonalQRData, InviteQRData, QRData } from './types';

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
 */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
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

/**
 * Guarda el perfil del usuario en localStorage.
 */
export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem('mitimiti_profile', JSON.stringify(profile));
}

/**
 * Genera un saldo simulado aleatorio entre $2.00 y $10.00 (200 - 1000 centavos)
 */
export function generateRandomBalance(): number {
  return 200 + Math.floor(Math.random() * 801);
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
 * Decodifica un string de QR y determina su tipo.
 * Retorna null si el QR no es reconocido.
 */
export function decodeQR(raw: string): QRData | null {
  // Intentar como URL de invitación MitiMiti
  const inviteMatch = raw.match(/\/#\/mitimiti\/join\/([A-Za-z0-9]+)$/);
  if (inviteMatch) {
    return { type: 'mitimiti_invite', token: inviteMatch[1] } as InviteQRData;
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
