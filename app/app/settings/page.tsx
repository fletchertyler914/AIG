import { Cog } from 'lucide-react'
import { AuthProvidersPanel } from '@/components/settings/auth-providers-panel'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'

export default async function SettingsPage() {
  const ctx = await resolveWorkspaceContext()
  const canManageProviders = canManageSharedConnections(ctx.memberRole)

  return (
    <Container width="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <PageHeader
        eyebrow="Settings"
        title="Team, policies, and workspace"
        description="Invite teammates, define approval policies, and configure operator defaults for your workspace."
      />

      {canManageProviders ? <AuthProvidersPanel /> : null}

      <EmptyState
        icon={Cog}
        title="Approval policies and team invites ship in Sprint 4"
        description="Policy rules per tool pattern, reviewer roles, and member/invitation management for your workspace."
      />
    </Container>
  )
}
