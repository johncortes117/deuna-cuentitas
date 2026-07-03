// ─── Supabase Client + MitiMiti CRUD ─────────────────────────
import { createClient } from '@supabase/supabase-js';
import type { Room, Participant, RoomStatus, Debt } from './types';
import { generateId, generateInviteToken, dividirMonto } from './utils';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Room CRUD ───────────────────────────────────────────────

/**
 * Crea una nueva sala MitiMiti y agrega al host como primer participante.
 */
export async function createRoom(
  hostId: string,
  hostName: string,
  commerceName: string,
  totalCents: number,
): Promise<Room> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos

  const room: Omit<Room, 'created_at'> & { created_at?: string } = {
    id: generateId(),
    host_id: hostId,
    host_name: hostName,
    commerce_name: commerceName,
    total_cents: totalCents,
    tip_cents: 0,
    status: 'waiting' as RoomStatus,
    invite_token: generateInviteToken(),
    locked_at: null,
    paid_at: null,
    expires_at: expiresAt.toISOString(),
    split_mode: 'equal',
  };

  const { data, error } = await supabase
    .from('mitimiti_rooms')
    .insert(room)
    .select()
    .single();

  if (error) throw new Error(`Error creando sala: ${error.message}`);

  // Agregar al host como participante
  await addParticipant(data.id, hostId, hostName, 'host');

  return data as Room;
}

/**
 * Obtiene una sala por su ID.
 */
