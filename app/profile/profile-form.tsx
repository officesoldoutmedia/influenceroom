'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type Role = 'owner' | 'manager' | 'account' | 'intern'

export type NotificationPrefs = {
  task_assigned: boolean
  task_status_changed: boolean
  deadline_reminder: boolean
  daily_digest: boolean
  campaign_started: boolean
}

export type ProfileData = {
  id: string
  name: string
  email: string
  role: Role
  avatar_url: string | null
  notification_prefs: NotificationPrefs
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  account: 'Account',
  intern: 'Intern',
}

const PREF_LABELS: { key: keyof NotificationPrefs; label: string; help: string }[] = [
  { key: 'task_assigned', label: 'Task asignat ție', help: 'Când îți este asignat un task într-o campanie.' },
  { key: 'task_status_changed', label: 'Status task schimbat', help: 'Când statusul unui task din campaniile tale se schimbă.' },
  { key: 'deadline_reminder', label: 'Reminder deadline', help: 'Cu o zi înainte de termenul unui task.' },
  { key: 'daily_digest', label: 'Daily digest dimineața', help: 'Sumar zilnic al taskurilor și campaniilor active.' },
  { key: 'campaign_started', label: 'Campanie nouă pornită', help: 'Când o campanie nouă este creată din template.' },
]

const ERROR_MAP: Record<string, string> = {
  invalid_name: 'Numele trebuie să aibă între 2 și 100 caractere.',
  invalid_email: 'Email invalid.',
  invalid_avatar_url: 'Avatar URL trebuie să înceapă cu https://.',
  invalid_prefs: 'Preferințe invalide.',
  email_exists: 'Acest email este deja folosit.',
  invalid_current_pin: 'PIN-ul actual este greșit.',
  invalid_format: 'PIN-ul trebuie să fie format din 4 cifre.',
  server_error: 'Eroare server. Încearcă din nou.',
  unauthorized: 'Sesiune expirată. Re-loghează-te.',
}

function err(code: string | undefined): string {
  return ERROR_MAP[code ?? 'server_error'] ?? ERROR_MAP.server_error
}

export function ProfileForm({
  initial,
  vapidPublicKey,
  deviceCount,
}: {
  initial: ProfileData
  vapidPublicKey: string | null
  deviceCount: number
}) {
  const [profile, setProfile] = useState<ProfileData>(initial)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  function flash(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm shadow-lg ${
            toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <ProfileHeader profile={profile} />
      <DetailsCard profile={profile} setProfile={setProfile} flash={flash} />
      <PinCard flash={flash} />
      <NotificationsCard
        profile={profile}
        setProfile={setProfile}
        flash={flash}
      />
      <PushCard
        vapidPublicKey={vapidPublicKey}
        initialDeviceCount={deviceCount}
        flash={flash}
      />
    </div>
  )
}

function ProfileHeader({ profile }: { profile: ProfileData }) {
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4">
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt={profile.name}
          className="w-16 h-16 rounded-full object-cover bg-stone-100"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-xl font-semibold">
          {initials}
        </div>
      )}
      <div className="flex-1">
        <div className="text-lg font-semibold text-stone-900">{profile.name}</div>
        <div className="text-sm text-stone-500 mt-0.5">
          <span className="text-stone-400">Rol:</span>{' '}
          <span className="font-medium text-stone-700">{ROLE_LABEL[profile.role]}</span>
        </div>
        <div className="text-xs text-stone-400 mt-0.5">
          Schimbă rolul prin Admin → Team (doar owner).
        </div>
      </div>
    </div>
  )
}

function DetailsCard({
  profile,
  setProfile,
  flash,
}: {
  profile: ProfileData
  setProfile: (p: ProfileData) => void
  flash: (k: 'ok' | 'err', m: string) => void
}) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const dirty =
    name !== profile.name ||
    email !== profile.email ||
    (avatarUrl || null) !== (profile.avatar_url ?? null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        avatar_url: avatarUrl.trim() || null,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      profile?: ProfileData
    }
    setBusy(false)
    if (res.ok && json.ok && json.profile) {
      setProfile(json.profile)
      flash('ok', 'Profil actualizat')
      router.refresh()
    } else {
      flash('err', err(json.error))
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
        Detalii cont
      </h2>
      <Field label="Nume">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          className={inputCls}
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputCls}
        />
      </Field>
      <Field label="Avatar URL (opțional, https://...)">
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </Field>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={!dirty || busy} className={btnPrimary}>
          {busy ? '...' : 'Salvează'}
        </button>
      </div>
    </form>
  )
}

