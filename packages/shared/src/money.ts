/**
 * Dinero: siempre céntimos enteros (`amountCents`). Nunca `float` en datos persistidos.
 * Formato español: "12,34 €", "1.234,00 €" (espacio duro U+00A0 antes del símbolo, como Intl).
 */

const moneyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // es-ES no agrupa los números de 4 cifras por defecto ("1234,00 €"); forzamos "1.234,00 €".
  useGrouping: 'always',
});

/** 1234 → "12,34 €" · 123400 → "1.234,00 €" · -500 → "-5,00 €" */
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatMoney espera céntimos enteros, recibió ${cents}`);
  }
  return moneyFormatter.format(cents / 100);
}

const PLAIN = /^\d+(?:,\d{1,2})?$/; // 12 · 12,3 · 1234,56
const GROUPED = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/; // 1.234 · 12.345,67
const DOT_DECIMAL = /^\d+\.\d{1,2}$/; // 12.5 · 12.34 (teclado numérico en inglés)

/**
 * Convierte lo que escribe el usuario a céntimos.
 * Acepta "12", "12,3", "12,34", "12.345,67", "12.5", "12,34 €". Devuelve `null` si no es válido,
 * si es negativo o si tiene más de 2 decimales.
 */
export function parseMoney(input: string): number | null {
  // `\s` incluye el espacio duro U+00A0 que pone Intl antes del símbolo.
  const value = input.replace(/€/g, '').replace(/\s/g, '');
  if (value === '') return null;

  let normalized: string;
  if (GROUPED.test(value)) {
    normalized = value.replace(/\./g, '').replace(',', '.');
  } else if (PLAIN.test(value)) {
    normalized = value.replace(',', '.');
  } else if (DOT_DECIMAL.test(value)) {
    normalized = value;
  } else {
    return null;
  }

  const [intPart = '0', fracPart = ''] = normalized.split('.');
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
