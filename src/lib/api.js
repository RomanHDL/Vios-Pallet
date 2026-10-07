// Cliente del API. Lanza ApiError con el mensaje del servidor (en espanol) y los datos extra.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Error ${status}`)
    this.status = status
    this.body = body || {}
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  let url = `/api${path}`
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me')
      window.dispatchEvent(new Event('vp:unauthorized'))
    throw new ApiError(res.status, data)
  }
  return data
}
