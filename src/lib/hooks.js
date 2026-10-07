import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

// Carga datos del API; con `refreshMs` se actualiza solo (tableros en vivo).
export function useApi(path, { query, refreshMs, skip } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const key = JSON.stringify([path, query])
  const alive = useRef(true)

  const load = useCallback(
    async (silent = false) => {
      if (skip) return
      if (!silent) setLoading(true)
      try {
        const d = await api(path, { query })
        if (alive.current) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (alive.current) setError(e)
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, skip],
  )

  useEffect(() => {
    alive.current = true
    load()
    if (!refreshMs) return () => (alive.current = false)
    const id = setInterval(() => document.visibilityState === 'visible' && load(true), refreshMs)
    return () => {
      alive.current = false
      clearInterval(id)
    }
  }, [load, refreshMs])

  return { data, error, loading, reload: load, setData }
}

// Valor guardado en localStorage (configuracion de la estacion, filtros).
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* sin storage */
    }
  }, [key, value])
  return [value, setValue]
}
