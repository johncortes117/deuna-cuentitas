// Claro, oscuro o el del teléfono. El script de index.html lo aplica antes de
// pintar; aquí se cambia y se sigue al sistema si está en "automático".
export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'mitimiti-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice = getTheme()) {
  const dark = choice === 'dark' || (choice === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#131218' : '#FBF8F3'))
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // sin almacenamiento
  }
  applyTheme(choice)
}

export function watchSystemTheme() {
  const mq = media()
  const onChange = () => {
    if (getTheme() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
