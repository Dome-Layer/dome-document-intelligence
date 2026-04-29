import { authHeaders } from '@/lib/auth'
import type {
  DocumentIntelligenceResult,
  RulesListResponse,
  GovernanceRule,
  AuditListResponse,
  SavedExtractionSummary,
  SavedExtractionDetail,
  SavedExtractionsListResponse,
} from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000'

export class APIError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // ignore parse error
    }
    throw new APIError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export async function extractDocument(file: File): Promise<DocumentIntelligenceResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/api/extract`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })
  return handleResponse<DocumentIntelligenceResult>(res)
}

export async function getRules(): Promise<GovernanceRule[]> {
  const res = await fetch(`${API_BASE}/api/rules`, {
    headers: authHeaders(),
  })
  const data = await handleResponse<RulesListResponse>(res)
  return data.rules
}

export async function toggleRule(ruleId: string, enabled: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rules/${ruleId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled }),
  })
  await handleResponse<unknown>(res)
}

export async function getAuditLog(page = 1, pageSize = 20): Promise<AuditListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  const res = await fetch(`${API_BASE}/api/audit?${params.toString()}`, {
    headers: authHeaders(),
  })
  return handleResponse<AuditListResponse>(res)
}

export async function saveExtraction(
  filename: string | null,
  result: DocumentIntelligenceResult,
): Promise<SavedExtractionSummary> {
  const res = await fetch(`${API_BASE}/api/extractions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, result }),
  })
  return handleResponse<SavedExtractionSummary>(res)
}

export async function getSavedExtractions(
  page = 1,
  pageSize = 20,
  docType?: string,
  search?: string,
): Promise<SavedExtractionsListResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (docType) params.set('doc_type', docType)
  if (search) params.set('search', search)
  const res = await fetch(`${API_BASE}/api/extractions?${params.toString()}`, {
    headers: authHeaders(),
  })
  return handleResponse<SavedExtractionsListResponse>(res)
}

export async function getSavedExtraction(id: string): Promise<SavedExtractionDetail> {
  const res = await fetch(`${API_BASE}/api/extractions/${id}`, {
    headers: authHeaders(),
  })
  return handleResponse<SavedExtractionDetail>(res)
}

export async function deleteSavedExtraction(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/extractions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok && res.status !== 204) await handleResponse<never>(res)
}
