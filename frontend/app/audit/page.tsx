'use client'

import { useEffect, useState, useCallback } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { PageContent } from '@/components/layout/PageContent'
import { AuditLogTable } from '@/components/audit/AuditLogTable'
import { getAuditLog, APIError } from '@/lib/api'
import type { GovernanceEvent } from '@/lib/types'

const PAGE_SIZE = 20

interface AuditState {
  events: GovernanceEvent[]
  total: number
  page: number
}

export default function AuditPage() {
  const [state, setState] = useState<AuditState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAuditLog(page, PAGE_SIZE)
      setState({ events: data.events, total: data.total, page: data.page })
    } catch (err) {
      setError(
        err instanceof APIError
          ? `Error ${err.status}: ${err.message}`
          : 'Failed to load audit log'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(1)
  }, [load])

  return (
    <AuthGuard>
      <PageContent size="wide">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-dome-text mb-1" style={{ letterSpacing: '-0.01em' }}>
            Audit log
          </h1>
          <p className="text-sm text-dome-muted">
            Governance events from all processed documents. Metadata only — no document content is stored.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3 mb-4">
            <p className="text-sm text-dome-error">{error}</p>
          </div>
        )}

        {loading && !state ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : state ? (
          <AuditLogTable
            events={state.events}
            total={state.total}
            page={state.page}
            pageSize={PAGE_SIZE}
            onPageChange={load}
          />
        ) : null}
      </PageContent>
    </AuthGuard>
  )
}
