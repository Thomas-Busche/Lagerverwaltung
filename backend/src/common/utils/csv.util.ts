const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
// Plain numbers such as "-3" or "+1,5" must stay untouched (legit differences).
const PLAIN_NUMBER = /^[+-]?\d+([.,]\d+)?$/;

/**
 * Escapes one CSV cell. Text starting with a spreadsheet formula trigger gets a
 * leading single quote so Excel/LibreOffice do not execute it as a formula.
 * Numbers (type number or plain numeric strings) are never prefixed.
 */
export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const isNumeric = typeof value === 'number' || PLAIN_NUMBER.test(text);
  const safe = !isNumeric && FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
