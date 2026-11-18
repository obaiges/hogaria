import { describe, expect, it, vi } from 'vitest';

import { EmailSendError, ResendEmailSender, type ResendEmailsApi } from './resend-email-sender.js';

const MESSAGE = { to: 'ana@demo.local', subject: 'Asunto', text: 'texto', html: '<p>html</p>' };

function sender(send: ResendEmailsApi['send']) {
  return new ResendEmailSender('re_test', 'Hogaria <no-reply@hogaria.test>', { send });
}

describe('ResendEmailSender', () => {
  it('envía con EMAIL_FROM como remitente, texto y HTML', async () => {
    const send = vi.fn<ResendEmailsApi['send']>().mockResolvedValue({ error: null });
    await sender(send).send(MESSAGE);
    expect(send).toHaveBeenCalledWith({ from: 'Hogaria <no-reply@hogaria.test>', ...MESSAGE });
  });

  it('lanza EmailSendError si Resend devuelve un error, sin el destinatario en el mensaje', async () => {
    const send = vi.fn<ResendEmailsApi['send']>().mockResolvedValue({ error: { name: 'rate_limit_exceeded', message: 'Too many requests' } });
    const error = await sender(send).send(MESSAGE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailSendError);
    expect((error as Error).message).toContain('rate_limit_exceeded');
    expect((error as Error).message).not.toContain('ana@demo.local');
  });

  it('lanza EmailSendError si la llamada falla (red)', async () => {
    const send = vi.fn<ResendEmailsApi['send']>().mockRejectedValue(new Error('fetch failed'));
    await expect(sender(send).send(MESSAGE)).rejects.toThrow(EmailSendError);
  });
});
