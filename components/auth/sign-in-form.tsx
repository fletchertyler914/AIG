'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldLabel, Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'

interface SignInFormProps {
  callbackUrl: string
}

export function SignInForm({ callbackUrl }: SignInFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your work email.')
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await authClient.signIn.magicLink({
        email: trimmed,
        callbackURL: callbackUrl,
      })

      if (result.error) {
        setError(result.error.message ?? 'Failed to send magic link')
        return
      }

      router.push(`/sign-in?sent=1&callbackUrl=${encodeURIComponent(callbackUrl)}`)
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-6 sm:p-6">
        <div className="space-y-2">
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input
            id="email"
            autoComplete="email"
            data-testid="sign-in-email"
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="you@company.com"
            type="email"
            value={email}
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button className="w-full" data-testid="sign-in-submit" disabled={pending} onClick={submit}>
          {pending ? 'Sending…' : 'Send magic link'}
        </Button>
      </CardContent>
    </Card>
  )
}
