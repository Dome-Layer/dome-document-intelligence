import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera=self allows the camera capture feature on this tool
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(self)' },
  // Content-Security-Policy is set per-request in middleware.ts (nonce-based
  // script-src — no 'unsafe-inline'/'unsafe-eval').
]

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  disableSourceMapUpload: true,
})
