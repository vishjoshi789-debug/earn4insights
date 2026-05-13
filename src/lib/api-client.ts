const CSRF_META_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const meta = document.querySelector(`meta[name="${CSRF_META_NAME}"]`)
  return meta?.getAttribute('content') ?? ''
}

type ExtraInit = Omit<RequestInit, 'method' | 'body'>

async function send(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  init?: ExtraInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (!headers.has('Content-Type') && body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set(CSRF_HEADER_NAME, getCsrfToken())
  return fetch(url, {
    ...init,
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData || typeof body === 'string'
          ? (body as BodyInit)
          : JSON.stringify(body),
  })
}

export const apiPost = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'POST', body, init)
export const apiPatch = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'PATCH', body, init)
export const apiPut = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'PUT', body, init)
export const apiDelete = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'DELETE', body, init)
