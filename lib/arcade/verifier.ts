/**
 * Arcade custom user verifier helpers.
 *
 * During tool OAuth, Arcade redirects the browser to our verifier route with a
 * `flow_id`. We confirm the operator's Arcade identity server-side via
 * `auth.confirmUser` — never from the client.
 */

import { getArcadeClient } from './client'
import type { ArcadeIdentity } from './identity'
import { toArcadeUserId } from './identity'

export interface ConfirmArcadeUserInput {
  flowId: string
  identity: ArcadeIdentity
}

export interface ConfirmArcadeUserResult {
  authId: string
  nextUri?: string
}

export async function confirmArcadeUser(
  input: ConfirmArcadeUserInput,
): Promise<ConfirmArcadeUserResult> {
  const arcade = getArcadeClient()
  const result = await arcade.auth.confirmUser({
    flow_id: input.flowId,
    user_id: toArcadeUserId(input.identity),
  })

  const out: ConfirmArcadeUserResult = { authId: result.auth_id }
  if (result.next_uri) out.nextUri = result.next_uri
  return out
}
