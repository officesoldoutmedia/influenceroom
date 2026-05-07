// Generate a VAPID keypair for web-push.
// Run once locally: `node scripts/generate-vapid.mjs`
//
// Output (DO NOT COMMIT) — paste these into the Worker config:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (Build env, inlined into client bundle)
//   VAPID_PRIVATE_KEY             (Worker secret, server-only)
//   VAPID_SUBJECT                 (Worker env, e.g. "mailto:office@soldoutmedia.ro")

import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
console.log('VAPID_SUBJECT=mailto:office@soldoutmedia.ro')
