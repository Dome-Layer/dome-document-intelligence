'use client'

import Link from 'next/link'
import { DomeLogo } from './DomeLogo'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/context/AuthContext'

export function Header() {
  const { isAuthenticated, signOut } = useAuth()

  return (
    <header className="app-topbar">
      <div className="flex items-center justify-between w-full">
        <Link href="/" aria-label="Home">
          <DomeLogo width={100} />
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isAuthenticated ? (
            <button
              onClick={async () => {
                await signOut()
                window.location.href = 'https://domelayer.com/login'
              }}
              className="btn btn-neutral btn-sm"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => {
                const returnUrl = encodeURIComponent(window.location.href)
                window.location.href = `https://domelayer.com/login?redirect=${returnUrl}`
              }}
              className="btn btn-primary btn-sm"
            >
              Sign in
            </button>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
