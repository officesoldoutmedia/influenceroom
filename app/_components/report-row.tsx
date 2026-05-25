'use client'

import Link from 'next/link'
import { formatKpiSummary, type ReportEntry } from '@/lib/reports/types'

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'acum câteva secunde'
  if (diffMin < 60) return `acum ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `acum ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `acum ${diffD} zile`
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ReportRow({
  report,
  showCampaign = false,
  onEdit,
  onDelete,
}: {
  report: ReportEntry
  showCampaign?: boolean
  onEdit: (report: ReportEntry) => void
  onDelete: (report: ReportEntry) => void
}) {
  const uploadedBy = pickOne(report.uploaded_by)
  const campaign = pickOne(report.campaign)

  return (
    <tr className="hover:bg-stone-50 transition-colors">
      <td className="px-4 py-3">
        {report.signedUrl ? (
          <a
            href={report.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-stone-900 hover:text-brand-700 underline-offset-2 hover:underline"
          >
            {report.file_name}
          </a>
        ) : (
          <span className="text-stone-600">{report.file_name}</span>
        )}
        {report.file_size_bytes != null && (
          <span className="text-xs text-stone-400 ml-2">({(report.file_size_bytes / 1024).toFixed(1)} KB)</span>
        )}
      </td>
      {showCampaign && (
        <td className="px-4 py-3 text-stone-600">
          {campaign ? (
            <Link
              href={`/campaigns/${campaign.id}`}
              className="hover:text-brand-700 underline-offset-2 hover:underline"
            >
              {campaign.name}
            </Link>
          ) : (
            '—'
          )}
        </td>
      )}
      <td className="px-4 py-3 text-stone-600 tabular-nums">{formatKpiSummary(report)}</td>
      <td className="px-4 py-3 text-stone-500" title={new Date(report.uploaded_at).toLocaleString('ro-RO')}>
        {formatRelative(report.uploaded_at)}
      </td>
      <td className="px-4 py-3 text-stone-600">{uploadedBy?.name ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={() => onEdit(report)} className="text-xs text-stone-600 hover:text-brand-700 mr-2">
          Edit
        </button>
        <button type="button" onClick={() => onDelete(report)} className="text-xs text-rose-600 hover:text-rose-800">
          Şterge
        </button>
      </td>
    </tr>
  )
}
