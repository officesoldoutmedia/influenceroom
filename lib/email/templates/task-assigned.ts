import { layout, esc, button, card } from './_layout'

export type TaskAssignedParams = {
  assigneeName: string
  taskTitle: string
  campaignName: string
  dueDate?: string | null
  assignedByName: string
  taskUrl: string
}

export function taskAssigned(p: TaskAssignedParams) {
  const due = p.dueDate ? p.dueDate : 'fără deadline'
  const subject = `Task nou: ${p.taskTitle}`
  const html = layout(`
    <p>Salut <strong>${esc(p.assigneeName)}</strong>,</p>
    <p><strong>${esc(p.assignedByName)}</strong> ți-a asignat un task nou.</p>
    ${card(`
      <div style="font-weight:600;color:#1c1917;margin-bottom:6px;">${esc(p.taskTitle)}</div>
      <div style="color:#57534e;font-size:13px;">Campania: ${esc(p.campaignName)}</div>
      <div style="color:#57534e;font-size:13px;">Deadline: ${esc(due)}</div>
    `)}
    ${button('Vezi task-ul', p.taskUrl)}
  `)
  const text = `Salut ${p.assigneeName},

${p.assignedByName} ți-a asignat task-ul "${p.taskTitle}" din campania "${p.campaignName}".
Deadline: ${due}

Vezi task-ul: ${p.taskUrl}
`
  return { subject, html, text }
}
