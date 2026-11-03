'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Upload, Shield, FileText, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n'

const NAV_ITEMS = [
  { href: '/', key: 'upload', icon: Upload },
  { href: '/history', key: 'history', icon: Clock },
  { href: '/rules', key: 'rules', icon: Shield },
  { href: '/audit', key: 'audit', icon: FileText },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const t = useT()

  return (
    <aside className="app-sidebar">
      <nav>
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const label = t.nav[key]
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-item${isActive ? ' active' : ''}`}
              title={label}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
