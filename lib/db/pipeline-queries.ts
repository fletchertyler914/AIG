/**
 * Pipeline persistence — workspace-scoped template registry.
 */

import { and, desc, eq, max, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { buildSeedPipelineTemplate, type PipelineTemplate } from '@/lib/aig/pipeline'
import { db } from '@/lib/db/client'
import { type Pipeline, pipelines } from '@/lib/db/schema'

export async function listPipelinesForWorkspace(workspaceId: string): Promise<Pipeline[]> {
  return db
    .select()
    .from(pipelines)
    .where(eq(pipelines.workspaceId, workspaceId))
    .orderBy(desc(pipelines.updatedAt))
}

export async function getPipelineById(input: {
  workspaceId: string
  pipelineId: string
}): Promise<Pipeline | null> {
  const [row] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, input.pipelineId), eq(pipelines.workspaceId, input.workspaceId)))
    .limit(1)
  return row ?? null
}

export async function getLatestPipelineVersion(input: {
  workspaceId: string
  name: string
}): Promise<number> {
  const [row] = await db
    .select({ maxVersion: max(pipelines.version) })
    .from(pipelines)
    .where(and(eq(pipelines.workspaceId, input.workspaceId), eq(pipelines.name, input.name)))
  return row?.maxVersion ?? 0
}

export async function createPipeline(input: {
  workspaceId: string
  name: string
  description?: string | null
  sourceIntentId?: string | null
  objective: string
  systems: string[]
  template: PipelineTemplate
  createdByUserId?: string | null
}): Promise<Pipeline> {
  const now = Date.now()
  const version =
    (await getLatestPipelineVersion({ workspaceId: input.workspaceId, name: input.name })) + 1

  const id = ulid()
  const [row] = await db
    .insert(pipelines)
    .values({
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description ?? null,
      sourceIntentId: input.sourceIntentId ?? null,
      version,
      objective: input.objective,
      systems: input.systems,
      template: input.template,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!row) throw new Error('pipeline insert failed')
  return row
}

export async function countPipelinesForWorkspace(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pipelines)
    .where(eq(pipelines.workspaceId, workspaceId))
  return row?.count ?? 0
}

export async function ensureSeedPipelineForWorkspace(input: {
  workspaceId: string
  operatorEmail: string
  createdByUserId?: string | null
}): Promise<Pipeline | null> {
  if ((await countPipelinesForWorkspace(input.workspaceId)) > 0) return null

  const template = buildSeedPipelineTemplate(input.operatorEmail)
  return createPipeline({
    workspaceId: input.workspaceId,
    name: template.label,
    description: template.description,
    objective: template.objective,
    systems: template.systems,
    template,
    createdByUserId: input.createdByUserId ?? null,
  })
}
