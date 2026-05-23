'use client'

import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type {
  ApprovalPoliciesResponseDto,
  ApprovalPolicyDto,
} from '@/app/api/approval-policies/route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

async function fetchPolicies(): Promise<ApprovalPoliciesResponseDto> {
  const res = await fetch('/api/approval-policies', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as ApprovalPoliciesResponseDto
}

export function ApprovalPoliciesPanel() {
  const [data, setData] = useState<ApprovalPoliciesResponseDto | null>(null)
  const [name, setName] = useState('')
  const [pattern, setPattern] = useState('Gmail.*')
  const [action, setAction] = useState<'require_admin_approval' | 'block'>('require_admin_approval')
  const [deleteTarget, setDeleteTarget] = useState<ApprovalPolicyDto | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setData(await fetchPolicies())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load approval policies')
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createPolicy = () => {
    startTransition(async () => {
      const res = await fetch('/api/approval-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          rules: [{ toolPattern: pattern, action }],
        }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      setName('')
      toast.success('Approval policy created.')
      setData(await fetchPolicies())
    })
  }

  const togglePolicy = (policy: ApprovalPolicyDto) => {
    startTransition(async () => {
      const res = await fetch(`/api/approval-policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !policy.enabled }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      setData(await fetchPolicies())
    })
  }

  const deletePolicy = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await fetch(`/api/approval-policies/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      setDeleteTarget(null)
      toast.success('Approval policy deleted.')
      setData(await fetchPolicies())
    })
  }

  const canManage = data?.canManage ?? false
  const canCreate = canManage && name.trim().length > 0 && pattern.trim().length > 0 && !isPending

  return (
    <>
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                Approval policies
              </p>
              <h2 className="font-semibold text-lg tracking-tight">Tool approval gates</h2>
              <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
                Match Arcade tool names with wildcard patterns. Policies run before approval: either
                require an owner/admin approver or block approval entirely.
              </p>
            </div>
            <Badge variant={canManage ? 'success' : 'outline'}>
              {canManage ? 'Owner/admin controls' : 'Read-only'}
            </Badge>
          </div>

          {canManage ? (
            <div className="grid gap-3 rounded-md border border-border bg-surface-1/40 p-3 sm:grid-cols-[1fr_1fr_190px_auto]">
              <label className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Policy name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Sensitive email sends"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </label>
              <label className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Tool pattern
                </span>
                <input
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  placeholder="Gmail.*"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-ring"
                />
              </label>
              <label className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Action
                </span>
                <select
                  value={action}
                  onChange={(event) =>
                    setAction(event.target.value as 'require_admin_approval' | 'block')
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                >
                  <option value="require_admin_approval">Require owner/admin</option>
                  <option value="block">Block approval</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button disabled={!canCreate} onClick={createPolicy} size="sm" className="w-full">
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {data?.policies.map((policy) => (
              <div
                key={policy.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-1/30 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <p className="font-medium">{policy.name}</p>
                    <Badge variant={policy.enabled ? 'success' : 'outline'}>
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {policy.rules
                      .map((rule) => `${formatAction(rule.action)} · ${rule.toolPattern}`)
                      .join(', ')}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={isPending}
                      onClick={() => togglePolicy(policy)}
                      size="sm"
                      variant="outline"
                    >
                      {policy.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={() => setDeleteTarget(policy)}
                      size="sm"
                      variant="danger"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {data && data.policies.length === 0 ? (
            <p className="rounded-md border border-border border-dashed p-4 text-muted-foreground text-sm">
              No approval policies yet. Start with a focused pattern like{' '}
              <span className="font-mono text-foreground">Gmail.SendEmail*</span> or{' '}
              <span className="font-mono text-foreground">Slack.*</span>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <DeletePolicyDialog
        target={deleteTarget}
        pending={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deletePolicy}
      />
    </>
  )
}

function formatAction(action: 'require_admin_approval' | 'block'): string {
  if (action === 'block') return 'Block approval'
  return 'Require owner/admin'
}

function DeletePolicyDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: ApprovalPolicyDto | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open ? onCancel() : null)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete approval policy?</DialogTitle>
          <DialogDescription>
            {target
              ? `This removes "${target.name}" immediately. Existing audit history is unchanged.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={pending} onClick={onCancel} size="sm" variant="secondary">
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm} size="sm" variant="destructive">
            {pending ? 'Deleting…' : 'Delete policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
