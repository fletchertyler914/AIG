'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { isNavItemActive, PRIMARY_NAV } from './nav-config'

interface AppSidebarProps {
  onNavigate?: () => void
  className?: string
}

export function AppSidebar({ onNavigate, className }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn('flex w-60 shrink-0 flex-col border-border border-r bg-surface-1', className)}
    >
      <div className="flex h-16 items-center gap-2 border-border border-b px-5">
        <Link
          className="flex items-center gap-2"
          href="/"
          {...(onNavigate ? { onClick: onNavigate } : {})}
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-[11px] text-primary-foreground tracking-tighter shadow-arcade">
            AIG
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">Arcade Intent Graph</span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Control plane
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Primary">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          const active = isNavItemActive(item, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              {...(active ? { 'aria-current': 'page' as const } : {})}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-surface-2 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm bg-primary transition-opacity',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Icon
                className={cn(
                  'size-4 shrink-0 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-border border-t p-4">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Built on Arcade MCP.
          <br />
          Governance for production agents.
        </p>
      </div>
    </aside>
  )
}
