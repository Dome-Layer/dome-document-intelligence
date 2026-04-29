'use client'

import { useState } from 'react'
import type { GovernanceRule } from '@/lib/types'
import { toggleRule, APIError } from '@/lib/api'

interface RulesToggleListProps {
  initialRules: GovernanceRule[]
}

export function RulesToggleList({ initialRules }: RulesToggleListProps) {
  const [rules, setRules] = useState<GovernanceRule[]>(initialRules)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleToggle = async (rule: GovernanceRule) => {
    if (toggling.has(rule.rule_id)) return
    setToggling(prev => new Set(prev).add(rule.rule_id))
    setErrors(prev => { const next = { ...prev }; delete next[rule.rule_id]; return next })

    // Optimistic update
    setRules(prev =>
      prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled: !r.enabled } : r)
    )

    try {
      await toggleRule(rule.rule_id, !rule.enabled)
    } catch (err) {
      // Revert on error
      setRules(prev =>
        prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled: rule.enabled } : r)
      )
      const message = err instanceof APIError ? err.message : 'Failed to update rule'
      setErrors(prev => ({ ...prev, [rule.rule_id]: message }))
    } finally {
      setToggling(prev => { const next = new Set(prev); next.delete(rule.rule_id); return next })
    }
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12 text-dome-muted text-sm">
        No rules found.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.map(rule => (
        <RuleCard
          key={rule.rule_id}
          rule={rule}
          isToggling={toggling.has(rule.rule_id)}
          error={errors[rule.rule_id]}
          onToggle={() => handleToggle(rule)}
        />
      ))}
    </div>
  )
}

interface RuleCardProps {
  rule: GovernanceRule
  isToggling: boolean
  error?: string
  onToggle: () => void
}

const SEVERITY_CLASSES = {
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-neutral',
} as const

function RuleCard({ rule, isToggling, error, onToggle }: RuleCardProps) {
  return (
    <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 transition-opacity ${
      rule.enabled ? 'border-dome-border bg-dome-surface' : 'border-dome-border bg-dome-bg opacity-60'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`badge ${SEVERITY_CLASSES[rule.severity]}`}>
            {rule.severity}
          </span>
          <span className="text-sm font-semibold text-dome-text">{rule.name}</span>
        </div>
        <p className="text-sm text-dome-muted">{rule.description}</p>
        {error && (
          <p className="text-xs text-dome-error mt-1">{error}</p>
        )}
      </div>

      <button
        role="switch"
        aria-checked={rule.enabled}
        aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
        onClick={onToggle}
        disabled={isToggling}
        className="flex-shrink-0 mt-0.5 relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: rule.enabled ? 'var(--color-accent)' : 'var(--color-border-strong)',
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: rule.enabled ? 'translateX(18px)' : 'translateX(3px)' }}
        />
      </button>
    </div>
  )
}
