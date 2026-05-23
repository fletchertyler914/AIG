import { ArrowLeft, MailCheck } from 'lucide-react'
import Link from 'next/link'
import { SignInForm } from '@/components/auth/sign-in-form'
import { Card, CardContent } from '@/components/ui/card'
import { isDevelopment } from '@/lib/env'

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; sent?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const callbackUrl = params.callbackUrl ?? '/app'
  const sent = params.sent === '1'

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        aria-hidden
        className="grid-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_20%,black,transparent)]"
      />
      <header className="relative">
        <div className="mx-auto flex w-full max-w-[var(--container-wide)] items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link
            className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <Link className="flex items-center gap-2" href="/" aria-label="Arcade Intent Graph">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground font-mono text-[11px] text-background tracking-tighter">
              AIG
            </span>
            <span className="hidden font-semibold text-sm sm:inline">Arcade Intent Graph</span>
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <p className="font-mono text-[11px] text-aig-proposed uppercase tracking-widest">
              Control plane
            </p>
            <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
              Sign in to your workspace
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Magic link — no password. We use your email as your Arcade operator identity.
            </p>
          </div>

          {sent ? (
            <Card data-testid="magic-link-sent" className="border-success/30 bg-success/5">
              <CardContent className="flex items-start gap-3 p-5 sm:p-6">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                  <MailCheck className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm text-success">Check your inbox</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    We sent a sign-in link. It expires in 15 minutes.
                  </p>
                  {isDevelopment ? (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Dev tip: if Resend delivery fails, the link is printed to the dev server logs.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : (
            <SignInForm callbackUrl={callbackUrl} />
          )}

          <p className="text-center text-muted-foreground text-xs">
            New here? Your organization and production workspace are created on first sign-in.
          </p>
        </div>
      </main>
    </div>
  )
}
