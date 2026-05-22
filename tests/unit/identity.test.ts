import { describe, expect, it } from 'vitest'
import {
  arcadeIdentityForScope,
  parseFlowIdFromAuthUrl,
  personalArcadeIdentity,
  sharedArcadeIdentity,
  toArcadeUserId,
  toolkitFromToolName,
} from '@/lib/arcade/identity'

describe('toArcadeUserId', () => {
  it('prefixes personal identities with user:', () => {
    expect(toArcadeUserId(personalArcadeIdentity('usr_01'))).toBe('user:usr_01')
  })

  it('prefixes shared identities with workspace:', () => {
    expect(toArcadeUserId(sharedArcadeIdentity('ws_01'))).toBe('workspace:ws_01')
  })
})

describe('arcadeIdentityForScope', () => {
  it('returns personal identity for personal scope', () => {
    const id = arcadeIdentityForScope({
      scope: 'personal',
      userId: 'u1',
      workspaceId: 'w1',
    })
    expect(id).toEqual({ kind: 'personal', userId: 'u1' })
  })

  it('returns shared identity for shared scope', () => {
    const id = arcadeIdentityForScope({
      scope: 'shared',
      userId: 'u1',
      workspaceId: 'w1',
    })
    expect(id).toEqual({ kind: 'shared', workspaceId: 'w1' })
  })
})

describe('toolkitFromToolName', () => {
  it('strips version suffix and returns toolkit segment', () => {
    expect(toolkitFromToolName('Gmail.SendEmail@7.0.0')).toBe('Gmail')
  })
})

describe('parseFlowIdFromAuthUrl', () => {
  it('extracts flow_id from oauth callback urls', () => {
    expect(
      parseFlowIdFromAuthUrl('https://cloud.arcade.dev/oauth/start?flow_id=abc-123&other=1'),
    ).toBe('abc-123')
  })

  it('returns null for invalid urls', () => {
    expect(parseFlowIdFromAuthUrl('not-a-url')).toBeNull()
  })
})
