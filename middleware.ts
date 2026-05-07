import { NextRequest, NextResponse } from 'next/server'
import { verify, COOKIE_NAME } from '@/lib/auth/jwt'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = token ? await verify(token) : null

  if (!session) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  const headers = new Headers(req.headers)
  headers.set('x-user-id', session.user_id)
  headers.set('x-user-role', session.role)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!login|api/auth|api/cron|_next|favicon.ico|public).*)'],
}
