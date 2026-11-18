import type { EmailMessage } from '../../email/email-sender.js';

/**
 * Maqueta común de los emails de Hogaria (spec 01 §7 "Emails"): HTML simple con
 * estilos en línea (los clientes de correo ignoran `<style>` y las fuentes web) y su
 * versión de texto plano.
 */
export interface EmailContent {
  to: string;
  subject: string;
  /** Párrafos antes del botón (texto plano: se escapan). */
  intro: string[];
  button: { label: string; url: string };
  /** Letra pequeña después del botón. */
  footer: string;
}

/** Tokens del tema claro de `apps/web/src/styles/tokens.css` (`--bg`, `--surface`, `--ink`, `--ink-muted`, `--primary`, `--on-primary`). */
const COLORS = {
  background: '#F4FAFA',
  card: '#FFFFFF',
  text: '#0B2A2C',
  muted: '#4A6668',
  button: '#0E817F',
  buttonText: '#FFFFFF',
} as const;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderEmail({ to, subject, intro, button, footer }: EmailContent): EmailMessage {
  const font = "font-family:'Barlow',Arial,Helvetica,sans-serif;";
  const paragraphs = intro
    .map((p) => `<p style="margin:0 0 16px;${font}font-size:16px;line-height:1.5;color:${COLORS.text};">${escapeHtml(p)}</p>`)
    .join('');
  const url = escapeHtml(button.url);

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.background};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:24px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLORS.card};border-radius:12px;padding:32px 24px;">
<tr><td>
<p style="margin:0 0 24px;${font}font-size:22px;font-weight:700;letter-spacing:0.02em;color:${COLORS.button};">Hogaria</p>
${paragraphs}
<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:${COLORS.button};color:${COLORS.buttonText};${font}font-size:16px;font-weight:600;text-decoration:none;">${escapeHtml(button.label)}</a></p>
<p style="margin:0 0 16px;${font}font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(footer)}</p>
<p style="margin:0;${font}font-size:12px;line-height:1.5;color:${COLORS.muted};word-break:break-all;">Si el botón no funciona, copia este enlace en el navegador:<br><a href="${url}" style="color:${COLORS.button};">${url}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [...intro, '', `${button.label}: ${button.url}`, '', footer, ''].join('\n');
  return { to, subject, text, html };
}
