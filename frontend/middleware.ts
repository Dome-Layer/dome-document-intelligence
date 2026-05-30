import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Per-request nonce-based Content-Security-Policy.
//
// Replaces the static `script-src 'unsafe-inline' 'unsafe-eval'` that used to
// live in next.config.mjs. With a per-request nonce, an injected inline script
// cannot execute — so the CSP is a real XSS backstop for the cross-subdomain
// SSO session token (which is JS-readable by design; see SECURITY.md).
//
// Next.js reads the nonce from the request's Content-Security-Policy header and
// applies it to its own bootstrap/hydration scripts automatically; our inline
// theme script in app/layout.tsx reads it from the `x-nonce` request header.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    // Run on everything except Next static assets and the icon, which don't
    // execute scripts and so don't need a per-request CSP.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
