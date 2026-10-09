// Sesion del usuario + catalogos (lineas, modelos, marcas, defectos) para toda la app.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const SessionCtx = createContext(null)

export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = cargando
  const [catalogs, setCatalogs] = useState(null)

  const loadCatalogs = useCallback(async () => {
    try {
      setCatalogs(await api('/catalogs'))
    } catch {
      /* se reintenta al entrar */
    }
  }, [])

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    if (user) loadCatalogs()
  }, [user, loadCatalogs])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('vp:unauthorized', onUnauthorized)
    return () => window.removeEventListener('vp:unauthorized', onUnauthorized)
  }, [])

  const login = async (username, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { username, password } })
    setUser(d.user)
  }
  // Entrar con la cuenta Planta en un area de trabajo (entrada | salida | lineas).
  const enter = async (area) => {
    const d = await api('/auth/guest', { method: 'POST', body: { area } })
    setUser(d.user)
  }
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }

  return (
    <SessionCtx.Provider value={{ user, login, enter, logout, catalogs, reloadCatalogs: loadCatalogs }}>
      {children}
    </SessionCtx.Provider>
  )
}

export function useSession() {
  return useContext(SessionCtx)
}

// Catalogos activos listos para selects (memorizados: mismos arreglos mientras no cambien los catalogos).
export function useCatalogs() {
  const { catalogs } = useSession()
  return useMemo(() => {
    const active = (list) => (list || []).filter((x) => x.active)
    return {
      loaded: Boolean(catalogs),
      lines: active(catalogs?.lines),
      models: active(catalogs?.models),
      brands: active(catalogs?.brands),
      defects: active(catalogs?.defects),
      all: catalogs,
    }
  }, [catalogs])
}
