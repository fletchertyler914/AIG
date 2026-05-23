import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AIG — Control plane for Arcade pipelines',
  description:
    'Governance, orchestration, and audit for Arcade-powered AI agents. Intent graphs, approval policies, and workspace-scoped connections.',
  authors: [{ name: 'Tyler Fletcher', url: 'https://github.com/fletchertyler914' }],
  metadataBase: new URL('https://arcadeintent.graph'),
  openGraph: {
    title: 'AIG — Arcade Intent Graph',
    description: 'A pre-execution governance runtime for Arcade-powered AI agents.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased`}
      >
        {children}
        <Analytics />
        <Toaster richColors closeButton position="bottom-right" />
      </body>
    </html>
  )
}
