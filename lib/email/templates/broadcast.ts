import { layout, esc } from './_layout'

export type BroadcastParams = {
  recipientName: string
  senderName: string
  subject: string
  body: string
}

export function broadcast(p: BroadcastParams) {
  // Escape body, then turn newlines into paragraphs so plain-text composition
  // renders readably without exposing user input as HTML.
  const paragraphs = p.body
    .split(/\n{2,}/)
    .map((para) =>
      `<p style="margin:0 0 12px;">${esc(para).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('')

  const html = layout(`
    <p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
    ${paragraphs}
    <p style="margin-top:18px;color:#78716c;font-size:12px;">
      — ${esc(p.senderName)}, Influence Room
    </p>
  `)

  const text = `Salut ${p.recipientName},

${p.body}

— ${p.senderName}, Influence Room
`

  return { subject: p.subject, html, text }
}
