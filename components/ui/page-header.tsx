import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-border border-b pb-6 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-2">
        {eyebrow ? (
          <p className="font-mono text-[11px] text-primary uppercase tracking-widest">{eyebrow}</p>
        ) : null}
        <h1 className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
