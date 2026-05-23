/**
 * Pure connection authorization checks for the executor.
 *
 * Lives in lib/aig so it stays testable without DB I/O.
 */

import { AIGBlockedAuthError } from '@/lib/aig/types'

export interface ConnectionAuthSnapshot {
  scope: 'personal' | 'shared'
  authStatus: string
  arcadeUserId: string | null
  ownerUserId: string | null
}

export type ValidatedConnection = ConnectionAuthSnapshot & { arcadeUserId: string }

export function validateConnectionForExecution(input: {
  connection: ConnectionAuthSnapshot | null
  approverUserId: string
  isWorkspaceMember: boolean
  toolkitName: string
  /** Runtime-resolved Arcade user id for the active verifier mode. */
  arcadeUserId?: string
}): ValidatedConnection {
  const { connection, approverUserId, isWorkspaceMember, toolkitName } = input
  const resolvedArcadeUserId = input.arcadeUserId ?? connection?.arcadeUserId ?? null

  if (!connection || connection.authStatus !== 'completed' || !resolvedArcadeUserId) {
    throw new AIGBlockedAuthError(
      approverUserId,
      resolvedArcadeUserId ?? `no connection for ${toolkitName}`,
    )
  }

  if (connection.scope === 'personal') {
    if (connection.ownerUserId !== approverUserId) {
      throw new AIGBlockedAuthError(approverUserId, resolvedArcadeUserId)
    }
    return { ...connection, arcadeUserId: resolvedArcadeUserId }
  }

  if (!isWorkspaceMember) {
    throw new AIGBlockedAuthError(approverUserId, resolvedArcadeUserId)
  }

  return { ...connection, arcadeUserId: resolvedArcadeUserId }
}
