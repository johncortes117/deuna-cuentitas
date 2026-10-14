// ─── Supabase Client + MitiMiti CRUD ─────────────────────────
import { createClient } from '@supabase/supabase-js';
import type { Room, Participant, RoomStatus, Debt, ActiveRoom } from './types';
import { generateId, generateInviteToken, dividirMonto, isRoomStale, OPEN_ROOM_STATUSES } from './utils';
import { trackEvent } from './analytics';

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

  trackEvent('ROOM_CREATED', data.id, hostId, { commerceName, totalCents });

  // Agregar al host como participante
  await addParticipant(data.id, hostId, hostName, 'host');

  return data as Room;
}

// ─── Vencimiento de salas ────────────────────────────────────
//
// Antes el vencimiento solo existía en la pantalla: el timer llegaba a 0 y,
// únicamente si la sala estaba en 'waiting' Y el host la estaba mirando, se
// cancelaba. Una sala que vencía en 'locked'/'confirming' (o con el host
// fuera de la app) quedaba abierta para siempre en la BD: la sala "Pizza" que
// seguía saliendo en el inicio semanas después, y cuyo QR seguía sirviendo.
//
// Ahora el vencimiento se aplica al LEER: cualquier lectura que encuentre una
// sala abierta y vencida la cierra en la BD (sin importar quién la lea) y la
// devuelve ya cerrada. No se borra la fila — eso arrastraría en cascada las
// deudas de la sala — se marca 'cancelled', que en la app equivale a que
// desaparezca. Para cerrarlas aunque nadie abra la app, ver la función SQL
// opcional `mitimiti_expire_rooms` en supabase-setup.sql.

/**
 * Cierra una sala vencida. Es condicional (solo si sigue abierta Y vencida)
 * para no pisar una sala que justo se pagó o se canceló, y para que si varios
 * teléfonos lo intentan a la vez solo uno lo haga de verdad.
 */
export async function expireRoom(roomId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('mitimiti_rooms')
    .update({ status: 'cancelled' })
    .eq('id', roomId)
    .in('status', OPEN_ROOM_STATUSES)
    .lte('expires_at', new Date().toISOString())
    .select('id');

  if (error || !data || data.length === 0) return false;

  // Los préstamos hechos en la sala eran solo promesas: se anulan.
  await supabase
    .from('mitimiti_debts')
    .update({ status: 'cancelled' })
    .eq('room_id', roomId)
    .eq('status', 'pending');

  trackEvent('ROOM_EXPIRED', roomId);
  return true;
}

/**
 * Si la sala venció pero sigue abierta en la BD, la cierra y la devuelve ya
 * cerrada, para que ninguna pantalla vuelva a mostrarla como activa.
 */
async function closeIfStale(room: Room): Promise<Room> {
  if (!isRoomStale(room)) return room;
  await expireRoom(room.id).catch(() => { /* se reintenta en la próxima lectura */ });
  return { ...room, status: 'cancelled' };
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
  return closeIfStale(data as Room);
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
  return closeIfStale(data as Room);
}

/**
 * Busca si el usuario está en una sala que aún no haya finalizado, y en qué
 * punto está él dentro de ella.
 *
 * De paso hace la limpieza: las salas del usuario que vencieron sin cerrarse
 * se cierran aquí mismo, así que la sala zombi desaparece la primera vez que
 * el usuario abre el inicio.
 */
export async function getActiveRoomForUser(userId: string): Promise<ActiveRoom | null> {
  const { data: parts, error: partsError } = await supabase
    .from('mitimiti_participants')
    .select('room_id, confirmation_status, amount_cents')
    .eq('user_id', userId);

  if (partsError || !parts || parts.length === 0) return null;

  const roomIds = parts.map(p => p.room_id);
  const { data: rooms, error: roomsError } = await supabase
    .from('mitimiti_rooms')
    .select('*')
    .in('id', roomIds)
    .in('status', OPEN_ROOM_STATUSES)
    .order('created_at', { ascending: false })
    .limit(20);

  if (roomsError || !rooms || rooms.length === 0) return null;

  const now = Date.now();
  const stale = (rooms as Room[]).filter(r => isRoomStale(r, now));
  stale.forEach(r => {
    expireRoom(r.id).catch(() => { /* se reintenta en el próximo chequeo */ });
  });

  const room = (rooms as Room[]).find(r => !isRoomStale(r, now));
  if (!room) return null;

  const me = parts.find(p => p.room_id === room.id);
  return {
    room,
    myStatus: (me?.confirmation_status ?? 'pending') as Participant['confirmation_status'],
    myAmountCents: me?.amount_cents ?? null,
  };
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

  // Sincronizar estado de las deudas (Liquidación / Auth vs Capture)
  if (status === 'completed') {
    await supabase
      .from('mitimiti_debts')
      .update({ status: 'active' })
      .eq('room_id', roomId)
      .eq('status', 'pending');
  } else if (status === 'cancelled') {
    // OJO: 'failed' ya NO anula los préstamos. Después de un fallo el host
    // puede reintentar el pago; si los anulábamos aquí, al reintentar con
    // éxito los préstamos de la sala se perdían. Se anulan recién cuando la
    // sala se cancela de verdad ("Cancelar todo" o vencimiento).
    await supabase
      .from('mitimiti_debts')
      .update({ status: 'cancelled' })
      .eq('room_id', roomId)
      .eq('status', 'pending');
  }
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
  
  trackEvent('USER_JOINED', roomId, userId, { role });
  
  return data as Participant;
}

