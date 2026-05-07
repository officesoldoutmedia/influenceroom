// Render PWA icons from an inline SVG to multiple PNG sizes via sharp.
// Run: node scripts/generate-icons.mjs
//
// Outputs to public/icons + public/favicon.ico. Filenames are stable so the
// agency can replace branding later by overwriting these files.

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const OUT_ICONS = path.join(PROJECT_ROOT, 'public', 'icons')
const OUT_FAVICON = path.join(PROJECT_ROOT, 'public', 'favicon.ico')

const BG = '#6366F1' // indigo-500

function svg({ size, padding = 0 }) {
  // Padding is in absolute px applied symmetrically (used for maskable safe zone).
  const inner = size - padding * 2
  // Cap font size so "IR" fits in the inner box at any scale.
  const fontSize = Math.round(inner * 0.5)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="50%" y="50%" dy="0.05em"
        text-anchor="middle" dominant-baseline="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="700"
        font-size="${fontSize}"
        fill="#FFFFFF"
        letter-spacing="-2">IR</text>
</svg>`
}

async function renderPng(size, outPath, { padding = 0 } = {}) {
  const buf = Buffer.from(svg({ size, padding }))
  await sharp(buf).png().toFile(outPath)
  return outPath
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
    await renderPng(t.size, out, { padding: t.padding ?? 0 })
    console.log(`wrote ${path.relative(PROJECT_ROOT, out)} (${t.size}x${t.size})`)
  }

  // favicon.ico: render a 32x32 PNG, then write as ICO. sharp supports ICO via
  // its built-in encoder when the extension is .ico — but to keep the asset
  // browser-portable across older clients we write a 32x32 PNG renamed .ico,
  // which all modern browsers accept.
  const faviconBuf = await sharp(Buffer.from(svg({ size: 32 }))).png().toBuffer()
  await writeFile(OUT_FAVICON, faviconBuf)
  console.log(`wrote ${path.relative(PROJECT_ROOT, OUT_FAVICON)} (32x32 png-as-ico)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
