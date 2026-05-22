import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-mono text-[10px] uppercase tracking-wider',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-2 text-muted-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        brand: 'border-aig-proposed/40 bg-aig-proposed/15 text-aig-proposed',
        success: 'border-success/40 bg-success/15 text-success',
        warning: 'border-warning/50 bg-warning/20 text-warning',
        info: 'border-info/50 bg-info/20 text-info',
        danger: 'border-destructive/50 bg-destructive/20 text-destructive',
        accent: 'border-aig-edited/50 bg-aig-edited/20 text-aig-edited',
        proposed: 'border-aig-proposed/50 bg-aig-proposed/20 text-aig-proposed',
        modified: 'border-warning/50 bg-warning/20 text-warning',
        approved: 'border-aig-approved/40 bg-aig-approved/15 text-aig-approved',
        executed: 'border-aig-executed/40 bg-aig-executed/15 text-aig-executed',
        failed: 'border-aig-failed/40 bg-aig-failed/15 text-aig-failed',
        removed: 'border-aig-removed/40 bg-aig-removed/15 text-aig-removed',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-1 text-[10px]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

/**
 * Intent status → Badge variant. Single source of truth so every page renders
 * statuses consistently.
 */
const INTENT_STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  DRAFT: 'neutral',
  UNCERTAIN: 'warning',
  FORMED: 'info',
  PENDING_REVIEW: 'brand',
  MODIFIED: 'modified',
  REGENERATING: 'modified',
  APPROVED: 'approved',
  EXECUTING: 'accent',
  COMPLETE: 'executed',
  PARTIAL_FAILURE: 'warning',
  FAILED: 'failed',
  BLOCKED: 'failed',
  EXPIRED: 'removed',
}

const TOOL_CALL_STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  pending: 'neutral',
  approved: 'approved',
  executing: 'accent',
  done: 'executed',
  failed: 'failed',
  invalidated: 'removed',
}

export function IntentStatusBadge({
  status,
  className,
  ...rest
}: { status: string } & Omit<BadgeProps, 'variant'>) {
  return (
    <Badge variant={INTENT_STATUS_VARIANT[status] ?? 'neutral'} className={className} {...rest}>
      {status}
    </Badge>
  )
}

export function ToolCallStatusBadge({
  status,
  className,
  ...rest
}: { status: string } & Omit<BadgeProps, 'variant'>) {
  return (
    <Badge variant={TOOL_CALL_STATUS_VARIANT[status] ?? 'neutral'} className={className} {...rest}>
      {status}
    </Badge>
  )
}