export async function getRoom(roomId: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('mitimiti_rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) return null;
  return data as Room;
}

/**
 * Obtiene una sala por su token de invitación.
 */
export async function getRoomByToken(token: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('mitimiti_rooms')
    .select('*')
    .eq('invite_token', token)
    .single();

  if (error) return null;
  return data as Room;
}

/**
 * Actualiza el status de una sala.
 */
export async function updateRoomStatus(
  roomId: string,
  status: RoomStatus,
  extraFields?: Partial<Room>,
): Promise<void> {
  const { error } = await supabase
    .from('mitimiti_rooms')
    .update({ status, ...extraFields })
    .eq('id', roomId);

  if (error) throw new Error(`Error actualizando sala: ${error.message}`);
}

// ─── Participant CRUD ────────────────────────────────────────

/**
 * Agrega un participante a la sala.
 */
async function addParticipant(
  roomId: string,
  userId: string,
  displayName: string,
  role: 'host' | 'member' = 'member',
): Promise<Participant> {
  const participant = {
    id: generateId(),
    room_id: roomId,
    user_id: userId,
    display_name: displayName,
    role,
    amount_cents: null,
    has_extra_cent: false,
    confirmation_status: 'pending',
    confirmed_at: null,
  };

  const { data, error } = await supabase
    .from('mitimiti_participants')
    .insert(participant)
    .select()
    .single();

  if (error) throw new Error(`Error agregando participante: ${error.message}`);
  return data as Participant;
}

/**
 * Une a un usuario a una sala por token de invitación.
 */
export async function joinRoom(
  inviteToken: string,
  userId: string,
  displayName: string,
): Promise<{ room: Room; participant: Participant }> {
  // Buscar la sala
  const room = await getRoomByToken(inviteToken);
  if (!room) throw new Error('Sala no encontrada');
  if (room.status !== 'waiting') throw new Error('Esta sala ya está cerrada');

  // Verificar que no esté ya unido
  const { data: existing } = await supabase
    .from('mitimiti_participants')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .single();

  if (existing) throw new Error('Ya estás en esta sala');

  const participant = await addParticipant(room.id, userId, displayName);
  return { room, participant };
}

/**
 * Saca a un participante de la sala.
 * Si la sala estaba en 'locked', vuelve a 'waiting' y limpia asignaciones.
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  // Eliminar participante
  const { error } = await supabase
    .from('mitimiti_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) throw new Error(`Error saliendo de sala: ${error.message}`);

  // Si la sala estaba locked, volver a waiting
  const room = await getRoom(roomId);
  if (room && (room.status === 'locked' || room.status === 'confirming')) {
    // Limpiar asignaciones de todos
    await supabase
      .from('mitimiti_participants')
      .update({
        amount_cents: null,
        has_extra_cent: false,
        confirmation_status: 'pending',
        confirmed_at: null,
      })
      .eq('room_id', roomId);

    await updateRoomStatus(roomId, 'waiting', { locked_at: null });
  }
}

/**
 * Obtiene todos los participantes de una sala.
 */
export async function getParticipants(roomId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('mitimiti_participants')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(`Error obteniendo participantes: ${error.message}`);
  return (data || []) as Participant[];
}

/**
 * El host cierra la sala. Calcula la división y asigna montos.
 */
export async function lockRoom(
  roomId: string, 
  hostId: string, 
  splitMode: 'equal' | 'custom' = 'equal',
  customAmounts?: { userId: string, amountCents: number }[]
): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Sala no encontrada');
  if (room.host_id !== hostId) throw new Error('Solo el host puede cerrar la sala');
  if (room.status !== 'waiting') throw new Error('La sala no está abierta');

  const participants = await getParticipants(roomId);
  if (participants.length < 2) throw new Error('Necesitas al menos 2 personas');

  // Calcular división
  const totalCents = room.total_cents + room.tip_cents;
  
  let updates: {id: string, amount_cents: number, has_extra_cent: boolean}[] = [];

  if (splitMode === 'equal') {
    const amounts = dividirMonto(totalCents, participants.length);
    updates = participants.map((p, i) => ({
      id: p.id,
      amount_cents: amounts[i],
      has_extra_cent: amounts[i] > Math.floor(totalCents / participants.length),
    }));
  } else {
    if (!customAmounts) throw new Error('Faltan montos personalizados');
    const sum = customAmounts.reduce((acc, curr) => acc + curr.amountCents, 0);
    if (sum !== totalCents) throw new Error('La suma de montos no coincide con el total');
    
    updates = participants.map(p => {
      const custom = customAmounts.find(c => c.userId === p.user_id);
      return {
        id: p.id,
        amount_cents: custom ? custom.amountCents : 0,
        has_extra_cent: false,
      };
    });
  }

  // Actualizar cada participante
  for (const update of updates) {
    await supabase
      .from('mitimiti_participants')
      .update({
        amount_cents: update.amount_cents,
        has_extra_cent: update.has_extra_cent,
      })
      .eq('id', update.id);
  }

  // Auto-confirmar al host
  await supabase
    .from('mitimiti_participants')
    .update({
      confirmation_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('user_id', hostId);

  await updateRoomStatus(roomId, 'locked', {
    locked_at: new Date().toISOString(),
    split_mode: splitMode,
  });
}

/**
 * Un participante confirma su pago.
 * Si todos confirman, la sala pasa a 'confirming'.
 */
export async function confirmPayment(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('mitimiti_participants')
    .update({
      confirmation_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) throw new Error(`Error confirmando: ${error.message}`);

  // Verificar si todos confirmaron
  const participants = await getParticipants(roomId);
  const allConfirmed = participants.every(p => p.confirmation_status === 'confirmed');

  if (allConfirmed) {
    await updateRoomStatus(roomId, 'confirming');
  }
}

/**
 * El host ejecuta el pago grupal.
 * Simula procesamiento con delay y luego marca como completado.
 */
export async function executePayment(
  roomId: string,
  hostId: string,
  simulateFailure = false,
): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Sala no encontrada');
  if (room.host_id !== hostId) throw new Error('Solo el host puede ejecutar el pago');
  if (room.status !== 'confirming') throw new Error('No todos han confirmado');

  // Cambiar a processing
  await updateRoomStatus(roomId, 'processing');

  // Simular procesamiento (2-3 segundos)
  await new Promise(resolve => setTimeout(resolve, 2500));

  if (simulateFailure) {
    await updateRoomStatus(roomId, 'failed');
    throw new Error('Fondos insuficientes en la cuenta de un participante');
  }

  // Marcar como completado
  await updateRoomStatus(roomId, 'completed', {
    paid_at: new Date().toISOString(),
  });
}

/**
 * Cancela una sala.
 */
export async function cancelRoom(roomId: string, hostId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Sala no encontrada');
  if (room.host_id !== hostId) throw new Error('Solo el host puede cancelar');

  await updateRoomStatus(roomId, 'cancelled');
}

// ─── Debts & Loans CRUD ─────────────────────────────────────

/**
 * Un participante solicita un préstamo porque no le alcanza.
 */
export async function requestLoan(roomId: string, userId: string, deficitCents: number): Promise<void> {
  const { error } = await supabase
    .from('mitimiti_participants')
    .update({
      confirmation_status: 'requesting_loan',
      deficit_cents: deficitCents,
    })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) throw new Error(`Error solicitando préstamo: ${error.message}`);
}

/**
 * Otro participante presta dinero al que lo solicitó.
 */
export async function lendMoney(
  roomId: string,
  lenderId: string,
  lenderName: string,
  borrowerId: string,
  borrowerName: string,
  amountCents: number
): Promise<void> {
  // Buscar si ya existe una deuda en esta sala entre estas dos personas
  const { data: existingDebt } = await supabase
    .from('mitimiti_debts')
    .select('id, amount_cents')
    .eq('room_id', roomId)
    .eq('debtor_id', borrowerId)
    .eq('creditor_id', lenderId)
    .maybeSingle();

  if (existingDebt) {
    const { error: debtError } = await supabase
      .from('mitimiti_debts')
      .update({ amount_cents: existingDebt.amount_cents + amountCents })
      .eq('id', existingDebt.id);
    if (debtError) throw new Error(`Error actualizando deuda: ${debtError.message}`);
  } else {
    const { error: debtError } = await supabase
      .from('mitimiti_debts')
      .insert({
        room_id: roomId,
        debtor_id: borrowerId,
        debtor_name: borrowerName,
        creditor_id: lenderId,
        creditor_name: lenderName,
        amount_cents: amountCents,
      });
    if (debtError) throw new Error(`Error creando deuda: ${debtError.message}`);
  }

  // Obtener déficit actual del deudor
  const { data: borrower, error: getError } = await supabase
    .from('mitimiti_participants')
    .select('deficit_cents')
    .eq('room_id', roomId)
    .eq('user_id', borrowerId)
    .single();
  if (getError) throw new Error(`Error obteniendo participante: ${getError.message}`);

  const newDeficit = Math.max(0, (borrower.deficit_cents || 0) - amountCents);
  const isConfirmed = newDeficit === 0;

  // Actualizar déficit y status si ya cubrió
  const { error: updateError } = await supabase
    .from('mitimiti_participants')
    .update({
      deficit_cents: newDeficit,
      ...(isConfirmed ? { confirmation_status: 'confirmed', confirmed_at: new Date().toISOString() } : {})
    })
    .eq('room_id', roomId)
    .eq('user_id', borrowerId);
  if (updateError) throw new Error(`Error actualizando déficit: ${updateError.message}`);
  
  if (isConfirmed) {
    // Si todos están confirmados, pasar a confirming
    const participants = await getParticipants(roomId);
    const allConfirmed = participants.every(p => p.confirmation_status === 'confirmed');
    if (allConfirmed) {
      await updateRoomStatus(roomId, 'confirming');
    }
  }
}

export async function getMyDebts(userId: string): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('mitimiti_debts')
    .select('*')
    .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error obteniendo deudas: ${error.message}`);
  return (data || []) as Debt[];
}

export async function settleDebt(debtId: string): Promise<void> {
  const { error } = await supabase
    .from('mitimiti_debts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', debtId);
  if (error) throw new Error(`Error pagando deuda: ${error.message}`);
}

export async function forgiveDebt(debtId: string): Promise<void> {
  const { error } = await supabase
    .from('mitimiti_debts')
    .update({ status: 'forgiven', forgiven_at: new Date().toISOString() })
    .eq('id', debtId);
  if (error) throw new Error(`Error perdonando deuda: ${error.message}`);
}

// ─── Realtime Subscriptions ─────────────────────────────────

export interface RoomSubscriptionCallbacks {
  onRoomChange: (room: Room) => void;
  onParticipantsChange: (participants: Participant[]) => void;
  onDebtsChange?: (debts: Debt[]) => void;
}

/**
 * Se suscribe a cambios en tiempo real de una sala y sus participantes.
 * Retorna una función para desuscribirse.
 */
export function subscribeToRoom(
  roomId: string,
  callbacks: RoomSubscriptionCallbacks,
): () => void {
  const channel = supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mitimiti_rooms',
        filter: `id=eq.${roomId}`,
      },
      async () => {
        // Re-fetch completo para tener datos consistentes
        const room = await getRoom(roomId);
        if (room) callbacks.onRoomChange(room);
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mitimiti_participants',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        const participants = await getParticipants(roomId);
        callbacks.onParticipantsChange(participants);
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mitimiti_debts',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        if (callbacks.onDebtsChange) {
          const { data } = await supabase.from('mitimiti_debts').select('*').eq('room_id', roomId);
          if (data) callbacks.onDebtsChange(data as Debt[]);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
