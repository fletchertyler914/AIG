import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app/app-header'
import { AppSidebar } from '@/components/app/app-sidebar'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { isE2eAuthSkipped } from '@/lib/env'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await resolveWorkspaceContext()

  if (!isE2eAuthSkipped && ctx.userId === 'anonymous') {
    redirect('/sign-in?callbackUrl=/app')
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          email={ctx.email || 'operator'}
          workspaceName={ctx.workspace.name}
          workspaceKind={ctx.workspace.kind}
        />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
