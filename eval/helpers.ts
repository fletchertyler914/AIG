import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repairIntent } from '@/lib/aig/repair'
import type { RepairInput, RepairResponse } from '@/lib/aig/types'

export interface RepairFixture {
  name: string
  input: RepairInput
  mockResponse: RepairResponse
  /** Extra assertions beyond the contract checker. */
  assert?: (response: RepairResponse, input: RepairInput) => void
}

export function loadFixture(caseId: string): RepairFixture {
  const base = join(process.cwd(), 'eval')
  const input = JSON.parse(
    readFileSync(join(base, 'fixtures', `${caseId}.json`), 'utf8'),
  ) as RepairFixture
  const mockResponse = JSON.parse(
    readFileSync(join(base, 'mocks', `${caseId}.json`), 'utf8'),
  ) as RepairResponse
  return { ...input, mockResponse }
}

export async function runFixture(fixture: RepairFixture): Promise<RepairResponse> {
  const response = await repairIntent(fixture.input, {
    mockResponse: fixture.mockResponse,
  })
  fixture.assert?.(response, fixture.input)
  return response
}

export const CASE_IDS = [
  'case-01',
  'case-02',
  'case-03',
  'case-04',
  'case-05',
  'case-06',
  'case-07',
  'case-08',
  'case-09',
] as const
