import { describe, expect, it } from 'vitest';

import { describeUserAgent, UNKNOWN_DEVICE } from './user-agent.js';

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
};

describe('describeUserAgent', () => {
  it.each([
    [UA.chromeAndroid, 'Chrome en Android'],
    [UA.safariIphone, 'Safari en iPhone'],
    [UA.firefoxWindows, 'Firefox en Windows'],
    [UA.firefoxLinux, 'Firefox en Linux'],
    [UA.edgeWindows, 'Edge en Windows'],
    [UA.safariMac, 'Safari en macOS'],
    [UA.chromeIphone, 'Chrome en iPhone'],
    [UA.samsung, 'Samsung Internet en Android'],
  ])('%s → %s', (ua, label) => {
    expect(describeUserAgent(ua)).toBe(label);
  });

  it('vacío, nulo o irreconocible → "Dispositivo desconocido"', () => {
    expect(describeUserAgent('')).toBe(UNKNOWN_DEVICE);
    expect(describeUserAgent('   ')).toBe(UNKNOWN_DEVICE);
    expect(describeUserAgent(null)).toBe(UNKNOWN_DEVICE);
    expect(describeUserAgent(undefined)).toBe(UNKNOWN_DEVICE);
    expect(describeUserAgent('curl/8.5.0')).toBe(UNKNOWN_DEVICE);
    expect(UNKNOWN_DEVICE).toBe('Dispositivo desconocido');
  });

  it('solo navegador o solo sistema', () => {
    expect(describeUserAgent('Mozilla/5.0 Firefox/133.0')).toBe('Firefox');
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Bot')).toBe('Navegador en Windows');
  });
});
