import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Width = 'prose' | 'page' | 'wide' | 'full'

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: Width
}

const widthClass: Record<Width, string> = {
  prose: 'max-w-[var(--container-prose)]',
  page: 'max-w-[var(--container-page)]',
  wide: 'max-w-[var(--container-wide)]',
  full: 'max-w-none',
}

/**
 * Standard page-content wrapper. Owns horizontal gutters and the canonical
 * max-width so every page lines up visually with the sidebar/header.
 */
export function Container({ className, width = 'page', ...props }: ContainerProps) {
  return (
    <div
      className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', widthClass[width], className)}
      {...props}
    />
  )
}
