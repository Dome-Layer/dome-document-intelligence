import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Sidebar } from '@/components/layout/Sidebar'
import { AuthProvider } from '@/context/AuthContext'

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
  title: 'Dome Document Intelligence',
  description:
    'Upload any document. Extract structured data with governance validation in seconds.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

// Runs before first paint to prevent theme flash.
// Reads cookie first (shared across all *.domelayer.com subdomains),
// then falls back to localStorage, then OS preference.
const themeScript = `
(function() {
  try {
    var cookie = document.cookie.split('; ').find(function(r){ return r.startsWith('dome-theme='); });
    var cookieVal = cookie ? cookie.split('=')[1] : null;
    var saved = (cookieVal === 'dark' || cookieVal === 'light') ? cookieVal : localStorage.getItem('dome-theme');
    var theme = (saved === 'dark' || saved === 'light')
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-dome-bg text-dome-text font-sans antialiased">
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
