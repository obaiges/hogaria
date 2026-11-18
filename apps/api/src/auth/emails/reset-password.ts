import { renderEmail } from './layout.js';

import type { EmailMessage } from '../../email/email-sender.js';

export const RESET_PASSWORD_SUBJECT = 'Restablece tu contraseña de Hogaria';

/** Email de restablecimiento (spec 01 §7, RN-01-16/17): caduca en 30 min y es de un solo uso. */
export function resetPasswordEmail({ to, url }: { to: string; url: string }): EmailMessage {
  return renderEmail({
    to,
    subject: RESET_PASSWORD_SUBJECT,
    intro: ['Pulsa el botón para elegir una contraseña nueva.'],
    button: { label: 'Cambiar contraseña', url },
    footer: 'El enlace caduca en 30 minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este email.',
  });
}
