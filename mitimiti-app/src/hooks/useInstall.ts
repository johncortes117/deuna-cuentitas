// "Agregar a la pantalla de inicio": en Android con el aviso del navegador;
// en iPhone se explica cómo (Compartir → Agregar a inicio).
import { useEffect, useState } from 'react'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function useInstall() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((t) => t + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return {
    canPrompt: Boolean(deferred),
    showIosHint: !deferred && isIos() && !isStandalone(),
    installed: isStandalone(),
    prompt: async () => {
      if (!deferred) return false
      await deferred.prompt()
      const choice = await deferred.userChoice
      deferred = null
      return choice.outcome === 'accepted'
    },
  }
}
