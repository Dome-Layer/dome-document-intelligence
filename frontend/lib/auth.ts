// Cookie-based cross-subdomain token storage.
// The Supabase JWT is set as a .domelayer.com cookie so all
// *.domelayer.com subdomains share authentication (SSO).
// The cookie is not HttpOnly by design — JS must read it to build
// the Authorization header sent to each tool's backend.

const COOKIE_NAME = 'dome_auth_token'

function isProduction(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('domelayer.com')
}

function cookieDomain(): string {
  return isProduction() ? '.domelayer.com' : ''
}

function parseCookieExpiry(expiresAt: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  )
  return diffSec.toString()
}

export function getToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
  if (!match) return null
  return match.split('=').slice(1).join('=') || null
}

export function setToken(token: string, expiresAt?: string): void {
  if (typeof document === 'undefined') return
  const domain = cookieDomain()
  const maxAge = expiresAt ? parseCookieExpiry(expiresAt) : '3600'
  const domainPart = domain ? `; Domain=${domain}` : ''
  const securePart = isProduction() ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${token}; Path=/${domainPart}; SameSite=Lax${securePart}; Max-Age=${maxAge}`
}

export function clearToken(): void {
  if (typeof document === 'undefined') return
  const domain = cookieDomain()
  const domainPart = domain ? `; Domain=${domain}` : ''
  const securePart = isProduction() ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=; Path=/${domainPart}; SameSite=Lax${securePart}; Max-Age=0`
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
