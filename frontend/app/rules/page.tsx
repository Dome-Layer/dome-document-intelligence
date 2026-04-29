'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { PageContent } from '@/components/layout/PageContent'
import { RulesToggleList } from '@/components/rules/RulesToggleList'
import { getRules, APIError } from '@/lib/api'
import type { GovernanceRule } from '@/lib/types'

export default function RulesPage() {
  const [rules, setRules] = useState<GovernanceRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRules()
      .then(setRules)
      .catch(err => {
        setError(
          err instanceof APIError
            ? `Error ${err.status}: ${err.message}`
            : 'Failed to load rules'
        )
      })
  }, [])

  return (
    <AuthGuard>
      <PageContent size="wide">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-dome-text mb-1" style={{ letterSpacing: '-0.01em' }}>
            Governance rules
          </h1>
          <p className="text-sm text-dome-muted">
            Enable or disable rules applied during extraction. Changes take effect on the next document.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3 mb-4">
            <p className="text-sm text-dome-error">{error}</p>
          </div>
        )}

        {rules === null && !error ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : rules !== null ? (
          <RulesToggleList initialRules={rules} />
        ) : null}
      </PageContent>
    </AuthGuard>
  )
}
