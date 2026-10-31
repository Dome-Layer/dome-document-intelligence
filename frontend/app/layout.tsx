import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Sidebar } from '@/components/layout/Sidebar'
import { AuthProvider } from '@/context/AuthContext'
import { StagingBanner } from '@dome-layer/dome-ui'
import { THEME_INIT_SCRIPT } from '@dome-layer/dome-ui/utils'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Document Intelligence | DOME',
  description:
    'Upload any document. Extract structured data with governance validation in seconds.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint, so there is no flash; the rule lives in dome-ui. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-dome-bg text-dome-text font-sans antialiased">
        <StagingBanner environment={process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT} />
        <AuthProvider>
          <div className="app-shell">
            <Header />
            <div className="app-body">
              <Sidebar />
              <main className="app-main">
                {children}
              </main>
            </div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
