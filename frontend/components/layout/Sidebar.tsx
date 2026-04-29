'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Upload, Shield, FileText, Clock } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Upload', icon: Upload },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/rules', label: 'Rules', icon: Shield },
  { href: '/audit', label: 'Audit log', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="app-sidebar">
      <nav>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-item${isActive ? ' active' : ''}`}
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