/**
 * Mete al usuario en la sala a partir del token de invitación.
 *
 * Es idempotente a propósito: escanear el QR YA es la aceptación, así que
 * reentrar (reintento de red, doble efecto de React, otra pestaña) no puede
 * fallar. El UNIQUE(room_id, user_id) de la tabla hace ese trabajo.
 *
 * Una consulta para la sala y un upsert para entrar. Antes eran cinco viajes
 * al servidor encadenados, y esa espera era justo la que alcanzaba a mostrar
 * la pantalla intermedia entre el escáner y la sala.
 */
export async function enterRoomByToken(
  inviteToken: string,
  userId: string,
  displayName: string,
): Promise<Room> {
  // getRoomByToken ya devuelve como 'cancelled' una sala vencida: un QR o
  // link viejo deja de servir aunque nadie la haya cerrado a mano.
  const room = await getRoomByToken(inviteToken);
  if (!room) throw new Error('No encontramos esta sala. Puede que el código sea de otra cuenta.');
  if (room.status === 'locked' || room.status === 'confirming') {
    throw new Error(`${room.host_name} ya dividió la cuenta, así que esta sala no acepta más personas.`);
  }
  if (room.status !== 'waiting') throw new Error('Esta sala ya se cerró.');

  const { data, error } = await supabase
    .from('mitimiti_participants')
    .upsert(
      {
        id: generateId(),
        room_id: room.id,
        user_id: userId,
        display_name: displayName,
        role: 'member',
        amount_cents: null,
        has_extra_cent: false,
        confirmation_status: 'pending',
        confirmed_at: null,
      },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true },
    )
    .select();

  if (error) throw new Error(`Error entrando a la sala: ${error.message}`);

  // Con ignoreDuplicates, `data` viene vacío si ya estábamos dentro: solo
  // contamos el evento cuando la entrada es nueva de verdad.
  if (data && data.length > 0) {
    trackEvent('USER_JOINED', room.id, userId, { role: 'member' });
  }

  return room;
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
 * El host divide la cuenta: calcula la división, asigna montos y cierra la
 * sala para que cada uno acepte su parte.
 *
 * También sirve para CORREGIR montos con la sala ya dividida ('locked' o
 * 'confirming'): así, si al ver los montos alguien dice "yo no tomé
 * cerveza", el host lo arregla en dos toques en vez de cancelar la sala y
 * empezar de cero. Al corregir, todos vuelven a aceptar (cambió su monto,
 * así que su "acepto" anterior ya no vale). Si ya hubo préstamos en la sala
 * no se permite: esos préstamos se calcularon con los montos viejos.
 *
 * Devuelve el monto que quedó para cada persona, para que el host pueda
 * aceptar su propia parte en el mismo toque.
 */
