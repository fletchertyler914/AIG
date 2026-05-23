import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PLAN_TOOLKITS,
  inferRequestedToolkits,
  planSelectToolkits,
} from '@/lib/aig/toolkit-preflight'

describe('inferRequestedToolkits', () => {
  it('infers email and calendar toolkits from a multi-tool prompt', () => {
    expect(
      inferRequestedToolkits(
        'Email a concise launch update and create a 15-minute calendar reminder tomorrow.',
      ),
    ).toEqual(['Gmail', 'GoogleCalendar'])
  })

  it('returns an empty list when no toolkit keywords match', () => {
    expect(inferRequestedToolkits('Summarize the launch retro in three bullet points.')).toEqual([])
  })

  it('infers multiple Google toolkits from a richer prompt', () => {
    expect(
      inferRequestedToolkits(
        'Drop the launch notes into a Google doc and share the folder with the team via drive.',
      ),
    ).toEqual(['GoogleDocs', 'GoogleDrive'])
  })
})

type EnsureFn = (toolkitName: string) => Promise<{ resolved: boolean }>

interface StubDeps {
  enabled: string[]
  unresolved?: ReadonlyArray<string>
  ensure?: EnsureFn
}

function makeDeps(stub: StubDeps) {
  const ensure: EnsureFn =
    stub.ensure ??
    (async (name: string) => ({
      resolved: stub.unresolved ? !stub.unresolved.includes(name) : true,
    }))
  return {
    listEnabled: vi.fn<() => Promise<string[]>>(async () => stub.enabled),
    ensureToolkit: vi.fn<EnsureFn>(ensure),
  }
}

describe('planSelectToolkits', () => {
  it('uses inferred toolkits when none are explicitly provided', async () => {
    const deps = makeDeps({ enabled: [] })

    const toolkits = await planSelectToolkits({
      prompt: 'Email a launch update and create a calendar reminder.',
      deps,
    })

    expect(toolkits).toEqual(['Gmail', 'GoogleCalendar'])
    expect(deps.ensureToolkit).toHaveBeenCalledWith('Gmail')
    expect(deps.ensureToolkit).toHaveBeenCalledWith('GoogleCalendar')
  })

  it('does NOT require pre-existing enabled toolkits before planning', async () => {
    // Regression: this is the bug the demo hit — planning was rejected because
    // Gmail / GoogleCalendar were not yet "enabled" on the workspace. With the
    // fix, planning auto-enables (ensureToolkit) instead of throwing.
    const deps = makeDeps({
      enabled: ['Github', 'GoogleDocs', 'GoogleDrive', 'GoogleSheets'],
    })

    const toolkits = await planSelectToolkits({
      prompt: 'Email a launch update to the team and create a 15-minute calendar reminder.',
      deps,
    })

    expect(toolkits).toEqual(['Gmail', 'GoogleCalendar'])
    expect(deps.ensureToolkit).toHaveBeenCalledTimes(2)
    expect(deps.ensureToolkit).toHaveBeenCalledWith('Gmail')
    expect(deps.ensureToolkit).toHaveBeenCalledWith('GoogleCalendar')
  })

  it('honors explicit toolkits over inferred ones and only enables the missing set', async () => {
    const deps = makeDeps({ enabled: ['Gmail'] })

    const toolkits = await planSelectToolkits({
      prompt: 'Send an email and post to slack',
      explicit: ['Gmail', 'Slack'],
      deps,
    })

    expect(toolkits).toEqual(['Gmail', 'Slack'])
    expect(deps.ensureToolkit).toHaveBeenCalledTimes(1)
    expect(deps.ensureToolkit).toHaveBeenCalledWith('Slack')
  })

  it('skips ensureToolkit when every requested toolkit is already enabled', async () => {
    const deps = makeDeps({ enabled: ['Gmail', 'GoogleCalendar'] })

    const toolkits = await planSelectToolkits({
      prompt: 'Email a launch update and create a calendar reminder.',
      deps,
    })

    expect(toolkits).toEqual(['Gmail', 'GoogleCalendar'])
    expect(deps.ensureToolkit).not.toHaveBeenCalled()
  })

  it('falls back to enabled toolkits when no prompt keywords match', async () => {
    const deps = makeDeps({ enabled: ['Github'] })

    const toolkits = await planSelectToolkits({
      prompt: 'Summarize the retro for me, then move on.',
      deps,
    })

    expect(toolkits).toEqual(['Github'])
    expect(deps.ensureToolkit).not.toHaveBeenCalled()
  })

  it('falls back to the demo default toolkits when nothing is inferred or enabled', async () => {
    const deps = makeDeps({ enabled: [] })

    const toolkits = await planSelectToolkits({
      prompt: 'Summarize the retro for me, then move on.',
      deps,
    })

    expect(toolkits).toEqual(Array.from(DEFAULT_PLAN_TOOLKITS))
    expect(deps.ensureToolkit).not.toHaveBeenCalled()
  })

  it('throws a helpful error only when a requested toolkit cannot be resolved by Arcade', async () => {
    const deps = makeDeps({
      enabled: [],
      unresolved: ['Hubspot'],
    })

    await expect(
      planSelectToolkits({
        prompt: 'Push to hubspot.',
        explicit: ['Hubspot'],
        deps,
      }),
    ).rejects.toThrow(/Toolkit not found in Arcade catalog: Hubspot/)
  })

  it('only flags the unresolved toolkit, not the ones that resolved', async () => {
    const deps = makeDeps({
      enabled: [],
      unresolved: ['Hubspot'],
    })

    await expect(
      planSelectToolkits({
        prompt: 'Email the team and push to hubspot.',
        explicit: ['Gmail', 'Hubspot'],
        deps,
      }),
    ).rejects.toThrow(/Hubspot(?!.*Gmail)/s)
  })
})
