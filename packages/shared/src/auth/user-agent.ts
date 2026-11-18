/**
 * Etiqueta legible de un dispositivo a partir de su user agent (spec 01 §5 `sessionDto`):
 * "Chrome en Android", "Safari en iPhone", "Dispositivo desconocido". Sin librerías:
 * expresiones regulares simples, el orden importa (Edge y Opera incluyen "Chrome", y
 * Chrome incluye "Safari").
 */
export const UNKNOWN_DEVICE = 'Dispositivo desconocido';

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\b(?:OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

function match(ua: string, table: ReadonlyArray<[RegExp, string]>): string | null {
  return table.find(([re]) => re.test(ua))?.[1] ?? null;
}

export function describeUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return UNKNOWN_DEVICE;
  const browser = match(ua, BROWSERS);
  const system = match(ua, SYSTEMS);
  if (browser && system) return `${browser} en ${system}`;
  if (browser) return browser;
  if (system) return `Navegador en ${system}`;
  return UNKNOWN_DEVICE;
}
