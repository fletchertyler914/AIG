import { BarChart3 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'

export default function InsightsPage() {
  return (
    <Container width="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <PageHeader
        eyebrow="Insights"
        title="Runs, toolkits, and the audit log"
        description="See how Arcade pipelines behave in your workspace: runs by status and toolkit, who approved what, and the immutable audit trail."
      />
      <EmptyState
        icon={BarChart3}
        title="Observability dashboard ships in Sprint 5"
        description="Charts for runs over time, failure modes by toolkit, average time-to-approval, and full audit-log search — your control-plane observability layer."
      />
    </Container>
  )
}
