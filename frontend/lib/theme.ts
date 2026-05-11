export type Theme = 'light' | 'dark'

const COOKIE_NAME = 'dome-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

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

function readThemeCookie(): Theme | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find(r => r.startsWith(`${COOKIE_NAME}=`))
  if (!match) return null
  const val = match.split('=')[1]
  return val === 'light' || val === 'dark' ? val : null
}

function writeThemeCookie(theme: Theme): void {
  if (typeof document === 'undefined') return
  const domain = cookieDomain()
  const domainPart = domain ? `; Domain=${domain}` : ''
  const secure = isHttpsHost() ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${theme}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${domainPart}${secure}`
}

export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  const cookie = readThemeCookie()
  if (cookie) return cookie
  const stored = localStorage.getItem(COOKIE_NAME) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const setTheme = (theme: Theme): void => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(COOKIE_NAME, theme)
  writeThemeCookie(theme)
}

export const toggleTheme = (): Theme => {
  const current = document.documentElement.getAttribute('data-theme') as Theme | null
  const next: Theme = current === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export const initTheme = (): void => {
  setTheme(getTheme())
}
