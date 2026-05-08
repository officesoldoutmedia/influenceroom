'use client'

import { useEffect, useRef, useState } from 'react'
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
  TASK_STATUSES,
  TASK_PRIORITIES,
  type Task,
  type TaskGroup,
  type TaskStatus,
  type TaskPriority,
} from '@/lib/campaigns/types'

type Member = { id: string; name: string; role: string; avatar_url: string | null }

export type TaskWithAssignee = Task & {
  assignee: { id: string; name: string; avatar_url: string | null } | null
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-stone-200 text-stone-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-amber-100 text-amber-800',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-stone-100 text-stone-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-rose-100 text-rose-700',
}

type ApiTask = { ok?: boolean; error?: string; task?: TaskWithAssignee }
type ApiGroup = { ok?: boolean; error?: string; group?: TaskGroup }

export function BoardUI({
  campaignId,
  initialGroups,
  initialTasks,
  members,
  canEdit,
  currentUserId,
}: {
  campaignId: string
  initialGroups: TaskGroup[]
  initialTasks: TaskWithAssignee[]
  members: Member[]
  canEdit: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [groups, setGroups] = useState<TaskGroup[]>(initialGroups)
  const [tasks, setTasks] = useState<TaskWithAssignee[]>(initialTasks)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<TaskWithAssignee | null>(null)
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)
  const [addingTaskInGroup, setAddingTaskInGroup] = useState<string | null>(null)
  const [addingTaskTitle, setAddingTaskTitle] = useState('')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setGroups(initialGroups), [initialGroups])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTasks(initialTasks), [initialTasks])

  function tasksOf(groupId: string): TaskWithAssignee[] {
    return tasks.filter((t) => t.group_id === groupId)
  }

  function toggleCollapse(gid: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(gid)) next.delete(gid)
      else next.add(gid)
      return next
    })
  }

  async function patchTask(id: string, patch: Partial<TaskWithAssignee>) {
    const prev = tasks.find((t) => t.id === id)
    if (!prev) return
    // Optimistic
    setTasks((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = (await res.json().catch(() => ({}))) as ApiTask
    if (!res.ok || !data.task) {
      // Rollback
      setTasks((all) => all.map((t) => (t.id === id ? prev : t)))
      alert(`Eroare: ${data.error ?? 'server_error'}`)
      return
    }
    setTasks((all) => all.map((t) => (t.id === id ? data.task! : t)))
  }

  async function deleteTask(id: string, title: string) {
    if (!confirm(`Șterg task "${title}"?`)) return
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks((all) => all.filter((t) => t.id !== id))
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  async function addTask(groupId: string, title: string) {
    if (!title.trim()) return
    const res = await fetch(`/api/campaigns/${campaignId}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, title }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiTask
    if (res.ok && data.task) {
      setTasks((all) => [...all, data.task!])
      setAddingTaskTitle('')
    } else {
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  async function deleteGroup(g: TaskGroup) {
    const groupTasks = tasksOf(g.id)
    if (!confirm(`Șterg grup "${g.name}"? ${groupTasks.length} task-uri vor fi șterse.`)) return
    const res = await fetch(`/api/task-groups/${g.id}`, { method: 'DELETE' })
    if (res.ok) {
      setGroups((all) => all.filter((x) => x.id !== g.id))
      setTasks((all) => all.filter((t) => t.group_id !== g.id))
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  function canEditTask(t: TaskWithAssignee): boolean {
    if (canEdit) return true
    return t.assignee_id === currentUserId
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function persistGroupOrder(order: TaskGroup[]) {
    const res = await fetch(`/api/campaigns/${campaignId}/board/reorder`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: order.map((g, i) => ({ id: g.id, position: i + 1 })),
      }),
    })
    if (!res.ok) {
      setGroups(initialGroups)
      alert('Reorder eșuat')
    }
  }

  async function persistTaskOrder(groupId: string | null, order: TaskWithAssignee[]) {
    const res = await fetch(`/api/campaigns/${campaignId}/board/reorder`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tasks: order.map((t, i) => ({ id: t.id, position: i, group_id: groupId })),
      }),
    })
    if (!res.ok) {
      setTasks(initialTasks)
      alert('Reorder eșuat')
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type as 'task' | 'group' | undefined

    if (activeType === 'group') {
      const oldIndex = groups.findIndex((g) => g.id === active.id)
      const newIndex = groups.findIndex((g) => g.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(groups, oldIndex, newIndex)
      setGroups(newOrder)
      void persistGroupOrder(newOrder)
    } else if (activeType === 'task') {
      const activeGroupId = (active.data.current?.groupId as string | null | undefined) ?? null
      const overGroupId = (over.data.current?.groupId as string | null | undefined) ?? null
      if (activeGroupId !== overGroupId) {
        // Cross-group drag deferred. Use Edit modal → Group dropdown to move tasks between groups.
        return
      }
      const groupTasks = tasks.filter((t) => t.group_id === activeGroupId)
      const oldIndex = groupTasks.findIndex((t) => t.id === active.id)
      const newIndex = groupTasks.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(groupTasks, oldIndex, newIndex)
      const otherTasks = tasks.filter((t) => t.group_id !== activeGroupId)
      setTasks([...otherTasks, ...newOrder])
      void persistTaskOrder(activeGroupId, newOrder)
    }
  }

  return (
    <>
      {groups.length === 0 && tasks.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-xl py-10 px-6 sm:py-14 text-center mb-6">
          <p className="font-display text-lg text-stone-900 mb-1">Niciun grup adăugat încă</p>
          <p className="text-sm text-stone-500 mb-5">
            Campania pornește goală. Crează primul grup și adaugă taskuri pentru ce trebuie făcut.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAddingGroup(true)}
              className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-brand-700 text-white text-sm font-medium hover:bg-brand-800"
            >
              + Adaugă primul grup
            </button>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {groups.map((g) => (
              <SortableGroupSection
                key={g.id}
                group={g}
                tasks={tasksOf(g.id)}
                members={members}
                canEdit={canEdit}
                canEditTask={canEditTask}
                isCollapsed={collapsed.has(g.id)}
                onToggleCollapse={() => toggleCollapse(g.id)}
                onEditGroup={() => setEditingGroup(g)}
                onDeleteGroup={() => deleteGroup(g)}
                onPatchTask={patchTask}
                onEditTask={(t) => setEditing(t)}
                onDeleteTask={(t) => deleteTask(t.id, t.title)}
                addingTask={addingTaskInGroup === g.id}
                addingTaskTitle={addingTaskTitle}
                onSetAddingTaskTitle={setAddingTaskTitle}
                onStartAddTask={() => setAddingTaskInGroup(g.id)}
                onCancelAddTask={() => {
                  setAddingTaskInGroup(null)
                  setAddingTaskTitle('')
                }}
                onSubmitAddTask={async () => {
                  await addTask(g.id, addingTaskTitle)
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {canEdit && (
        <div className="mt-6 pt-4 border-t border-stone-100">
          {addingGroup ? (
            <AddGroupForm
              campaignId={campaignId}
              onClose={() => setAddingGroup(false)}
              onCreated={(g) => {
                setGroups((all) => [...all, g])
                setAddingGroup(false)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingGroup(true)}
              className="text-sm text-stone-500 hover:text-brand-800"
            >
              + Add group
            </button>
          )}
        </div>
      )}

      {editing && (
        <EditTaskModal
          task={editing}
          groups={groups}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setTasks((all) => all.map((x) => (x.id === t.id ? t : x)))
            setEditing(null)
          }}
        />
      )}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSaved={(g) => {
            setGroups((all) => all.map((x) => (x.id === g.id ? g : x)))
            setEditingGroup(null)
          }}
        />
      )}
    </>
  )
}

const menuItemCls = 'block w-full text-left px-3 py-1.5 text-xs hover:bg-stone-100 rounded'

function SortableGroupSection({
  group,
  tasks,
  members,
  canEdit,
  canEditTask,
  isCollapsed,
  onToggleCollapse,
  onEditGroup,
  onDeleteGroup,
  onPatchTask,
  onEditTask,
  onDeleteTask,
  addingTask,
  addingTaskTitle,
  onSetAddingTaskTitle,
  onStartAddTask,
  onCancelAddTask,
  onSubmitAddTask,
}: {
  group: TaskGroup
  tasks: TaskWithAssignee[]
  members: Member[]
  canEdit: boolean
  canEditTask: (t: TaskWithAssignee) => boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onEditGroup: () => void
  onDeleteGroup: () => void
  onPatchTask: (id: string, patch: Partial<TaskWithAssignee>) => void | Promise<void>
  onEditTask: (t: TaskWithAssignee) => void
  onDeleteTask: (t: TaskWithAssignee) => void | Promise<void>
  addingTask: boolean
  addingTaskTitle: string
  onSetAddingTaskTitle: (s: string) => void
  onStartAddTask: () => void
  onCancelAddTask: () => void
  onSubmitAddTask: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { type: 'group' },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const taskIds = tasks.map((t) => t.id)
  return (
    <section ref={setNodeRef} style={style} className="border-t border-stone-100 pt-3">
      <header className="flex items-center justify-between mb-2 gap-2">
        {canEdit && (
          <span
            {...attributes}
            {...listeners}
            className="text-stone-400 cursor-grab active:cursor-grabbing select-none px-1"
            title="Drag to reorder group"
          >
            ⋮⋮
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left flex-1 hover:opacity-80"
        >
          <span className="text-stone-400 w-3 inline-block">{isCollapsed ? '▸' : '▾'}</span>
          <h3 className="text-sm font-semibold text-stone-900">
            {group.position}. {group.name}
          </h3>
          <span className="text-xs text-stone-500 ml-2">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            {group.due_date && ` · due ${group.due_date}`}
          </span>
        </button>
        {canEdit && (
          <RowMenu>
            <button onClick={onEditGroup} className={menuItemCls}>Edit</button>
            <button onClick={onDeleteGroup} className={`${menuItemCls} text-rose-600`}>Delete</button>
          </RowMenu>
        )}
      </header>

      {!isCollapsed && (
        <>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-stone-100">
              {tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  members={members}
                  canEdit={canEditTask(t)}
                  canFullEdit={canEdit}
                  onPatch={(patch) => onPatchTask(t.id, patch)}
                  onEdit={() => onEditTask(t)}
                  onDelete={() => onDeleteTask(t)}
                />
              ))}
              {tasks.length === 0 && (
                <li className="py-2 text-xs text-stone-400 italic">Niciun task în acest grup.</li>
              )}
            </ul>
          </SortableContext>

          {canEdit && (
            <div className="mt-2 pl-6">
              {addingTask ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    await onSubmitAddTask()
                  }}
                >
                  <input
                    value={addingTaskTitle}
                    onChange={(e) => onSetAddingTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') onCancelAddTask()
                    }}
                    onBlur={() => {
                      if (!addingTaskTitle.trim()) onCancelAddTask()
                    }}
                    autoFocus
                    placeholder="Task title — Enter to save, Esc to cancel"
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={onStartAddTask}
                  className="text-xs text-stone-500 hover:text-brand-800"
                >
                  + Add task
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function RowMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"
        aria-label="Actions"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-32 bg-white border border-stone-200 rounded-lg shadow-lg z-10 py-1">
          {children}
        </div>
      )}
    </div>
  )
}

function TaskRow({
  task,
  members,
  canEdit,
  canFullEdit,
  onPatch,
  onEdit,
  onDelete,
}: {
  task: TaskWithAssignee
  members: Member[]
  canEdit: boolean
  canFullEdit: boolean
  onPatch: (patch: Partial<TaskWithAssignee>) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', groupId: task.group_id },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <li ref={setNodeRef} style={style} className="py-2 flex items-center gap-2 text-sm">
      {canFullEdit ? (
        <span
          {...attributes}
          {...listeners}
          className="w-3 text-stone-400 cursor-grab active:cursor-grabbing select-none"
          title="Drag to reorder within group"
        >
          ⋮⋮
        </span>
      ) : (
        <span className="w-3 text-stone-200 select-none">⋮⋮</span>
      )}

      <select
        value={task.status}
        disabled={!canEdit}
        onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}
        className={`text-[10px] uppercase tracking-wide font-medium px-2 py-1 rounded-full border-0 ${STATUS_BADGE[task.status]} disabled:opacity-50`}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>

      <span className="flex-1 text-stone-900 truncate">{task.title}</span>

      <select
        value={task.priority}
        disabled={!canFullEdit}
        onChange={(e) => onPatch({ priority: e.target.value as TaskPriority })}
        className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border-0 ${PRIORITY_BADGE[task.priority]} disabled:opacity-50`}
      >
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        value={task.assignee_id ?? ''}
        disabled={!canFullEdit}
        onChange={(e) => onPatch({ assignee_id: e.target.value || null })}
        className="text-xs border border-stone-200 rounded px-2 py-1 bg-white disabled:opacity-50 max-w-[140px]"
      >
        <option value="">— Unassigned —</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <input
        type="date"
        value={task.due_date ?? ''}
        disabled={!canFullEdit}
        onChange={(e) => onPatch({ due_date: e.target.value || null })}
        className="text-xs border border-stone-200 rounded px-2 py-1 bg-white disabled:opacity-50 w-32"
      />

      {canFullEdit && (
        <RowMenu>
          <button onClick={onEdit} className={menuItemCls}>Edit</button>
          <button onClick={onDelete} className={`${menuItemCls} text-rose-600`}>Delete</button>
        </RowMenu>
      )}
    </li>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary =
  'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
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

function EditTaskModal({
  task,
  groups,
  members,
  onClose,
  onSaved,
}: {
  task: TaskWithAssignee
  groups: TaskGroup[]
  members: Member[]
  onClose: () => void
  onSaved: (t: TaskWithAssignee) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [groupId, setGroupId] = useState(task.group_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
        group_id: groupId || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiTask
    setBusy(false)
    if (res.ok && data.task) onSaved(data.task)
    else setError(data.error ?? 'server_error')
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit task</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputCls}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputCls}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Assignee">
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
              <option value="">— Unassigned —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Group">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
            <option value="">— No group —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.position}. {g.name}</option>)}
          </select>
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Save'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditGroupModal({
  group,
  onClose,
  onSaved,
}: {
  group: TaskGroup
  onClose: () => void
  onSaved: (g: TaskGroup) => void
}) {
  const [name, setName] = useState(group.name)
  const [dueDate, setDueDate] = useState(group.due_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/task-groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, due_date: dueDate || null }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiGroup
    setBusy(false)
    if (res.ok && data.group) onSaved(data.group)
    else setError(data.error ?? 'server_error')
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit group</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Save'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function AddGroupForm({
  campaignId,
  onClose,
  onCreated,
}: {
  campaignId: string
  onClose: () => void
  onCreated: (g: TaskGroup) => void
}) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, due_date: dueDate || null }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiGroup
    setBusy(false)
    if (res.ok && data.group) onCreated(data.group)
    else setError(data.error ?? 'server_error')
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        required
        className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm"
      />
      <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Add'}</button>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
      {error && <span className="text-sm text-rose-600 ml-2">{error}</span>}
    </form>
  )
}
