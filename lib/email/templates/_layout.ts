// HTML escape for user-controlled content interpolated into email bodies.
export function esc(s: string | number | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:18px 24px;border-bottom:1px solid #f5f5f4;">
            <span style="font-size:14px;font-weight:600;color:#1c1917;letter-spacing:-0.01em;">Influencer Room</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;color:#292524;font-size:14px;line-height:1.6;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;border-top:1px solid #f5f5f4;font-size:11px;color:#a8a29e;line-height:1.5;">
            Acest email vine de la Influencer Room. Te poți dezabona din Settings.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export const button = (label: string, href: string): string =>
  `<p style="margin:18px 0;"><a href="${href}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">${esc(label)}</a></p>`

export const card = (inner: string): string =>
  `<div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:14px 16px;margin:14px 0;">${inner}</div>`
