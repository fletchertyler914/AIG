import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium' +
    'transition-[color,background-color,border-color,box-shadow,transform] duration-100' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background' +
    'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-arcade hover:bg-primary/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
        secondary:
          'border border-border bg-surface-1 text-foreground shadow-arcade hover:bg-surface-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-surface-2 active:translate-x-0.5 active:translate-y-0.5',
        ghost: 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground shadow-arcade hover:bg-destructive/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
        danger:
          'border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10 active:translate-x-0.5 active:translate-y-0.5',
        link: 'text-foreground underline-offset-4 hover:underline',
        display:
          'bg-primary font-mono text-primary-foreground uppercase tracking-widest shadow-arcade-lg hover:bg-primary/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-12 px-7 text-sm',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
})
