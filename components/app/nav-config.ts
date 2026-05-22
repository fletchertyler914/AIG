import { BarChart3, Cable, Cog, GitBranch, type LucideIcon, PlayCircle } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
  /** Paths under which this item is considered active (in addition to `href`). */
  activeAlso?: string[]
}

export const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  {
    href: '/app',
    label: 'Runs',
    description: 'Intent graph executions',
    icon: PlayCircle,
    activeAlso: ['/app/intent'],
  },
  {
    href: '/app/connections',
    label: 'Connections',
    description: 'Arcade toolkit OAuth',
    icon: Cable,
  },
  {
    href: '/app/pipelines',
    label: 'Pipelines',
    description: 'Saved agent workflows',
    icon: GitBranch,
  },
  {
    href: '/app/insights',
    label: 'Insights',
    description: 'Usage & audit',
    icon: BarChart3,
  },
  {
    href: '/app/settings',
    label: 'Settings',
    description: 'Policies & team',
    icon: Cog,
  },
] as const

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/app') {
    return pathname === '/app' || pathname.startsWith('/app/intent')
  }
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true
  return (item.activeAlso ?? []).some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}
