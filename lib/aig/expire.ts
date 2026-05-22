/**
 * Lazy EXPIRED enforcement.
 *
 * AIG runs serverlessly, so there is no always-on worker to mark
 * intents expired. Instead, every read path calls `expireIfNeeded`
 * which inspects the intent's `expireAt` and transitions it into
 * EXPIRED + appends a `system_expired` mutation when it has overshot
 * its window without being approved.
 *
 * This guarantees no autonomous continuation — the entire promise
 * AIG makes the operator is enforced lazily but reliably.
 */

import { canTransition } from '@/lib/aig/state'
import { appendMutation, setIntentStatus } from '@/lib/db/queries'
import type { Intent } from '@/lib/db/schema'

/**
 * Per VALID_TRANSITIONS in `state.ts` only PENDING_REVIEW can transition
 * directly to EXPIRED. Other transient states (DRAFT, UNCERTAIN, MODIFIED,
 * REGENERATING, FORMED) are short-lived and converge on PENDING_REVIEW
 * before any deadline matters in practice. Adding their direct expiry
 * paths requires an ADR amending the state machine.
 */
export async function expireIfNeeded(intent: Intent, now = Date.now()): Promise<Intent['status']> {
  if (intent.expireAt > now) return intent.status
  if (!canTransition(intent.status, 'EXPIRED')) return intent.status

  await setIntentStatus(intent.id, 'EXPIRED')
  await appendMutation({
    intentId: intent.id,
    type: 'system_expired',
    actor: 'system',
    payload: {
      expireAt: intent.expireAt,
      observedAt: now,
      previousStatus: intent.status,
    },
  })

  return 'EXPIRED'
}