export async function lockRoom(
  roomId: string,
  hostId: string,
  splitMode: 'equal' | 'custom' = 'equal',
  customAmounts?: { userId: string, amountCents: number }[]
): Promise<{ userId: string; amountCents: number }[]> {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Sala no encontrada');
  if (room.host_id !== hostId) throw new Error('Solo el anfitrión puede dividir la cuenta');
  if (room.status === 'cancelled') throw new Error('Esta sala ya se cerró');

  const isResplit = room.status === 'locked' || room.status === 'confirming';
  if (room.status !== 'waiting' && !isResplit) throw new Error('Esta sala ya no se puede dividir');

  if (isResplit) {
    const { count } = await supabase
      .from('mitimiti_debts')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('status', 'pending');
    if (count && count > 0) {
      throw new Error('Ya hubo préstamos en esta sala, así que los montos no se pueden cambiar');
    }
  }

  const participants = await getParticipants(roomId);
  if (participants.length < 2) throw new Error('Necesitas al menos 2 personas');

  // Calcular división
  const totalCents = room.total_cents + room.tip_cents;

  let updates: {id: string, userId: string, amount_cents: number, has_extra_cent: boolean}[] = [];

  if (splitMode === 'equal') {
    const amounts = dividirMonto(totalCents, participants.length);
    updates = participants.map((p, i) => ({
      id: p.id,
      userId: p.user_id,
      amount_cents: amounts[i],
      has_extra_cent: amounts[i] > Math.floor(totalCents / participants.length),
    }));
  } else {
    if (!customAmounts) throw new Error('Faltan los montos de cada persona');
    // Alguien pudo entrar justo mientras el host ajustaba: mejor avisar que
    // dejarlo en $0 sin que nadie lo haya decidido.
    const missing = participants.filter(p => !customAmounts.some(c => c.userId === p.user_id));
    if (missing.length > 0) {
      throw new Error(`${missing[0].display_name} acaba de entrar. Revisa los montos otra vez.`);
    }
    if (customAmounts.some(c => c.amountCents < 0)) throw new Error('Hay un monto negativo');
    const sum = participants.reduce(
      (acc, p) => acc + (customAmounts.find(c => c.userId === p.user_id)?.amountCents || 0),
      0,
    );
    if (sum !== totalCents) throw new Error('La suma de montos no coincide con el total');

    updates = participants.map(p => ({
      id: p.id,
      userId: p.user_id,
      amount_cents: customAmounts.find(c => c.userId === p.user_id)?.amountCents || 0,
      has_extra_cent: false,
    }));
  }

  // Actualizar cada participante. Quien quedó en $0 (p. ej. el cumpleañero
  // al que invitan) no tiene nada que aceptar: queda listo de una.
  const now = new Date().toISOString();
  for (const update of updates) {
    const nothingToPay = update.amount_cents === 0;
    await supabase
      .from('mitimiti_participants')
      .update({
        amount_cents: update.amount_cents,
        has_extra_cent: update.has_extra_cent,
        confirmation_status: nothingToPay ? 'confirmed' : 'pending',
        confirmed_at: nothingToPay ? now : null,
        deficit_cents: 0,
      })
      .eq('id', update.id);
  }

  // NOTA: el host no se auto-confirma aquí: la vista lo hace en el mismo
  // toque si su saldo alcanza (el saldo vive en el teléfono), y si no, le
  // abre de una las opciones para cubrir lo que falta.
  await updateRoomStatus(roomId, 'locked', {
    locked_at: now,
    split_mode: splitMode,
  });
  trackEvent(isResplit ? 'ROOM_RESPLIT' : 'ROOM_LOCKED', roomId, hostId, { splitMode });

  return updates.map(u => ({ userId: u.userId, amountCents: u.amount_cents }));
}

/**
 * Un participante confirma su pago.
 * Si todos confirman, la sala pasa a 'confirming'.
 *
 * `expectedAmountCents` es el monto que la persona VIO al aceptar. Si el
 * host lo cambió (o alguien salió y la sala se reinició) en ese mismo
 * instante, no se confirma un monto distinto al que aceptó.
 */
