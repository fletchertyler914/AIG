import { IntentDetailClient } from '@/components/intent/intent-detail-client'

interface IntentPageProps {
  params: Promise<{ id: string }>
}

export default async function IntentPage({ params }: IntentPageProps) {
  const { id } = await params
  return <IntentDetailClient intentId={id} />
}
