// Sprint 15 Faza 3 §11 — generator PDF bulk summary pentru lista campanii filtrate.
//
// Conţinut: Cover cu interval (ex: "Ian – Mar 2026") → tabel one-row-per-campaign
// cu Nume / Brand / Status / Perioadă / # Participanţi / Buget. Paginare auto
// la 25 rânduri/pagină. Total general la final.

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { WORDMARK_ASPECT_RATIO, WORDMARK_PNG_BASE64 } from '@/lib/rate-cards/wordmark-asset'
import { formatEur } from '@/lib/influencers/format'

const COLORS = {
  obsidian: rgb(0x0a / 255, 0x0a / 255, 0x0b / 255),
  brand: rgb(0xc2 / 255, 0x41 / 255, 0x0c / 255),
  textMuted: rgb(0x57 / 255, 0x53 / 255, 0x4e / 255),
  textFaint: rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255),
  rule: rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255),
  rowAlt: rgb(0xfa / 255, 0xfa / 255, 0xf9 / 255),
}
const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = { x: 56, y: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2
const WORDMARK_W = 120
const WORDMARK_H = WORDMARK_W / WORDMARK_ASPECT_RATIO
const FOOTER_W = 70
const FOOTER_H = FOOTER_W / WORDMARK_ASPECT_RATIO

type Fonts = { serif: PDFFont; serifBold: PDFFont; sans: PDFFont; sansBold: PDFFont }
type Assets = Fonts & { wordmark: PDFImage }

export type ReportCampaign = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  brand_name: string | null
  participants_count: number
}

export type ReportFilters = {
  monthFrom?: string | null
  monthTo?: string | null
  statuses?: string[]
  brandName?: string | null
  ownerName?: string | null
  search?: string | null
}

function decodeWordmarkPng(): Uint8Array {
  const bin = atob(WORDMARK_PNG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Standard pdf-lib fonts folosesc WinAnsi encoding care nu suporta diacritice
 * romanesti. Mapam Ă/Â/Î/Ș/Ț la litere ASCII inainte de drawText pentru a
 * evita crash-ul "WinAnsi cannot encode".
 */
function safeText(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/î/g, 'i').replace(/Î/g, 'I')
    .replace(/ș/g, 's').replace(/Ș/g, 'S').replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T').replace(/ţ/g, 't').replace(/Ţ/g, 'T')
}

function drawSafe(page: PDFPage, text: string, opts: Parameters<PDFPage['drawText']>[1]): void {
  page.drawText(safeText(text), opts)
}

/**
 * Truncate cu "…" dacă textul depăşeşte maxWidth, ţinând cont de safeText
 * (string-ul efectiv desenat). Folosit per cell în tabele ca să nu se
 * suprapună text-ul peste coloana următoare.
 */
function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const safe = safeText(text)
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe
  const ELLIPSIS = '…'
  let lo = 0
  let hi = safe.length
  // Binary search pentru cel mai lung prefix care încape cu ellipsis.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = safe.slice(0, mid).trimEnd() + ELLIPSIS
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return safe.slice(0, lo).trimEnd() + ELLIPSIS
}

const MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']
function formatDateRo(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS_RO[m - 1]} ${y}`
}
function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return 'Perioada nedefinita'
  if (!end) return `din ${formatDateRo(start)}`
  return `${formatDateRo(start)} – ${formatDateRo(end)}`
}
function formatMonthRange(from: string | null | undefined, to: string | null | undefined): string {
  function fmt(s: string): string {
    const [y, m] = s.split('-').map(Number)
    return `${MONTHS_RO[m - 1]} ${y}`
  }
  if (from && to) return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
  if (from) return `din ${fmt(from)}`
  if (to) return `pana in ${fmt(to)}`
  return 'Toate campaniile'
}

const STATUS_LABELS_RO: Record<string, string> = {
  draft: 'Draft',
  active: 'Activa',
  in_review: 'In review',
  completed: 'Finalizata',
  cancelled: 'Anulata',
}
function statusLabel(s: string): string {
  return STATUS_LABELS_RO[s] ?? s
}

function drawTextRight(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const safe = safeText(text)
  const w = opts.font.widthOfTextAtSize(safe, opts.size) + (opts.tracking ?? 0) * (safe.length - 1)
  page.drawText(safe, {
    x: opts.x - w,
    y: opts.y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
  })
}
function drawTextCenter(
  page: PDFPage,
  text: string,
  opts: { y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const safe = safeText(text)
  const w = opts.font.widthOfTextAtSize(safe, opts.size) + (opts.tracking ?? 0) * (safe.length - 1)
  page.drawText(safe, {
    x: (PAGE.width - w) / 2,
    y: opts.y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
  })
}
function drawFooter(page: PDFPage, assets: Assets, pageNo: number, totalPages: number): void {
  const y = MARGIN.y - 24
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: y - FOOTER_H / 2,
    width: FOOTER_W,
    height: FOOTER_H,
  })
  drawTextRight(page, `${pageNo} / ${totalPages}`, {
    x: PAGE.width - MARGIN.x,
    y: y - 3,
    font: assets.sans,
    size: 8,
    color: COLORS.textFaint,
  })
}

export async function generateCampaignReportPDF(
  campaigns: ReportCampaign[],
  filters: ReportFilters,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Raport campanii — Influence Room')
  doc.setAuthor('Influence Room')
  doc.setProducer('Influence Room app')

  const fonts: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  const wordmark = await doc.embedPng(decodeWordmarkPng())
  const assets: Assets = { ...fonts, wordmark }

  drawCover(doc, assets, campaigns, filters)
  drawTable(doc, assets, campaigns)

  const pages = doc.getPages()
  const total = pages.length
  pages.forEach((p, i) => drawFooter(p, assets, i + 1, total))

  return doc.save()
}

export function getCampaignReportStoragePath(timestamp: number, from: string | null, to: string | null): string {
  const slug = from && to ? `${from}-${to}` : from ? `${from}-onwards` : to ? `until-${to}` : 'all'
  return `_reports/${timestamp}-${slug}.pdf`
}

function drawCover(
  doc: PDFDocument,
  assets: Assets,
  campaigns: ReportCampaign[],
  filters: ReportFilters,
): void {
  const page = doc.addPage([PAGE.width, PAGE.height])

  const wordmarkBottom = PAGE.height - MARGIN.y - WORDMARK_H
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: wordmarkBottom,
    width: WORDMARK_W,
    height: WORDMARK_H,
  })
  drawTextRight(page, 'RAPORT CAMPANII', {
    x: PAGE.width - MARGIN.x,
    y: wordmarkBottom + (WORDMARK_H - 9) / 2 + 1,
    font: assets.sansBold,
    size: 9,
    color: COLORS.textFaint,
    tracking: 1.5,
  })

  const titleY = PAGE.height / 2 + 80
  drawTextCenter(page, formatMonthRange(filters.monthFrom, filters.monthTo), {
    y: titleY,
    font: assets.serifBold,
    size: 30,
    color: COLORS.obsidian,
  })

  page.drawRectangle({
    x: (PAGE.width - 80) / 2,
    y: titleY - 18,
    width: 80,
    height: 2,
    color: COLORS.brand,
  })

  const lines: string[] = []
  if (filters.statuses && filters.statuses.length > 0) {
    lines.push(`Status: ${filters.statuses.map(statusLabel).join(', ')}`)
  }
  if (filters.brandName) lines.push(`Brand: ${filters.brandName}`)
  if (filters.ownerName) lines.push(`Owner: ${filters.ownerName}`)
  if (filters.search) lines.push(`Cautare: "${filters.search}"`)

  let y = titleY - 50
  for (const line of lines) {
    drawTextCenter(page, line, {
      y,
      font: assets.sans,
      size: 11,
      color: COLORS.textMuted,
    })
    y -= 16
  }

  drawTextCenter(page, `Total: ${campaigns.length} ${campaigns.length === 1 ? 'campanie' : 'campanii'}`, {
    y: y - 30,
    font: assets.sansBold,
    size: 16,
    color: COLORS.brand,
  })

  const now = new Date().toISOString().slice(0, 10)
  drawTextCenter(page, `Generat la ${formatDateRo(now)}`, {
    y: MARGIN.y + 20,
    font: assets.sans,
    size: 9,
    color: COLORS.textFaint,
  })
}

function drawTable(doc: PDFDocument, assets: Assets, campaigns: ReportCampaign[]): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  drawSafe(page, 'Campanii', {
    x: MARGIN.x,
    y: y - 20,
    font: assets.serifBold,
    size: 22,
    color: COLORS.obsidian,
  })
  y -= 50

  if (campaigns.length === 0) {
    drawSafe(page, 'Nicio campanie potrivita filtrelor.', {
      x: MARGIN.x,
      y,
      font: assets.sans,
      size: 11,
      color: COLORS.textMuted,
    })
    return
  }

  const cols = [
    { label: 'Nume', w: 140 },
    { label: 'Brand', w: 90 },
    { label: 'Status', w: 70 },
    { label: 'Perioada', w: 110 },
    { label: '# Part.', w: 50 },
    { label: 'Buget', w: 80 },
  ]
  const drawHeader = (target: PDFPage, yy: number) => {
    let cx = MARGIN.x
    target.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      drawSafe(target, c.label.toUpperCase(), {
        x: cx + 6,
        y: yy + 4,
        font: assets.sansBold,
        size: 8,
        color: COLORS.textMuted,
      })
      cx += c.w
    }
  }
  drawHeader(page, y)
  y -= 18

  let totalBudget = 0
  let row = 0
  for (const c of campaigns) {
    if (y < MARGIN.y + 60) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(page, y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const rawValues = [
      c.name,
      c.brand_name ?? '—',
      statusLabel(c.status),
      formatPeriod(c.start_date, c.end_date),
      String(c.participants_count),
      c.total_budget != null ? formatEur(c.total_budget) : '—',
    ]
    // Cell padding intern 6px stânga + 6px buffer dreapta = 12px deduce din w.
    const values = rawValues.map((v, i) => truncateToWidth(v, assets.sans, 10, cols[i].w - 12))
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      drawSafe(page, values[i], {
        x: cx + 6,
        y: y,
        font: assets.sans,
        size: 10,
        color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    if (c.total_budget != null) totalBudget += c.total_budget
    y -= 18
    row++
  }

  y -= 12
  drawTextRight(page, `Buget cumulat: ${formatEur(totalBudget)}`, {
    x: PAGE.width - MARGIN.x,
    y,
    font: assets.sansBold,
    size: 12,
    color: COLORS.brand,
  })
}
