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
  // null en las deudas anotadas a mano (no nacieron en una sala).
  room_id: string | null;
  // En una deuda anotada a mano, el lado del amigo queda en '' hasta que él
  // abre el link y la acepta (quien la anotó ya está en su lado).
  debtor_id: string;
  debtor_name: string;
  creditor_id: string;
  creditor_name: string;
  amount_cents: number;
  // 'pending': en una sala, préstamo prometido que aún no es oficial; en una
  // deuda anotada a mano, link enviado que el amigo todavía no acepta.
  // 'declined': el amigo abrió el link y dijo que no reconoce la deuda.
  status: 'pending' | 'active' | 'paid' | 'forgiven' | 'cancelled' | 'declined';
  created_at: string;
  paid_at: string | null;
  forgiven_at: string | null;
  // Deudas anotadas a mano ("le presté $1,50 a Juan"). Opcionales porque una
  // BD sin la migración de supabase-setup.sql (sección 7) no las trae.
  kind?: 'room' | 'direct';
  concept?: string | null;
  invite_token?: string | null;
  created_by?: string | null;
  responded_at?: string | null;
}

// Quién le prestó a quién, visto por quien anota la deuda.
export type LoanDirection = 'lent' | 'borrowed'; // lent: yo presté · borrowed: me prestaron

export interface Assignment {
  userId: string;
  amountCents: number;
  hasExtraCent: boolean;
}

// Sala abierta del usuario + en qué punto está él dentro de ella, para que el
// inicio pueda decir algo útil ("Falta que aceptes $12") y no solo "Sala activa".
export interface ActiveRoom {
  room: Room;
  myStatus: Participant['confirmation_status'];
  myAmountCents: number | null;
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

// Datos de un QR con el link de una deuda anotada a mano
export interface DebtLinkQRData {
  type: 'mitimiti_debt';
  token: string;
}

// Union de todos los tipos de QR que la app puede leer
export type QRData = PersonalQRData | InviteQRData | DebtLinkQRData;

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
  | { page: 'debts'; tab?: 'owe' | 'owed' }
  | { page: 'new_debt'; direction?: LoanDirection }
  | { page: 'debt_link'; token: string };
