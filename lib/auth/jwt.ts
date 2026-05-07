export type SessionPayload = {
  user_id: string
  role: 'owner' | 'manager' | 'account' | 'intern'
  iat?: number
  exp?: number
}
