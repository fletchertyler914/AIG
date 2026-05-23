'use client'

import {
  Close as DialogClosePrimitive,
  Content as DialogContentPrimitive,
  Description as DialogDescriptionPrimitive,
  Overlay as DialogOverlayPrimitive,
  Portal as DialogPortalPrimitive,
  Title as DialogTitlePrimitive,
  Root,
  Trigger,
} from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  type HTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

export const Dialog = Root
export const DialogTrigger = Trigger
export const DialogClose = DialogClosePrimitive

export const DialogPortal = DialogPortalPrimitive

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogOverlayPrimitive>,
  ComponentPropsWithoutRef<typeof DialogOverlayPrimitive>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogOverlayPrimitive
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-background/70 backdrop-blur-sm transition-opacity duration-150',
        'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
        className,
      )}
      {...props}
    />
  )
})

export const DialogContent = forwardRef<
  ElementRef<typeof DialogContentPrimitive>,
  ComponentPropsWithoutRef<typeof DialogContentPrimitive> & {
    showCloseButton?: boolean
  }
>(function DialogContent({ className, children, showCloseButton = true, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogContentPrimitive
        ref={ref}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[calc(100%-2rem)] max-w-md rounded-md border border-border bg-card text-card-foreground shadow-arcade-lg',
          'p-5 sm:p-6',
          'focus:outline-none',
          'transition-[opacity,transform] duration-150',
          'data-[state=closed]:scale-95 data-[state=closed]:opacity-0',
          'data-[state=open]:scale-100 data-[state=open]:opacity-100',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClosePrimitive
            className={cn(
              'absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md',
              'text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            )}
            aria-label="Close"
          >
            <X className="size-3.5" aria-hidden />
          </DialogClosePrimitive>
        ) : null}
      </DialogContentPrimitive>
    </DialogPortal>
  )
})

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogTitlePrimitive>,
  ComponentPropsWithoutRef<typeof DialogTitlePrimitive>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogTitlePrimitive
      ref={ref}
      className={cn('font-semibold text-base tracking-tight', className)}
      {...props}
    />
  )
})

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogDescriptionPrimitive>,
  ComponentPropsWithoutRef<typeof DialogDescriptionPrimitive>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogDescriptionPrimitive
      ref={ref}
      className={cn('text-muted-foreground text-sm leading-relaxed', className)}
      {...props}
    />
  )
})
