// Local smoke for the rate-card PDF generator.
//
// Renders a sample PDF using a SPEAK-shaped fixture and writes it to
// /tmp/rate-card-smoke.pdf. Run with:
//   npx tsx scripts/smoke-rate-card-pdf.ts
// Then open the file to eyeball the design before deploying. Useful sanity
// check that pdf-lib actually emits a parseable PDF in the project's runtime
// (Node 20) — the Workers environment uses the same library.

import { writeFile } from 'node:fs/promises'
import { generateRateCardPDF } from '@/lib/rate-cards/pdf-generator'
import type { Influencer } from '@/lib/influencers/types'

const fixture: Influencer = {
  id: 'smoke',
  name: 'SPEAK',
  social_handles: {
    instagram: { handle: 'speak', url: 'https://instagram.com/speak', followers: 1_200_000 },
    tiktok: { handle: 'speak', url: 'https://tiktok.com/@speak', followers: 1_200_000 },
    youtube: { handle: 'speak', url: 'https://youtube.com/@speak', followers: 546_000 },
    facebook: { handle: 'speak', url: 'https://facebook.com/speak', followers: 1_000_000 },
  },
  niche_tags: [],
  tier: 'macro',
  tier_manual_override: false,
  language: 'ro',
  location_city: 'București',
  location_country: 'Romania',
  rate_cards: {
    facebook: { photo: 2000, video: 2500, story_set: 1000, ur_30d: 500 },
    instagram: { photo: 2300, video: 2500, story_set: 2000, ur_30d: 700 },
    tiktok: { video: 2500, boost_7d: 1000, boost_15d: 1500, boost_30d: 2500, ur_30d: 800 },
    youtube: { video_insert: 2000, shorts: 1000, dedicated: 6000, ur_30d: 1200 },
  },
  contact_email: null,
  contact_phone: null,
  agent_name: null,
  agent_email: null,
  fiscal_data: null,
  exclusive: false,
  status: 'active',
  notes: null,
  account_manager_id: null,
  created_at: '2026-05-08T00:00:00Z',
  updated_at: '2026-05-08T00:00:00Z',
}

async function main() {
  const bytes = await generateRateCardPDF(fixture)
  const out = '/tmp/rate-card-smoke.pdf'
  await writeFile(out, bytes)
  // First eight bytes of a valid PDF must be `%PDF-1.X`.
  const head = new TextDecoder().decode(bytes.subarray(0, 8))
  console.log(`bytes:  ${bytes.length}`)
  console.log(`header: ${JSON.stringify(head)}`)
  console.log(`wrote:  ${out}`)
  if (!head.startsWith('%PDF-')) {
    console.error('FAIL: header is not a PDF signature')
    process.exit(1)
  }
}

void main()
