'use client'

import { MailPlus, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { TeamResponseDto } from '@/app/api/team/route'
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

async function fetchTeam(): Promise<TeamResponseDto> {
  const res = await fetch('/api/team', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as TeamResponseDto
}

export function TeamPanel() {
  const [data, setData] = useState<TeamResponseDto | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setData(await fetchTeam())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load team')
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = () => {
    startTransition(async () => {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      setEmail('')
      toast.success('Invitation created.')
      setData(await fetchTeam())
    })
  }

  const deleteInvitation = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await fetch(`/api/team/invitations/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      setDeleteTarget(null)
      toast.success('Invitation removed.')
      setData(await fetchTeam())
    })
  }

  const canManage = data?.canManage ?? false

  return (
    <>
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                Team
              </p>
              <h2 className="font-semibold text-lg tracking-tight">Workspace members</h2>
              <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
                Owner/admin members can manage shared connections and approval policies. Invitations
                are tracked in Better Auth&apos;s organization tables.
              </p>
            </div>
            <Badge variant={canManage ? 'success' : 'outline'}>
              {canManage ? 'Can invite' : 'Read-only'}
            </Badge>
          </div>

          {canManage ? (
            <div className="grid gap-3 rounded-md border border-border bg-surface-1/40 p-3 sm:grid-cols-[1fr_150px_auto]">
              <label className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </label>
              <label className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Role
                </span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as 'member' | 'admin')}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  disabled={isPending || !email.trim()}
                  onClick={invite}
                  size="sm"
                  className="w-full"
                >
                  <MailPlus className="size-3.5" />
                  Invite
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <p className="font-medium text-sm">Members</p>
            </div>
            {data?.members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-1/30 p-3"
              >
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-muted-foreground text-xs">{member.email}</p>
                </div>
                <Badge
                  variant={
                    member.role === 'owner' || member.role === 'admin' ? 'success' : 'outline'
                  }
                >
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>

          {data && data.invitations.length > 0 ? (
            <div className="space-y-2">
              <p className="font-medium text-sm">Pending invitations</p>
              {data.invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-1/30 p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{invitation.email}</p>
                    <p className="text-muted-foreground text-xs">
                      {invitation.role ?? 'member'} · {invitation.status}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      disabled={isPending}
                      onClick={() =>
                        setDeleteTarget({ id: invitation.id, email: invitation.email })
                      }
                      size="sm"
                      variant="danger"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DeleteInvitationDialog
        target={deleteTarget}
        pending={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteInvitation}
      />
    </>
  )
}

function DeleteInvitationDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: { id: string; email: string } | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open ? onCancel() : null)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Remove invitation?</DialogTitle>
          <DialogDescription>
            {target ? `This removes the pending invitation for ${target.email}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={pending} onClick={onCancel} size="sm" variant="secondary">
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm} size="sm" variant="destructive">
            {pending ? 'Removing…' : 'Remove invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
