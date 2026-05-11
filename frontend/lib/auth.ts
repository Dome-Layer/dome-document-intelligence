// Cookie-based cross-subdomain token storage.
// The Supabase JWT is set as a cookie scoped to the current environment band
// (.domelayer.com on production, .staging.domelayer.com on staging) so all
// subdomains in that band share authentication (SSO) without bleeding across
// production/staging.
// The cookie is not HttpOnly by design — JS must read it to build
// the Authorization header sent to each tool's backend.

const COOKIE_NAME = 'dome_auth_token'

function isStagingHost(host: string): boolean {
  return host === 'staging.domelayer.com' || host.endsWith('.staging.domelayer.com')
}

function isProductionHost(host: string): boolean {
  if (isStagingHost(host)) return false
  return host === 'domelayer.com' || host.endsWith('.domelayer.com')
}

function isHttpsHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return isStagingHost(host) || isProductionHost(host)
}

function cookieDomain(): string {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  if (isStagingHost(host)) return '.staging.domelayer.com'
  if (isProductionHost(host)) return '.domelayer.com'
  return ''
}

// Returns the auth-gateway base URL for the current environment band.
// Used to build login/logout redirect URLs that stay within the same band
// (staging users go to staging.domelayer.com/login; production users to
// domelayer.com/login). Returns "" in dev — callers should then construct
// a relative URL.
export function getAuthSiteUrl(): string {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  if (isStagingHost(host)) return 'https://staging.domelayer.com'
  if (isProductionHost(host)) return 'https://domelayer.com'
  return ''
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
  const securePart = isHttpsHost() ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${token}; Path=/${domainPart}; SameSite=Lax${securePart}; Max-Age=${maxAge}`
}

export function clearToken(): void {
  if (typeof document === 'undefined') return
  const domain = cookieDomain()
  const domainPart = domain ? `; Domain=${domain}` : ''
  const securePart = isHttpsHost() ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=; Path=/${domainPart}; SameSite=Lax${securePart}; Max-Age=0`
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
