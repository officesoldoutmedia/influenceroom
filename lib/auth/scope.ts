// Path-A app-layer scoping helpers.
//
// The app uses custom HS256 JWT (not Supabase Auth) and every server-side
// Supabase client uses service_role, which bypasses RLS. So instead of
// per-table RLS policies tied to auth.uid(), we filter at the API/page
// layer using the role + user_id headers set by middleware.ts.
//
// Roles:
//   - owner / manager → bypass (full read + write across all rows)
//   - account / intern → scoped:
//       campaigns:    owner_id = user.id
//       influencers:  account_manager_id = user.id OR account_manager_id IS NULL
//
// Same predicate is used for read scoping (list pages, search) and write
// authorization (PATCH/DELETE on individual rows). Unassigned influencers
// are intentionally visible+editable by all account managers — that's how
// they get claimed in the UI. If Oana later wants assignment to gate writes,
// tighten requireInfluencerWriter to drop the `IS NULL` branch.
//
// Defense in depth: existing "authenticated read all" RLS policies stay in
// place. They're not load-bearing — service_role bypasses them — but they
// document intent for any future migration to real Supabase Auth + JWT
// minting (Path B in the original RLS spec).

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SessionPayload } from './jwt'

export type UserRole = SessionPayload['role']
export type UserContext = { id: string; role: UserRole }

const VALID_ROLES = new Set<UserRole>(['owner', 'manager', 'account', 'intern'])

export async function getCurrentUser(): Promise<UserContext | null> {
  const h = await headers()
  const id = h.get('x-user-id')
  const role = h.get('x-user-role')
  if (!id || !role || !VALID_ROLES.has(role as UserRole)) return null
  return { id, role: role as UserRole }
}

export function isOwnerOrManager(user: UserContext | null | undefined): boolean {
  return user?.role === 'owner' || user?.role === 'manager'
}

// PostgREST builder types are deeply generic — instantiating our scoping
// helpers against the full PostgrestFilterBuilder<...> type explodes inference
// (TS2589). We only need .eq / .or which preserve the builder identity, so we
// pass through as `any`. The runtime invariant is "called with a real Supabase
// builder"; callers regain typing on the eventual `await` of the query.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function scopeCampaignsRead(query: any, user: UserContext): any {
  if (isOwnerOrManager(user)) return query
  return query.eq('owner_id', user.id)
}

export function scopeInfluencersRead(query: any, user: UserContext): any {
  if (isOwnerOrManager(user)) return query
  return query.or(`account_manager_id.eq.${user.id},account_manager_id.is.null`)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function canReadCampaign(
  user: UserContext,
  campaign: { owner_id: string | null },
): boolean {
  if (isOwnerOrManager(user)) return true
  return campaign.owner_id === user.id
}

export function canReadInfluencer(
  user: UserContext,
  inf: { account_manager_id: string | null },
): boolean {
  if (isOwnerOrManager(user)) return true
  return inf.account_manager_id === null || inf.account_manager_id === user.id
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// Mirrors requireCampaignWriter. Writes on an influencer require: owner/manager
// bypass; otherwise the row's account_manager_id must equal the caller, OR
// be NULL (unassigned rows are claimable by any account). 404 vs 403 is
// deliberately not distinguished — both surface as "forbidden" so a probing
// account user can't enumerate ids of influencers assigned elsewhere.
export async function requireInfluencerWriter(influencerId: string): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  if (isOwnerOrManager(user)) return null

  const { data } = await admin()
    .from('influencers')
    .select('account_manager_id')
    .eq('id', influencerId)
    .maybeSingle()
  if (!data) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  if (data.account_manager_id === null || data.account_manager_id === user.id) return null
  return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
}
