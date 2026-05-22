import { type NextRequest, NextResponse } from 'next/server'

/** Read directly — middleware runs on Edge and cannot import full env module. */
const skipAuth = process.env['E2E_SKIP_AUTH'] === '1' || process.env['E2E_SKIP_AUTH'] === 'true'

const PUBLIC_PATHS = ['/', '/sign-in', '/api/auth', '/api/health'] as const

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (skipAuth) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const sessionCookie =
    request.cookies.get('aig.session_token') ?? request.cookies.get('better-auth.session_token')

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
