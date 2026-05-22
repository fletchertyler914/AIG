import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/**
 * Lightweight section heading used inside cards/grids. Visually distinct from
 * the top-level <PageHeader/>.
 */
export function SectionHeader({
  title,
  description,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)} {...props}>
      <div className="min-w-0 space-y-1">
        <h2 className="font-semibold text-foreground text-lg tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] text-muted-foreground shadow-soft">
      {children}
    </kbd>
  )
}
