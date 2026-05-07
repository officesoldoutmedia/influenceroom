// Render PWA icons from the IR monogram on the burnt-amber brand background.
// Run once locally: `node scripts/generate-icons.mjs`
//
// Source: assets/logo-ir.png (1080×1080, black IR shape on white background).
// We invert that to get a white IR shape on black, then use the result as a
// `screen` blend over a solid amber canvas — landing white-on-amber pixels
// for the icon. Filenames stable so the agency can re-run with a different
// source PNG without code changes.

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE = path.join(PROJECT_ROOT, 'assets', 'logo-ir.png')
const OUT_ICONS = path.join(PROJECT_ROOT, 'public', 'icons')
const OUT_FAVICON = path.join(PROJECT_ROOT, 'public', 'favicon.ico')

const BRAND = { r: 0xC2, g: 0x41, b: 0x0C, alpha: 1 } // brand-700 #C2410C

/**
 * Build a white-IR-on-amber square buffer at the given size.
 * `padding` is absolute px on each side (used for maskable safe zone).
 */
async function renderIconBuffer(size, { padding = 0 } = {}) {
  const inner = size - padding * 2

  // Step 1: invert the source so the IR letters are white, bg is black.
  // negate({alpha:false}) preserves the alpha channel.
  const inverted = await sharp(SOURCE)
    .flatten({ background: '#FFFFFF' }) // ensure no transparency before inversion
    .negate({ alpha: false })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer()

  // Step 2: solid amber canvas at full output size.
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND,
    },
  })

  // Step 3: composite the inverted (black bg, white IR) on amber using
  // `screen` blend — black pixels leave the amber unchanged; white pixels
  // become white over the amber.
  return canvas
    .composite([
      {
        input: inverted,
        top: padding,
        left: padding,
        blend: 'screen',
      },
    ])
    .png()
    .toBuffer()
}

async function main() {
  await mkdir(OUT_ICONS, { recursive: true })

  const targets = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    // Maskable spec: ~10% safe-zone padding so OS shape masks don't clip the glyph.
    { size: 512, name: 'icon-512-maskable.png', padding: 51 },
    { size: 180, name: 'apple-touch-icon.png' },
  ]

  for (const t of targets) {
    const out = path.join(OUT_ICONS, t.name)
    const buf = await renderIconBuffer(t.size, { padding: t.padding ?? 0 })
    await writeFile(out, buf)
    console.log(`wrote ${path.relative(PROJECT_ROOT, out)} (${t.size}×${t.size})`)
  }

  // Favicon: 32×32 PNG-as-ICO. Modern browsers accept PNG content under .ico.
  const favBuf = await renderIconBuffer(32)
  await writeFile(OUT_FAVICON, favBuf)
  console.log(`wrote ${path.relative(PROJECT_ROOT, OUT_FAVICON)} (32×32 png-as-ico)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
