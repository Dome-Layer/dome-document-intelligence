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
    const token = getToken()
    if (token) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_AUTH_BACKEND}/api/v1/auth/session`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        )
      } catch {
        // best-effort
      }
    }
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
