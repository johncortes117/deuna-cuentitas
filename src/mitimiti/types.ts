// ─── MitiMiti Type Definitions ───────────────────────────────

export type RoomStatus =
  | 'waiting'      // Sala abierta, esperando participantes
  | 'locked'       // Host cerró la sala, esperando confirmaciones
  | 'confirming'   // Todos confirmaron, host puede ejecutar pago
  | 'processing'   // Pago en proceso
  | 'completed'    // Pago exitoso
  | 'failed'       // Pago falló
  | 'cancelled';   // Host canceló o sala expiró

export interface Room {
  id: string;
  host_id: string;
  host_name: string;
  commerce_name: string;
  total_cents: number;
  tip_cents: number;
  status: RoomStatus;
  invite_token: string;
  locked_at: string | null;
  paid_at: string | null;
  created_at: string;
  expires_at: string;
  split_mode: 'equal' | 'custom';
}

export interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  role: 'host' | 'member';
  amount_cents: number | null;
  has_extra_cent: boolean;
  deficit_cents: number;
  confirmation_status: 'pending' | 'confirmed' | 'declined' | 'requesting_loan';
  joined_at: string;
  confirmed_at: string | null;
}

export interface Debt {
  id: string;
  room_id: string;
  debtor_id: string;
  debtor_name: string;
  creditor_id: string;
  creditor_name: string;
  amount_cents: number;
  status: 'pending' | 'active' | 'paid' | 'forgiven' | 'cancelled';
  created_at: string;
  paid_at: string | null;
  forgiven_at: string | null;
}

export interface Assignment {
  userId: string;
  amountCents: number;
  hasExtraCent: boolean;
}

// Datos codificados en un QR personal (simula el QR de cobro de DeUna)
export interface PersonalQRData {
  type: 'deuna_personal';
  userId: string;
  displayName: string;
}

// Datos codificados en un QR de invitación MitiMiti
export interface InviteQRData {
  type: 'mitimiti_invite';
  token: string;
}

// Union de todos los tipos de QR que la app puede leer
export type QRData = PersonalQRData | InviteQRData;

// Perfil del usuario local (persiste en localStorage)
export interface UserProfile {
  userId: string;
  displayName: string;
  balanceCents: number;
}

// Rutas del módulo MitiMiti
export type MitiMitiRoute =
  | { page: 'scan_before_create' }
  | { page: 'create'; commerceName?: string; totalCents?: number }
  | { page: 'room'; roomId: string }
  | { page: 'join'; token: string }
  | { page: 'success'; roomId: string }
  | { page: 'error'; roomId: string; message: string }
  | { page: 'debts' };
