import { parseFlexibleVolume } from './sheetParser';

/**
 * Standardized decimal and numeric formatters that strictly preserve exact decimal representation
 * and use '.' as the decimal separator (preventing locale-based dot-to-comma or dot-removal errors).
 */

/**
 * Formats a single decimal value with '.' as decimal separator.
 * E.g. 2.06 -> "2.06", 2.89 -> "2.89", 21.23 -> "21.23", 0 -> "0.00"
 */
export function formatValue(value: number | string | null | undefined, isSmall: boolean = false): string {
  const digits = isSmall ? 4 : 2;
  if (value === undefined || value === null || value === '' || value === 'Trống') {
    return digits === 4 ? '0.0000' : '0.00';
  }

  const num = typeof value === 'number' ? value : parseFlexibleVolume(value);
  if (isNaN(num)) {
    return digits === 4 ? '0.0000' : '0.00';
  }

  // Format with standard US numbering (dot for decimal separator)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Formats a quantity/volume value preserving exact decimal places with '.' decimal separator.
 * If number has decimals (e.g. 2.06, 2.89, 1.65, 21.23), renders exact decimals.
 */
export function formatQuantity(num: number | string | null | undefined, maxDecimals: number = 2): string {
  if (num === undefined || num === null || num === '' || num === 'Trống') {
    return '0.00';
  }

  const val = typeof num === 'number' ? num : parseFlexibleVolume(num);
  if (isNaN(val)) return '0.00';

  // Format with dot decimal separator
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals >= 2 ? maxDecimals : 2,
  });
}

/**
 * Formats revenue/currency with proper thousands separator and no unintended decimals
 */
export function formatRevenue(num: number | string | null | undefined): string {
  if (num === undefined || num === null || num === '' || num === 'Trống') {
    return '0';
  }

  const val = typeof num === 'number' ? num : parseFlexibleVolume(num);
  if (isNaN(val)) return '0';

  return Math.round(val).toLocaleString('en-US');
}

/**
 * Formats growth percentage calculated by (2026 / 2025 - 1), e.g. 0.3106 -> "+31.06%", -0.052 -> "-5.20%", 0 -> "0.00%"
 */
export function formatGrowthPct(rate: number | string | null | undefined): string {
  if (rate === undefined || rate === null || rate === '' || isNaN(Number(rate))) {
    return '0.00%';
  }
  const num = Number(rate);
  if (num === 0) return '0.00%';

  const pct = num * 100;
  if (Math.abs(pct) < 0.005) return '0.00%';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Formats gap/daily required number, e.g. 1.25 or 12
 */
export function formatGapNumber(num: number | string | null | undefined): string {
  if (num === undefined || num === null || num === '') return '0';
  const val = typeof num === 'number' ? num : parseFlexibleVolume(num);
  if (isNaN(val) || val === 0) return '0';
  if (Number.isInteger(val)) return val.toLocaleString('en-US');
  return val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/**
 * Formats a target/actual pair with exact decimal formatting: "actual / target"
 * E.g. (2.06, 2.89) -> "2.06 / 2.89"
 * (1.65, 1.89) -> "1.65 / 1.89"
 * (21.23, 30.21) -> "21.23 / 30.21"
 */
export function formatActualTargetPair(actual: number | string | null | undefined, target: number | string | null | undefined, isSmall: boolean = false): string {
  const actualStr = formatValue(actual, isSmall);
  const targetStr = formatValue(target, isSmall);
  return `${actualStr} / ${targetStr}`;
}
