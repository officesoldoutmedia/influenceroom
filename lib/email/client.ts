import { Resend } from 'resend'

export const APP_URL = process.env.APP_URL || 'https://influenceroom.office-2e5.workers.dev'

export type SendArgs = {
  to: string
  subject: string
  html: string
  text: string
}

export type SendResult = { id: string | null; simulated: boolean }

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[email simulated] to=${args.to} subject="${args.subject}"`)
    return { id: null, simulated: true }
  }

  const sender = process.env.EMAIL_SENDER || 'notify@influenceroom.local'
  const replyTo = process.env.EMAIL_REPLY_TO || undefined
  const resend = new Resend(apiKey)

  const result = await resend.emails.send({
    from: `Influencer Room <${sender}>`,
    to: [args.to],
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo,
  })

  if (result.error) {
    throw new Error(result.error.message ?? 'Resend send failed')
  }
  return { id: result.data?.id ?? null, simulated: false }
}
