'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  TASK_PRIORITIES,
  type CampaignTemplate,
  type TaskPriority,
  type TemplateGroupDef,
  type TemplateTaskDef,
} from '@/lib/campaigns/types'

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Any' },
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'account', label: 'Account' },
  { value: 'intern', label: 'Intern' },
]

let DRAFT_ID = 0
function newId(prefix: string): string {
  DRAFT_ID += 1
  return `${prefix}-${DRAFT_ID}`
}

type TaskDraft = {
  _id: string
  title: string
  description: string
  role_default: string
  priority: TaskPriority
}

type GroupDraft = {
  _id: string
  name: string
  due_offset_days: number
  tasks: TaskDraft[]
}

type FormState = {
  name: string
  description: string
  default_duration_days: number
  active: boolean
  groups: GroupDraft[]
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    default_duration_days: 28,
    active: true,
    groups: [emptyGroup()],
  }
}

function emptyGroup(): GroupDraft {
  return { _id: newId('g'), name: '', due_offset_days: 0, tasks: [emptyTask()] }
}

function emptyTask(): TaskDraft {
  return { _id: newId('t'), title: '', description: '', role_default: '', priority: 'normal' }
}

function templateToForm(t: CampaignTemplate): FormState {
  return {
    name: t.name,
    description: t.description ?? '',
    default_duration_days: t.default_duration_days,
    active: t.active,
    groups: (t.default_task_groups ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((g) => ({
        _id: newId('g'),
        name: g.name,
        due_offset_days: g.due_offset_days,
        tasks: (g.tasks ?? []).map((task) => ({
          _id: newId('t'),
          title: task.title,
          description: task.description ?? '',
          role_default: task.role_default ?? '',
          priority: (task.priority ?? 'normal') as TaskPriority,
        })),
      })),
  }
}

function formToPayload(f: FormState) {
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    default_duration_days: f.default_duration_days,
    active: f.active,
    default_task_groups: f.groups.map((g, i): TemplateGroupDef => ({
      name: g.name.trim(),
      position: i + 1,
      due_offset_days: g.due_offset_days,
      tasks: g.tasks.map((t): TemplateTaskDef => ({
        title: t.title.trim(),
        ...(t.description.trim() ? { description: t.description.trim() } : {}),
        ...(t.role_default ? { role_default: t.role_default } : {}),
        priority: t.priority,
      })),
    })),
  }
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary =
  'px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'
const btnDanger =
  'px-3 py-1 rounded text-xs bg-rose-50 text-rose-700 hover:bg-rose-100'

function ErrorMap(code: string, detail?: string): string {
  const base = ({
    invalid_name: 'Numele e obligatoriu (2-100 caractere)',
    description_too_long: 'Descrierea e prea lungă (max 500 caractere)',
    invalid_duration: 'Durata trebuie 1-365 zile',
    invalid_active: 'Active trebuie boolean',
    no_groups: 'Cel puțin un grup obligatoriu',
    invalid_group: 'Grup invalid',
    invalid_group_name: 'Numele grupului e obligatoriu',
    invalid_group_offset: 'Offset grup invalid (-365..365)',
    group_needs_task: 'Fiecare grup are cel puțin un task',
    invalid_task: 'Task invalid',
    invalid_task_title: 'Titlu task obligatoriu (2-200 caractere)',
    task_description_too_long: 'Descriere task prea lungă (max 1000)',
    invalid_task_role: 'Rol task invalid',
    invalid_task_priority: 'Prioritate task invalidă',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
  return detail ? `${base} (${detail})` : base
}

type ApiResp = { ok?: boolean; error?: string; detail?: string; template?: CampaignTemplate }

export function TemplateForm({
  initialTemplate,
  isEdit,
}: {
  initialTemplate?: CampaignTemplate
  isEdit: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(
    initialTemplate ? templateToForm(initialTemplate) : emptyForm(),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function setName(v: string) { setForm({ ...form, name: v }) }
  function setDescription(v: string) { setForm({ ...form, description: v }) }
  function setDuration(v: number) { setForm({ ...form, default_duration_days: v }) }
  function setActive(v: boolean) { setForm({ ...form, active: v }) }

  function setGroup(gid: string, patch: Partial<GroupDraft>) {
    setForm({
      ...form,
      groups: form.groups.map((g) => (g._id === gid ? { ...g, ...patch } : g)),
    })
  }

  function addGroup() {
    setForm({ ...form, groups: [...form.groups, emptyGroup()] })
  }
  function removeGroup(gid: string) {
    const g = form.groups.find((x) => x._id === gid)
    if (g && g.tasks.length > 0 && !confirm(`Șterg grupul "${g.name || '(fără nume)'}" cu ${g.tasks.length} task-uri?`)) return
    setForm({ ...form, groups: form.groups.filter((x) => x._id !== gid) })
  }

  function addTask(gid: string) {
    setForm({
      ...form,
      groups: form.groups.map((g) =>
        g._id === gid ? { ...g, tasks: [...g.tasks, emptyTask()] } : g,
      ),
    })
  }
  function setTask(gid: string, tid: string, patch: Partial<TaskDraft>) {
    setForm({
      ...form,
      groups: form.groups.map((g) =>
        g._id !== gid
          ? g
          : { ...g, tasks: g.tasks.map((t) => (t._id === tid ? { ...t, ...patch } : t)) },
      ),
    })
  }
  function removeTask(gid: string, tid: string) {
    setForm({
      ...form,
      groups: form.groups.map((g) =>
        g._id !== gid ? g : { ...g, tasks: g.tasks.filter((t) => t._id !== tid) },
      ),
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const activeType = active.data.current?.type as 'group' | 'task' | undefined

    if (activeType === 'group') {
      const oldIdx = form.groups.findIndex((g) => g._id === active.id)
      const newIdx = form.groups.findIndex((g) => g._id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      setForm({ ...form, groups: arrayMove(form.groups, oldIdx, newIdx) })
    } else if (activeType === 'task') {
      const groupId = active.data.current?.groupId as string | undefined
      const overGroupId = over.data.current?.groupId as string | undefined
      if (!groupId || groupId !== overGroupId) return
      setForm({
        ...form,
        groups: form.groups.map((g) => {
          if (g._id !== groupId) return g
          const oldIdx = g.tasks.findIndex((t) => t._id === active.id)
          const newIdx = g.tasks.findIndex((t) => t._id === over.id)
          if (oldIdx === -1 || newIdx === -1) return g
          return { ...g, tasks: arrayMove(g.tasks, oldIdx, newIdx) }
        }),
      })
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload = formToPayload(form)
    const url = isEdit && initialTemplate ? `/api/admin/templates/${initialTemplate.id}` : '/api/admin/templates'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok) {
      router.push('/admin/templates')
      router.refresh()
    } else {
      setError(ErrorMap(data.error ?? 'server_error', data.detail))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Detalii template</h2>
        <Field label="Nume *">
          <input value={form.name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputCls} />
        </Field>
        <Field label="Descriere">
          <textarea value={form.description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className={textareaCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durată standard (zile) *">
            <input
              type="number"
              min={1}
              max={365}
              value={form.default_duration_days}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
              className={inputCls}
            />
          </Field>
          {isEdit && (
            <Field label="Status">
              <label className="flex items-center gap-2 mt-1">
                <input type="checkbox" checked={form.active} onChange={(e) => setActive(e.target.checked)} />
                <span className="text-sm text-stone-700">Activ (vizibil la create campanie)</span>
              </label>
            </Field>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-5">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Grupuri ({form.groups.length})
          </h2>
          <button type="button" onClick={addGroup} className={btnSecondary}>+ Add group</button>
        </header>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={form.groups.map((g) => g._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {form.groups.map((g, gi) => (
                <SortableGroupCard
                  key={g._id}
                  group={g}
                  position={gi + 1}
                  onPatch={(patch) => setGroup(g._id, patch)}
                  onRemove={() => removeGroup(g._id)}
                  onAddTask={() => addTask(g._id)}
                  onPatchTask={(tid, patch) => setTask(g._id, tid, patch)}
                  onRemoveTask={(tid) => removeTask(g._id, tid)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? '...' : isEdit ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function SortableGroupCard({
  group,
  position,
  onPatch,
  onRemove,
  onAddTask,
  onPatchTask,
  onRemoveTask,
}: {
  group: GroupDraft
  position: number
  onPatch: (p: Partial<GroupDraft>) => void
  onRemove: () => void
  onAddTask: () => void
  onPatchTask: (tid: string, p: Partial<TaskDraft>) => void
  onRemoveTask: (tid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group._id,
    data: { type: 'group' },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="border border-stone-200 rounded-lg p-3 bg-stone-50">
      <div className="flex items-center gap-2 mb-3">
        <span
          {...attributes}
          {...listeners}
          className="text-stone-400 cursor-grab active:cursor-grabbing select-none px-1"
          title="Drag to reorder group"
        >
          ⋮⋮
        </span>
        <span className="text-xs font-mono text-stone-500 w-6 text-center">{position}.</span>
        <input
          value={group.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Nume grup (ex: Pitch & Negotiation)"
          required
          maxLength={100}
          className={`${inputCls} flex-1`}
        />
        <label className="flex items-center gap-1 text-xs text-stone-600 whitespace-nowrap">
          T
          <input
            type="number"
            min={-365}
            max={365}
            value={group.due_offset_days}
            onChange={(e) => onPatch({ due_offset_days: Number(e.target.value) })}
            className="w-16 px-2 py-1 border border-stone-300 rounded text-sm text-right"
            title="Days from campaign start (T+0). Negative = before publish."
          />
        </label>
        <button type="button" onClick={onRemove} className={btnDanger}>Șterge grup</button>
      </div>

      <SortableContext items={group.tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {group.tasks.map((t) => (
            <SortableTaskRow
              key={t._id}
              task={t}
              groupId={group._id}
              onPatch={(patch) => onPatchTask(t._id, patch)}
              onRemove={() => onRemoveTask(t._id)}
            />
          ))}
        </ul>
      </SortableContext>

      <div className="mt-2">
        <button type="button" onClick={onAddTask} className="text-xs text-stone-500 hover:text-indigo-700">
          + Add task
        </button>
      </div>
    </div>
  )
}

function SortableTaskRow({
  task,
  groupId,
  onPatch,
  onRemove,
}: {
  task: TaskDraft
  groupId: string
  onPatch: (p: Partial<TaskDraft>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { type: 'task', groupId },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <li ref={setNodeRef} style={style} className="bg-white rounded-lg border border-stone-200 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span
          {...attributes}
          {...listeners}
          className="text-stone-400 cursor-grab active:cursor-grabbing select-none"
          title="Drag to reorder task"
        >
          ⋮⋮
        </span>
        <input
          value={task.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Titlu task"
          required
          maxLength={200}
          className={`${inputCls} flex-1`}
        />
        <select
          value={task.role_default}
          onChange={(e) => onPatch({ role_default: e.target.value })}
          className="text-xs border border-stone-300 rounded px-2 py-1 bg-white"
          title="Rol implicit"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={task.priority}
          onChange={(e) => onPatch({ priority: e.target.value as TaskPriority })}
          className="text-xs border border-stone-300 rounded px-2 py-1 bg-white"
          title="Prioritate"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button type="button" onClick={onRemove} className={btnDanger}>×</button>
      </div>
      <textarea
        value={task.description}
        onChange={(e) => onPatch({ description: e.target.value })}
        placeholder="Descriere (opțional, max 1000 caractere)"
        maxLength={1000}
        className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs focus:outline-none focus:border-indigo-600 min-h-[40px]"
      />
    </li>
  )
}
