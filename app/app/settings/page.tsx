import { ApprovalPoliciesPanel } from '@/components/settings/approval-policies-panel'
import { AuthProvidersPanel } from '@/components/settings/auth-providers-panel'
import { TeamPanel } from '@/components/settings/team-panel'
import { Container } from '@/components/ui/container'
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

      <ApprovalPoliciesPanel />

      <TeamPanel />
    </Container>
  )
}
