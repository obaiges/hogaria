import { describe, expect, it } from 'vitest';

import { FakePushSender, FakeWebPushSender } from './fake-push-sender.js';

const sub = (id: string, userId: string) => ({ id, userId, endpoint: `https://push.test/${id}`, p256dh: 'k', auth: 'a' });

describe('FakeWebPushSender', () => {
  it('registra los envíos y simula suscripciones caducadas', async () => {
    const fake = new FakeWebPushSender();
    fake.setSubscriptions([sub('1', 'ana'), sub('2', 'ana'), sub('3', 'oscar')]);
    fake.failWith('https://push.test/2', 'gone');

    await expect(fake.sendToUser('ana', { title: 'Te toca fregar' })).resolves.toEqual({ sent: 1, failed: 1 });
    await expect(fake.send(sub('3', 'oscar'), { title: 'Hola' })).resolves.toBe('ok');

    expect(fake.to('ana').map((p) => p.result)).toEqual(['ok', 'gone']);
    expect(fake.sent).toHaveLength(3);
    fake.clear();
    expect(fake.sent).toEqual([]);
    await expect(fake.sendToUser('ana', {})).resolves.toEqual({ sent: 0, failed: 0 });
  });

  it('FakePushSender es el mismo fake (nombre usado en E12)', () => {
    expect(FakePushSender).toBe(FakeWebPushSender);
  });
});
