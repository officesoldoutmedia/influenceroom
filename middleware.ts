import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  const userId = await verifyToken(token)

  const requestHeaders = new Headers(req.headers)
  if (userId) {
    requestHeaders.set('x-user-id', userId)
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

async function verifyToken(_token: string | undefined): Promise<string | null> {
  return null
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
