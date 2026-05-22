import {
  ArrowRight,
  ClipboardCheck,
  GitBranch,
  History,
  Lock,
  PlugZap,
  Workflow,
} from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { cn } from '@/lib/utils'

interface Feature {
  title: string
  body: string
  icon: ComponentType<{ className?: string }>
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    title: 'Intent graph execution',
    body: 'Agents propose multi-tool plans. Humans constrain, repair, and approve before Arcade executes.',
    icon: Workflow,
  },
  {
    title: 'Workspace-scoped connections',
    body: 'Each team connects Gmail, Calendar, GitHub, Slack via Arcade OAuth — scoped per workspace, not per user guesswork.',
    icon: PlugZap,
  },
  {
    title: 'Versioned pipelines',
    body: 'Save working agent workflows as named templates with parameters. Run manually or on a schedule.',
    icon: GitBranch,
  },
  {
    title: 'Approval policies',
    body: 'Require reviewer roles before risky tool calls execute. Configurable per tool pattern.',
    icon: ClipboardCheck,
  },
  {
    title: 'Immutable audit log',
    body: 'Every mutation, approval, and Arcade execution is recorded. Replay any run.',
    icon: History,
  },
  {
    title: 'Locked objectives',
    body: 'Repair the plan all you want — the objective is sealed at formation time and never silently rewritten.',
    icon: Lock,
  },
] as const

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-border border-b bg-background/85 backdrop-blur">
        <Container width="wide" className="flex h-16 items-center justify-between">
          <Link className="flex items-center gap-2" href="/">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground font-mono text-[11px] text-background tracking-tighter">
              AIG
            </span>
            <span className="font-semibold text-sm">Arcade Intent Graph</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              className="hidden text-muted-foreground text-sm transition-colors hover:text-foreground sm:inline"
              href="/sign-in"
            >
              Sign in
            </Link>
            <Link
              className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}
              href="/sign-in?callbackUrl=/app"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Container>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden border-border border-b">
          <div
            aria-hidden
            className="grid-bg absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_60%_at_50%_30%,black,transparent)]"
          />
          <Container width="wide" className="relative py-20 sm:py-28">
            <div className="max-w-3xl">
              <Badge variant="brand">Control plane for Arcade pipelines</Badge>
              <h1 className="mt-6 font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
                Deploy Arcade agents into production with governance built in.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
                Arcade gives you 7,000 managed tools. AIG gives you the orchestration, approval, and
                audit layer companies need to actually run agents on top of them — without inventing
                governance from scratch.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}
                  href="/sign-in?callbackUrl=/app"
                >
                  Start free
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  className={buttonVariants({ variant: 'secondary', size: 'lg' })}
                  href="https://docs.arcade.dev"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Arcade docs
                </Link>
              </div>
            </div>
          </Container>
        </section>

        <section className="border-border border-b py-16 sm:py-20">
          <Container width="wide">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] text-aig-proposed uppercase tracking-widest">
                What you get
              </p>
              <h2 className="mt-2 font-semibold text-2xl tracking-tight sm:text-3xl">
                Everything you&apos;d otherwise build yourself.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <Card key={feature.title} className="h-full">
                    <CardContent className="p-6 pt-6">
                      <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground">
                        <Icon className="size-4" />
                      </div>
                      <h3 className="mt-5 font-semibold text-base">{feature.title}</h3>
                      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                        {feature.body}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container width="wide">
            <Card>
              <CardContent className="p-8 sm:p-12">
                <Badge variant="accent">Primary artifact</Badge>
                <h2 className="mt-3 font-semibold text-2xl tracking-tight sm:text-3xl">
                  The negotiation is the artifact.
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
                  Every intent carries a co-authorship trace — agent proposals, human edits,
                  constrained repairs, and Arcade execution results. Your team sees exactly what
                  happened and why.
                </p>
              </CardContent>
            </Card>
          </Container>
        </section>
      </main>

      <footer className="border-border border-t py-8">
        <Container
          width="wide"
          className="flex flex-col items-center justify-between gap-2 text-center text-muted-foreground text-xs sm:flex-row sm:text-left"
        >
          <span>Built on Arcade MCP · Tyler Fletcher</span>
          <span className="font-mono uppercase tracking-widest">© AIG 2026</span>
        </Container>
      </footer>
    </div>
  )
}
