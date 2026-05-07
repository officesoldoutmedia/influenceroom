'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type TemplateRow = {
  id: string
  name: string
  description: string | null
  default_duration_days: number
  active: boolean
  groups_count: number
  tasks_count: number
  campaigns_count: number
}

type ApiResp = { ok?: boolean; error?: string; soft_deleted?: boolean; campaigns_count?: number }

export function TemplatesListUI({
  items,
  role,
}: {
  items: TemplateRow[]
  role: string
}) {
  const router = useRouter()
  const canWrite = role === 'owner'

  async function deleteTemplate(t: TemplateRow) {
    if (t.campaigns_count > 0) {
      const ok = confirm(
        `${t.campaigns_count} campanii folosesc template-ul "${t.name}". ` +
          `Nu se poate hard-delete. OK = soft delete (active=false, dispare din selector pentru campanii noi).`,
      )
      if (!ok) return
    } else {
      if (!confirm(`Șterg definitiv template-ul "${t.name}"?`)) return
    }
    const res = await fetch(`/api/admin/templates/${t.id}`, { method: 'DELETE' })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    if (res.ok) {
      router.refresh()
    } else {
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <p className="text-stone-500 text-sm mb-4">Niciun template încă.</p>
        {canWrite && (
          <Link href="/admin/templates/new" className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 inline-block">
            Creează primul template
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr className="text-left text-stone-500">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium text-right">Duration</th>
            <th className="px-4 py-3 font-medium text-right">Groups</th>
            <th className="px-4 py-3 font-medium text-right">Tasks</th>
            <th className="px-4 py-3 font-medium text-right">Campaigns</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((t) => (
            <tr key={t.id} className={t.active ? '' : 'opacity-60'}>
              <td className="px-4 py-3">
                <Link href={`/admin/templates/${t.id}`} className="font-medium text-stone-900 hover:text-brand-800">
                  {t.name}
                </Link>
                {t.description && (
                  <div className="text-xs text-stone-500 line-clamp-1 max-w-md">{t.description}</div>
                )}
              </td>
              <td className="px-4 py-3 text-stone-600 text-right">{t.default_duration_days} d</td>
              <td className="px-4 py-3 text-stone-600 text-right">{t.groups_count}</td>
              <td className="px-4 py-3 text-stone-600 text-right">{t.tasks_count}</td>
              <td className="px-4 py-3 text-stone-600 text-right">{t.campaigns_count}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
                  {t.active ? 'active' : 'inactive'}
                </span>
              </td>
              {canWrite && (
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/templates/${t.id}/edit`} className="px-3 py-1 rounded text-xs bg-stone-100 hover:bg-stone-200 text-stone-700">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(t)}
                      className="px-3 py-1 rounded text-xs bg-rose-50 hover:bg-rose-100 text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
