// Un toque físico mínimo en acciones importantes (Android). Si el teléfono
// no lo soporta, no pasa nada.
export function tap(ms = 8) {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    // El navegador solo deja vibrar después de que la persona tocó la página.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
    navigator.vibrate(ms)
  } catch {
    // sin vibración
  }
}

export function success() {
  tap(18)
}
