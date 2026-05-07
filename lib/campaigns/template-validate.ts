import { TASK_PRIORITIES, type TaskPriority } from './types'

const ALLOWED_ROLES = new Set(['owner', 'manager', 'account', 'intern'])

export type TemplateInput = {
  name?: string
  description?: string | null
  default_duration_days?: number
  active?: boolean
  default_task_groups?: unknown
}

export type ValidatedTemplate = {
  name: string
  description: string | null
  default_duration_days: number
  active: boolean
  default_task_groups: NormalizedGroup[]
}

export type NormalizedGroup = {
  name: string
  position: number
  due_offset_days: number
  tasks: NormalizedTask[]
}

export type NormalizedTask = {
  title: string
  description?: string
  role_default?: string
  priority: TaskPriority
}

export type ValidateResult =
  | { ok: true; data: ValidatedTemplate }
  | { ok: false; error: string; detail?: string }

export function validateTemplate(body: TemplateInput, partial = false): ValidateResult {
  const out: Partial<ValidatedTemplate> = {}

  if (!partial || body.name !== undefined) {
    const n = body.name?.trim() ?? ''
    if (n.length < 2 || n.length > 100) return { ok: false, error: 'invalid_name' }
    out.name = n
  }
  if (body.description !== undefined) {
    const d = body.description?.toString().trim() ?? ''
    if (d.length > 500) return { ok: false, error: 'description_too_long' }
    out.description = d || null
  }
  if (!partial || body.default_duration_days !== undefined) {
    const d = body.default_duration_days
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 365) {
      return { ok: false, error: 'invalid_duration' }
    }
    out.default_duration_days = d
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return { ok: false, error: 'invalid_active' }
    out.active = body.active
  }

  if (!partial || body.default_task_groups !== undefined) {
    if (!Array.isArray(body.default_task_groups) || body.default_task_groups.length === 0) {
      return { ok: false, error: 'no_groups' }
    }
    const groups: NormalizedGroup[] = []
    for (let gi = 0; gi < body.default_task_groups.length; gi++) {
      const g = body.default_task_groups[gi] as Record<string, unknown>
      if (!g || typeof g !== 'object') {
        return { ok: false, error: 'invalid_group', detail: `group ${gi}` }
      }
      const gname = typeof g.name === 'string' ? g.name.trim() : ''
      if (!gname || gname.length > 100) return { ok: false, error: 'invalid_group_name', detail: `group ${gi + 1}` }
      const offset = typeof g.due_offset_days === 'number' ? g.due_offset_days : Number(g.due_offset_days)
      if (!Number.isInteger(offset) || offset < -365 || offset > 365) {
        return { ok: false, error: 'invalid_group_offset', detail: `group ${gi + 1}` }
      }
      if (!Array.isArray(g.tasks) || g.tasks.length === 0) {
        return { ok: false, error: 'group_needs_task', detail: `group "${gname}"` }
      }
      const tasks: NormalizedTask[] = []
      for (let ti = 0; ti < g.tasks.length; ti++) {
        const t = g.tasks[ti] as Record<string, unknown>
        if (!t || typeof t !== 'object') {
          return { ok: false, error: 'invalid_task', detail: `group "${gname}" task ${ti + 1}` }
        }
        const ttitle = typeof t.title === 'string' ? t.title.trim() : ''
        if (ttitle.length < 2 || ttitle.length > 200) {
          return { ok: false, error: 'invalid_task_title', detail: `group "${gname}" task ${ti + 1}` }
        }
        const tdesc = typeof t.description === 'string' ? t.description.trim() : ''
        if (tdesc.length > 1000) {
          return { ok: false, error: 'task_description_too_long', detail: `group "${gname}" task ${ti + 1}` }
        }
        const trole = typeof t.role_default === 'string' && t.role_default ? t.role_default : ''
        if (trole && !ALLOWED_ROLES.has(trole)) {
          return { ok: false, error: 'invalid_task_role', detail: `group "${gname}" task ${ti + 1}` }
        }
        const tpriRaw = typeof t.priority === 'string' ? t.priority : 'normal'
        if (!(TASK_PRIORITIES as readonly string[]).includes(tpriRaw)) {
          return { ok: false, error: 'invalid_task_priority', detail: `group "${gname}" task ${ti + 1}` }
        }
        const out: NormalizedTask = { title: ttitle, priority: tpriRaw as TaskPriority }
        if (tdesc) out.description = tdesc
        if (trole) out.role_default = trole
        tasks.push(out)
      }
      groups.push({
        name: gname,
        position: gi + 1,
        due_offset_days: offset,
        tasks,
      })
    }
    out.default_task_groups = groups
  }

  return { ok: true, data: out as ValidatedTemplate }
}
