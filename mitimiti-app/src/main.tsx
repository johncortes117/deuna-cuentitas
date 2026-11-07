import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import { router } from './routes'
import { SessionProvider } from './state/session'
import { ToastProvider } from './ui/Toast'
import { applyTheme, watchSystemTheme } from './state/theme'

applyTheme()
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SessionProvider>
  </StrictMode>,
)