function PinCard({ flash }: { flash: (k: 'ok' | 'err', m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}$/.test(next)) {
      setError(ERROR_MAP.invalid_format)
      return
    }
    if (next !== confirm) {
      setError('Confirmarea nu se potrivește.')
      return
    }
    setBusy(true)
    const res = await fetch('/api/profile/change-pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ current_pin: current, new_pin: next }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    setBusy(false)
    if (res.ok && json.ok) {
      reset()
      setOpen(false)
      flash('ok', 'PIN schimbat')
    } else {
      setError(err(json.error))
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <button
        type="button"
        onClick={() => {
          if (open) reset()
          setOpen(!open)
        }}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
          Schimbă PIN
        </h2>
        <span className="text-stone-400 text-sm">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="space-y-4 mt-4">
          <Field label="PIN actual">
            <PinInput value={current} onChange={setCurrent} />
          </Field>
          <Field label="PIN nou (4 cifre)">
            <PinInput value={next} onChange={setNext} />
          </Field>
          <Field label="Confirmă PIN nou">
            <PinInput value={confirm} onChange={setConfirm} />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                reset()
                setOpen(false)
              }}
              className={btnSecondary}
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className={btnPrimary}
            >
              {busy ? '...' : 'Schimbă PIN'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      className={inputCls}
    />
  )
}

function NotificationsCard({
  profile,
  setProfile,
  flash,
}: {
  profile: ProfileData
  setProfile: (p: ProfileData) => void
  flash: (k: 'ok' | 'err', m: string) => void
}) {
  const [pending, startTransition] = useTransition()

  function toggle(key: keyof NotificationPrefs) {
    const prev = profile.notification_prefs
    const next = { ...prev, [key]: !prev[key] }
    // optimistic
    setProfile({ ...profile, notification_prefs: next })
    startTransition(async () => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notification_prefs: next }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        profile?: ProfileData
      }
      if (!(res.ok && json.ok && json.profile)) {
        // revert
        setProfile({ ...profile, notification_prefs: prev })
        flash('err', err(json.error))
      } else {
        setProfile(json.profile)
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">
        Notificări
      </h2>
      <ul className="space-y-3">
        {PREF_LABELS.map(({ key, label, help }) => (
          <li key={key} className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-stone-900">{label}</div>
              <div className="text-xs text-stone-500 mt-0.5">{help}</div>
            </div>
            <Toggle
              checked={profile.notification_prefs[key]}
              onChange={() => toggle(key)}
              disabled={pending}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-brand-700' : 'bg-stone-300'
      } disabled:opacity-60`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function PushCard({
  vapidPublicKey,
  initialDeviceCount,
  flash,
}: {
  vapidPublicKey: string | null
  initialDeviceCount: number
  flash: (k: 'ok' | 'err', m: string) => void
}) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deviceCount, setDeviceCount] = useState(initialDeviceCount)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok)
    if (!ok) return
    setPermission(Notification.permission)
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub)
      }),
    )
  }, [])

  async function enable() {
    if (!vapidPublicKey) {
      flash('err', 'Push nu este configurat (lipsește VAPID).')
      return
    }
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        flash('err', 'Permisiunea pentru notificări a fost refuzată.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        setSubscribed(true)
        setDeviceCount((c) => c + 1)
        flash('ok', 'Notificări activate')
      } else {
        flash('err', err(data.error))
      }
    } catch (e) {
      flash('err', String(e))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setDeviceCount((c) => Math.max(0, c - 1))
      flash('ok', 'Notificări dezactivate')
    } catch (e) {
      flash('err', String(e))
    } finally {
      setBusy(false)
    }
  }

  const status = (() => {
    if (supported === null) return '...'
    if (!supported) return 'Browser nu suportă'
    if (permission === 'denied') return 'Refuzate (schimbă din setările browserului)'
    if (subscribed) return `Activate · ${deviceCount} ${deviceCount === 1 ? 'dispozitiv' : 'dispozitive'}`
    return 'Dezactivate'
  })()

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
      <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
        Notificări push
      </h2>
      <p className="text-sm text-stone-600">{status}</p>
      {!vapidPublicKey && (
        <p className="text-xs text-amber-600">
          Push nu este configurat la nivel de server. Setează VAPID_* în Worker.
        </p>
      )}
      <div className="flex gap-2 pt-1">
        {supported && permission !== 'denied' && !subscribed && (
          <button
            type="button"
            onClick={enable}
            disabled={busy || !vapidPublicKey}
            className={btnPrimary}
          >
            {busy ? '...' : 'Activează notificări push'}
          </button>
        )}
        {supported && subscribed && (
          <button type="button" onClick={disable} disabled={busy} className={btnSecondary}>
            {busy ? '...' : 'Dezactivează'}
          </button>
        )}
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const btnPrimary =
  'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'
