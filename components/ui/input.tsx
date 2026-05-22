import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm shadow-soft ' +
  'placeholder:text-muted-foreground/70 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return <input ref={ref} type={type} className={cn(fieldBase, 'h-9', className)} {...props} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-24 resize-y leading-relaxed', className)}
      {...props}
    />
  )
})

interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor: string
  children: React.ReactNode
}

export function FieldLabel({ className, children, ...props }: FieldLabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is required by the FieldLabel API
    <label className={cn('font-medium text-foreground text-sm', className)} {...props}>
      {children}
    </label>
  )
}
