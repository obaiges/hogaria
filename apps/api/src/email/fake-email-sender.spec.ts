import { describe, expect, it } from 'vitest';

import { extractLinks, FakeEmailSender } from './fake-email-sender.js';

describe('FakeEmailSender', () => {
  it('guarda los emails en memoria con sus enlaces', async () => {
    const fake = new FakeEmailSender();
    await fake.send({
      to: 'Ana@Demo.local',
      subject: 'Verifica tu email',
      text: 'Entra en https://hogaria.test/verificar?token=abc',
      html: '<a href="https://hogaria.test/verificar?token=abc&amp;x=1">Verificar</a>',
    });
    await fake.send({ to: 'oscar@demo.local', subject: 'Otro', text: 'sin enlaces', html: '' });

    expect(fake.sent).toHaveLength(2);
    const email = fake.last('ana@demo.local');
    expect(email).toMatchObject({ to: 'Ana@Demo.local', subject: 'Verifica tu email' });
    expect(email?.links).toEqual(['https://hogaria.test/verificar?token=abc', 'https://hogaria.test/verificar?token=abc&x=1']);
    expect(fake.to('oscar@demo.local')).toHaveLength(1);
    expect(fake.last()?.subject).toBe('Otro');

    fake.clear();
    expect(fake.sent).toEqual([]);
  });

  it('extractLinks quita duplicados', () => {
    expect(extractLinks('https://a.test/x y https://a.test/x', '<b>http://b.test</b>')).toEqual(['https://a.test/x', 'http://b.test']);
  });
});
