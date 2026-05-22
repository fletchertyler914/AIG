/**
 * Re-check Arcade OAuth for an intent and persist updated auth state.
 *
 * `pendingAuthorizations` is written at plan time; without this sync the UI
 * stays stale until a manual refetch even after OAuth completes.
 */

import { statusForConfidence } from '@/lib/aig/formation'
import { authorizeMany, hasPendingAuthorizations } from '@/lib/arcade/authorize'
import { personalArcadeIdentity } from '@/lib/arcade/identity'
import {
  getIntentWithTrace,
  type IntentWithTrace,
  setIntentStatus,
  updateIntentImpact,
} from '@/lib/db/queries'
import type { Intent } from '@/lib/db/schema'

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function hadPendingAuthorizations(impact: Record<string, unknown>): boolean {
  const raw = impact['pendingAuthorizations']
  return Array.isArray(raw) && raw.length > 0
}

function arcadeIdentityForIntent(intent: Intent) {
  return personalArcadeIdentity(intent.createdByUserId ?? 'anonymous')
}

/** Stable fingerprint for SSE change detection (not just mutation count). */
export function intentSnapshotFingerprint(snapshot: IntentWithTrace): string {
  const impact = asRecord(snapshot.intent.impact)
  const tcSig = snapshot.toolCalls
    .map((tc) => `${tc.id}:${tc.status}:${tc.locked}:${JSON.stringify(tc.args)}`)
    .join(',')
  return [
    snapshot.intent.status,
    snapshot.mutations.length,
    tcSig,
    JSON.stringify(impact['pendingAuthorizations'] ?? null),
  ].join('|')
}

/**
 * Re-authorize tools when the intent is UNCERTAIN or still carries pending auth
 * metadata. Returns true when DB state changed.
 */
export async function syncAuthorizationIfNeeded(intentId: string): Promise<boolean> {
  const snapshot = await getIntentWithTrace(intentId)
  if (!snapshot) return false

  const impact = asRecord(snapshot.intent.impact)
  if (snapshot.intent.status !== 'UNCERTAIN' && !hadPendingAuthorizations(impact)) {
    return false
  }

  const tools = snapshot.toolCalls.map((tc) => tc.tool)
  if (tools.length === 0) return false

  const authorizations = await authorizeMany(tools, arcadeIdentityForIntent(snapshot.intent))
  const pendingAuths = authorizations.filter((auth) => auth.status !== 'completed')
  const stillPending = hasPendingAuthorizations(authorizations)

  const nextImpact: Record<string, unknown> = { ...impact }
  if (stillPending) {
    nextImpact['pendingAuthorizations'] = pendingAuths
  } else {
    delete nextImpact['pendingAuthorizations']
  }

  const impactChanged =
    JSON.stringify(impact['pendingAuthorizations'] ?? null) !==
    JSON.stringify(nextImpact['pendingAuthorizations'] ?? null)

  let statusChanged = false
  if (!stillPending && snapshot.intent.status === 'UNCERTAIN') {
    const confidence = snapshot.intent.confidence === null ? 0 : Number(snapshot.intent.confidence)
    const nextStatus = statusForConfidence(confidence)
    if (nextStatus !== snapshot.intent.status) {
      await setIntentStatus(intentId, nextStatus)
      statusChanged = true
    }
  }

  if (impactChanged) {
    await updateIntentImpact(intentId, nextImpact)
  }

  return impactChanged || statusChanged
}
