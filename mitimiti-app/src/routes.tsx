import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { AppFrame, RequireProfile, Splash, TabsLayout } from './AppFrame'
import { RouteError } from './features/RouteError'
import HomePage from './features/home/HomePage'
import WelcomePage from './features/onboarding/WelcomePage'

// Las pantallas grandes se cargan cuando se abren: quien entra por un link
// de WhatsApp descarga solo lo que necesita para esa cuenta.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const router = createBrowserRouter([
  {
    element: <AppFrame />,
    errorElement: <RouteError />,
    // Mientras llega la pantalla de un link (p. ej. /c/K7Q2PX), el logo.
    hydrateFallbackElement: <Splash />,
    children: [
      { path: '/bienvenida', element: <WelcomePage /> },
      { path: '/entrar', lazy: page(() => import('./features/profile/RestorePage')) },
      { path: '/c/:code', lazy: page(() => import('./features/bill/BillPage')) },
      { path: '/d/:token', lazy: page(() => import('./features/debts/DebtLinkPage')) },
      { path: '/p/:code', lazy: page(() => import('./features/profile/PayCardPage')) },
      { path: '/unirme', lazy: page(() => import('./features/bill/JoinByCodePage')) },
      {
        element: <RequireProfile />,
        children: [
          {
            element: <TabsLayout />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/saldos', lazy: page(() => import('./features/debts/BalancesPage')) },
              { path: '/tu', lazy: page(() => import('./features/profile/ProfilePage')) },
            ],
          },
          { path: '/nueva', lazy: page(() => import('./features/bill/NewBillPage')) },
          { path: '/prestamo', lazy: page(() => import('./features/debts/NewLoanPage')) },
          { path: '/saldos/historial', lazy: page(() => import('./features/debts/HistoryPage')) },
          { path: '/saldos/:key', lazy: page(() => import('./features/debts/PersonPage')) },
          { path: '/actividad', lazy: page(() => import('./features/activity/ActivityPage')) },
          { path: '/tu/cobros', lazy: page(() => import('./features/profile/PayMethodsPage')) },
        ],
      },
      { path: '*', lazy: page(() => import('./features/NotFoundPage')) },
    ],
  },
])
