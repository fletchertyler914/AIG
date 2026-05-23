import { describe, expect, it } from 'vitest'
import {
  arcadeIdentityForScope,
  parseFlowIdFromAuthUrl,
  personalArcadeIdentity,
  resolveArcadeUserIdForConnection,
  sharedArcadeIdentity,
  sharedArcadeIdentitySupported,
  toArcadeUserId,
  toolkitFromToolName,
} from '@/lib/arcade/identity'

describe('resolveArcadeUserIdForConnection', () => {
  it('uses operator email in arcade verifier mode', () => {
    expect(
      resolveArcadeUserIdForConnection({
        connection: { scope: 'personal', ownerUserId: 'usr_01' },
        operator: {
          userId: 'usr_01',
          email: 'dev@example.com',
          workspaceId: 'ws_01',
        },
        verifierMode: 'arcade',
      }),
    ).toBe('dev@example.com')
  })

  it('uses prefixed user id in custom verifier mode', () => {
    expect(
      resolveArcadeUserIdForConnection({
        connection: { scope: 'personal', ownerUserId: 'usr_01' },
        operator: {
          userId: 'usr_01',
          email: 'dev@example.com',
          workspaceId: 'ws_01',
        },
        verifierMode: 'custom',
      }),
    ).toBe('user:usr_01')
  })

  it('uses workspace id for shared connections', () => {
    expect(
      resolveArcadeUserIdForConnection({
        connection: { scope: 'shared', ownerUserId: null },
        operator: {
          userId: 'usr_01',
          email: 'dev@example.com',
          workspaceId: 'ws_01',
        },
        verifierMode: 'custom',
      }),
    ).toBe('workspace:ws_01')
  })
})

describe('toArcadeUserId', () => {
  it('uses prefixed user id in custom verifier mode', () => {
    expect(
      toArcadeUserId(personalArcadeIdentity('usr_01', 'dev@example.com'), {
        verifierMode: 'custom',
      }),
    ).toBe('user:usr_01')
  })

  it('uses operator email in arcade verifier mode', () => {
    expect(
      toArcadeUserId(personalArcadeIdentity('usr_01', 'dev@example.com'), {
        verifierMode: 'arcade',
      }),
    ).toBe('dev@example.com')
  })

  it('falls back to DEMO_USER_ID in arcade mode without email', () => {
    expect(toArcadeUserId(personalArcadeIdentity('usr_01'), { verifierMode: 'arcade' })).toMatch(
      /@/,
    )
  })

  it('prefixes shared identities with workspace: in both modes', () => {
    expect(toArcadeUserId(sharedArcadeIdentity('ws_01'), { verifierMode: 'custom' })).toBe(
      'workspace:ws_01',
    )
    expect(toArcadeUserId(sharedArcadeIdentity('ws_01'), { verifierMode: 'arcade' })).toBe(
      'workspace:ws_01',
    )
  })
})

describe('sharedArcadeIdentitySupported', () => {
  it('is true only in custom mode', () => {
    expect(sharedArcadeIdentitySupported({ verifierMode: 'custom' })).toBe(true)
    expect(sharedArcadeIdentitySupported({ verifierMode: 'arcade' })).toBe(false)
  })
})

describe('arcadeIdentityForScope', () => {
  it('returns personal identity with optional email', () => {
    const id = arcadeIdentityForScope({
      scope: 'personal',
      userId: 'u1',
      workspaceId: 'w1',
      email: 'u1@example.com',
    })
    expect(id).toEqual({ kind: 'personal', userId: 'u1', email: 'u1@example.com' })
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
