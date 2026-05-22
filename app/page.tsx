import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="font-mono text-aig-proposed text-xs uppercase tracking-widest">
          Arcade Intent Graph
        </p>
        <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
          A pre-execution governance runtime for{' '}
          <span className="text-aig-approved">Arcade-powered</span> AI agents.
        </h1>
        <p className="text-lg text-muted-foreground">
          Agents propose. Humans constrain. The runtime repairs. Arcade executes. The negotiation is
          the artifact.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="font-semibold text-sm tracking-tight">The loop</h2>
        <pre className="mt-3 overflow-x-auto font-mono text-muted-foreground text-xs leading-relaxed">
          {`09:41  Agent proposed "Coordinate customer follow-up"
       \u251C Gmail.SendEmail \u00D7 2
       \u251C Calendar.CreateEvent \u00D7 2
       \u2514 Slack.SendMessage \u00D7 1
09:42  Human removed Calendar.CreateEvent (Globex)
09:43  Agent regenerated downstream actions
09:44  Human edited Gmail.SendEmail.body (Acme thread)
09:45  Human approved
09:45  Arcade executed in dependency order
09:45  COMPLETE \u2014 5/5 actions, 0 failures`}
        </pre>
      </section>

      <footer className="flex items-center gap-4 text-muted-foreground text-sm">
        <Link
          className="underline-offset-4 transition hover:text-foreground hover:underline"
          href="https://github.com/fletchertyler914/aig"
        >
          GitHub
        </Link>
        <span aria-hidden>·</span>
        <Link
          className="underline-offset-4 transition hover:text-foreground hover:underline"
          href="https://github.com/fletchertyler914/aig/tree/main/docs/adr"
        >
          Architecture
        </Link>
        <span aria-hidden>·</span>
        <Link
          className="underline-offset-4 transition hover:text-foreground hover:underline"
          href="https://www.arcade.dev"
        >
          Built on Arcade
        </Link>
      </footer>
    </main>
  )
}
