/**
 * Intent status presentation — separates UNCERTAIN causes for UI copy/badges.
 *
 * DB status stays `UNCERTAIN`; display layer distinguishes auth vs confidence.
 */

const CONFIDENCE_GATE = 0.6

export type UncertainReason = 'auth_pending' | 'low_confidence' | 'both'

export interface IntentStatusDisplayInput {
  status: string
  confidence: string | number | null | undefined
  pendingAuthCount: number
}

export interface IntentStatusDisplay {
  /** Primary badge label shown to operators. */
  label: string
  /** Badge variant key — maps to components/ui/badge variants. */
  variant: 'warning' | 'info' | 'brand' | 'neutral' | 'success' | 'danger'
  /** When status is UNCERTAIN, which gate is blocking promotion to review. */
  uncertainReason: UncertainReason | null
  /** Short helper for list rows and headers. */
  hint: string | null
}

function parseConfidence(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function uncertainReasonFor(input: {
  confidence: string | number | null | undefined
  pendingAuthCount: number
}): UncertainReason | null {
  const lowConfidence = (parseConfidence(input.confidence) ?? 1) < CONFIDENCE_GATE
  const authPending = input.pendingAuthCount > 0

  if (authPending && lowConfidence) return 'both'
  if (authPending) return 'auth_pending'
  if (lowConfidence) return 'low_confidence'
  return null
}

export function readPendingAuthCount(impact: unknown): number {
  if (!impact || typeof impact !== 'object' || Array.isArray(impact)) return 0
  const raw = (impact as Record<string, unknown>)['pendingAuthorizations']
  if (!Array.isArray(raw)) return 0
  return raw.length
}

export function intentStatusDisplay(input: IntentStatusDisplayInput): IntentStatusDisplay {
  const { status, confidence, pendingAuthCount } = input

  if (status === 'UNCERTAIN') {
    const reason = uncertainReasonFor({ confidence, pendingAuthCount })
    if (reason === 'auth_pending' || reason === 'both') {
      return {
        label: 'AUTH REQUIRED',
        variant: 'warning',
        uncertainReason: reason,
        hint: 'Connect toolkits in the side panel — the page updates when OAuth completes.',
      }
    }
    return {
      label: 'LOW CONFIDENCE',
      variant: 'info',
      uncertainReason: reason,
      hint: 'Review the grouping — split or edit actions before approving.',
    }
  }

  const defaults: Record<string, Omit<IntentStatusDisplay, 'uncertainReason'>> = {
    DRAFT: { label: 'DRAFT', variant: 'neutral', hint: null },
    FORMED: { label: 'FORMED', variant: 'info', hint: null },
    PENDING_REVIEW: { label: 'PENDING REVIEW', variant: 'brand', hint: null },
    MODIFIED: { label: 'MODIFIED', variant: 'warning', hint: null },
    REGENERATING: { label: 'REGENERATING', variant: 'warning', hint: null },
    APPROVED: { label: 'APPROVED', variant: 'success', hint: null },
    EXECUTING: { label: 'EXECUTING', variant: 'brand', hint: null },
    COMPLETE: { label: 'COMPLETE', variant: 'success', hint: null },
    PARTIAL_FAILURE: { label: 'PARTIAL FAILURE', variant: 'warning', hint: null },
    FAILED: { label: 'FAILED', variant: 'danger', hint: null },
    BLOCKED: { label: 'BLOCKED', variant: 'danger', hint: null },
    EXPIRED: { label: 'EXPIRED', variant: 'neutral', hint: null },
  }

  const row = defaults[status] ?? { label: status, variant: 'neutral' as const, hint: null }
  return { ...row, uncertainReason: null }
}
