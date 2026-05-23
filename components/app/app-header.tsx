'use client'

import { LogOut, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { cn } from '@/lib/utils'
import { MobileNav } from './mobile-nav'

interface AppHeaderProps {
  email: string
  workspaceName: string
  workspaceKind: 'production' | 'sandbox' | string
}

export function AppHeader({ email, workspaceName, workspaceKind }: AppHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [menuOpen])

  const signOut = async () => {
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  const initials =
    email
      .split('@')[0]
      ?.split(/[.\-_]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'A'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-border border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <MobileNav />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="outline"
            className="border-accent/50 bg-transparent font-mono text-[10px] text-accent uppercase"
          >
            {workspaceName}
          </Badge>
          {workspaceKind === 'sandbox' ? (
            <Badge variant="warning" className="hidden sm:inline-flex">
              Sandbox
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="relative flex items-center gap-2" ref={menuRef}>
        <Button
          variant="primary"
          size="sm"
          className="hidden gap-2 md:inline-flex"
          onClick={() => router.push('/app')}
        >
          <Plus className="size-4" />
          New run
        </Button>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label="Open account menu"
          className={cn(
            'flex items-center gap-2 rounded-md border border-border bg-surface-1 py-1 pr-3 pl-1 text-sm shadow-arcade transition-colors hover:bg-surface-2',
            menuOpen && 'bg-surface-2',
          )}
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground font-medium text-[11px] text-background">
            {initials}
          </span>
          <span className="hidden max-w-[160px] truncate text-muted-foreground sm:inline">
            {email || 'operator'}
          </span>
        </button>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            className="absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-arcade-lg"
          >
            <div className="border-border border-b px-4 py-3">
              <p className="font-medium text-sm">Signed in as</p>
              <p className="mt-0.5 truncate text-muted-foreground text-xs">{email || 'operator'}</p>
            </div>
            <div className="p-1">
              <button
                type="button"
                role="menuitem"
                tabIndex={0}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-foreground text-sm transition-colors hover:bg-surface-2"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4 text-muted-foreground" />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}
