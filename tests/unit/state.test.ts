import { describe, expect, it } from 'vitest'
import {
  allowedNextStatuses,
  assertTransition,
  canTransition,
  computeInvalidatedIds,
  isTerminal,
  isToolCallImmutable,
  topologicalSort,
} from '@/lib/aig/state'
import { AIGCycleError, AIGInvalidTransitionError, INTENT_STATUSES } from '@/lib/aig/types'

describe('assertTransition', () => {
  it.each([
    ['DRAFT', 'FORMED'],
    ['DRAFT', 'UNCERTAIN'],
    ['UNCERTAIN', 'PENDING_REVIEW'],
    ['FORMED', 'PENDING_REVIEW'],
    ['PENDING_REVIEW', 'APPROVED'],
    ['PENDING_REVIEW', 'MODIFIED'],
    ['PENDING_REVIEW', 'BLOCKED'],
    ['PENDING_REVIEW', 'EXPIRED'],
    ['MODIFIED', 'REGENERATING'],
    ['REGENERATING', 'PENDING_REVIEW'],
    ['APPROVED', 'EXECUTING'],
    ['EXECUTING', 'COMPLETE'],
    ['EXECUTING', 'PARTIAL_FAILURE'],
    ['EXECUTING', 'FAILED'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow()
    expect(canTransition(from, to)).toBe(true)
  })

  it.each([
    ['DRAFT', 'APPROVED'],
    ['FORMED', 'EXECUTING'],
    ['PENDING_REVIEW', 'COMPLETE'],
    ['COMPLETE', 'EXECUTING'],
    ['FAILED', 'PENDING_REVIEW'],
    ['BLOCKED', 'APPROVED'],
    ['EXPIRED', 'PENDING_REVIEW'],
    ['EXECUTING', 'APPROVED'],
  ] as const)('rejects %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(AIGInvalidTransitionError)
    expect(canTransition(from, to)).toBe(false)
  })

  it('throws AIGInvalidTransitionError with from + to context', () => {
    try {
      assertTransition('DRAFT', 'COMPLETE')
      throw new Error('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AIGInvalidTransitionError)
      const e = err as AIGInvalidTransitionError
      expect(e.from).toBe('DRAFT')
      expect(e.to).toBe('COMPLETE')
    }
  })
})

describe('isTerminal', () => {
  it('marks the four terminal statuses', () => {
    for (const s of ['COMPLETE', 'FAILED', 'BLOCKED', 'EXPIRED'] as const) {
      expect(isTerminal(s)).toBe(true)
      expect(allowedNextStatuses(s)).toEqual([])
    }
  })

  it('does not mark any non-terminal status terminal', () => {
    const terminal = new Set(['COMPLETE', 'FAILED', 'BLOCKED', 'EXPIRED'])
    for (const s of INTENT_STATUSES) {
      if (terminal.has(s)) continue
      expect(isTerminal(s)).toBe(false)
    }
  })

  it('PARTIAL_FAILURE is not terminal — it can still move to FAILED', () => {
    expect(isTerminal('PARTIAL_FAILURE')).toBe(false)
    expect(canTransition('PARTIAL_FAILURE', 'FAILED')).toBe(true)
  })
})

describe('isToolCallImmutable', () => {
  it('immutable when tool call is approved or done', () => {
    expect(isToolCallImmutable('approved', 'PENDING_REVIEW')).toBe(true)
    expect(isToolCallImmutable('done', 'COMPLETE')).toBe(true)
  })

  it('immutable when parent intent is in any post-APPROVED state', () => {
    for (const intentStatus of [
      'APPROVED',
      'EXECUTING',
      'COMPLETE',
      'PARTIAL_FAILURE',
      'FAILED',
    ] as const) {
      expect(isToolCallImmutable('pending', intentStatus)).toBe(true)
    }
  })

  it('mutable when both are pending', () => {
    expect(isToolCallImmutable('pending', 'PENDING_REVIEW')).toBe(false)
    expect(isToolCallImmutable('pending', 'DRAFT')).toBe(false)
  })
})

describe('computeInvalidatedIds', () => {
  it('includes seed ids in the result', () => {
    const nodes = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ]
    const result = computeInvalidatedIds(nodes, new Set(['a']))
    expect(result.has('a')).toBe(true)
  })

  it('propagates a removal through a single dependent', () => {
    const nodes = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ]
    const result = computeInvalidatedIds(nodes, new Set(['a']))
    expect(Array.from(result).sort()).toEqual(['a', 'b'])
  })

  it('propagates through fan-out (one root, multiple dependents)', () => {
    const nodes = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['a'] },
    ]
    const result = computeInvalidatedIds(nodes, new Set(['a']))
    expect(Array.from(result).sort()).toEqual(['a', 'b', 'c'])
  })

  it('propagates through fan-in (multiple roots → one dependent)', () => {
    const nodes = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: [] },
      { id: 'c', dependsOn: ['a', 'b'] },
    ]
    const result = computeInvalidatedIds(nodes, new Set(['a']))
    expect(Array.from(result).sort()).toEqual(['a', 'c'])
  })

  it('propagates through a three-deep chain', () => {
    const nodes = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
    ]
    const result = computeInvalidatedIds(nodes, new Set(['a']))
    expect(Array.from(result).sort()).toEqual(['a', 'b', 'c'])
  })

  it('removing a leaf invalidates only itself', () => {
    const nodes = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
    ]
    const result = computeInvalidatedIds(nodes, new Set(['c']))
    expect(Array.from(result).sort()).toEqual(['c'])
  })

  it('returns empty when seed set is empty', () => {
    const nodes = [{ id: 'a', dependsOn: [] }]
    expect(computeInvalidatedIds(nodes, new Set())).toEqual(new Set())
  })
})

describe('topologicalSort', () => {
  it('returns the only order for a linear chain', () => {
    const order = topologicalSort([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
    ])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('roots before dependents in fan-out', () => {
    const order = topologicalSort([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['a'] },
    ])
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
  })

  it('all roots before dependent in fan-in', () => {
    const order = topologicalSort([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: [] },
      { id: 'c', dependsOn: ['a', 'b'] },
    ])
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  it('is deterministic for two equivalent inputs', () => {
    const input = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: [] },
      { id: 'c', dependsOn: ['a'] },
    ]
    expect(topologicalSort(input)).toEqual(topologicalSort(input))
  })

  it('throws on a cycle', () => {
    expect(() =>
      topologicalSort([
        { id: 'a', dependsOn: ['b'] },
        { id: 'b', dependsOn: ['a'] },
      ]),
    ).toThrow(AIGCycleError)
  })

  it('throws on a self-loop', () => {
    expect(() => topologicalSort([{ id: 'a', dependsOn: ['a'] }])).toThrow(AIGCycleError)
  })

  it('handles an empty input', () => {
    expect(topologicalSort([])).toEqual([])
  })
})
