import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/errors'

export interface DataState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => Promise<void>
}

/**
 * Carga datos y los vuelve a pedir cuando cambia `key` (p. ej. la señal de
 * notificaciones). Mientras recarga se sigue mostrando lo anterior: nada
 * parpadea.
 */
export function useData<T>(load: () => Promise<T>, key: string): DataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const reload = useCallback(async () => {
    try {
      const next = await loadRef.current()
      setData(next)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('unknown', String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, key])

  return { data, error, loading, reload }
}
