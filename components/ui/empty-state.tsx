import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-border border-dashed bg-surface-1/50 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="grid-bg mb-4 flex size-14 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-muted-foreground text-sm leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
