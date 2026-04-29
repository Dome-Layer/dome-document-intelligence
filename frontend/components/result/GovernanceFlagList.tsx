import type { ValidationFlag } from '@/lib/types'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

interface GovernanceFlagListProps {
  flags: ValidationFlag[]
}

export function GovernanceFlagList({ flags }: GovernanceFlagListProps) {
  if (flags.length === 0) {
    return (
      <div className="rounded-xl border border-dome-success-border bg-dome-success-subtle px-5 py-4 flex items-center gap-3">
        <div className="text-dome-success flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 9.5L7 13.5L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-sm text-dome-text font-medium">No governance issues detected</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1 text-xs text-dome-muted">
        <span className="flex items-center gap-1.5">
          <span className="badge badge-error" style={{ fontSize: '0.5625rem' }}>error</span>
          manual review required
        </span>
        <span className="flex items-center gap-1.5">
          <span className="badge badge-warning" style={{ fontSize: '0.5625rem' }}>warning</span>
          attention recommended
        </span>
        <span className="flex items-center gap-1.5">
          <span className="badge badge-neutral" style={{ fontSize: '0.5625rem' }}>info</span>
          informational
        </span>
      </div>
      {flags.map((flag, i) => (
        <FlagRow key={i} flag={flag} />
      ))}
    </div>
  )
}

function FlagRow({ flag }: { flag: ValidationFlag }) {
  const config = SEVERITY_CONFIG[flag.severity]

  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${config.wrapperClass}`}
    >
      <config.Icon size={16} strokeWidth={1.5} className={`flex-shrink-0 mt-0.5 ${config.iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${config.badgeClass}`}>{flag.severity}</span>
          <span className="text-sm font-medium text-dome-text">{flag.rule_name}</span>
          {flag.field_name && (
            <span className="text-xs text-dome-muted font-mono">
              {flag.field_name}
            </span>
          )}
        </div>
        <p className="text-sm text-dome-muted mt-0.5">{flag.message}</p>
      </div>
    </div>
  )
}

const SEVERITY_CONFIG = {
  error: {
    wrapperClass: 'bg-dome-error-subtle border-dome-error-border',
    iconClass: 'text-dome-error',
    badgeClass: 'badge-error',
    Icon: AlertCircle,
  },
  warning: {
    wrapperClass: 'bg-dome-warning-subtle border-dome-warning-border',
    iconClass: 'text-dome-warning',
    badgeClass: 'badge-warning',
    Icon: AlertTriangle,
  },
  info: {
    wrapperClass: 'border-dome-border bg-dome-surface',
    iconClass: 'text-dome-muted',
    badgeClass: 'badge-neutral',
    Icon: Info,
  },
} as const
