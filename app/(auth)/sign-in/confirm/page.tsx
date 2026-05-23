import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ConfirmPageProps {
  searchParams: Promise<{
    token?: string
    callbackURL?: string
    errorCallbackURL?: string
    newUserCallbackURL?: string
  }>
}

/**
 * Magic-link confirmation landing page.
 *
 * Email link scanners (Gmail Safe Links, Outlook ATP, etc.) eagerly GET URLs
 * in emails, which would consume Better Auth's single-use verification token
 * before the human ever clicks. Instead of linking straight to
 * `/api/auth/magic-link/verify`, magic-link emails land here. The form
 * submission (real user click) is what actually hits the verify endpoint.
 *
 * No `<a href>` to the verify endpoint is rendered. Bots that follow links
 * but never submit forms cannot consume the token.
 */
export default async function MagicLinkConfirmPage({ searchParams }: ConfirmPageProps) {
  const params = await searchParams
  const token = params.token

  if (!token) {
    redirect('/sign-in')
  }

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
            href="/sign-in"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
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
              Confirm your sign-in
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You're one click away. We use a confirmation step so email scanners can't open your
              sign-in link before you do.
            </p>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5 pt-6 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-aig-proposed/30 bg-aig-proposed/10 text-aig-proposed">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">Single-use sign-in link</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Click below to complete sign-in. Your link expires in 15 minutes.
                  </p>
                </div>
              </div>

              <form
                action="/api/auth/magic-link/verify"
                method="GET"
                data-testid="magic-link-confirm-form"
              >
                <input type="hidden" name="token" value={token} />
                {params.callbackURL ? (
                  <input type="hidden" name="callbackURL" value={params.callbackURL} />
                ) : null}
                {params.errorCallbackURL ? (
                  <input type="hidden" name="errorCallbackURL" value={params.errorCallbackURL} />
                ) : null}
                {params.newUserCallbackURL ? (
                  <input
                    type="hidden"
                    name="newUserCallbackURL"
                    value={params.newUserCallbackURL}
                  />
                ) : null}
                <Button className="w-full" data-testid="magic-link-confirm-submit" type="submit">
                  Sign in to AIG
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-muted-foreground text-xs">
            Didn't request this link? You can safely close this tab.
          </p>
        </div>
      </main>
    </div>
  )
}
