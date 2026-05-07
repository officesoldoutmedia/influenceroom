import { SignJWT, jwtVerify } from 'jose'

export type SessionPayload = {
  user_id: string
  role: 'owner' | 'manager' | 'account' | 'intern'
  iat?: number
  exp?: number
}

export const COOKIE_NAME = 'ir_session'
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function sign(payload: Pick<SessionPayload, 'user_id' | 'role'>): Promise<string> {
  return await new SignJWT({ user_id: payload.user_id, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verify(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (typeof payload.user_id !== 'string' || typeof payload.role !== 'string') return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
