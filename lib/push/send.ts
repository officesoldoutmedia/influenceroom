// Web push helper using @block65/webcrypto-web-push (Web Crypto API based,
// works on Cloudflare Workers without nodejs_compat polyfills for crypto).
//
// Lib choice: @block65/webcrypto-web-push (option b in spec).
//   - web-push (Node, option a) requires Node crypto + Buffer; works under
//     nodejs_compat but pulls a heavier dep tree into the Worker bundle.
//   - webcrypto-web-push uses fetch + Web Crypto natively → smallest bundle.

import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export type PushSendResult =
  | { ok: true; status: number }
  | { ok: false; status: number; expired: boolean; error?: string }

function vapidKeys() {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) return null
  return { subject, publicKey, privateKey }
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

export function isPushConfigured(): boolean {
  return vapidKeys() !== null
}

export async function sendPush(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<PushSendResult> {
  const vapid = vapidKeys()
  if (!vapid) {
    return { ok: false, status: 0, expired: false, error: 'vapid_not_configured' }
  }

  let built: Awaited<ReturnType<typeof buildPushPayload>>
  try {
    built = await buildPushPayload(
      {
        data: payload,
        options: { ttl: 60 * 60 * 24, urgency: 'normal' },
      },
      subscription,
      vapid,
    )
  } catch (err) {
    // Malformed p256dh/auth keys throw inside the library; treat as a per-sub
    // failure and let the caller decide whether to delete the row.
    return { ok: false, status: 0, expired: false, error: `payload_build: ${err}` }
  }

  let res: Response
  try {
    res = await fetch(subscription.endpoint, {
      method: built.method,
      headers: built.headers,
      // The lib returns Uint8Array<ArrayBufferLike>; Workers' fetch typings
      // are narrower than BodyInit. Cast to BodyInit — runtime accepts it.
      body: built.body as unknown as BodyInit,
    })
  } catch (err) {
    return { ok: false, status: 0, expired: false, error: String(err) }
  }

  if (res.ok) return { ok: true, status: res.status }

  // 404 / 410 mean the subscription no longer exists upstream — caller should
  // delete the row to keep the table clean.
  const expired = res.status === 404 || res.status === 410
  return { ok: false, status: res.status, expired }
}
