import { describe, expect, it } from 'vitest';

import { RESET_PASSWORD_SUBJECT, resetPasswordEmail } from './reset-password.js';
import { VERIFY_EMAIL_SUBJECT, verifyEmail } from './verify-email.js';

const URL = 'https://api.hogaria.test/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fhogaria.test%2F';

describe('plantillas de email (spec 01 §7)', () => {
  it('verificación: asunto, saludo, botón y caducidad en HTML y texto', () => {
    const email = verifyEmail({ to: 'ana@demo.local', name: 'Ana', url: URL });
    expect(email.to).toBe('ana@demo.local');
    expect(email.subject).toBe(VERIFY_EMAIL_SUBJECT);
    expect(email.subject).toBe('Confirma tu email en Hogaria');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Hola, Ana. Pulsa el botón para activar tu cuenta de Hogaria.');
      expect(body).toContain('Confirmar email');
      expect(body).toContain('El enlace caduca en 24 horas. Si no has creado una cuenta, ignora este email.');
    }
    expect(email.text).toContain(URL);
    expect(email.html).toContain(`href="${URL.replace(/&/g, '&amp;')}"`);
    expect(email.html).toContain('<html lang="es">');
  });

  it('restablecimiento: asunto, botón y aviso de un solo uso', () => {
    const email = resetPasswordEmail({ to: 'ana@demo.local', url: 'https://api.hogaria.test/reset/xyz' });
    expect(email.subject).toBe(RESET_PASSWORD_SUBJECT);
    expect(email.subject).toBe('Restablece tu contraseña de Hogaria');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Pulsa el botón para elegir una contraseña nueva.');
      expect(body).toContain('Cambiar contraseña');
      expect(body).toContain('El enlace caduca en 30 minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este email.');
    }
  });

  it('escapa el nombre en el HTML', () => {
    const email = verifyEmail({ to: 'x@demo.local', name: '<script>alert(1)</script>', url: URL });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});
