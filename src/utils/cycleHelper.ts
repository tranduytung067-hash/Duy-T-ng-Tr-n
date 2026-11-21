/**
 * Helper to calculate the Sales Cycle (Chu kỳ bán hàng) based on a given date.
 * 
 * Rules:
 * - 12 cycles per year.
 * - If date is >= 20: cycle starts on the 20th of current month, ends on the 19th of next month.
 * - If date is < 20: cycle starts on the 20th of previous month, ends on the 19th of current month.
 * - Cycle name is "Chu kỳ [Num]" where:
 *   - June 20 to July 19 is Cycle 7.
 *   - Dec 20 to Jan 19 (next year) is Cycle 1.
 */
export interface SalesCycle {
  startDate: string;
  endDate: string;
  cycleName: string;
}

export function getSalesCycleDates(dateInput: Date = new Date()): SalesCycle {
  const year = dateInput.getFullYear();
  const month = dateInput.getMonth(); // 0 - 11
  const date = dateInput.getDate();

  let startYear = year;
  let startMonth = month;
  let endYear = year;
  let endMonth = month;

  if (date >= 20) {
    // Current date is 20th or later: Cycle starts on 20th of current month
    startYear = year;
    startMonth = month; // current month
    
    // Cycle ends on 19th of next month
    if (month === 11) {
      endYear = year + 1;
      endMonth = 0; // January of next year
    } else {
      endYear = year;
      endMonth = month + 1;
    }
  } else {
    // Current date is 19th or earlier: Cycle started on 20th of previous month
    if (month === 0) {
      startYear = year - 1;
      startMonth = 11; // December of previous year
    } else {
      startYear = year;
      startMonth = month - 1;
    }
    endYear = year;
    endMonth = month; // current month
  }

  const sMonthStr = String(startMonth + 1).padStart(2, '0');
  const eMonthStr = String(endMonth + 1).padStart(2, '0');

  const startDate = `${startYear}-${sMonthStr}-20`;
  const endDate = `${endYear}-${eMonthStr}-19`;
  
  // June (5) -> Cycle 7, Dec (11) -> Cycle 1
  const cycleNum = ((startMonth + 1) % 12) + 1;
  const cycleName = `Chu kỳ ${cycleNum}`;

  return { startDate, endDate, cycleName };
}

/**
 * Returns the cycle name for a given start date.
 * Useful to display "Chu kỳ X" when the cycle has already been set or changed.
 */
export function getCycleNameFromStartDate(startDateStr: string): string {
  if (!startDateStr) return 'Chu kỳ không xác định';
  try {
    const parts = startDateStr.split('-');
    if (parts.length < 3) return 'Chu kỳ không xác định';
    const month = parseInt(parts[1], 10); // 1-12
    const day = parseInt(parts[2], 10);
    
    // If start day is indeed 20
    if (day === 20) {
      const startMonth = month - 1;
      const cycleNum = ((startMonth + 1) % 12) + 1;
      return `Chu kỳ ${cycleNum}`;
    }
    
    // Fallback: map it based on month
    const startMonth = month - 1;
    const cycleNum = ((startMonth + 1) % 12) + 1;
    return `Chu kỳ ${cycleNum}`;
  } catch (err) {
    return 'Chu kỳ không xác định';
  }
}

/**
 * Formats a YYYY-MM-DD string into DD/MM/YYYY.
 */
export function formatDateToVN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

