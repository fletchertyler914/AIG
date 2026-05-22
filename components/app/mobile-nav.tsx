'use client'

import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppSidebar } from './app-sidebar'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const _pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="lg:hidden"
      >
        <Menu className="size-5" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full max-w-[18rem] flex-col bg-surface-1 shadow-elevated">
            <div className="flex h-16 items-center justify-end border-border border-b px-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <AppSidebar className="border-0" onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  )
}
