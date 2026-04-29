'use client'

import { useEffect } from 'react'
import { getToken } from '@/lib/auth'

interface AuthGuardProps {
  children: React.ReactNode
}

// When NEXT_PUBLIC_SKIP_AUTH=true, auth is bypassed entirely for local development.
// Never set this to true in production.
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true'

export default function AuthGuard({ children }: AuthGuardProps) {
  useEffect(() => {
    if (!SKIP_AUTH && !getToken()) {
      const returnUrl = encodeURIComponent(window.location.href)
      window.location.href = `https://domelayer.com/login?redirect=${returnUrl}`
    }
  }, [])

  if (!SKIP_AUTH && typeof window !== 'undefined' && !getToken()) {
    return null
  }

  return <>{children}</>
}
