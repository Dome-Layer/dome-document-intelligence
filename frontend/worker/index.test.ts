import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, isNoindexHost, makeNonce, shellFor } from './index'

describe('tool Worker', () => {
  it('builds the same CSP the Vercel middleware sent, with the nonce in script-src', () => {
    const csp = contentSecurityPolicy('abc')
    expect(csp.startsWith("default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; ")).toBe(true)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-inline\'; script')
  })

  it('makes a fresh 128-bit nonce each time', () => {
    const a = makeNonce()
    expect(atob(a)).toHaveLength(16)
    expect(makeNonce()).not.toBe(a)
  })

  it('has no shell routes for Document Intelligence', () => {
    expect(shellFor('/history')).toBeUndefined()
    expect(shellFor('/history/123')).toBeUndefined()
  })

  it('marks staging and workers.dev noindex, never production', () => {
    expect(isNoindexHost('document-intelligence.domelayer.com', { DOME_NOINDEX: 'true' } as never)).toBe(true)
    expect(isNoindexHost('dome-document-intelligence.x.workers.dev', {} as never)).toBe(true)
    expect(isNoindexHost('document-intelligence.domelayer.com', {} as never)).toBe(false)
  })
})
