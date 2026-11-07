// Los errores de la base llegan como "mm:<código>"; aquí se dicen en palabras.
const MESSAGES: Record<string, string> = {
  auth_required: 'Tu sesión se cerró. Vuelve a abrir la app.',
  profile_required: 'Primero cuéntanos cómo te llamas.',
  invalid_name: 'Escribe un nombre de hasta 40 letras.',
  invalid_title: 'Ponle un nombre a la cuenta (hasta 40 letras).',
  invalid_amount: 'Ese monto no es válido.',
  invalid_concept: 'El motivo puede tener hasta 40 letras.',
  invalid_direction: 'Elige quién le prestó a quién.',
  bill_not_found: 'No encontramos esa cuenta. Revisa el código o el link.',
  bill_locked: 'Esta cuenta ya se dividió, así que no acepta más personas.',
  bill_settled: 'Esta cuenta ya está pagada.',
  bill_cancelled: 'Esta cuenta se canceló.',
  bill_full: 'La cuenta llegó al máximo de 30 personas.',
  not_member: 'No estás en esta cuenta.',
  not_host: 'Eso solo lo puede hacer quien creó la cuenta.',
  bill_not_open: 'La cuenta ya se dividió.',
  bill_not_locked: 'La cuenta todavía no se dividió.',
  stale: 'Alguien cambió algo justo ahora. Revisa y vuelve a intentar.',
  members_changed: 'Alguien entró o salió justo ahora. Revisa los montos.',
  sum_mismatch: 'Los montos no suman el total de la cuenta.',
  need_two: 'Hacen falta al menos 2 personas para dividir.',
  has_payments: 'Alguien ya pagó en esta cuenta, así que ya no se puede cambiar.',
  invalid_item: 'Revisa el nombre y el precio.',
  too_many_items: 'Son demasiados productos para una cuenta.',
  not_allowed: 'Eso solo lo puede cambiar quien lo agregó o quien creó la cuenta.',
  item_not_found: 'Ese producto ya no está.',
  member_not_found: 'Esa persona ya no está en la cuenta.',
  cannot_remove_host: 'Quien creó la cuenta no se puede sacar.',
  invalid_payer: 'Quien pagó tiene que estar en la app.',
  invalid_mode: 'Esa forma de dividir no existe.',
  debt_not_found: 'No encontramos esta deuda. Revisa el link.',
  own_link: 'Este link es tuyo: envíaselo a tu amigo.',
  link_used: 'Este link ya lo usó otra persona.',
  link_cancelled: 'Este link se anuló.',
  link_closed: 'Esta deuda ya está cerrada.',
  cannot_decline: 'Esta parte no se puede rechazar.',
  already_member: 'Ya estás en esta cuenta con tu nombre.',
  invalid_debts: 'Algo cambió con estas deudas. Actualiza e intenta de nuevo.',
  nothing_to_pay: 'No tienes nada pendiente con esta persona.',
  invalid_method: 'Elige cómo pagaste.',
  settlement_not_found: 'Ese pago ya no está.',
  settlement_closed: 'Ese pago ya se resolvió.',
  you_owe: 'Aquí eres tú quien debe.',
  nothing_to_remind: 'No hay nada pendiente que recordar.',
  anonymous_disabled: 'Falta activar las sesiones anónimas en Supabase (Authentication → Sign In / Providers).',
  bad_code: 'Ese código no coincide o ya venció. Revísalo o pide uno nuevo.',
  no_account: 'No hay ninguna cuenta respaldada con ese correo.',
  email_taken: 'Ese correo ya respalda otra cuenta. Entra con él desde "Ya tengo cuenta".',
  rate_limited: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  network: 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  not_configured: 'La app no está conectada a su base de datos.',
  unknown: 'Algo salió mal. Intenta de nuevo.',
}

export class ApiError extends Error {
  readonly code: string
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.code = code
  }
}

export function errorCode(err: unknown): string {
  return err instanceof ApiError ? err.code : 'unknown'
}

export function errorMessage(err: unknown): string {
  return MESSAGES[errorCode(err)] ?? MESSAGES.unknown
}

/** Traduce el error que devuelve supabase-js al código de la app. */
export function toApiError(error: { message?: string; code?: string } | null | undefined): ApiError {
  const message = error?.message ?? ''
  if (message.startsWith('mm:')) return new ApiError(message.slice(3))
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message)) return new ApiError('network')
  if (error?.code === '42501' || /permission denied|jwt/i.test(message)) return new ApiError('auth_required', message)
  return new ApiError('unknown', message)
}
