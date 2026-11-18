import { renderEmail } from './layout.js';

import type { EmailMessage } from '../../email/email-sender.js';

export const VERIFY_EMAIL_SUBJECT = 'Confirma tu email en Hogaria';

/** Email de verificación (spec 01 §7, RN-01-11/12): el enlace caduca en 24 h. */
export function verifyEmail({ to, name, url }: { to: string; name: string; url: string }): EmailMessage {
  return renderEmail({
    to,
    subject: VERIFY_EMAIL_SUBJECT,
    intro: [`Hola, ${name}. Pulsa el botón para activar tu cuenta de Hogaria.`],
    button: { label: 'Confirmar email', url },
    footer: 'El enlace caduca en 24 horas. Si no has creado una cuenta, ignora este email.',
  });
}
