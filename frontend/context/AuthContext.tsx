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
import { deleteSession } from '@/lib/api'

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
    try {
      await deleteSession()
    } catch {
      // best-effort; local session always cleared
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
