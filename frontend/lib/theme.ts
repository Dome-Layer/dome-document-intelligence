export type Theme = 'light' | 'dark'

const COOKIE_NAME = 'dome-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function isProduction(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('domelayer.com')
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
  const domain = isProduction() ? '; Domain=.domelayer.com' : ''
  const secure = isProduction() ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${theme}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${domain}${secure}`
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
