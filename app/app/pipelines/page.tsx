import { GitBranch } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'

export default function PipelinesPage() {
  return (
    <Container width="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <PageHeader
        eyebrow="Pipelines"
        title="Saved agent workflows"
        description="Named, versioned intent templates with parameters and triggers. Promote a working run to a pipeline, then re-run it on demand or on a schedule."
      />
      <EmptyState
        icon={GitBranch}
        title="Pipeline registry ships in Sprint 3"
        description="Save a working run as a pipeline, configure parameters and approval policy, and re-execute deterministically."
      />
    </Container>
  )
}
