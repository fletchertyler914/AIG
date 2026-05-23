'use client'

import {
  Content as PopoverContentPrimitive,
  Portal as PopoverPortalPrimitive,
  Root,
  Trigger,
} from '@radix-ui/react-popover'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Popover = Root
export const PopoverTrigger = Trigger
export const PopoverPortal = PopoverPortalPrimitive

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverContentPrimitive>,
  ComponentPropsWithoutRef<typeof PopoverContentPrimitive>
>(function PopoverContent({ className, align = 'start', sideOffset = 6, ...props }, ref) {
  return (
    <PopoverPortal>
      <PopoverContentPrimitive
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md border border-border bg-card text-card-foreground shadow-arcade-lg',
          'outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
          className,
        )}
        {...props}
      />
    </PopoverPortal>
  )
})
