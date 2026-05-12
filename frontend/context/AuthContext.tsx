'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { getToken, setToken, clearToken } from '@/lib/auth'

interface AuthState {
  isAuthenticated: boolean
  signIn: (token: string, expiresAt?: string) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  signIn: () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    setIsAuthenticated(!!getToken())
  }, [])

  const signIn = useCallback((newToken: string, expiresAt?: string) => {
    setToken(newToken, expiresAt)
    setIsAuthenticated(true)
  }, [])

  const signOut = useCallback(async () => {
    // DocI has no backend /auth/session endpoint, so signOut is client-only:
    // we discard the access token locally and rely on natural Supabase
    // session expiry. Other tools (PA/LLC/DI) revoke the token server-side
    // via supabase.auth.admin.sign_out() — adding that to DocI is tracked
    // as a separate follow-up.
    clearToken()
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
