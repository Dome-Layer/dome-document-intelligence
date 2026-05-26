'use client'

import { useEffect, useState } from 'react'
import { getToken, getAuthSiteUrl } from '@/lib/auth'

interface AuthGuardProps {
  children: React.ReactNode
}

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true'

export default function AuthGuard({ children }: AuthGuardProps) {
  const [checked, setChecked] = useState(SKIP_AUTH)

  useEffect(() => {
    if (SKIP_AUTH) return
    if (!getToken()) {
      const returnUrl = encodeURIComponent(window.location.href)
      window.location.href = `${getAuthSiteUrl()}/login?redirect=${returnUrl}`
    } else {
      setChecked(true)
    }
  }, [])

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--color-bg-subtle)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--color-border-default)', borderTopColor: 'var(--color-accent)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-text-tertiary)' }}>
            Loading
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
