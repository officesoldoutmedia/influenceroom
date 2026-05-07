import { layout, esc, button, card } from './_layout'

export type TaskStatusChangedParams = {
  taskTitle: string
  campaignName: string
  oldStatus: string
  newStatus: string
  changedByName: string
  taskUrl: string
}

export function taskStatusChanged(p: TaskStatusChangedParams) {
  const subject = `${p.taskTitle} → ${p.newStatus}`
  const html = layout(`
    <p><strong>${esc(p.changedByName)}</strong> a schimbat statusul unui task.</p>
    ${card(`
      <div style="font-weight:600;color:#1c1917;margin-bottom:6px;">${esc(p.taskTitle)}</div>
      <div style="color:#57534e;font-size:13px;">Campania: ${esc(p.campaignName)}</div>
      <div style="color:#57534e;font-size:13px;margin-top:6px;">
        <span style="color:#a8a29e;text-decoration:line-through;">${esc(p.oldStatus)}</span>
        &nbsp;→&nbsp;
        <strong style="color:#1c1917;">${esc(p.newStatus)}</strong>
      </div>
    `)}
    ${button('Vezi task-ul', p.taskUrl)}
  `)
  const text = `${p.changedByName} a schimbat statusul task-ului "${p.taskTitle}" (${p.campaignName}) de la ${p.oldStatus} la ${p.newStatus}.

Vezi task-ul: ${p.taskUrl}
`
  return { subject, html, text }
}
