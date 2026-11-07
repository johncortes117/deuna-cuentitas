import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '../ui/Button'
import { ErrorScreen } from '../ui/Layout'

export function RouteError() {
  const error = useRouteError()
  // Una versión nueva de la app cambió los archivos: recargar lo arregla.
  const chunk = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message)
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <ErrorScreen
        title={chunk ? 'Hay una versión nueva de MitiMiti' : isRouteErrorResponse(error) && error.status === 404 ? 'Esta página no existe' : 'Algo salió mal'}
        body={chunk ? 'Recarga para seguir donde estabas.' : 'Vuelve a intentarlo. Si sigue pasando, recarga la app.'}
        action={
          <Button full onClick={() => (chunk ? window.location.reload() : window.location.assign('/'))}>
            {chunk ? 'Recargar' : 'Ir al inicio'}
          </Button>
        }
      />
    </div>
  )
}
