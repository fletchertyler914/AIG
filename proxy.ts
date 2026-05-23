import { type NextRequest, NextResponse } from 'next/server'

/** Read directly — proxy runs on Edge and cannot import full env module. */
const skipAuth = process.env['E2E_SKIP_AUTH'] === '1' || process.env['E2E_SKIP_AUTH'] === 'true'

const PUBLIC_PATHS = ['/', '/sign-in', '/api/auth', '/api/health', '/api/test'] as const

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (skipAuth) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Better Auth prefixes cookies with `__Secure-` when useSecureCookies is on
  // (production). Cookie cache (`session_data`) is also present when the user
  // is signed in; checking either is sufficient to gate the session redirect.
  const sessionCookie =
    request.cookies.get('aig.session_token') ??
    request.cookies.get('__Secure-aig.session_token') ??
    request.cookies.get('aig.session_data') ??
    request.cookies.get('__Secure-aig.session_data')

  if (!sessionCookie?.value) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(signIn)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