export async function confirmPayment(
  roomId: string,
  userId: string,
  expectedAmountCents?: number,
): Promise<void> {
  let query = supabase
    .from('mitimiti_participants')
    .update({
      confirmation_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (expectedAmountCents !== undefined) {
    query = query.eq('amount_cents', expectedAmountCents);
  }

  const { data, error } = await query.select('id');

  if (error) throw new Error(`Error confirmando: ${error.message}`);
  if (expectedAmountCents !== undefined && (!data || data.length === 0)) {
    throw new Error('Tu monto acaba de cambiar. Revísalo antes de aceptar.');
  }

  trackEvent('USER_CONFIRMED', roomId, userId);

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
  if (room.host_id !== hostId) throw new Error('Solo el anfitrión puede pagar');
  if (room.status === 'cancelled') throw new Error('Esta sala ya se cerró');
  // 'failed' también vale: es el "Reintentar" después de un pago fallido.
  // Antes solo se aceptaba 'confirming', así que reintentar SIEMPRE fallaba
  // con "No todos han confirmado".
  if (room.status !== 'confirming' && room.status !== 'failed') {
    throw new Error('Todavía faltan personas por aceptar');
  }

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
  trackEvent('PAYMENT_EXECUTED', roomId, hostId);
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
  
  trackEvent('LOAN_REQUESTED', roomId, userId, { deficitCents });
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
    .eq('status', 'pending')
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
        status: 'pending',
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
  
  trackEvent('LOAN_GRANTED', roomId, lenderId, { borrowerId, amountCents });
}

/**
 * Devuelve un mapa room_id → nombre de la sala, para dar contexto de origen
 * a las deudas (en qué sala/comercio nació cada una).
 */
export async function getRoomNames(roomIds: string[]): Promise<Record<string, string>> {
  if (roomIds.length === 0) return {};
  const { data } = await supabase
    .from('mitimiti_rooms')
    .select('id, commerce_name')
    .in('id', roomIds);
  const map: Record<string, string> = {};
  (data || []).forEach((r: { id: string; commerce_name: string }) => {
    map[r.id] = r.commerce_name;
  });
  return map;
}

export async function getMyDebts(userId: string): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('mitimiti_debts')
    .select('*')
    .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
    .in('status', ['active', 'paid', 'forgiven'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error obteniendo deudas: ${error.message}`);
  return (data || []) as Debt[];
}

export async function settleDebt(debtId: string): Promise<void> {
  await settleDebts([debtId]);
}

/**
 * Marca varias deudas como pagadas de una vez. Las deudas se muestran
 * agrupadas por persona ("Le debes $7 a Pedro", aunque vengan de dos
 * salas), así que pagarle a alguien salda todas las que tienes con él.
 * Solo toca deudas todavía activas: un doble toque no paga dos veces.
 */
export async function settleDebts(debtIds: string[]): Promise<void> {
  if (debtIds.length === 0) return;
  const { error } = await supabase
    .from('mitimiti_debts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('id', debtIds)
    .eq('status', 'active');
  if (error) throw new Error(`Error pagando deuda: ${error.message}`);
}

export async function forgiveDebt(debtId: string): Promise<void> {
  await forgiveDebts([debtId]);
}

export async function forgiveDebts(debtIds: string[]): Promise<void> {
  if (debtIds.length === 0) return;
  const { error } = await supabase
    .from('mitimiti_debts')
    .update({ status: 'forgiven', forgiven_at: new Date().toISOString() })
    .in('id', debtIds)
    .eq('status', 'active');
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
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const pushRoom = async () => {
    const room = await getRoom(roomId);
    if (room && !closed) callbacks.onRoomChange(room);
  };

  const pushParticipants = async () => {
    const participants = await getParticipants(roomId);
    if (!closed) callbacks.onParticipantsChange(participants);
  };

  const pushDebts = async () => {
    if (!callbacks.onDebtsChange) return;
    const { data } = await supabase.from('mitimiti_debts').select('*').eq('room_id', roomId);
    if (data && !closed) callbacks.onDebtsChange(data as Debt[]);
  };

  // Re-consulta todo de una. Lo que cambió mientras el canal estaba caído (o
  // mientras todavía se estaba uniendo) NO llega nunca como evento, así que
  // hay que ir a buscarlo a mano cada vez que (re)conectamos.
  const resync = () => {
    pushRoom().catch(() => { /* el poll de respaldo lo reintenta */ });
    pushParticipants().catch(() => { /* idem */ });
    pushDebts().catch(() => { /* idem */ });
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer) return;
    const delay = Math.min(1000 * 2 ** attempt, 10000);
    attempt++;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (closed) return;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      connect();
    }, delay);
  };

  function connect() {
    if (closed) return;

    // Nombre único por intento: reusar el nombre de un canal medio muerto
    // hace que el join se quede colgado del lado del servidor.
    channel = supabase
      .channel(`room-${roomId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mitimiti_rooms',
          filter: `id=eq.${roomId}`,
        },
        // Re-fetch completo para tener datos consistentes
        pushRoom,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mitimiti_participants',
          filter: `room_id=eq.${roomId}`,
        },
        pushParticipants,
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'mitimiti_participants',
          // SIN filter, a propósito: Supabase Realtime NO puede filtrar
          // eventos DELETE (el registro borrado solo trae su primary key,
          // no room_id), así que el listener filtrado de arriba nunca se
          // entera cuando alguien sale de la sala. Escuchamos todos los
          // DELETE de la tabla y re-consultamos nuestra sala.
        },
        pushParticipants,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mitimiti_debts',
          filter: `room_id=eq.${roomId}`,
        },
        pushDebts,
      )
      .subscribe((status) => {
        if (closed) return;

        if (status === 'SUBSCRIBED') {
          attempt = 0;
          resync();
          return;
        }

        // Antes esto se llamaba sin callback: si el canal moría al unirse
        // (red móvil, Realtime saturado, pestaña dormida) nadie se enteraba
        // y no volvía a intentarlo NUNCA. La sala quedaba dependiendo solo
        // del poll de respaldo, que es justo lo que se veía como "no se
        // actualiza en tiempo real".
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect();
        }
      });
  }

  // Bloquear el teléfono o cambiar de app tumba el WebSocket sin avisar.
  // Al volver, re-consultamos: si además el canal quedó muerto, el propio
  // estado del socket dispara la reconexión de arriba.
  const onWake = () => {
    if (closed || document.hidden) return;
    resync();
  };

  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('online', onWake);

  connect();

  return () => {
    closed = true;
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('online', onWake);
    if (retryTimer) clearTimeout(retryTimer);
    if (channel) supabase.removeChannel(channel);
  };
}
