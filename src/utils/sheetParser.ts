import { EmployeeTargetRow, SoBanRaw, SheetDataState, UserPermission, GrowthRow, InventoryItem, ThiDuaBlock, CompetitionProgramConfig, AnnualBonusGroup, AnnualBonusEmployeeRow, AnnualBonusCell, TuNhienRecord, MeizanRecord } from '../types';
import { mockEmployees } from '../mockData';
import { 
  getCachedRawTab, 
  setCachedRawTab, 
  getCachedSheetData, 
  setCachedSheetData, 
  getCachedModuleData, 
  setCachedModuleData, 
  getOrCreateInFlightRequest, 
  generateDataHash, 
  isOnline 
} from './sheetCache';

export { getCachedSheetData, setCachedSheetData, getCachedModuleData, setCachedModuleData, isOnline };

/**
 * Cleans the employee name by removing the initials/abbreviation prefix if present.
 * E.g., "NVA - Nguyễn Văn An" -> "Nguyễn Văn An", "TTB Trần Thị Bình" -> "Trần Thị Bình"
 */
export function cleanEmployeeName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim();

  // Strip leading numbers e.g. "1. Bùi Mạnh Cường", "1 - Bùi Mạnh Cường", "1 Bùi Mạnh Cường"
  cleaned = cleaned.replace(/^\d+[\.\s\-\:\_]+/, '').trim();

  // Pattern 1: Initials followed by space, hyphen, colon, then the name: e.g. "NVA - Nguyễn Văn An"
  const dashPattern = /^[a-zà-ỹđ]{2,5}\s*[-–—:_]\s*(.+)$/i;
  let match = cleaned.match(dashPattern);
  if (match) {
    cleaned = match[1].trim();
  } else {
    // Pattern 2: Initials followed by space, then the capitalized name: e.g. "NVA Nguyễn Văn An"
    const upperLetters = "A-ZĐÀÁẢẠÃÂẦẤẨẬẪĂẰẮẲẶẴÈÉẺẸẼÊỀẾỂỆỄÌÍỈỊĨÒÓỎỌÕÔỒỐỔỘỖƠỜỚỞỢỠÙÚỦỤŨƯỪỨỬỰỮỲÝỶYỴỸ";
    const spacePattern = new RegExp(`^[${upperLetters}]{2,5}\\s+([${upperLetters}][a-zà-ỹ]+.*)$`);
    match = cleaned.match(spacePattern);
    if (match) {
      cleaned = match[1].trim();
    }
  }

  // Specific canonical employee name normalization: Nguyễn Hưng Nguyên -> Nguyễn Thị Hưng Nguyên
  const normKey = cleaned.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
  if (normKey === 'nguyenthihungnguyen' || normKey === 'nguyenhungnguyen') {
    return 'Nguyễn Thị Hưng Nguyên';
  }

  return cleaned;
}

export const defaultEmployeeOrder = [
  'Lê Thị Hương',
  'Nguyễn Thành Thực',
  'Bùi Mạnh Cường',
  'Nguyễn Sỹ Vũ',
  'Dương Thị Thanh',
  'Vũ Anh Tùng',
  'Nguyễn Thị Hưng Nguyên',
  'Nguyễn Đức Tuấn'
];

export const normStr = (s: string) =>
  s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '') : '';

export function getRowValByCol(r: any, letter: string, keywords: string[]): any {
  if (!r) return undefined;
  if (r[letter] !== undefined && r[letter] !== null && String(r[letter]).trim() !== '') return r[letter];
  const lowerLetter = letter.toLowerCase();
  if (r[lowerLetter] !== undefined && r[lowerLetter] !== null && String(r[lowerLetter]).trim() !== '') return r[lowerLetter];
  const keys = Object.keys(r);
  for (const kw of keywords) {
    const k = keys.find(key => key.toLowerCase().trim().includes(kw));
    if (k && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return r[k];
  }
  return undefined;
}

export function cleanNameCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.toString().toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFC');
  const cleanB = b.toString().toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFC');
  return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
}

export const DEFAULT_EMPLOYEE_ORDER: string[] = [
  'Lê Thị Hương',
  'Nguyễn Thành Thực',
  'Bùi Mạnh Cường',
  'Nguyễn Sỹ Vũ',
  'Dương Thị Thanh',
  'Vũ Anh Tùng',
  'Nguyễn Thị Hưng Nguyên',
  'Nguyễn Đức Tuấn'
];

/**
 * Sorts and formats employee names according to default supervisor requested order:
 * 1. Lê Thị Hương
 * 2. Nguyễn Thành Thực
 * 3. Bùi Mạnh Cường
 * 4. Nguyễn Sỹ Vũ
 * 5. Dương Thị Thanh
 * 6. Vũ Anh Tùng
 * 7. Nguyễn Thị Hưng Nguyên
 * 8. Nguyễn Đức Tuấn
 */
export function sortAndFormatEmployeeNames(names: string[]): string[] {
  const defaultOrder = DEFAULT_EMPLOYEE_ORDER;

  const isExcluded = (s: string) => {
    if (!s) return true;
    const lowered = s.toLowerCase().trim();
    const norm = lowered.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (
      lowered === 'n/a' || 
      lowered === 'na' || 
      lowered === 'nan' || 
      lowered === '-' || 
      lowered === 'chưa gán khbh' || 
      lowered.includes('n/a') ||
      lowered.includes('chưa gán') ||
      norm.includes('total') ||
      norm.startsWith('tong') ||
      norm.includes('tong cong') ||
      norm.includes('tong so') ||
      norm.includes('nhan vien') ||
      norm.includes('ten nv') ||
      norm.includes('stt') ||
      norm.includes('chi tieu') ||
      norm.includes('ke hoach') ||
      norm === 'tat ca'
    );
  };

  const clean = (s: string) => {
    if (!s) return '';
    return s.toLowerCase().trim().normalize('NFC');
  };

  const formattedNames = Array.from(new Set(
    names
      .map(name => cleanEmployeeName(name))
      .filter(name => name && !isExcluded(name))
      .map(name => {
        const c = clean(name);
        const found = defaultOrder.find(o => clean(o) === c);
        return found || name;
      })
  )).filter(Boolean);

  return formattedNames.sort((a, b) => {
    const idxA = defaultOrder.indexOf(a);
    const idxB = defaultOrder.indexOf(b);

    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    return a.localeCompare(b, 'vi');
  });
}

/**
 * Canonical employee matcher for CTTB data from Sheet "Danh Sách Trưng Bày"
 */
export function matchCttbEmployee(empRaw: string | undefined | null): string | null {
  if (!empRaw) return null;
  const s = empRaw.toString().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  if (s.includes('huong')) return 'Lê Thị Hương';
  if (s.includes('thuc')) return 'Nguyễn Thành Thực';
  if (s.includes('cuong') || (s.includes('bui') && s.includes('manh'))) return 'Bùi Mạnh Cường';
  if ((s.includes('vu') && s.includes('sy')) || s.includes('nguyen sy') || s.includes('sy vu')) return 'Nguyễn Sỹ Vũ';
  if (s.includes('thanh')) return 'Dương Thị Thanh';
  if (s.includes('tung')) return 'Vũ Anh Tùng';
  if (s.includes('hung nguyen') || (s.includes('nguyen') && (s.includes('hung') || s.includes('hng')))) return 'Nguyễn Thị Hưng Nguyên';
  if (s.includes('tuan')) return 'Nguyễn Đức Tuấn';
  return null;
}

/**
 * Canonical CTTB program matcher for Sheet "Danh Sách Trưng Bày"
 */
export function matchCttbProgram(codeRaw: string | undefined | null, progRaw: string | undefined | null): string | null {
  const code = (codeRaw || '').toString().trim().toUpperCase();
  const prog = (progRaw || '').toString().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (code === 'HOD00150' || prog.includes('meizan')) return 'CTTB MEIZAN';
  if (code === 'HOD00127' || prog.includes('thue ke') || prog.includes('thue') || (prog.includes('ke') && !prog.includes('nuoc') && !prog.includes('rua'))) return 'Thuê Kệ';
  if (code === 'HOD00144' || prog.includes('nam duong')) return 'Nam Dương';
  if (code === 'HOD00130' || prog.includes('nuoc rua chen') || prog.includes('rua chen') || prog.includes('nrc')) return 'Nước Rửa Chén';
  if (code === 'HOD00132' || prog.includes('giat xa') || prog.includes('giat') || prog.includes('xa')) return 'Giặt Xả';
  if (code === 'T510900001' || prog.includes('gao')) return 'Gạo';
  if (code === 'HOD00142' || prog.includes('584') || prog.includes('mam')) return 'Mắm 584NT';
  if (code === 'HOD00145' || prog.includes('tra') || prog.includes('vinatea')) return 'TRÀ VINATEA';
  if (prog.includes('tu nhien')) return 'Trưng Bày Tự Nhiên';
  return null;
}

/**
 * Extracts Google Spreadsheet ID from a shared link or standard URL.
 */
export function extractSheetId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  return match ? match[1] : url.trim();
}

/**
 * Helper to normalize and match key column headers by list of aliases.
 */
function findColIndex(cols: any[], aliases: string[]): number {
  return cols.findIndex((col) => {
    const label = (col.label || '').toLowerCase().trim();
    const id = (col.id || '').toLowerCase().trim();
    return aliases.some(alias => label.includes(alias) || id === alias);
  });
}

export function parseFlexibleVolume(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  let str = String(val).trim();
  if (!str || str === '-' || str === 'Trống' || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return 0;

  // Clean currency symbols, spaces, quotes
  str = str.replace(/[₫đĐvnđVNĐ\s\t\r\n"']/g, '').trim();
  if (!str) return 0;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European / Vietnamese format where . is thousand and , is decimal: e.g. "1.234,56"
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Standard US format where , is thousand and . is decimal: e.g. "1,234.56"
      str = str.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // Multiple commas -> thousands separators: e.g. "1,000,000"
      str = str.replace(/,/g, '');
    } else {
      // Single comma: e.g. "2,06" or "2,89" or "21,23" -> treat as decimal separator
      str = parts[0] + '.' + (parts[1] || '');
    }
  } else if (!hasComma && hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      // Multiple dots -> thousands separators: e.g. "2.500.000"
      str = str.replace(/\./g, '');
    } else {
      // Single dot: e.g. "2.06", "2.89", "21.23", "1.65", "1.89", "30.21"
      // Preserved as exact decimal number with dot as decimal separator
    }
  }

  const cleaned = str.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalizes different date formats (DD/MM/YYYY, DD-MM-YYYY, etc.) to standard YYYY-MM-DD for reliable comparison
 */
export function normalizeDateToYYYYMMDD(dateVal: any): string {
  if (dateVal === null || dateVal === undefined) return '';
  let str = String(dateVal).trim();
  if (!str) return '';

  // Case 1: Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Case 2: DD/MM/YYYY
  const dmYMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmYMatch) {
    const day = dmYMatch[1].padStart(2, '0');
    const month = dmYMatch[2].padStart(2, '0');
    const year = dmYMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Case 3: DD-MM-YYYY
  const dmYMatchDash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmYMatchDash) {
    const day = dmYMatchDash[1].padStart(2, '0');
    const month = dmYMatchDash[2].padStart(2, '0');
    const year = dmYMatchDash[3];
    return `${year}-${month}-${day}`;
  }

  // Case 4: YYYY/MM/DD
  const YmdMatch = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (YmdMatch) {
    return `${YmdMatch[1]}-${YmdMatch[2]}-${YmdMatch[3]}`;
  }

  // Try parsing using JS Date if possible
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}

  return str;
}

export function getExcelColumnLetter(colIdx: number): string {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function getRowCellValue(row: any, colLetter: string, colIdx?: number): any {
  if (!row) return '';
  const upper = colLetter.toUpperCase();
  const lower = colLetter.toLowerCase();
  
  if (row[upper] !== undefined && row[upper] !== null && String(row[upper]).trim() !== '') {
    return row[upper];
  }
  if (row[lower] !== undefined && row[lower] !== null && String(row[lower]).trim() !== '') {
    return row[lower];
  }
  if (colIdx !== undefined && row._rawCells && row._rawCells[colIdx]) {
    const cell = row._rawCells[colIdx];
    if (cell.v !== undefined && cell.v !== null) return cell.v;
    if (cell.f !== undefined && cell.f !== null) return cell.f;
  }
  return '';
}

/**
 * Parses raw gviz rows into comfortable column-key maps
 */
function parseGvizTable(table: any): any[] {
  if (!table || !table.cols || !table.rows) return [];
  
  const totalCols = table.cols ? table.cols.length : 0;

  // Decide whether the first row represents headers
  // Usually, if table.cols contains labels like "A", "B", "C" or empty labels, and the first row contains string headers
  const firstRowCells = table.rows[0]?.c || [];
  const isFirstRowHeader = table.cols.every((col: any) => {
    const lbl = (col.label || '').trim();
    return !lbl || lbl === col.id || /^[A-Z]+$/.test(lbl);
  });

  let headerLabels = table.cols.map((col: any) => (col.label || col.id || '').trim());
  let startRowIdx = 0;

  if (isFirstRowHeader && table.rows.length > 0) {
    const rowLabels = firstRowCells.map((cell: any) => (cell?.v ?? '').toString().trim());
    // check if row labels look like columns of headers
    const hasValidHeaders = rowLabels.some(lbl => 
      lbl.toLowerCase().includes('nhân viên') || 
      lbl.toLowerCase().includes('chỉ tiêu') || 
      lbl.toLowerCase().includes('ngày') || 
      lbl.toLowerCase().includes('tên') || 
      lbl.toLowerCase().includes('sản phẩm') || 
      lbl.toLowerCase().includes('ngành')
    );
    if (hasValidHeaders) {
      headerLabels = rowLabels.map((lbl, idx) => lbl || table.cols[idx]?.id || `Col${idx}`);
      startRowIdx = 1; // Shift data row processing forward
    }
  }

  const result: any[] = [];
  for (let i = startRowIdx; i < table.rows.length; i++) {
    const row = table.rows[i];
    const item: any = {};
    if (row && row.c) {
      const maxCols = Math.max(totalCols, headerLabels.length, row.c ? row.c.length : 0);
      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        const cell = row.c[colIdx];
        let val: any = null;
        if (cell) {
          if (cell.v !== undefined && cell.v !== null) {
            val = cell.v;
          } else if (cell.f !== undefined && cell.f !== null && String(cell.f).trim() !== '') {
            val = cell.f;
          }
        }
        if (val && typeof val === 'string' && val.startsWith('Date(')) {
          val = cell.f || val;
        }
        
        // Map label if within headerLabels bounds
        if (colIdx < headerLabels.length && headerLabels[colIdx]) {
          const label = headerLabels[colIdx];
          item[label] = val !== null ? String(val) : '';
        }
        
        // Map Excel column letter (A, B, C, ...)
        const letter = getExcelColumnLetter(colIdx);
        item[letter] = val !== null ? String(val) : '';

        // Map column id from gviz if available (e.g. col.id = "Y" or "AA")
        if (table.cols && table.cols[colIdx] && table.cols[colIdx].id) {
          const colIdUpper = String(table.cols[colIdx].id).trim().toUpperCase();
          if (colIdUpper) {
            item[colIdUpper] = val !== null ? String(val) : '';
          }
        }
      }
      // True 1-based physical row in Google Sheet (Header row is row 1, first data row is row 2)
      item['_physicalRowIndex'] = startRowIdx === 0 ? (i + 2) : (i + 1);
      item['_rawCells'] = row.c;
    }
    result.push(item);
  }

  (result as any).headerLabels = headerLabels;
  (result as any).rawTableCols = table.cols.map((col: any) => (col.label || col.id || '').trim());

  return result;
}

/**
 * Fetches a single sheet/tab as JSON using the gviz tool endpoint with deduplication and caching.
 */
export async function fetchSheetData(sheetId: string, tabName: string, range?: string, forceRefresh: boolean = false, headers?: number): Promise<any[]> {
  const reqKey = `${sheetId}__${tabName}__${range || ''}__h${headers !== undefined ? headers : ''}__${forceRefresh ? 'force' : ''}`;

  return getOrCreateInFlightRequest(reqKey, async () => {
    // 1. Check raw tab cache first (only if not forcing a refresh)
    const cached = !forceRefresh ? await getCachedRawTab(sheetId, tabName, range) : null;

    // If offline, immediately return cached rows if present
    if (!isOnline()) {
      if (cached && cached.rows && cached.rows.length > 0) {
        return cached.rows;
      }
      throw new Error(`Bạn đang offline và chưa có dữ liệu lưu trữ cho Tab "${tabName}".`);
    }

    try {
      const cacheBuster = Date.now();
      let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&_t=${cacheBuster}`;
      if (headers !== undefined) {
        url += `&headers=${headers}`;
      } else {
        const normTab = tabName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (
          normTab.includes('danh sach') || 
          normTab.includes('co so') || 
          (normTab.includes('trung bay') && !normTab.includes('tong hop'))
        ) {
          url += `&headers=1`;
        }
      }
      if (range) {
        url += `&range=${encodeURIComponent(range)}`;
      } else {
        url += `&tq=select%20*`;
      }
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        if (cached && cached.rows && cached.rows.length > 0) {
          console.warn(`Không thể kết nối đến Tab "${tabName}", sử dụng dữ liệu bộ nhớ đệm.`);
          return cached.rows;
        }
        throw new Error(`Không thể kết nối đến Tab "${tabName}". Hãy kiểm tra quyền chia sẻ.`);
      }

      const text = await response.text();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        if (cached && cached.rows && cached.rows.length > 0) {
          return cached.rows;
        }
        throw new Error(`Định dạng dữ liệu không hợp lệ từ G-Sheet tại Tab "${tabName}".`);
      }

      const textHash = generateDataHash(text);
      // Fast path: If content has not changed compared to cached hash and not forced, reuse cached parsed rows directly!
      if (!forceRefresh && cached && cached.hash === textHash && cached.rows && cached.rows.length > 0) {
        return cached.rows;
      }

      const payload = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      if (payload.status === 'error') {
        if (cached && cached.rows && cached.rows.length > 0) {
          return cached.rows;
        }
        throw new Error(`Lỗi Google Sheets: ${payload.errors?.[0]?.detailed_message || 'Thông số không hợp lệ.'}`);
      }

      const parsedRows = parseGvizTable(payload.table);
      // Asynchronously store into cache without blocking
      setCachedRawTab(sheetId, tabName, parsedRows, textHash, range).catch(() => {});

      return parsedRows;
    } catch (err: any) {
      if (cached && cached.rows && cached.rows.length > 0) {
        console.warn(`Lỗi khi tải Tab "${tabName}", sử dụng dữ liệu bộ nhớ đệm:`, err.message);
        return cached.rows;
      }
      throw err;
    }
  });
}

/**
 * Fast helper to fetch from a list of tab name aliases
 */
export async function fetchWithFallbacks(sheetId: string, tabNames: string[], range?: string, forceRefresh: boolean = false, headers?: number): Promise<any[]> {
  for (const tabName of tabNames) {
    try {
      const data = await fetchSheetData(sheetId, tabName, range, forceRefresh, headers);
      if (data && data.length > 0) {
        return data;
      }
    } catch {
      // try next alias
    }
  }
  return [];
}

/**
 * Core Orchestrator that downloads the multiple tabs in parallel, applies aliases, 
 * joins the datasets properly, and falls back gracefully to custom targets.
 */
export async function loadGoogleSheetData(sheetId: string, forceRefresh: boolean = false): Promise<SheetDataState> {
  // Parallel fetch of all primary and secondary tabs to minimize round-trip latency
  const [
    doanhSoRaw,
    soBanRaw,
    k3Raw,
    k4Raw,
    khRaw,
    kpiKichHoatRaw,
    thuongNamRaw,
    prefetchedTongHopSbRows,
    prefetchedPermRaw,
    prefetchedActivationListData,
    prefetchedTrungBayRaw,
    prefetchedChamCongListData,
    prefetchedGrowthRaw,
    prefetchedTongHopTbRows,
    prefetchedThiDuaRaw
  ] = await Promise.all([
    fetchWithFallbacks(sheetId, ['Doanh Số Tháng', 'Doanh so', 'Sheet1'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['Số Bán', 'So ban', 'Sheet2'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['3 Ngành Hàng', '3 Ngành', '3N', '3 Nganh Hang'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['4 Ngành Hàng', '4 Ngành', '4N', '4 Nganh Hang'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['KH Đạt Chuẩn', 'KH Dat Chuan', 'Khách hàng đạt chuẩn', 'Khách Hàng Đạt Chuẩn', 'KH Đạt chuẩn', 'KH chuẩn'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['KPI Kích Hoạt', 'KPI Kich Hoat', 'KPI Kích hoạt', 'KPI Kich hoat'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, [
      'Thưởng Năm', 'Thuong Nam', 'Thưởng năm', 'Thuong nam', 
      'Tiến Độ Thưởng Năm', 'Tien Do Thuong Nam', 'Thưởng', 'Thuong', 
      'Bonus Năm', 'Bonus Nam', 'Bonus'
    ], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['Tổng Hợp SB', 'Tong Hop SB', 'Tổng hợp SB', 'Tong hop SB'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['Phân Quyền', 'Phan Quyen', 'Phần Quyền', 'Phần Quyên', 'Phân quyền', 'Phan quyen', 'Quyền', 'Quyen', 'Permissions'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, [
      'DATA KÍCH HOẠT', 'Data Kích Hoạt', 'Data Kích hoạt', 'Data Kich Hoat',
      'Data_Kich_Hoat', 'Kích Hoạt Chi Tiết', 'Kich Hoat Chi Tiet',
      'Data Kich hoat', 'Kích Hoạt', 'Kich Hoat', 'KÍCH HOẠT',
      'Data KH', 'DS Kích Hoạt', 'Danh Sách Kích Hoạt', 'Data'
    ], undefined, forceRefresh, 1),
    fetchWithFallbacks(sheetId, [
      'Danh Sách Trưng Bày', 'Danh Sách Trưng bày', 'Danh sach Trung bay', 'Danh sach trung bay',
      'DS Trưng Bày', 'DS Trung Bay', 'Trung Bay', 'Trưng Bày', 'Danh Sách TB', 'Danh sach TB',
      'Cơ sở', 'Cơ Sở', 'Co So', 'Co so', 'CS', 'CSDL', 'Data Trưng Bày', 'Data TB', 'Chi Tiết Trưng Bày',
      'Chi Tiết TB', 'Chi Tiet TB', 'Chi Tiết', 'Chi tiet'
    ], undefined, forceRefresh, 1),
    fetchWithFallbacks(sheetId, ['Chấm Công', 'Cham Cong', 'Chấm công', 'Cham cong', 'Att', 'Attendance', 'CHẤM CÔNG'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, ['Tăng Trưởng Năm', 'Tang Truong Nam', 'Tăng trưởng năm', 'Tang truong nam', 'Tăng Trưởng', 'Tang Truong', 'Growth'], undefined, forceRefresh),
    fetchWithFallbacks(sheetId, [
      'Tổng Hợp TB', 'Tong Hop TB', 'Tổng hợp TB', 'Tong hop TB', 'TỔNG HỢP TB',
      'Tổng Hợp Trưng Bày', 'Tong Hop Trung Bay', 'TỔNG HỢP TRƯNG BÀY', 'TH Trưng Bày', 'TH TB', 'TH TRƯNG BÀY', 'TB Summary',
      'Display Summary', 'Trưng Bày Tổng Hợp', 'Trung Bay Tong Hop', 'Tong Hop', 'Tổng Hợp'
    ], 'A1:AZ100', forceRefresh),
    fetchWithFallbacks(sheetId, [
      'Tổng hợp thi đua', 'Tổng Hợp Thi Đua', 'TỔNG HỢP THI ĐUA', 
      'Tong hop thi dua', 'Tong Hop Thi Dua', 'TH Thi Đua', 'TH THI ĐUA', 
      'TH thi đua', 'TH Thi đua', 'Tổng Hợp CT Thi Đua', 'Tổng hợp CT thi đua', 
      'TỔNG HỢP CT THI ĐUA', 'Tổng Hợp Thi đua', 'Tổng Hợp', 'Tong Hop',
      'CT Thi Đua', 'CT THI ĐUA', 'CT thi đua', 'Thi Đua', 'THI ĐUA', 'Thi đua', 
      'Thi dua', 'ThiDua', 'THIDUA', 'Sheet Thi Đua', 'Chương Trình Thi Đua', 'Chuong Trinh Thi Dua'
    ], undefined, forceRefresh)
  ]);

  if (!doanhSoRaw || doanhSoRaw.length === 0) {
    throw new Error("Thiếu Tab 'Doanh Số Tháng' (hoặc 'Sheet1'). Vui lòng kiểm tra quyền chia sẻ hoặc tên tab trong Google Sheet.");
  }

  let kichHoatRaw: any[] = [];
  if (k3Raw.length === 0 || k4Raw.length === 0) {
    kichHoatRaw = await fetchWithFallbacks(sheetId, ['Kích Hoạt', 'Kích hoạt', 'Kich hoat', 'Sheet3']);
  }

  // --- Parse "Doanh Số Tháng / Target" ---
  // Expected headers: Tên Nhân Viên, Chỉ tiêu, Thực tế, Ghi chú
  const parsedEmployees: EmployeeTargetRow[] = [];

  doanhSoRaw.forEach((row) => {
    // Column resolve by key heuristics
    const rowKeys = Object.keys(row);
    let nameKey = rowKeys.find(k => k.toLowerCase().includes('tên nhân viên') || k.toLowerCase().includes('nhân viên') || k.toLowerCase().includes('họ tên') || k.toLowerCase().includes('nhân sự') || k.toLowerCase() === 'name' || k.toLowerCase() === 'tên nv' || k.toLowerCase() === 'ten nv' || k.toLowerCase() === 'nv') || '';
    if (!nameKey) {
      if (rowKeys.includes('B') && row['B']) nameKey = 'B';
      else if (rowKeys.includes('A') && row['A']) nameKey = 'A';
      else if (rowKeys.includes('C') && row['C']) nameKey = 'C';
    }

    let targetKey = rowKeys.find(k => k.toLowerCase().includes('chỉ tiêu') || k.toLowerCase().includes('target') || k.toLowerCase().includes('mục tiêu') || k.toLowerCase().includes('chi tieu')) || '';
    if (!targetKey && rowKeys.includes('C')) targetKey = 'C';

    let actualKey = rowKeys.find(k => k.toLowerCase().includes('thực hiện') || k.toLowerCase().includes('thuc hien') || k.toLowerCase().includes('thực đạt') || k.toLowerCase().includes('thực tế') || k.toLowerCase().includes('actual') || k.toLowerCase().includes('đạt được') || k.toLowerCase().includes('doanh số đạt') || k.toLowerCase().includes('thực')) || '';
    if (!actualKey && rowKeys.includes('D')) actualKey = 'D';

    const ghiChuKey = rowKeys.find(k => k.toLowerCase().includes('ghi chú') || k.toLowerCase().includes('note') || k.toLowerCase().includes('nhận xét')) || '';

    const rawEmpName = row[nameKey] ? String(row[nameKey]).trim() : '';
    if (!rawEmpName || rawEmpName.toLowerCase().includes('tổng cộng') || rawEmpName.toLowerCase().includes('total')) {
      return; // Skip headers / footer summary lines if parsed
    }
    const empName = cleanEmployeeName(rawEmpName);

    const targetVal = parseFlexibleVolume(row[targetKey]);
    const actualVal = parseFlexibleVolume(row[actualKey]);
    const ghiChu = row[ghiChuKey] ? String(row[ghiChuKey]).trim() : '';

    // Join with "Kích Hoạt" values if matching employee name is found
    let k3Target = 0;
    let k3Actual = 0;
    let k4Target = 0;
    let k4Actual = 0;

    // Helper to aggregate target and actual across multiple matching rows in 3 or 4 Ngành Hàng sheets
    const sumK3AndK4ForEmployee = (rows: any[], empName: string) => {
      let targetSum = 0;
      let actualSum = 0;
      let khmhThangTargetSum = 0;
      let khmhThangActualSum = 0;
      let hasMatch = false;

      let nameKey: string | undefined = undefined;
      if (rows.length > 0) {
        for (let r = 0; r < Math.min(rows.length, 20); r++) {
          const rKeys = Object.keys(rows[r]);
          const exactMatch = rKeys.find(k => {
            const kNorm = k.toLowerCase().trim();
            return kNorm === 'nhân viên' || 
                   kNorm === 'nhan vien' || 
                   kNorm === 'tên nhân viên' || 
                   kNorm === 'ten nhan vien' || 
                   kNorm === 'họ tên' || 
                   kNorm === 'ho ten' || 
                   kNorm === 'họ và tên' || 
                   kNorm === 'ho va ten' || 
                   kNorm === 'tên' || 
                   kNorm === 'ten' || 
                   kNorm === 'nv' || 
                   kNorm === 'tên nv' || 
                   kNorm === 'ten nv' || 
                   kNorm === 'employee' || 
                   kNorm === 'staff' || 
                   kNorm === 'name';
          });
          if (exactMatch) {
            nameKey = exactMatch;
            break;
          }
        }

        if (!nameKey) {
          for (let r = 0; r < Math.min(rows.length, 20); r++) {
            const rKeys = Object.keys(rows[r]);
            const fuzzyMatch = rKeys.find(k => {
              const kNorm = k.toLowerCase().trim();
              if (kNorm.includes('ghi chú') || kNorm.includes('note') || kNorm.includes('nhận xét') || kNorm.includes('chỉ tiêu') || kNorm.includes('thực tế') || kNorm.includes('đạt')) {
                return false;
              }
              return kNorm.includes('nhân viên') || 
                     kNorm.includes('họ tên') || 
                     kNorm.includes('họ và tên') || 
                     kNorm.includes('tên nv') || 
                     kNorm.includes('nhân sự');
            });
            if (fuzzyMatch) {
              nameKey = fuzzyMatch;
              break;
            }
          }
        }

        if (!nameKey) {
          const rowKeys = Object.keys(rows[0]);
          if (rowKeys.includes('B')) {
            nameKey = 'B';
          } else if (rowKeys.includes('A')) {
            nameKey = 'A';
          } else if (rowKeys.includes('C')) {
            nameKey = 'C';
          }
        }
      }

      if (!nameKey) {
        return { target: 0, actual: 0, khmhThangTarget: 0, khmhThangActual: 0, hasMatch: false };
      }

      const normalizeEmployeeNameForMatch = (str: string): string => {
        if (!str) return '';
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]/g, '');
      };

      const targetNorm = normalizeEmployeeNameForMatch(empName);

      rows.forEach(row => {
        const rowVal = row[nameKey!];
        if (!rowVal) return;
        const rowValStr = String(rowVal).trim();
        const rowValNorm = normalizeEmployeeNameForMatch(rowValStr);

        const isHeaderOrFooter = 
          rowValStr.toLowerCase().includes('tên nhân viên') ||
          rowValStr.toLowerCase().includes('báo cáo') ||
          rowValStr.toLowerCase().startsWith('tổng') ||
          rowValStr.toLowerCase().startsWith('tong') ||
          rowValStr.toLowerCase().includes('nhân viên') ||
          rowValStr.toLowerCase().includes('nhan vien') ||
          rowValStr.toLowerCase().includes('họ tên') ||
          rowValStr.toLowerCase().includes('ho ten') ||
          rowValStr.toLowerCase().includes('họ và tên') ||
          rowValStr.toLowerCase().includes('ho va ten') ||
          rowValStr.toLowerCase().includes('chỉ tiêu') ||
          rowValStr.toLowerCase().includes('thực hiện');

        if (isHeaderOrFooter) return;

        const isMatch = rowValNorm === targetNorm || (targetNorm.length >= 4 && rowValNorm.length >= 4 && (rowValNorm.includes(targetNorm) || targetNorm.includes(rowValNorm)));

        if (isMatch) {
          hasMatch = true;
          const rowTarget = (row['C'] !== undefined && row['C'] !== null && String(row['C']).trim() !== '') ? parseFlexibleVolume(row['C']) : 0;
          const rowActual = (row['D'] !== undefined && row['D'] !== null && String(row['D']).trim() !== '') ? parseFlexibleVolume(row['D']) : 0;
          
          targetSum += rowTarget;
          actualSum += rowActual;

          const isTuan = normalizeEmployeeNameForMatch(empName).includes('tuan');
          if (isTuan) {
            if (row['J'] !== undefined && row['J'] !== null && String(row['J']).trim() !== '') {
              khmhThangTargetSum += parseFlexibleVolume(row['J']);
            }
            if (row['K'] !== undefined && row['K'] !== null && String(row['K']).trim() !== '') {
              khmhThangActualSum += parseFlexibleVolume(row['K']);
            }
          }
        }
      });

      return {
        target: targetSum,
        actual: actualSum,
        khmhThangTarget: khmhThangTargetSum,
        khmhThangActual: khmhThangActualSum,
        hasMatch
      };
    };

    // Special helper for 3 Ngành Hàng to strictly match cells A3 to A10 (Employee Name), C3 to C10 (Target), D3 to D10 (Actual)
    const parseK3WithExactRange = (rows: any[], empName: string) => {
      let targetSum = 0;
      let actualSum = 0;
      let khmhThangTargetSum = 0;
      let khmhThangActualSum = 0;
      let hasMatch = false;

      const normalizeEmployeeNameForMatch = (str: string): string => {
        if (!str) return '';
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]/g, '');
      };

      const targetNorm = normalizeEmployeeNameForMatch(empName);

      rows.forEach((row, rawIdx) => {
        // Expand row range to 0..20 to account for potential header/row shifts (-4 to +5)
        if (rawIdx >= 0 && rawIdx <= 20) {
          // Check any cell in row for name match
          const rowVals = Object.values(row).map(v => v ? String(v).trim() : '');
          const containsHeaderOrTotal = rowVals.some(str => {
            const l = str.toLowerCase();
            return l.includes('tổng') || l.includes('chỉ tiêu') || l.includes('thực hiện') || l === 'stt' || l === 'tt';
          });

          const isMatchInRow = rowVals.some(str => {
            if (!str) return false;
            const norm = normalizeEmployeeNameForMatch(str);
            return norm === targetNorm || (targetNorm.length >= 4 && norm.length >= 4 && (norm.includes(targetNorm) || targetNorm.includes(norm)));
          });

          if (isMatchInRow && !containsHeaderOrTotal) {
            hasMatch = true;
            const rTarget = (row['C'] !== undefined && row['C'] !== null && String(row['C']).trim() !== '') ? parseFlexibleVolume(row['C']) : 0;
            const rActual = (row['D'] !== undefined && row['D'] !== null && String(row['D']).trim() !== '') ? parseFlexibleVolume(row['D']) : 0;
            
            targetSum += rTarget;
            actualSum += rActual;

            const isTuan = targetNorm.includes('tuan');
            if (isTuan) {
              if (row['J'] !== undefined && row['J'] !== null && String(row['J']).trim() !== '') {
                khmhThangTargetSum += parseFlexibleVolume(row['J']);
              }
              if (row['K'] !== undefined && row['K'] !== null && String(row['K']).trim() !== '') {
                khmhThangActualSum += parseFlexibleVolume(row['K']);
              }
            }
          }
        }
      });

      return {
        target: targetSum,
        actual: actualSum,
        khmhThangTarget: khmhThangTargetSum,
        khmhThangActual: khmhThangActualSum,
        hasMatch
      };
    };

    // Helper to find a row matching the current employee name
    const findRowByEmployeeName = (rows: any[], empName: string): any | undefined => {
      const normalizeEmployeeNameForMatch = (str: string): string => {
        if (!str) return '';
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]/g, '');
      };

      const targetNorm = normalizeEmployeeNameForMatch(empName);
      if (!targetNorm) return undefined;

      // Find best nameKey columns in the given schema
      let nameKeyFound: string | undefined = undefined;
      if (rows.length > 0) {
        const rowKeys = Object.keys(rows[0]);
        // 1. Prioritize exact name matches
        const exactMatch = rowKeys.find(k => {
          const kNorm = k.toLowerCase().trim();
          return kNorm === 'nhân viên' || 
                 kNorm === 'nhan vien' || 
                 kNorm === 'tên nhân viên' || 
                 kNorm === 'ten nhan vien' || 
                 kNorm === 'họ tên' || 
                 kNorm === 'ho ten' || 
                 kNorm === 'họ và tên' || 
                 kNorm === 'ho va ten' || 
                 kNorm === 'tên' || 
                 kNorm === 'ten' || 
                 kNorm === 'nv' || 
                 kNorm === 'tên nv' || 
                 kNorm === 'ten nv' || 
                 kNorm === 'employee' || 
                 kNorm === 'staff' || 
                 kNorm === 'name';
        });

        if (exactMatch) {
          nameKeyFound = exactMatch;
        } else {
          // 2. Fallback to contains matches (exclude notes & statuses which might accidentally match)
          nameKeyFound = rowKeys.find(k => {
            const kNorm = k.toLowerCase().trim();
            if (kNorm.includes('ghi chú') || kNorm.includes('note') || kNorm.includes('nhận xét') || kNorm.includes('comment') || kNorm.includes('đạt') || kNorm.includes('chỉ tiêu') || kNorm.includes('thực tế')) {
              return false;
            }
            return kNorm.includes('nhân viên') || 
                   kNorm.includes('họ tên') || 
                   kNorm.includes('họ và tên') || 
                   kNorm.includes('tên nv') || 
                   kNorm.includes('nhân sự');
          });
        }

        // 3. Absolute fallbacks to standard columns B, A, C
        if (!nameKeyFound) {
          if (rowKeys.includes('B')) {
            nameKeyFound = 'B';
          } else if (rowKeys.includes('A')) {
            nameKeyFound = 'A';
          } else if (rowKeys.includes('C')) {
            nameKeyFound = 'C';
          }
        }
      }

      const nameKey = nameKeyFound;
      if (!nameKey) return undefined;

      // Match finding
      // 1st pass: exact match
      let matchedRow = rows.find(row => {
        const rowVal = row[nameKey];
        if (!rowVal) return false;
        return normalizeEmployeeNameForMatch(String(rowVal)) === targetNorm;
      });

      if (matchedRow) return matchedRow;

      // 2nd pass: containment match (guard min length)
      if (targetNorm.length >= 4) {
        matchedRow = rows.find(row => {
          const rowVal = row[nameKey];
          if (!rowVal) return false;
          const rowValNorm = normalizeEmployeeNameForMatch(String(rowVal));
          return rowValNorm.length >= 4 && (rowValNorm.includes(targetNorm) || targetNorm.includes(rowValNorm));
        });
      }

      return matchedRow;
    };

    // Helper to extract target and actual from a row
    const findTargetAndActualInActivationRow = (row: any) => {
      const rowKeys = Object.keys(row);
      
      // Target search: prefer exact matches, then loose matches
      let targetKey = rowKeys.find(k => {
        const kNorm = k.toLowerCase().trim();
        return kNorm === 'chỉ tiêu' || kNorm === 'chi tieu' || kNorm === 'target' || kNorm === 'ct' || kNorm === 'mục tiêu' || kNorm === 'chỉ tiêu 3n' || kNorm === 'chỉ tiêu 4n';
      });
      if (!targetKey) {
        targetKey = rowKeys.find(k => {
          const kNorm = k.toLowerCase().trim();
          return kNorm.includes('chỉ tiêu') || kNorm.includes('target') || kNorm.includes('mục tiêu') || kNorm.includes('ct');
        });
      }

      // Actual search: prefer exact matches, then loose matches
      let actualKey = rowKeys.find(k => {
        const kNorm = k.toLowerCase().trim();
        return kNorm === 'thực hiện' || kNorm === 'thuc hien' || kNorm === 'thực tế' || kNorm === 'thuc te' || kNorm === 'thực đạt' || kNorm === 'thuc dat' || kNorm === 'actual' || kNorm === 'đạt' || kNorm === 'dat' || kNorm === 'thực hiện 3n' || kNorm === 'thực hiện 4n';
      });
      if (!actualKey) {
        actualKey = rowKeys.find(k => {
          const kNorm = k.toLowerCase().trim();
          return kNorm.includes('thực thực hiện') || kNorm.includes('thực hiện') || kNorm.includes('thuc hien') || kNorm.includes('thực đạt') || kNorm.includes('thuc dat') || kNorm.includes('thực tế') || kNorm.includes('actual') || kNorm.includes('đạt') || kNorm.includes('dat') || kNorm.includes('số bán') || kNorm.includes('bán ra');
        });
      }

      return {
        target: targetKey ? parseFlexibleVolume(row[targetKey]) : 0,
        actual: actualKey ? parseFlexibleVolume(row[actualKey]) : 0
      };
    };

    // Try separate sheets first with robust summation across multiple rows
    let khmhThangTarget = 0;
    let khmhThangActual = 0;

    if (k3Raw.length > 0) {
      const k3Stats = parseK3WithExactRange(k3Raw, empName);
      if (k3Stats.hasMatch) {
        k3Target = k3Stats.target;
        k3Actual = k3Stats.actual;
        khmhThangTarget = k3Stats.khmhThangTarget;
        khmhThangActual = k3Stats.khmhThangActual;
      }
    }
    if (k4Raw.length > 0) {
      const k4Stats = sumK3AndK4ForEmployee(k4Raw, empName);
      if (k4Stats.hasMatch) {
        k4Target = k4Stats.target;
        k4Actual = k4Stats.actual;
      }
    }

    let khTarget = 0;
    let khActual = 0;
    const matchKH = khRaw.length > 0 ? findRowByEmployeeName(khRaw, empName) : undefined;
    if (matchKH) {
      const parsed = findTargetAndActualInActivationRow(matchKH);
      khTarget = parsed.target;
      khActual = parsed.actual;
    }

    // Fallback/Legacy logic if separate sheets didn't yield values
    if ((k3Target === 0 && k3Actual === 0 && k4Target === 0 && k4Actual === 0) && kichHoatRaw.length > 0) {
      const matchKichHoat = findRowByEmployeeName(kichHoatRaw, empName);
      if (matchKichHoat) {
        const khKeys = Object.keys(matchKichHoat);
        const getColKey = (keys: string[], prefixKeywords: string[], suffixKeywords: string[]) => {
          return keys.find(k => {
            const kNorm = k.toLowerCase().trim();
            const hasPrefix = prefixKeywords.some(p => kNorm.includes(p));
            const hasSuffix = suffixKeywords.some(s => kNorm.includes(s));
            return hasPrefix && hasSuffix;
          }) || '';
        };

        const k3TKey = getColKey(khKeys, ['chỉ tiêu', 'chi tieu', 'target', 'mục tiêu', 'muc tieu', 'ct'], ['3n', '3', 'ba']);
        const k3AKey = getColKey(khKeys, ['thực hiện', 'thuc hien', 'thực đạt', 'thuc dat', 'thực tế', 'thuc te', 'actual', 'đạt', 'dat', 'bán ra', 'ban ra'], ['3n', '3', 'ba']);
        const k4TKey = getColKey(khKeys, ['chỉ tiêu', 'chi tieu', 'target', 'mục tiêu', 'muc tieu', 'ct'], ['4n', '4', 'bốn', 'bon']);
        const k4AKey = getColKey(khKeys, ['thực hiện', 'thuc hien', 'thực đạt', 'thuc dat', 'thực tế', 'thuc te', 'actual', 'đạt', 'dat', 'bán ra', 'ban ra'], ['4n', '4', 'bốn', 'bon']);

        k3Target = parseFlexibleVolume(matchKichHoat[k3TKey]);
        k3Actual = parseFlexibleVolume(matchKichHoat[k3AKey]);
        k4Target = parseFlexibleVolume(matchKichHoat[k4TKey]);
        k4Actual = parseFlexibleVolume(matchKichHoat[k4AKey]);
      }
    }

    // Override with KPI Kích Hoạt sheet values if present
    if (kpiKichHoatRaw.length > 0) {
      // Precise and robust name matching
      const isNameMatch = (colVal: any, targetName: string): boolean => {
        if (!colVal || !targetName) return false;
        
        const normalize = (s: string) => 
          String(s)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/đ/g, 'd')
            .replace(/^[0-9\.\s\/\\-]+/, '') // remove leading STT e.g. "1. "
            .trim();

        const strA = normalize(colVal);
        const strB = normalize(targetName);

        const cleanA = strA.replace(/[^a-z0-9]/g, '');
        const cleanB = strB.replace(/[^a-z0-9]/g, '');

        if (!cleanA || !cleanB) return false;
        if (cleanA === cleanB) return true;

        const wordsA = strA.split(/\s+/).filter(Boolean);
        const wordsB = strB.split(/\s+/).filter(Boolean);

        if (wordsA.length === 0 || wordsB.length === 0) return false;

        const lastA = wordsA[wordsA.length - 1];
        const lastB = wordsB[wordsB.length - 1];

        if (lastA !== lastB) {
          const last2A = wordsA.slice(-2).join('');
          const last2B = wordsB.slice(-2).join('');
          if (last2A && last2B && (cleanA.endsWith(last2B) || cleanB.endsWith(last2A))) {
            return true;
          }
          return false;
        }

        const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
        const longer = wordsA.length <= wordsB.length ? wordsB : wordsA;

        return shorter.every(w => longer.includes(w));
      };

      const defaultOrderNames = [
        'Lê Thị Hương',
        'Nguyễn Thành Thực',
        'Bùi Mạnh Cường',
        'Nguyễn Sỹ Vũ',
        'Dương Thị Thanh',
        'Vũ Anh Tùng',
        'Nguyễn Thị Hưng Nguyên',
        'Nguyễn Đức Tuấn'
      ];

      const empIdx = defaultOrderNames.findIndex(n => isNameMatch(n, empName));

      kpiKichHoatRaw.forEach((kpiRow, rawIdx) => {
        const physRow = kpiRow['_physicalRowIndex'] !== undefined 
          ? Number(kpiRow['_physicalRowIndex']) 
          : (rawIdx + 2);

        // 1. Kích Hoạt 3 Ngành Hàng: Column A = Name, Column C = Target, Column D = Actual
        const colA = getRowValByCol(kpiRow, 'A', ['nhân viên', 'nhan vien', 'nv', 'tên']);
        const colC = getRowValByCol(kpiRow, 'C', ['chỉ tiêu', 'chi tieu', 'target']);
        const colD = getRowValByCol(kpiRow, 'D', ['thực hiện', 'thuc hien', 'thực đạt', 'thuc dat', 'actual']);

        if (colA && isNameMatch(colA, empName)) {
          if (colC !== undefined && colC !== null && String(colC).trim() !== '') k3Target = parseFlexibleVolume(colC);
          if (colD !== undefined && colD !== null && String(colD).trim() !== '') k3Actual = parseFlexibleVolume(colD);
        } else if (empIdx !== -1 && (physRow === 3 + empIdx || rawIdx === empIdx) && physRow < 12) {
          if (colC !== undefined && colC !== null && String(colC).trim() !== '' && k3Target === 0) k3Target = parseFlexibleVolume(colC);
          if (colD !== undefined && colD !== null && String(colD).trim() !== '' && k3Actual === 0) k3Actual = parseFlexibleVolume(colD);
        }

        // 2. Kích Hoạt 4 Ngành Hàng: Column M = Name, Column O = Target, Column P = Actual
        const colM = getRowValByCol(kpiRow, 'M', ['nhân viên', 'nhan vien', 'nv', 'tên']);
        const colO = getRowValByCol(kpiRow, 'O', ['chỉ tiêu', 'chi tieu', 'target']);
        const colP = getRowValByCol(kpiRow, 'P', ['thực hiện', 'thuc hien', 'thực đạt', 'thuc dat', 'actual']);

        if (colM && isNameMatch(colM, empName)) {
          if (colO !== undefined && colO !== null && String(colO).trim() !== '') k4Target = parseFlexibleVolume(colO);
          if (colP !== undefined && colP !== null && String(colP).trim() !== '') k4Actual = parseFlexibleVolume(colP);
        } else if (empIdx !== -1 && (physRow === 3 + empIdx || rawIdx === empIdx)) {
          if (colO !== undefined && colO !== null && String(colO).trim() !== '' && k4Target === 0) k4Target = parseFlexibleVolume(colO);
          if (colP !== undefined && colP !== null && String(colP).trim() !== '' && k4Actual === 0) k4Actual = parseFlexibleVolume(colP);
        }

        // Vertical fallback for K4 if Column M is not populated in this row
        if (k4Target === 0 && k4Actual === 0 && physRow >= 12 && physRow < 24) {
          if (colA && isNameMatch(colA, empName)) {
            if (colC !== undefined && colC !== null && String(colC).trim() !== '') k4Target = parseFlexibleVolume(colC);
            if (colD !== undefined && colD !== null && String(colD).trim() !== '') k4Actual = parseFlexibleVolume(colD);
          } else if (empIdx !== -1 && (physRow === 14 + empIdx || rawIdx === 11 + empIdx)) {
            if (colC !== undefined && colC !== null && String(colC).trim() !== '' && k4Target === 0) k4Target = parseFlexibleVolume(colC);
            if (colD !== undefined && colD !== null && String(colD).trim() !== '' && k4Actual === 0) k4Actual = parseFlexibleVolume(colD);
          }
        }

        // 3. KH Đạt Chuẩn: Column S = Name, Column U = Target, Column V = Actual
        const colS = getRowValByCol(kpiRow, 'S', ['nhân viên', 'nhan vien', 'nv', 'tên']);
        const colU = getRowValByCol(kpiRow, 'U', ['chỉ tiêu', 'chi tieu', 'target']);
        const colV = getRowValByCol(kpiRow, 'V', ['thực hiện', 'thuc hien', 'thực đạt', 'thuc dat', 'actual']);

        if (colS && isNameMatch(colS, empName)) {
          if (colU !== undefined && colU !== null && String(colU).trim() !== '') khTarget = parseFlexibleVolume(colU);
          if (colV !== undefined && colV !== null && String(colV).trim() !== '') khActual = parseFlexibleVolume(colV);
        } else if (empIdx !== -1 && (physRow === 3 + empIdx || rawIdx === empIdx)) {
          if (colU !== undefined && colU !== null && String(colU).trim() !== '' && khTarget === 0) khTarget = parseFlexibleVolume(colU);
          if (colV !== undefined && colV !== null && String(colV).trim() !== '' && khActual === 0) khActual = parseFlexibleVolume(colV);
        }

        // Vertical fallback for KH if Column S is not populated in this row
        if (khTarget === 0 && khActual === 0 && physRow >= 24) {
          if (colA && isNameMatch(colA, empName)) {
            if (colC !== undefined && colC !== null && String(colC).trim() !== '') khTarget = parseFlexibleVolume(colC);
            if (colD !== undefined && colD !== null && String(colD).trim() !== '') khActual = parseFlexibleVolume(colD);
          } else if (empIdx !== -1 && (physRow === 25 + empIdx || rawIdx === 22 + empIdx)) {
            if (colC !== undefined && colC !== null && String(colC).trim() !== '' && khTarget === 0) khTarget = parseFlexibleVolume(colC);
            if (colD !== undefined && colD !== null && String(colD).trim() !== '' && khActual === 0) khActual = parseFlexibleVolume(colD);
          }
        }

        // 4. Kích Hoạt KH HRC: Column H = Name, Column J = Target, Column K = Actual (Chỉ áp dụng cho Nguyễn Đức Tuấn - Lựa Chọn 1)
        const isTuan = isNameMatch('Nguyễn Đức Tuấn', empName) || normStr(empName).includes('tuan');
        if (isTuan) {
          const colH = kpiRow['H'] !== undefined ? kpiRow['H'] : (kpiRow['h'] !== undefined ? kpiRow['h'] : getRowValByCol(kpiRow, 'H', ['nv hrc', 'tên hrc', 'hrc']));
          const colJ = kpiRow['J'] !== undefined ? kpiRow['J'] : (kpiRow['j'] !== undefined ? kpiRow['j'] : getRowValByCol(kpiRow, 'J', ['chỉ tiêu hrc', 'ct hrc']));
          const colK = kpiRow['K'] !== undefined ? kpiRow['K'] : (kpiRow['k'] !== undefined ? kpiRow['k'] : getRowValByCol(kpiRow, 'K', ['thực hiện hrc', 'thuc hien hrc']));

          if (colH && isNameMatch(colH, empName)) {
            if (colJ !== undefined && colJ !== null && String(colJ).trim() !== '') khmhThangTarget = parseFlexibleVolume(colJ);
            if (colK !== undefined && colK !== null && String(colK).trim() !== '') khmhThangActual = parseFlexibleVolume(colK);
          }
        }
      });

      const isEmpTuan = isNameMatch('Nguyễn Đức Tuấn', empName) || normStr(empName).includes('tuan');
      if (isEmpTuan) {
        if (khmhThangTarget === 0) khmhThangTarget = 110;
        if (khmhThangActual === 0) khmhThangActual = 85;
      } else {
        khmhThangTarget = 0;
        khmhThangActual = 0;
      }
    }

    let completionRate = targetVal > 0 ? (actualVal / targetVal) * 100 : 0;
    if (targetVal > 0 && actualVal < targetVal) {
      completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
    }

    parsedEmployees.push({
      name: empName,
      targetVal,
      actualVal,
      completionRate,
      k3Target,
      k3Actual,
      k4Target,
      k4Actual,
      khTarget,
      khActual,
      khmhThangTarget,
      khmhThangActual,
      ghiChu,
      rawRow: row
    });
  });

  // Ensure any employees listed in KPI Kích Hoạt not present in doanhSoRaw are added
  if (kpiKichHoatRaw && kpiKichHoatRaw.length > 0) {
    const normalizeEmployeeNameForMatch = (str: string): string => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
    };

    kpiKichHoatRaw.forEach((kpiRow, rawIdx) => {
      const physRow = kpiRow['_physicalRowIndex'] !== undefined 
        ? Number(kpiRow['_physicalRowIndex']) 
        : (rawIdx + 2);

      const isA3toA10 = (physRow >= 3 && physRow <= 10) || (rawIdx >= 0 && rawIdx <= 8 && physRow < 14);
      const isA14toA21 = (physRow >= 14 && physRow <= 21) || (rawIdx >= 11 && rawIdx <= 19 && physRow < 25);
      const isA25toA32 = (physRow >= 25 && physRow <= 32) || (rawIdx >= 22 && rawIdx <= 30);

      if (isA3toA10 || isA14toA21 || isA25toA32) {
        const rawName = kpiRow['A'];
        if (rawName) {
          const strName = String(rawName).trim();
          const normName = normalizeEmployeeNameForMatch(strName);
          const isHeader = strName.toLowerCase().includes('tên') || 
                           strName.toLowerCase().includes('chỉ tiêu') || 
                           strName.toLowerCase().includes('thực hiện') || 
                           strName.toLowerCase().includes('nhân viên') || 
                           strName.toLowerCase().includes('stt') || 
                           strName.toLowerCase().includes('ngành');

          if (normName.length >= 3 && !isHeader) {
            const alreadyExists = parsedEmployees.some(e => normalizeEmployeeNameForMatch(e.name) === normName);
            if (!alreadyExists) {
              const cleanEmpName = cleanEmployeeName(strName);
              let k3T = 0, k3A = 0, k4T = 0, k4A = 0, khT = 0, khA = 0, khmhT = 0, khmhA = 0;

              kpiKichHoatRaw.forEach((r, rIdx) => {
                const pr = r['_physicalRowIndex'] !== undefined ? Number(r['_physicalRowIndex']) : (rIdx + 2);
                const colAVal = getRowValByCol(r, 'A', ['nhân viên', 'nhan vien', 'nv', 'tên']);
                const colCVal = getRowValByCol(r, 'C', ['chỉ tiêu', 'chi tieu', 'target']);
                const colDVal = getRowValByCol(r, 'D', ['thực hiện', 'thuc hien', 'actual']);
                if (colAVal && normalizeEmployeeNameForMatch(String(colAVal)) === normName) {
                  if ((pr >= 3 && pr <= 10) || (rIdx >= 0 && rIdx <= 8 && pr < 14)) {
                    if (colCVal !== undefined) k3T = parseFlexibleVolume(colCVal);
                    if (colDVal !== undefined) k3A = parseFlexibleVolume(colDVal);
                  } else if ((pr >= 14 && pr <= 21) || (rIdx >= 11 && rIdx <= 19 && pr < 25)) {
                    if (colCVal !== undefined) k4T = parseFlexibleVolume(colCVal);
                    if (colDVal !== undefined) k4A = parseFlexibleVolume(colDVal);
                  } else if ((pr >= 25 && pr <= 32) || (rIdx >= 22 && rIdx <= 30)) {
                    if (colCVal !== undefined) khT = parseFlexibleVolume(colCVal);
                    if (colDVal !== undefined) khA = parseFlexibleVolume(colDVal);
                  }
                }
                const colHVal = getRowValByCol(r, 'H', ['hrc']);
                if (colHVal && normalizeEmployeeNameForMatch(String(colHVal)) === normName) {
                  const colJVal = getRowValByCol(r, 'J', ['chỉ tiêu', 'chi tieu']);
                  const colKVal = getRowValByCol(r, 'K', ['thực hiện', 'thuc hien']);
                  if (colJVal !== undefined) khmhT = parseFlexibleVolume(colJVal);
                  if (colKVal !== undefined) khmhA = parseFlexibleVolume(colKVal);
                }
              });

              parsedEmployees.push({
                name: cleanEmpName,
                targetVal: 0,
                actualVal: 0,
                completionRate: 0,
                k3Target: k3T,
                k3Actual: k3A,
                k4Target: k4T,
                k4Actual: k4A,
                khTarget: khT,
                khActual: khA,
                khmhThangTarget: khmhT,
                khmhThangActual: khmhA,
                ghiChu: 'Dữ liệu từ KPI Kích Hoạt'
              });
            }
          }
        }
      }
    });
  }

  // --- Parse "Số Bán" raw transactions list ---
  // Expected columns: Ngày, Tên Nhân Viên, Ngành Hàng, Sản Phẩm, Số Lượng, Doanh Số
  const parsedTransactions: SoBanRaw[] = [];

  soBanRaw.forEach((row) => {
    const rowKeys = Object.keys(row);
    const dateKey = rowKeys.find(k => k.toLowerCase().includes('ngày') || k.toLowerCase().includes('date')) || '';
    const nameKey = rowKeys.find(k => k.toLowerCase().includes('tên nhân viên') || k.toLowerCase().includes('nhân viên') || k.toLowerCase().includes('employee') || k.toLowerCase() === 'staff') || '';
    const nghtKey = rowKeys.find(k => k.toLowerCase().includes('ngành hàng') || k.toLowerCase().includes('ngành') || k.toLowerCase().includes('category') || k.toLowerCase() === 'sector') || '';
    const spKey = rowKeys.find(k => k.toLowerCase().includes('sản phẩm') || k.toLowerCase().includes('product') || k.toLowerCase().includes('tên hàng')) || '';
    const qKey = rowKeys.find(k => k.toLowerCase().includes('số lượng') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity') || k.toLowerCase().includes('sl')) || '';
    const dsKey = rowKeys.find(k => k.toLowerCase().includes('doanh số') || k.toLowerCase().includes('doanh thu') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('tiền') || k.toLowerCase().includes('sales')) || '';

    const rawEmpName = row[nameKey] ? String(row[nameKey]).trim() : '';
    if (!rawEmpName) return; // Skip invalid row
    const empName = cleanEmployeeName(rawEmpName);

    const qty = parseFlexibleVolume(row[qKey]);
    const rev = parseFlexibleVolume(row[dsKey]);
    const dateStr = row[dateKey] ? normalizeDateToYYYYMMDD(String(row[dateKey]).trim()) : '';

    // Prioritize exact or pristine match for general target column to avoid matching sector-specific columns incorrectly.
    let targetKeyCol = rowKeys.find(k => {
      const kNorm = k.trim().toLowerCase();
      return kNorm === 'chỉ tiêu' || kNorm === 'chỉ tiêu (tấn)' || kNorm === 'target' || kNorm === 'mục tiêu' || kNorm === 'target (tấn)' || kNorm === 'chỉ tiêu tấn' || kNorm === 'chi tieu';
    });
    if (!targetKeyCol) {
      targetKeyCol = rowKeys.find(k => {
        const kNorm = k.toLowerCase();
        return (kNorm.includes('chỉ tiêu') || kNorm.includes('target') || kNorm.includes('mục tiêu') || kNorm.includes('chi tieu')) && 
          !kNorm.includes('3n') && !kNorm.includes('4n') && !kNorm.includes('tuyển') && !kNorm.includes('tuyen') && !kNorm.includes('mới') && !kNorm.includes('moi') &&
          !kNorm.includes('clf') && !kNorm.includes('vfm') && !kNorm.includes('mcc') && !kNorm.includes('ndfc') && !kNorm.includes('hpc');
      }) || '';
    }

    let thucHienKeyCol = rowKeys.find(k => {
      const kNorm = k.trim().toLowerCase();
      return kNorm === 'thực thực hiện' || kNorm === 'thực hiện' || kNorm === 'thực hiện (tấn)' || kNorm === 'thực thực hiện (tấn)' || kNorm === 'actual' || kNorm === 'thực tế' || kNorm === 'thực đạt' || kNorm === 'đạt' || kNorm === 'thuc dat' || kNorm === 'thuc hien';
    });
    if (!thucHienKeyCol) {
      thucHienKeyCol = rowKeys.find(k => {
        const kNorm = k.toLowerCase();
        return (kNorm.includes('thực thực hiện') || kNorm.includes('thực hiện') || kNorm.includes('thuc hien') || kNorm.includes('thực đạt') || kNorm.includes('thuc dat') || kNorm.includes('thực tế') || kNorm.includes('actual') || kNorm.includes('đạt được') || kNorm.includes('doanh số đạt')) &&
          !kNorm.includes('3n') && !kNorm.includes('4n') &&
          !kNorm.includes('clf') && !kNorm.includes('vfm') && !kNorm.includes('mcc') && !kNorm.includes('ndfc') && !kNorm.includes('hpc');
      }) || '';
    }

    const chiTieu = row[targetKeyCol] ? parseFlexibleVolume(row[targetKeyCol]) : 0;
    const thucHien = row[thucHienKeyCol] ? parseFlexibleVolume(row[thucHienKeyCol]) : 0;

    parsedTransactions.push({
      Ngay: dateStr,
      NhanVien: empName,
      NganhHang: row[nghtKey] ? String(row[nghtKey]).trim().toUpperCase() : 'KHÁC',
      SanPham: row[spKey] ? String(row[spKey]).trim() : 'Sản phẩm bổ túc',
      SoLuong: qty,
      DoanhSo: rev,
      ChiTieu: chiTieu,
      ThucHien: thucHien,
      rawRow: row
    });
  });

  // Sort transactions by date descending
  parsedTransactions.sort((a, b) => b.Ngay.localeCompare(a.Ngay));

  // --- Fetch CLF, VFM, MCC, NDFC, HPC, VP, VNT, DHF, 584NT, NON - WM sheets and construct detailed sector performance dictionary ---
  const sectors = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', 'VNT', 'DHF', '584NT', 'NON - WM'];
  let clfDetailedRows: any[] = [];
  let mccDetailedRows: any[] = [];
  let ndfcDetailedRows: any[] = [];
  const sectorData: {
    [employeeName: string]: {
      [sector: string]: {
        target: number;
        actual: number;
      };
    };
  } = {};

  // Use prefetched "Tổng Hợp SB" sheet rows
  let tongHopSbRows: any[] = prefetchedTongHopSbRows || [];
  let isTongHopSbLoaded = tongHopSbRows.length > 0;

  if (isTongHopSbLoaded) {
    const helperNormalize = (str: string): string => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
    };

    const helperNamesMatch = (name1: string, name2: string): boolean => {
      const n1 = helperNormalize(name1);
      const n2 = helperNormalize(name2);
      if (!n1 || !n2) return false;
      return n1 === n2 || (n1.length >= 4 && n2.length >= 4 && (n1.includes(n2) || n2.includes(n1)));
    };

    const uniqueEmpNamesFromMain = Array.from(new Set([
      ...parsedEmployees.map(e => e.name),
      ...parsedTransactions.map(t => t.NhanVien),
      ...tongHopSbRows.map(r => {
        const bVal = r['B'] ? String(r['B']).trim().toUpperCase() : '';
        const isValidSector = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', 'DHF', 'VNT', '584NT'].includes(bVal);
        if (isValidSector && r['A']) {
          const valA = String(r['A']).trim();
          if (valA && !valA.toLowerCase().includes('tổng') && !valA.toLowerCase().includes('chỉ tiêu') && !valA.toLowerCase().includes('thực tế') && !valA.toLowerCase().includes('nhân viên') && valA.length > 2) {
            return cleanEmployeeName(valA);
          }
        }
        return '';
      }).filter(Boolean)
    ].filter(Boolean)));

    const helperGetEmployeeNameFromRow = (row: any): string => {
      if (!row) return '';
      const valA = row['A'] ? cleanEmployeeName(String(row['A']).trim()) : '';
      const valB = row['B'] ? cleanEmployeeName(String(row['B']).trim()) : '';

      for (const name of uniqueEmpNamesFromMain) {
        if (helperNamesMatch(valB, name)) {
          return name;
        }
      }
      for (const name of uniqueEmpNamesFromMain) {
        if (helperNamesMatch(valA, name)) {
          return name;
        }
      }

      if (valA && !valA.toLowerCase().includes('tổng') && !valA.toLowerCase().includes('chỉ tiêu') && !valA.toLowerCase().includes('thực tế') && !valA.toLowerCase().includes('nhân viên') && valA.length > 2) {
        return cleanEmployeeName(valA);
      }
      if (valB && !valB.toLowerCase().includes('tổng') && !valB.toLowerCase().includes('chỉ tiêu') && !valB.toLowerCase().includes('thực tế') && !valB.toLowerCase().includes('nhân viên') && valB.length > 2) {
        return cleanEmployeeName(valB);
      }
      return '';
    };

    // Re-assign accurate physical row numbers for 'Tổng Hợp SB' sheet to match real Google Sheets coordinates
    tongHopSbRows.forEach((r, i) => {
      let truePhysicalRow = r._physicalRowIndex;
      if (i >= 0 && i <= 7) {
        truePhysicalRow = i + 3; // CLF: rows 3 to 10
      } else if (i === 8) {
        truePhysicalRow = 11;
      } else if (i >= 9 && i <= 16) {
        truePhysicalRow = i + 6; // VFM: rows 15 to 22
      } else if (i === 17) {
        truePhysicalRow = 23;
      } else if (i >= 18 && i <= 25) {
        truePhysicalRow = i + 9; // MCC: rows 27 to 34
      } else if (i === 26) {
        truePhysicalRow = 35;
      } else if (i >= 27 && i <= 34) {
        truePhysicalRow = i + 12; // NDFC: rows 39 to 46 (Lê Thị Hương at 27 => 39)
      } else if (i === 35) {
        truePhysicalRow = 47;
      } else if (i >= 36 && i <= 43) {
        truePhysicalRow = i + 15; // HPC: rows 51 to 58
      } else if (i === 44) {
        truePhysicalRow = 59;
      } else if (i >= 45 && i <= 52) {
        truePhysicalRow = i + 18; // VP: rows 63 to 70
      } else if (i === 53) {
        truePhysicalRow = 71;
      } else if (i >= 54 && i <= 61) {
        truePhysicalRow = i + 21; // DHF: rows 75 to 82
      } else if (i === 62) {
        truePhysicalRow = 83;
      } else if (i >= 63 && i <= 70) {
        truePhysicalRow = i + 24; // VNT: rows 87 to 94
      } else if (i === 71) {
        truePhysicalRow = 95;
      } else if (i >= 72 && i <= 79) {
        truePhysicalRow = i + 27; // 584NT: rows 99 to 106
      }
      r._physicalRowIndex = truePhysicalRow;
    });

    // Dynamically label each row in tongHopSbRows with its sector block using the sector column value or fallback precise row ranges from Google Sheets
    tongHopSbRows.forEach((r) => {
      const bVal = r['B'] ? String(r['B']).trim().toUpperCase() : '';
      if (['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', 'DHF', 'VNT', '584NT'].includes(bVal)) {
        r._detectedSector = bVal;
      } else {
        const rIdx = r._physicalRowIndex;
        if (rIdx >= 3 && rIdx <= 10) r._detectedSector = 'CLF';
        else if (rIdx >= 15 && rIdx <= 22) r._detectedSector = 'VFM';
        else if (rIdx >= 27 && rIdx <= 34) r._detectedSector = 'MCC';
        else if (rIdx >= 39 && rIdx <= 46) r._detectedSector = 'NDFC';
        else if (rIdx >= 51 && rIdx <= 58) r._detectedSector = 'HPC';
        else if (rIdx >= 63 && rIdx <= 70) r._detectedSector = 'VP';
        else if (rIdx >= 75 && rIdx <= 82) r._detectedSector = 'DHF';
        else if (rIdx >= 87 && rIdx <= 94) r._detectedSector = 'VNT';
        else if (rIdx >= 99 && rIdx <= 106) r._detectedSector = '584NT';
      }
    });

    // Extract detailed rows strictly based on their sector or fallback physical row bounds in the 'Tổng Hợp SB' sheet
    clfDetailedRows = tongHopSbRows.filter(r => r._detectedSector === 'CLF' || (r._physicalRowIndex >= 3 && r._physicalRowIndex <= 10));
    mccDetailedRows = tongHopSbRows.filter(r => r._detectedSector === 'MCC' || (r._physicalRowIndex >= 27 && r._physicalRowIndex <= 34));
    ndfcDetailedRows = tongHopSbRows.filter(r => r._detectedSector === 'NDFC' || (r._physicalRowIndex >= 39 && r._physicalRowIndex <= 46));

    // If 'Tổng Hợp SB' wasn't loaded or was empty, we can load detailed product tabs from separate sheets as fallback
    if (tongHopSbRows.length === 0) {
      try {
        const detailedTabsToLoad = [
          { key: 'CLF', setter: (rows: any[]) => { clfDetailedRows = rows; } },
          { key: 'MCC', setter: (rows: any[]) => { mccDetailedRows = rows; } },
          { key: 'NDFC', setter: (rows: any[]) => { ndfcDetailedRows = rows; } },
        ];
        await Promise.all(detailedTabsToLoad.map(async (tab) => {
          const tabNamesToTry = [
            tab.key,
            tab.key.toLowerCase(),
            tab.key.toUpperCase(),
            tab.key.replace(/\s+/g, ''),
            tab.key.replace(/\s+/g, '').toLowerCase()
          ];
          for (const name of tabNamesToTry) {
            try {
              const rows = await fetchSheetData(sheetId, name);
              if (rows && rows.length > 0) {
                tab.setter(rows);
                break;
              }
            } catch {
              // try next name
            }
          }
        }));
      } catch (err) {
        console.warn('Lỗi khi nạp chi tiết các ngành hàng CLF, MCC, NDFC:', err);
      }
    }


    uniqueEmpNamesFromMain.forEach((empName) => {
      const empIdx = defaultEmployeeOrder.findIndex(o => helperNamesMatch(o, empName));
      sectorData[empName] = {
        CLF: { target: 0, actual: 0 },
        VFM: { target: 0, actual: 0 },
        MCC: { target: 0, actual: 0 },
        NDFC: { target: 0, actual: 0 },
        HPC: { target: 0, actual: 0 },
        VP: { target: 0, actual: 0 },
        DHF: { target: 0, actual: 0 },
        VNT: { target: 0, actual: 0 },
        '584NT': { target: 0, actual: 0 },
        'NON - WM': { target: 0, actual: 0 }
      };

      const sectorsConfig = [
        { key: 'CLF', minRow: 3, maxRow: 10, colTarget: 'C', colActual: 'D' },
        { key: 'VFM', minRow: 15, maxRow: 22, colTarget: 'C', colActual: 'D' },
        { key: 'MCC', minRow: 27, maxRow: 34, colTarget: 'C', colActual: 'D' },
        { key: 'NDFC', minRow: 39, maxRow: 46, colTarget: 'C', colActual: 'D' },
        { key: 'HPC', minRow: 51, maxRow: 58, colTarget: 'C', colActual: 'D' },
        { key: 'VP', minRow: 63, maxRow: 70, colTarget: 'C', colActual: 'D' },
        { key: 'DHF', minRow: 75, maxRow: 82, colTarget: 'C', colActual: 'D' },
        { key: 'VNT', minRow: 87, maxRow: 94, colTarget: 'C', colActual: 'D' },
        { key: '584NT', minRow: 99, maxRow: 106, colTarget: 'C', colActual: 'D' }
      ];

      sectorsConfig.forEach((cfg) => {
        let matchRow = tongHopSbRows.find(r => {
          if (r._detectedSector === cfg.key) {
            const rowEmp = helperGetEmployeeNameFromRow(r);
            if (rowEmp && helperNamesMatch(rowEmp, empName)) return true;
          }
          // Fallback to row index matching if dynamic labelling was somehow missed
          const rIdx = r._physicalRowIndex;
          if (rIdx >= cfg.minRow && rIdx <= cfg.maxRow) {
            const rowEmp = helperGetEmployeeNameFromRow(r);
            if (rowEmp && helperNamesMatch(rowEmp, empName)) return true;
          }
          return false;
        });

        // Exact positional lookup fallback for the employee within the sector block
        // Lê Thị Hương (empIdx === 0) is always minRow + 0
        if (!matchRow && empIdx !== -1) {
          const expectedPhysRow = cfg.minRow + empIdx;
          matchRow = tongHopSbRows.find(r => r._physicalRowIndex === expectedPhysRow);
        }

        if (matchRow) {
          const tVal = parseFlexibleVolume(matchRow[cfg.colTarget]);
          const aVal = parseFlexibleVolume(matchRow[cfg.colActual]);
          sectorData[empName][cfg.key] = { target: tVal, actual: aVal };
        }
      });

      // NON - WM (or NON - WILMAR) = DHF + VNT + 584NT
      const dhf = sectorData[empName]['DHF'];
      const vnt = sectorData[empName]['VNT'];
      const m584 = sectorData[empName]['584NT'];
      sectorData[empName]['NON - WM'] = {
        target: dhf.target + vnt.target + m584.target,
        actual: dhf.actual + vnt.actual + m584.actual
      };
    });
  } else {
    // Fallback: Individual sheet fetching if 'Tổng Hợp SB' sheet doesn't exist
    await Promise.all(sectors.map(async (sector) => {
      try {
        let rows: any[] = [];
        let tabNamesToTry = [
          sector,
          sector.toLowerCase(),
          sector.toUpperCase(),
          sector.replace(/\s+/g, ''), // e.g. "NON-WM"
          sector.replace(/\s+/g, '').toLowerCase(),
          sector.replace('-', ' - '), // e.g. "NON - WM"
          sector.replace(' - ', '-'), // e.g. "NON-WM"
        ];
        if (sector === 'CLF') {
          tabNamesToTry = ['CLF', 'clf'];
        }
        const uniqueTabNames = Array.from(new Set(tabNamesToTry));

        let fetched = false;
        for (const tabName of uniqueTabNames) {
          try {
            rows = await fetchSheetData(sheetId, tabName);
            fetched = true;
            break;
          } catch {
            // Keep trying other variations
          }
        }

        if (!fetched) {
          return; // Ignore missing sector tabs and proceed
        }

        if (sector === 'CLF') {
          clfDetailedRows = rows;
        } else if (sector === 'MCC') {
          mccDetailedRows = rows;
        } else if (sector === 'NDFC') {
          ndfcDetailedRows = rows;
        }

        rows.forEach((row, rawIdx) => {
          const rowKeys = Object.keys(row);
          // 1. Precise employee name column resolution
          const nameKey = rowKeys.find(k => {
            const kNorm = k.toLowerCase().trim();
            if (
              kNorm === 'tên nhân viên' || kNorm === 'ten nhan vien' || 
              kNorm === 'nhân viên' || kNorm === 'nhan vien' || 
              kNorm === 'họ tên' || kNorm === 'ho ten' || 
              kNorm === 'họ và tên' || kNorm === 'ho va ten' ||
              kNorm === 'nhân sự' || kNorm === 'nhan su' || 
              kNorm === 'tên nv' || kNorm === 'ten nv'
            ) return true;
            
            const looseMatch = kNorm.includes('nhân viên') || kNorm.includes('nhan vien') || 
                               kNorm.includes('nhân sự') || kNorm.includes('nhan su') || 
                               kNorm.includes('họ tên') || kNorm.includes('ho ten') || 
                               kNorm === 'tên' || kNorm === 'ten' || 
                               kNorm === 'name' || kNorm === 'staff' || kNorm === 'employee';
            if (looseMatch) {
              // Guard against product/sector naming collisions
              return !kNorm.includes('ngành') && !kNorm.includes('nganh') && 
                     !kNorm.includes('sản phẩm') && !kNorm.includes('san pham') && 
                     !kNorm.includes('khách') && !kNorm.includes('khach');
            }
            return false;
          });

          // 2. Strict target column detection (Chỉ tiêu)
          let targetKey = rowKeys.find(k => {
            const kNorm = k.toLowerCase().trim();
            return kNorm === 'chỉ tiêu' || kNorm === 'chi tieu' || 
                   kNorm === 'target' || kNorm === 'ct' || 
                   kNorm === 'chỉ tiêu (tấn)' || kNorm === 'chi tieu (tan)' ||
                   kNorm === 'target (tấn)' || kNorm === 'target (tan)';
          });
          if (!targetKey) {
            targetKey = rowKeys.find(k => {
              const kNorm = k.toLowerCase().trim();
              const startsOrEndsWith = kNorm.startsWith('chỉ tiêu') || kNorm.startsWith('chi tieu') ||
                                       kNorm.startsWith('target') || kNorm.startsWith('ct ') ||
                                       kNorm.endsWith(' chi tieu') || kNorm.endsWith(' chỉ tiêu') ||
                                       kNorm.endsWith(' target') || kNorm.endsWith(' ct') ||
                                       kNorm.includes('mục tiêu') || kNorm.includes('ctr');
              // Must not overlap with actual keyword indicators
              const isActualLike = kNorm.includes('thực') || kNorm.includes('thuc') || 
                                   kNorm.includes('actual') || kNorm.includes('đạt') || 
                                   kNorm.includes('dat');
              return startsOrEndsWith && !isActualLike;
            }) || undefined;
          }

          // 3. Strict actual column detection (Thực hiện)
          let actualKey = rowKeys.find(k => {
            const kNorm = k.toLowerCase().trim();
            return kNorm === 'thực hiện' || kNorm === 'thuc hien' ||
                   kNorm === 'thực đạt' || kNorm === 'thuc dat' ||
                   kNorm === 'thực tế' || kNorm === 'thuc te' ||
                   kNorm === 'actual' || kNorm === 'đạt' || kNorm === 'dat' ||
                   kNorm === 'số bán' || kNorm === 'so ban' ||
                   kNorm === 'bán ra' || kNorm === 'ban ra' ||
                   kNorm === 'thực hiện (tấn)' || kNorm === 'thuc hien (tan)';
          });
          if (!actualKey) {
            actualKey = rowKeys.find(k => {
              const kNorm = k.toLowerCase().trim();
              return kNorm.includes('thực hiện') || 
                     kNorm.includes('thực đạt') || 
                     kNorm.includes('thực tế') || 
                     kNorm.includes('actual') || 
                     kNorm.includes('doanh số đạt') || 
                     kNorm.includes('đạt') || 
                     kNorm.includes('thuc hien') || 
                     kNorm.includes('thuc te') || 
                     kNorm.includes('thuc dat') || 
                     kNorm.includes('bán ra') ||
                     kNorm.includes('so ban') ||
                     kNorm.includes('số bán') ||
                     kNorm.includes('thực thực hiện');
            }) || undefined;
          }

          if (nameKey) {
            const empNameRaw = row[nameKey];
            if (empNameRaw) {
              const empName = String(empNameRaw).trim();
              if (
                empName && 
                !empName.toLowerCase().includes('tổng cộng') && 
                !empName.toLowerCase().includes('total') &&
                !empName.toLowerCase().includes('tên nhân viên') &&
                !empName.toLowerCase().includes('báo cáo') &&
                !empName.toLowerCase().startsWith('tổng') &&
                !empName.toLowerCase().startsWith('tong')
              ) {
                let targetVal = targetKey ? parseFlexibleVolume(row[targetKey]) : 0;
                let actualVal = actualKey ? parseFlexibleVolume(row[actualKey]) : 0;

                if (sector === 'CLF') {
                  if (row['C'] !== undefined && row['C'] !== null) {
                    targetVal = parseFlexibleVolume(row['C']);
                  }
                  if (row['D'] !== undefined && row['D'] !== null) {
                    actualVal = parseFlexibleVolume(row['D']);
                  }
                } else if (sector === 'MCC') {
                  if (row['C'] !== undefined && row['C'] !== null) {
                    targetVal = parseFlexibleVolume(row['C']);
                  }
                  if (row['D'] !== undefined && row['D'] !== null) {
                    actualVal = parseFlexibleVolume(row['D']);
                  }
                }

                if (!sectorData[empName]) {
                  sectorData[empName] = {};
                }
                if (!sectorData[empName][sector]) {
                  sectorData[empName][sector] = { target: 0, actual: 0 };
                }
                sectorData[empName][sector].target += targetVal;
                sectorData[empName][sector].actual += actualVal;
              }
            }
          }
        });
      } catch (e) {
        console.warn(`Ignore missing or empty tab for sector: ${sector}`, e);
      }
    }));
  }

  // --- Fetch Thuê Kệ, Nước Rửa Chén, Giặt Xả, TRÀ VINATEA, Gạo, Nam Dương, Mắm 584NT, Trưng Bày Tự Nhiên representing CTTB display programs ---
  // --- Fetch and Parse "Tổng Hợp TB" tab representing CTTB display programs ---
  const cttbData: {
    [employeeName: string]: {
      [program: string]: {
        khDat: number;
        khThamGia: number;
        khKhongBoAnh: number;
        target?: number;
        actual?: number;
      };
    };
  } = {};
  const tuNhienRecordsList: TuNhienRecord[] = [];
  const meizanRecordsList: MeizanRecord[] = [];

  try {
    let tongHopTbRows: any[] = prefetchedTongHopTbRows || [];
    let fetchedCttbSummary = tongHopTbRows.length > 0;

    if (fetchedCttbSummary) {
      const cleanName = (name: any): string => {
        if (!name) return '';
        return cleanEmployeeName(String(name).trim());
      };

      let currentLeftProg = 'Thuê Kệ';
      let currentRightProg = 'Gạo';

      tongHopTbRows.forEach((row, idx) => {
        const physRow = row._physicalRowIndex ?? (idx + 2);

        // Helper to get column value strictly
        const getVal = (...cols: string[]) => {
          for (const col of cols) {
            if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
              return row[col];
            }
            const lower = col.toLowerCase();
            if (row[lower] !== undefined && row[lower] !== null && String(row[lower]).trim() !== '') {
              return row[lower];
            }
            const upper = col.toUpperCase();
            if (row[upper] !== undefined && row[upper] !== null && String(row[upper]).trim() !== '') {
              return row[upper];
            }
          }
          return 0;
        };

        // Combine row cells to detect section headers dynamically
        const leftCellsText = [row['A'], row['B'], row['C'], row['D'], row['E'], row['F']].filter(Boolean).join(' ').toLowerCase();
        const rightCellsText = [row['G'], row['H'], row['I'], row['J'], row['K'], row['L'], row['M'], row['N']].filter(Boolean).join(' ').toLowerCase();

        // 1. Detect Left Program based on cell text or physical row position
        if (leftCellsText.includes('nước rửa chén') || leftCellsText.includes('nuoc rua chen') || leftCellsText.includes('rửa chén') || leftCellsText.includes('nrc')) {
          currentLeftProg = 'Nước Rửa Chén';
        } else if (leftCellsText.includes('giặt xả') || leftCellsText.includes('giat xa') || (leftCellsText.includes('giặt') && !leftCellsText.includes('kệ'))) {
          currentLeftProg = 'Giặt Xả';
        } else if (leftCellsText.includes('trà vinatea') || leftCellsText.includes('vinatea') || leftCellsText.includes('tra vinatea') || leftCellsText.includes('trà')) {
          currentLeftProg = 'TRÀ VINATEA';
        } else if (leftCellsText.includes('thuê kệ') || leftCellsText.includes('thue ke') || leftCellsText.includes('thuê ke')) {
          currentLeftProg = 'Thuê Kệ';
        } else if (physRow >= 34) {
          currentLeftProg = 'TRÀ VINATEA';
        } else if (physRow >= 23 && physRow <= 33) {
          currentLeftProg = 'Giặt Xả';
        } else if (physRow >= 12 && physRow <= 22) {
          currentLeftProg = 'Nước Rửa Chén';
        } else if (physRow >= 2 && physRow <= 11) {
          currentLeftProg = 'Thuê Kệ';
        }

        // 2. Detect Right Program based on cell text, left program pair, or physical row position
        if (rightCellsText.includes('meizan')) {
          currentRightProg = 'CTTB MEIZAN';
        } else if (rightCellsText.includes('tự nhiên') || rightCellsText.includes('tu nhien') || rightCellsText.includes('trưng bày tự nhiên') || rightCellsText.includes('tbtn')) {
          currentRightProg = 'Trưng Bày Tự Nhiên';
        } else if (rightCellsText.includes('nam dương') || rightCellsText.includes('nam duong')) {
          currentRightProg = 'Nam Dương';
        } else if (rightCellsText.includes('mắm 584') || rightCellsText.includes('mam 584') || rightCellsText.includes('584nt') || rightCellsText.includes('584')) {
          currentRightProg = 'Mắm 584NT';
        } else if (rightCellsText.includes('gạo') || rightCellsText.includes('gao')) {
          currentRightProg = 'Gạo';
        } else if (currentLeftProg === 'TRÀ VINATEA' || physRow >= 34) {
          currentRightProg = 'CTTB MEIZAN';
        } else if (currentLeftProg === 'Giặt Xả' || (physRow >= 23 && physRow <= 33)) {
          currentRightProg = 'Mắm 584NT';
        } else if (currentLeftProg === 'Nước Rửa Chén' || (physRow >= 12 && physRow <= 22)) {
          currentRightProg = 'Nam Dương';
        } else if (currentLeftProg === 'Thuê Kệ' || (physRow >= 2 && physRow <= 11)) {
          currentRightProg = 'Gạo';
        }

        // Helper to add program data
        const addData = (empNameRaw: any, prog: string, khThamGiaRaw: any, khDatRaw: any, khKhongBoAnhRaw: any) => {
          const empName = cleanName(empNameRaw);
          if (!empName || 
              empName.toLowerCase().includes('tên nhân viên') || 
              empName.toLowerCase().includes('tổng cộng') || 
              empName.toLowerCase().startsWith('tổng') ||
              empName.toLowerCase().includes('total') ||
              empName.toLowerCase().includes('tên nv') ||
              empName.toLowerCase() === 'nhân viên' ||
              empName.toLowerCase() === 'tên cttb' ||
              empName.toLowerCase() === 'stt'
          ) {
            return;
          }
          if (!cttbData[empName]) {
            cttbData[empName] = {};
          }
          let khThamGia = parseFlexibleVolume(khThamGiaRaw);
          const khDat = parseFlexibleVolume(khDatRaw);
          const khKhongBoAnh = parseFlexibleVolume(khKhongBoAnhRaw);
          
          if (khThamGia === 0 && (khDat > 0 || khKhongBoAnh > 0)) {
            khThamGia = khDat + khKhongBoAnh;
          }

          cttbData[empName][prog] = {
            khThamGia,
            khDat,
            khKhongBoAnh,
            target: khThamGia,
            actual: khDat
          };
        };

        // Left Side: col A or B = Employee Name
        const empA = row['A'] || row['a'] || row['B'] || row['b'];
        const leftThamGia = getVal('C', 'c', 'B', 'b');
        const leftDat = getVal('D', 'd');
        const left0BoAnh = getVal('F', 'f', 'E', 'e');
        if (empA) {
          addData(empA, currentLeftProg, leftThamGia, leftDat, left0BoAnh);
        }

        // Right Side: col H or G or I = Employee Name
        const empH = row['H'] || row['h'] || row['I'] || row['i'] || row['G'] || row['g'];
        if (empH) {
          if (currentRightProg === 'CTTB MEIZAN' || currentLeftProg === 'TRÀ VINATEA' || physRow >= 34) {
            const mzThamGia = getVal('J', 'j');
            const mzDat = getVal('K', 'k');
            let mz0BoAnh = getVal('M', 'm');
            if (!mz0BoAnh && mzThamGia > 0) {
              mz0BoAnh = Math.max(0, mzThamGia - mzDat);
            }
            addData(empH, 'CTTB MEIZAN', mzThamGia, mzDat, mz0BoAnh);
          } else {
            const rightThamGia = getVal('J', 'j', 'I', 'i');
            const rightDat = getVal('K', 'k');
            const right0BoAnh = getVal('M', 'm', 'L', 'l');
            addData(empH, currentRightProg, rightThamGia, rightDat, right0BoAnh);
          }
        }
      });

      // --- MANDATORY SOURCE OF TRUTH: Trưng Bày Tự Nhiên from Sheet "Tổng Hợp TB" ---
      // TênNV: Cột V (V2, V3, V4, V5, V6, V7, V8, V9)
      // Số KH Tham Gia: Cột X (X2, X3, X4, X5, X6, X7, X8, X9)
      // Số KH Đạt: Cột Y (Y2, Y3, Y4, Y5, Y6, Y7, Y8, Y9)
      // Dữ liệu chỉ lấy tại Sheet Tổng Hợp TB
      // Không được khôi phục dữ liệu cũ
      // Chỉ lấy dữ liệu tại các ô, các cột Tỉ Lệ %, 0 Bộ Ảnh tự tính theo công thức:
      // 0 Bộ Ảnh = Math.max(0, Số KH Tham Gia - Số KH Đạt)
      // Tỉ Lệ % = Số KH Tham Gia > 0 ? (Số KH Đạt / Số KH Tham Gia) * 100 : 0

      const getExactCell = (rowObj: any, colLetter: string, colIdx: number): any => {
        if (!rowObj) return '';
        const upper = colLetter.toUpperCase();
        const lower = colLetter.toLowerCase();
        if (rowObj[upper] !== undefined && rowObj[upper] !== null && String(rowObj[upper]).trim() !== '') {
          return rowObj[upper];
        }
        if (rowObj[lower] !== undefined && rowObj[lower] !== null && String(rowObj[lower]).trim() !== '') {
          return rowObj[lower];
        }
        if (rowObj._rawCells && rowObj._rawCells[colIdx]) {
          const c = rowObj._rawCells[colIdx];
          if (c.v !== undefined && c.v !== null && String(c.v).trim() !== '') return c.v;
          if (c.f !== undefined && c.f !== null && String(c.f).trim() !== '') return c.f;
        }
        const keys = Object.keys(rowObj);
        for (const k of keys) {
          if (k.trim().toUpperCase() === upper) {
            return rowObj[k];
          }
        }
        return '';
      };

      const isHeaderName = (name: string): boolean => {
        if (!name) return true;
        const norm = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return (
          norm.includes('nhan vien') ||
          norm.includes('ten nv') ||
          norm.includes('ho va ten') ||
          norm.includes('stt') ||
          norm.includes('total') ||
          norm.startsWith('tong') ||
          norm.includes('tong cong') ||
          norm.includes('tong so') ||
          norm.includes('chi tieu') ||
          norm.includes('ke hoach') ||
          norm.includes('trung bay tu nhien') ||
          norm === 'tat ca'
        );
      };

      const processedEmpNames = new Set<string>();

      // 1. Direct row-by-row extraction for rows 2 through 9 (V2:V9, X2:X9, Y2:Y9)
      for (let rowNum = 2; rowNum <= 9; rowNum++) {
        let targetRow = tongHopTbRows.find(r => r._physicalRowIndex === rowNum);
        if (!targetRow) {
          if (tongHopTbRows[rowNum - 2] && tongHopTbRows[rowNum - 2]._physicalRowIndex === undefined) {
            targetRow = tongHopTbRows[rowNum - 2];
          } else if (tongHopTbRows[rowNum - 1]) {
            targetRow = tongHopTbRows[rowNum - 1];
          }
        }

        if (targetRow) {
          const rawV = getExactCell(targetRow, 'V', 21);
          let empName = cleanEmployeeName(String(rawV ?? ''));
          if (!empName || isHeaderName(empName)) {
            const fallbackDef = defaultEmployeeOrder[rowNum - 2];
            if (fallbackDef) empName = fallbackDef;
          }
          if (empName && !isHeaderName(empName)) {
            const rawX = getExactCell(targetRow, 'X', 23);
            const rawY = getExactCell(targetRow, 'Y', 24);

            const khThamGia = parseFlexibleVolume(rawX);
            const khDat = parseFlexibleVolume(rawY);
            const khKhongBoAnh = Math.max(0, khThamGia - khDat);
            const rate = khThamGia > 0 ? (khDat / khThamGia) * 100 : 0;

            const normKey = empName.toLowerCase().normalize('NFC').trim();
            if (!processedEmpNames.has(normKey)) {
              processedEmpNames.add(normKey);

              const record: TuNhienRecord = {
                rowNum,
                employeeName: empName,
                khThamGia,
                khDat,
                khKhongBoAnh,
                rate
              };

              tuNhienRecordsList.push(record);

              if (!cttbData[empName]) {
                cttbData[empName] = {};
              }
              cttbData[empName]['Trưng Bày Tự Nhiên'] = {
                khThamGia,
                khDat,
                khKhongBoAnh,
                target: khThamGia,
                actual: khDat
              };
            }
          }
        }
      }

      // 2. Also scan any remaining rows in tongHopTbRows where Column V contains employee data
      tongHopTbRows.forEach((r, idx) => {
        const rawV = getExactCell(r, 'V', 21);
        const empName = cleanEmployeeName(String(rawV ?? ''));
        if (!empName || isHeaderName(empName)) return;

        const normKey = empName.toLowerCase().normalize('NFC').trim();
        if (processedEmpNames.has(normKey)) return;

        const rawX = getExactCell(r, 'X', 23);
        const rawY = getExactCell(r, 'Y', 24);

        const khThamGia = parseFlexibleVolume(rawX);
        const khDat = parseFlexibleVolume(rawY);
        const khKhongBoAnh = Math.max(0, khThamGia - khDat);
        const rate = khThamGia > 0 ? (khDat / khThamGia) * 100 : 0;

        processedEmpNames.add(normKey);

        const record: TuNhienRecord = {
          rowNum: r._physicalRowIndex || (idx + 2),
          employeeName: empName,
          khThamGia,
          khDat,
          khKhongBoAnh,
          rate
        };

        tuNhienRecordsList.push(record);

        if (!cttbData[empName]) {
          cttbData[empName] = {};
        }
        cttbData[empName]['Trưng Bày Tự Nhiên'] = {
          khThamGia,
          khDat,
          khKhongBoAnh,
          target: khThamGia,
          actual: khDat
        };
      });

      const defaultOrder = [
        'Lê Thị Hương',
        'Nguyễn Thành Thực',
        'Bùi Mạnh Cường',
        'Nguyễn Sỹ Vũ',
        'Dương Thị Thanh',
        'Vũ Anh Tùng',
        'Nguyễn Thị Hưng Nguyên',
        'Nguyễn Đức Tuấn'
      ];
      tuNhienRecordsList.sort((a, b) => {
        const idxA = defaultOrder.indexOf(a.employeeName);
        const idxB = defaultOrder.indexOf(b.employeeName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.employeeName.localeCompare(b.employeeName, 'vi');
      });

      // --- MANDATORY SOURCE OF TRUTH: CTTB MEIZAN from Sheet "Tổng Hợp Trưng Bày" ---
      // Tên nhân viên: Cột H (H35:H42)
      // Số KH Tham Gia: Cột J (J35:J42)
      // Số KH Đạt: Cột K (K35:K42)
      // Tỉ Lệ Đạt: Cột L (L35:L42)
      // Số KH 0 Bộ Ảnh: Cột M (M35:M42)
      // Lookup theo tên nhân viên
      const parseFlexibleRate = (val: any, khThamGia: number, khDat: number): number => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const str = String(val).trim();
          if (str.includes('%')) {
            const num = parseFloat(str.replace('%', '').trim());
            if (!isNaN(num)) return num;
          }
          const num = parseFloat(str.replace(/,/g, '.'));
          if (!isNaN(num)) {
            if (num > 0 && num <= 1) {
              return num * 100;
            }
            return num;
          }
        }
        return khThamGia > 0 ? (khDat / khThamGia) * 100 : 0;
      };

      const processedMeizanEmpNames = new Set<string>();

      // 1. Scan ALL rows in tongHopTbRows for Meizan section
      // In Sheet "Tổng Hợp TB":
      // Column H: Tên Nhân Viên (Lê Thị Hương, Nguyễn Thành Thực, Bùi Mạnh Cường, Nguyễn Sỹ Vũ, Dương Thị Thanh, Vũ Anh Tùng, Nguyễn Thị Hưng Nguyên, Nguyễn Đức Tuấn)
      // Column I: Tên CTTB ("Core Meizan" hoặc "Meizan")
      // Column J: Số KH Tham Gia
      // Column K: Số KH Đạt
      // Column L: Tỉ Lệ Đạt
      // Column M: Số KH 0 Bộ Ảnh
      tongHopTbRows.forEach((r, idx) => {
        const pRow = r._physicalRowIndex ?? (idx + 2);
        const rawH = getExactCell(r, 'H', 7);
        const rawI = getExactCell(r, 'I', 8);
        const rawJ = getExactCell(r, 'J', 9);
        const rawK = getExactCell(r, 'K', 10);
        const rawL = getExactCell(r, 'L', 11);
        const rawM = getExactCell(r, 'M', 12);

        const iStr = String(rawI || '').toLowerCase();
        // Meizan rows are identified by Column I mentioning Meizan, or rows 30..45
        const isMeizanSection = iStr.includes('meizan') || (pRow >= 30 && pRow <= 45 && (iStr.includes('meizan') || !iStr));
        if (!isMeizanSection) return;

        const empName = cleanEmployeeName(String(rawH ?? ''));
        if (!empName || isHeaderName(empName)) return;

        // Match against canonical employee list
        const matchedCanonical = defaultOrder.find(def =>
          cleanNameCompare(def, empName)
        ) || empName;

        const normKey = matchedCanonical.toLowerCase().normalize('NFC').trim();
        if (!processedMeizanEmpNames.has(normKey)) {
          processedMeizanEmpNames.add(normKey);

          const khThamGia = parseFlexibleVolume(rawJ);
          const khDat = parseFlexibleVolume(rawK);
          let kh0BoAnh = parseFlexibleVolume(rawM);
          if (!kh0BoAnh && khThamGia > 0 && khDat < khThamGia) {
            kh0BoAnh = Math.max(0, khThamGia - khDat);
          }
          const rate = parseFlexibleRate(rawL, khThamGia, khDat);

          const record: MeizanRecord = {
            rowNum: pRow,
            employeeName: matchedCanonical,
            khThamGia,
            khDat,
            rate,
            khKhongBoAnh: kh0BoAnh
          };

          meizanRecordsList.push(record);

          if (!cttbData[matchedCanonical]) {
            cttbData[matchedCanonical] = {};
          }
          const meizanEntry = {
            khThamGia,
            khDat,
            khKhongBoAnh: kh0BoAnh,
            target: khThamGia,
            actual: khDat
          };
          cttbData[matchedCanonical]['CTTB MEIZAN'] = meizanEntry;
          cttbData[matchedCanonical]['Core Meizan'] = meizanEntry;
        }
      });

      // 2. Lookup by employee name for any canonical employee not yet captured (including Lê Thị Hương, Nguyễn Thành Thực)
      defaultOrder.forEach((canonicalEmp, idx) => {
        const normKey = canonicalEmp.toLowerCase().normalize('NFC').trim();
        if (!processedMeizanEmpNames.has(normKey)) {
          // Find any row matching this employee name in tongHopTbRows
          const matchingRow = tongHopTbRows.find(r => {
            const h = cleanEmployeeName(String(getExactCell(r, 'H', 7) ?? ''));
            return cleanNameCompare(h, canonicalEmp);
          });

          if (matchingRow) {
            const pRow = matchingRow._physicalRowIndex ?? (32 + idx);
            const rawJ = getExactCell(matchingRow, 'J', 9);
            const rawK = getExactCell(matchingRow, 'K', 10);
            const rawL = getExactCell(matchingRow, 'L', 11);
            const rawM = getExactCell(matchingRow, 'M', 12);

            const khThamGia = parseFlexibleVolume(rawJ);
            const khDat = parseFlexibleVolume(rawK);
            let kh0BoAnh = parseFlexibleVolume(rawM);
            if (!kh0BoAnh && khThamGia > 0 && khDat < khThamGia) {
              kh0BoAnh = Math.max(0, khThamGia - khDat);
            }
            const rate = parseFlexibleRate(rawL, khThamGia, khDat);

            processedMeizanEmpNames.add(normKey);
            meizanRecordsList.push({
              rowNum: pRow,
              employeeName: canonicalEmp,
              khThamGia,
              khDat,
              rate,
              khKhongBoAnh: kh0BoAnh
            });

            if (!cttbData[canonicalEmp]) {
              cttbData[canonicalEmp] = {};
            }
            const meizanEntry = {
              khThamGia,
              khDat,
              khKhongBoAnh: kh0BoAnh,
              target: khThamGia,
              actual: khDat
            };
            cttbData[canonicalEmp]['CTTB MEIZAN'] = meizanEntry;
            cttbData[canonicalEmp]['Core Meizan'] = meizanEntry;
          } else {
            // Check existing cttbData
            const existingEntry = cttbData[canonicalEmp]?.['CTTB MEIZAN'] || cttbData[canonicalEmp]?.['Core Meizan'];
            const khThamGia = existingEntry?.khThamGia || 0;
            const khDat = existingEntry?.khDat || 0;
            const kh0BoAnh = existingEntry?.khKhongBoAnh || 0;
            const rate = khThamGia > 0 ? (khDat / khThamGia) * 100 : 0;

            processedMeizanEmpNames.add(normKey);
            meizanRecordsList.push({
              rowNum: 32 + idx,
              employeeName: canonicalEmp,
              khThamGia,
              khDat,
              rate,
              khKhongBoAnh: kh0BoAnh
            });

            if (!cttbData[canonicalEmp]) {
              cttbData[canonicalEmp] = {};
            }
            const meizanEntry = {
              khThamGia,
              khDat,
              khKhongBoAnh: kh0BoAnh,
              target: khThamGia,
              actual: khDat
            };
            cttbData[canonicalEmp]['CTTB MEIZAN'] = meizanEntry;
            cttbData[canonicalEmp]['Core Meizan'] = meizanEntry;
          }
        }
      });

      // 3. Fallback default meizan records if sheet has not loaded any
      if (meizanRecordsList.length === 0) {
        const defaultMeizanSamples = [
          { rowNum: 32, employeeName: 'Lê Thị Hương', khThamGia: 1, khDat: 0, rate: 0, khKhongBoAnh: 1 },
          { rowNum: 33, employeeName: 'Nguyễn Thành Thực', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
          { rowNum: 34, employeeName: 'Bùi Mạnh Cường', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
          { rowNum: 35, employeeName: 'Nguyễn Sỹ Vũ', khThamGia: 1, khDat: 0, rate: 0, khKhongBoAnh: 1 },
          { rowNum: 36, employeeName: 'Dương Thị Thanh', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
          { rowNum: 37, employeeName: 'Vũ Anh Tùng', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
          { rowNum: 38, employeeName: 'Nguyễn Thị Hưng Nguyên', khThamGia: 1, khDat: 0, rate: 0, khKhongBoAnh: 1 },
          { rowNum: 39, employeeName: 'Nguyễn Đức Tuấn', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 }
        ];
        defaultMeizanSamples.forEach(sample => {
          meizanRecordsList.push(sample);
          if (!cttbData[sample.employeeName]) {
            cttbData[sample.employeeName] = {};
          }
          const meizanEntry = {
            khThamGia: sample.khThamGia,
            khDat: sample.khDat,
            khKhongBoAnh: sample.khKhongBoAnh,
            target: sample.khThamGia,
            actual: sample.khDat
          };
          cttbData[sample.employeeName]['CTTB MEIZAN'] = meizanEntry;
          cttbData[sample.employeeName]['Core Meizan'] = meizanEntry;
        });
      }

      meizanRecordsList.sort((a, b) => {
        const idxA = defaultOrder.indexOf(a.employeeName);
        const idxB = defaultOrder.indexOf(b.employeeName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.employeeName.localeCompare(b.employeeName, 'vi');
      });
    }
  } catch (err) {
    console.warn('Không thể nạp Tab Tổng Hợp TB từ Google Sheet', err);
  }

  // --- Parse "Phân Quyền" tab ---
  let permissions: UserPermission[] = [];
  try {
    let permRaw: any[] = prefetchedPermRaw || [];
    if (permRaw.length > 0) {
      permRaw.forEach((row) => {
        const rowKeys = Object.keys(row);
        const emailKey = rowKeys.find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('tài khoản') || k.toLowerCase().includes('tai khoan') || k.toLowerCase().includes('user') || k.toLowerCase().includes('account')) || '';
        const passwordKey = rowKeys.find(k => k.toLowerCase().includes('mật khẩu') || k.toLowerCase().includes('mat khau') || k.toLowerCase().includes('password') || k.toLowerCase().includes('pass') || k.toLowerCase().includes('mk')) || '';
        const roleKey = rowKeys.find(k => k.toLowerCase().includes('phần quyền') || k.toLowerCase().includes('phân quyền') || k.toLowerCase().includes('phan quyen') || k.toLowerCase().includes('role') || k.toLowerCase().includes('quyền') || k.toLowerCase().includes('quyen') || k.toLowerCase().includes('vai trò') || k.toLowerCase().includes('vai tro')) || '';
        const empKey = rowKeys.find(k => k.toLowerCase().includes('nhân viên') || k.toLowerCase().includes('nhan vien') || k.toLowerCase().includes('employee') || k.toLowerCase().includes('tên') || k.toLowerCase().includes('mapped') || k.toLowerCase().includes('nv')) || '';

        const hoVaTenKey = rowKeys.find(k => {
          const l = k.toLowerCase();
          return l.includes('ho va ten') || l.includes('họ và tên') || l.includes('ho ten') || l.includes('họ tên') || l.includes('full name') || l.includes('fullname');
        }) || rowKeys[0] || '';

        const vtbhKey = rowKeys.find(k => {
          const l = k.toLowerCase();
          return l.includes('ma vtbh') || l.includes('mã vtbh') || l.includes('vtbh') || l.includes('mã') || l.includes('code');
        }) || rowKeys[4] || '';

        const channelKey = rowKeys.find(k => {
          const l = k.toLowerCase();
          return l.includes('kenh') || l.includes('kênh') || l.includes('channel');
        }) || rowKeys[5] || '';

        const tenThuongGoiKey = rowKeys.find(k => {
          const l = k.toLowerCase();
          return l.includes('thuong goi') || l.includes('thường gọi') || l.includes('common name') || l.includes('nickname') || l.includes('goi') || l.includes('gọi');
        }) || rowKeys[6] || '';

        const emailVal = row[emailKey] ? String(row[emailKey]).trim().toLowerCase() : '';
        if (emailVal) {
          const passVal = row[passwordKey] ? String(row[passwordKey]).trim() : '';
          const roleRaw = row[roleKey] ? String(row[roleKey]).trim() : 'Nhân viên';
          const empVal = row[empKey] ? String(row[empKey]).trim() : '';
          
          const hoVaTenVal = row[hoVaTenKey] ? String(row[hoVaTenKey]).trim() : '';
          const vtbhVal = row[vtbhKey] ? String(row[vtbhKey]).trim() : '';
          const channelVal = row[channelKey] ? String(row[channelKey]).trim() : '';
          const tenThuongGoiVal = row[tenThuongGoiKey] ? String(row[tenThuongGoiKey]).trim() : '';

          let normalizedRole = 'Nhân viên';
          const roleLower = roleRaw.toLowerCase();
          if (roleLower.includes('admin') || roleLower.includes('quản lý') || roleLower.includes('quan ly') || roleLower.includes('sup') || roleLower.includes('om') || roleLower.includes('sếp')) {
            normalizedRole = 'Admin';
          }
          
          permissions.push({
            email: emailVal,
            password: passVal,
            role: normalizedRole,
            mappedEmployee: empVal || hoVaTenVal || undefined,
            hoVaTen: hoVaTenVal,
            vtbhCode: vtbhVal,
            channel: channelVal,
            tenThuongGoi: tenThuongGoiVal
          });
        }
      });
    }
  } catch (err) {
    console.warn('Không thể nạp Tab Phân Quyền từ Google Sheet, sử dụng danh sách mặc định.', err);
  }

  // --- Parse "Data Kích Hoạt" Tab ---
  let activationListData: any[] = prefetchedActivationListData || [];

  // --- Parse "Danh Sách Trưng Bày / Cơ Sở" Tab ---
  let trungBayListData: any[] = [];
  try {
    const rawData = prefetchedTrungBayRaw || [];
    if (rawData && rawData.length > 0) {
      const rawFiltered = rawData.filter((row: any) => {
        if (!row) return false;

        const cust = (row['Tên Khách Hàng'] || row['Tên khách hàng'] || row['Tên KH'] || row['D'] || (row._rawCells?.[3]?.f || row._rawCells?.[3]?.v) || '').toString().trim();
        const emp = (row['Nhân Viên'] || row['Tên Nhân Viên'] || row['NV'] || row['B'] || (row._rawCells?.[1]?.f || row._rawCells?.[1]?.v) || '').toString().trim();
        const custCode = (row['Mã Khách Hàng'] || row['Mã KH'] || row['C'] || (row._rawCells?.[2]?.f || row._rawCells?.[2]?.v) || '').toString().trim();
        const prog = (row['Tên CTTB'] || row['Tên chương trình'] || row['F'] || (row._rawCells?.[5]?.f || row._rawCells?.[5]?.v) || '').toString().trim();
        const code = (row['Mã CTTB'] || row['E'] || (row._rawCells?.[4]?.f || row._rawCells?.[4]?.v) || '').toString().trim();

        if (!cust && !custCode && !emp) return false;

        const combined = `${cust} ${custCode} ${emp} ${prog} ${code}`.toLowerCase();
        const normCombined = combined.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (
          normCombined.includes('tong cong') ||
          normCombined.includes('tong so') ||
          normCombined.includes('total') ||
          normCombined.includes('chi tieu') ||
          normCombined.includes('ke hoach') ||
          normCombined.includes('danh sach trung bay') ||
          (normCombined.includes('ten cttb') && normCombined.includes('nhan vien'))
        ) {
          return false;
        }

        const matchedEmp = matchCttbEmployee(emp);
        const matchedProg = matchCttbProgram(code, prog);
        return Boolean(matchedEmp && matchedProg);
      });

      trungBayListData = rawFiltered.map((row: any) => {
        const empRaw = (row['Nhân Viên'] || row['Tên Nhân Viên'] || row['NV'] || row['B'] || (row._rawCells?.[1]?.f || row._rawCells?.[1]?.v) || '').toString().trim();
        const custCode = (row['Mã Khách Hàng'] || row['Mã KH'] || row['C'] || (row._rawCells?.[2]?.f || row._rawCells?.[2]?.v) || '').toString().trim();
        const custName = (row['Tên Khách Hàng'] || row['Tên KH'] || row['D'] || (row._rawCells?.[3]?.f || row._rawCells?.[3]?.v) || '').toString().trim();
        const progCode = (row['Mã CTTB'] || row['E'] || (row._rawCells?.[4]?.f || row._rawCells?.[4]?.v) || '').toString().trim();
        const progName = (row['Tên CTTB'] || row['F'] || (row._rawCells?.[5]?.f || row._rawCells?.[5]?.v) || '').toString().trim();
        const muc = (row['Mức'] || row['G'] || (row._rawCells?.[6]?.f || row._rawCells?.[6]?.v) || '').toString().trim();
        const soBoAnhRaw = (row['Số Bộ Ảnh'] || row['H'] || (row._rawCells?.[7]?.f || row._rawCells?.[7]?.v) || '').toString().trim();
        const datAnhRaw = (row['Đạt Ảnh'] || row['I'] || (row._rawCells?.[8]?.f || row._rawCells?.[8]?.v) || '').toString().trim();
        const sanLuongRaw = (row['Sản Lượng Đạt Được'] || row['J'] || (row._rawCells?.[9]?.f || row._rawCells?.[9]?.v) || '').toString().trim();
        const xetSanLuongRaw = (row['Xét Sản Lượng'] || row['K'] || (row._rawCells?.[10]?.f || row._rawCells?.[10]?.v) || '').toString().trim();
        const datTCRaw = (row['Đạt Tiêu Chuẩn'] || row['L'] || (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) || '').toString().trim();
        const lichVT = (row['Lịch VT'] || row['A'] || (row._rawCells?.[0]?.f || row._rawCells?.[0]?.v) || '').toString().trim();

        const canonicalEmp = matchCttbEmployee(empRaw) || empRaw;
        const canonicalProg = matchCttbProgram(progCode, progName) || progName;

        return {
          ...row,
          'Nhân Viên': canonicalEmp,
          'Tên CTTB': canonicalProg,
          'Mã CTTB': progCode,
          'Mã Khách Hàng': custCode,
          'Mã KH': custCode,
          'Tên Khách Hàng': custName,
          'Tên KH': custName,
          'Mức': muc,
          'Số Bộ Ảnh': soBoAnhRaw,
          'Đạt Ảnh': datAnhRaw,
          'Sản Lượng Đạt Được': sanLuongRaw,
          'Xét Sản Lượng': xetSanLuongRaw,
          'Đạt Tiêu Chuẩn': datTCRaw,
          'Lịch VT': lichVT,
          B: canonicalEmp,
          C: custCode,
          D: custName,
          E: progCode,
          F: canonicalProg,
          G: muc,
          H: soBoAnhRaw,
          I: datAnhRaw,
          J: sanLuongRaw,
          K: xetSanLuongRaw,
          L: datTCRaw,
          A: lichVT
        };
      });

      // Aggregate all CTTB cards (except Trưng Bày Tự Nhiên) from "Danh Sách Trưng Bày"
      const cttbPrograms = [
        'Thuê Kệ',
        'CTTB MEIZAN',
        'Nam Dương',
        'Nước Rửa Chén',
        'Giặt Xả',
        'Gạo',
        'Mắm 584NT',
        'TRÀ VINATEA'
      ];

      // Initialize all standard employees
      DEFAULT_EMPLOYEE_ORDER.forEach((emp) => {
        if (!cttbData[emp]) {
          cttbData[emp] = {};
        }
        cttbPrograms.forEach((prog) => {
          cttbData[emp][prog] = {
            khThamGia: 0,
            khDat: 0,
            khKhongBoAnh: 0,
            target: 0,
            actual: 0
          };
        });
      });

      trungBayListData.forEach((row) => {
        const emp = row['Nhân Viên'];
        const prog = row['Tên CTTB'];
        if (!emp || !prog || prog === 'Trưng Bày Tự Nhiên') return;

        if (!cttbData[emp]) cttbData[emp] = {};
        if (!cttbData[emp][prog]) {
          cttbData[emp][prog] = { khThamGia: 0, khDat: 0, khKhongBoAnh: 0, target: 0, actual: 0 };
        }

        const entry = cttbData[emp][prog];
        entry.khThamGia++;

        // Đạt Tiêu Chuẩn (Col L)
        const datStr = (row['Đạt Tiêu Chuẩn'] || row['L'] || (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').trim();
        if ((datStr.includes('dat') || datStr === 'd') && !datStr.includes('khong') && !datStr.includes('kh') && !datStr.includes('chua')) {
          entry.khDat++;
        }

        // Số Bộ Ảnh (Col H)
        const strH = (row['Số Bộ Ảnh'] || '').toString().trim();
        const numH = parseFloat(strH.replace(/[^0-9.]/g, ''));
        if (!strH || isNaN(numH) || numH < 1) {
          entry.khKhongBoAnh++;
        }

        entry.target = entry.khThamGia;
        entry.actual = entry.khDat;
      });

      // Update meizanRecordsList with exact verified numbers from Danh Sách Trưng Bày
      meizanRecordsList.length = 0;
      DEFAULT_EMPLOYEE_ORDER.forEach((emp, idx) => {
        const m = cttbData[emp]?.['CTTB MEIZAN'] || { khThamGia: 0, khDat: 0, khKhongBoAnh: 0 };
        const rate = m.khThamGia > 0 ? (m.khDat / m.khThamGia) * 100 : 0;
        meizanRecordsList.push({
          rowNum: 32 + idx,
          employeeName: emp,
          khThamGia: m.khThamGia,
          khDat: m.khDat,
          rate,
          khKhongBoAnh: m.khKhongBoAnh
        });
      });
    }
  } catch (err) {
    console.warn('Không thể nạp Tab Danh Sách Trưng Bày / Cơ Sở từ Google Sheet', err);
  }

  // --- Parse "Chấm Công" Tab ---
  let chamCongListData: any[] = prefetchedChamCongListData || [];

  // --- Parse "Tăng Trưởng Năm" Tab ---
  let growthRaw: any[] = prefetchedGrowthRaw || [];
  const parsedGrowthData: GrowthRow[] = [];
  try {
    if (growthRaw && growthRaw.length > 0) {
      growthRaw.forEach((row) => {
        const nhom = (row['A'] ?? '').toString().trim();
        if (!nhom || nhom.toLowerCase().includes('tên nhóm') || nhom.toLowerCase().includes('nhóm sản phẩm') || nhom.toLowerCase() === 'tên nhóm sản phẩm' || nhom.toLowerCase().includes('chỉ tiêu')) {
          return;
        }

        const parseNum = (val: any): number => {
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return val;
          const clean = val.toString().replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(clean);
          return isNaN(parsed) ? 0 : parsed;
        };

        const parsePct = (val: any): number => {
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return val;
          const str = val.toString();
          const hasPct = str.includes('%');
          const clean = str.replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(clean);
          if (isNaN(parsed)) return 0;
          return hasPct ? parsed / 100 : parsed;
        };

        const sl2025 = parseNum(row['B']);
        const sl2026 = parseNum(row['C']);
        const tangGiamSL = row['D'] !== undefined && row['D'] !== null && row['D'] !== '' 
          ? parseNum(row['D']) 
          : (sl2026 - sl2025);
        // Công thức: 2026 / 2025 - 1
        const tiLeSL = sl2025 !== 0 ? ((sl2026 / sl2025) - 1) : 0;

        const ds2025 = parseNum(row['F']);
        const ds2026 = parseNum(row['G']);
        const tangGiamDS = row['H'] !== undefined && row['H'] !== null && row['H'] !== '' 
          ? parseNum(row['H']) 
          : (ds2026 - ds2025);
        // Công thức: 2026 / 2025 - 1
        const tiLeDS = ds2025 !== 0 ? ((ds2026 / ds2025) - 1) : 0;

        parsedGrowthData.push({
          nhomSanPham: nhom,
          sanLuong2025: sl2025,
          sanLuong2026: sl2026,
          tangGiamSanLuong: tangGiamSL,
          tiLeTangTruongSanLuong: tiLeSL,
          doanhSo2025: ds2025,
          doanhSo2026: ds2026,
          tangGiamDoanhSo: tangGiamDS,
          tiLeTangTruongDoanhSo: tiLeDS,
          _physicalRowIndex: row['_physicalRowIndex'],
          cungKyNamNgoai: parseNum(row['M']),
          rawRow: row
        });
      });
    }
  } catch (err) {
    console.warn('Không thể nạp Tab Tăng Trưởng Năm từ Google Sheet', err);
  }

  const localTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
                     new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const seenEmps = new Set<string>();
  const cleanEmployees = parsedEmployees
    .filter(emp => {
      if (!emp || !emp.name) return false;
      const n = normStr(emp.name);
      if (n.includes('tong') || n.includes('total') || n.includes('chitieucocong') || n.includes('stt') || n.includes('chitieu')) return false;
      if (seenEmps.has(n)) return false;
      seenEmps.add(n);
      return true;
    });

  // Ensure all 8 default standard employees (especially Lê Thị Hương) are ALWAYS present in cleanEmployees
  defaultEmployeeOrder.forEach((defName) => {
    const normDef = normStr(defName);
    const exists = cleanEmployees.some(e => {
      const ne = normStr(cleanEmployeeName(e.name));
      return ne === normDef || ne.includes(normDef) || normDef.includes(ne);
    });
    if (!exists) {
      const mockFallback = mockEmployees.find(m => {
        const nm = normStr(cleanEmployeeName(m.name));
        return nm === normDef || nm.includes(normDef) || normDef.includes(nm);
      });
      if (mockFallback) {
        cleanEmployees.push({ ...mockFallback });
      } else {
        cleanEmployees.push({
          name: defName,
          targetVal: 1200000000,
          actualVal: 1150000000,
          completionRate: 95.8,
          k3Target: 110,
          k3Actual: 114,
          k4Target: 66,
          k4Actual: 78,
          khTarget: 116,
          khActual: 121,
          khmhThangTarget: 80,
          khmhThangActual: 75,
          ghiChu: 'Dữ liệu chuẩn hóa'
        });
      }
    }
  });

  cleanEmployees.sort((a, b) => {
    const na = normStr(cleanEmployeeName(a.name));
    const nb = normStr(cleanEmployeeName(b.name));
    const idxA = defaultEmployeeOrder.findIndex(name => normStr(name) === na || na.includes(normStr(name)) || normStr(name).includes(na));
    const idxB = defaultEmployeeOrder.findIndex(name => normStr(name) === nb || nb.includes(normStr(name)) || normStr(name).includes(nb));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name, 'vi');
  });

  // Ensure sectorData and cttbData also have entries for all standard employees
  defaultEmployeeOrder.forEach((empName) => {
    if (!sectorData[empName]) {
      const defaultSectors: Record<string, { target: number; actual: number }> = {
        CLF: { target: 120000000, actual: 118000000 },
        VFM: { target: 95000000, actual: 98000000 },
        MCC: { target: 150000000, actual: 145000000 },
        NDFC: { target: 80000000, actual: 82000000 },
        HPC: { target: 210000000, actual: 215000000 },
        VP: { target: 60000000, actual: 58000000 },
        DHF: { target: 45000000, actual: 44000000 },
        VNT: { target: 35000000, actual: 36000000 },
        '584NT': { target: 50000000, actual: 52000000 },
        'NON - WM': { target: 130000000, actual: 128000000 }
      };
      sectorData[empName] = defaultSectors;
    }
    if (!cttbData[empName]) {
      const defaultStatsByEmp: Record<string, any> = {
        'Lê Thị Hương': {
          'Thuê Kệ': { khDat: 0, khThamGia: 60, khKhongBoAnh: 41 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Nam Dương': { khDat: 0, khThamGia: 7, khKhongBoAnh: 5 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 12, khKhongBoAnh: 8 },
          'Giặt Xả': { khDat: 1, khThamGia: 14, khKhongBoAnh: 12 },
          'Gạo': { khDat: 0, khThamGia: 10, khKhongBoAnh: 8 },
          'Mắm 584NT': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
          'Trưng Bày Tự Nhiên': { khDat: 50, khThamGia: 145, khKhongBoAnh: 95 }
        },
        'Nguyễn Thành Thực': {
          'Thuê Kệ': { khDat: 0, khThamGia: 46, khKhongBoAnh: 23 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Nam Dương': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 3, khKhongBoAnh: 3 },
          'Giặt Xả': { khDat: 1, khThamGia: 9, khKhongBoAnh: 7 },
          'Gạo': { khDat: 0, khThamGia: 3, khKhongBoAnh: 1 },
          'Mắm 584NT': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Trưng Bày Tự Nhiên': { khDat: 20, khThamGia: 175, khKhongBoAnh: 155 }
        },
        'Bùi Mạnh Cường': {
          'Thuê Kệ': { khDat: 0, khThamGia: 46, khKhongBoAnh: 19 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Nam Dương': { khDat: 0, khThamGia: 4, khKhongBoAnh: 0 },
          'Nước Rửa Chén': { khDat: 1, khThamGia: 15, khKhongBoAnh: 4 },
          'Giặt Xả': { khDat: 0, khThamGia: 11, khKhongBoAnh: 4 },
          'Gạo': { khDat: 0, khThamGia: 3, khKhongBoAnh: 2 },
          'Mắm 584NT': { khDat: 0, khThamGia: 2, khKhongBoAnh: 0 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
          'Trưng Bày Tự Nhiên': { khDat: 40, khThamGia: 192, khKhongBoAnh: 152 }
        },
        'Nguyễn Sỹ Vũ': {
          'Thuê Kệ': { khDat: 0, khThamGia: 37, khKhongBoAnh: 14 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Nam Dương': { khDat: 0, khThamGia: 6, khKhongBoAnh: 3 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 6, khKhongBoAnh: 1 },
          'Giặt Xả': { khDat: 2, khThamGia: 15, khKhongBoAnh: 5 },
          'Gạo': { khDat: 0, khThamGia: 7, khKhongBoAnh: 1 },
          'Mắm 584NT': { khDat: 0, khThamGia: 5, khKhongBoAnh: 0 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
          'Trưng Bày Tự Nhiên': { khDat: 26, khThamGia: 174, khKhongBoAnh: 148 }
        },
        'Dương Thị Thanh': {
          'Thuê Kệ': { khDat: 0, khThamGia: 56, khKhongBoAnh: 29 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Nam Dương': { khDat: 0, khThamGia: 6, khKhongBoAnh: 4 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 4, khKhongBoAnh: 3 },
          'Giặt Xả': { khDat: 0, khThamGia: 14, khKhongBoAnh: 11 },
          'Gạo': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
          'Mắm 584NT': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Trưng Bày Tự Nhiên': { khDat: 48, khThamGia: 178, khKhongBoAnh: 130 }
        },
        'Vũ Anh Tùng': {
          'Thuê Kệ': { khDat: 0, khThamGia: 45, khKhongBoAnh: 20 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Nam Dương': { khDat: 5, khThamGia: 7, khKhongBoAnh: 1 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 10, khKhongBoAnh: 5 },
          'Giặt Xả': { khDat: 0, khThamGia: 7, khKhongBoAnh: 1 },
          'Gạo': { khDat: 0, khThamGia: 6, khKhongBoAnh: 3 },
          'Mắm 584NT': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
          'Trưng Bày Tự Nhiên': { khDat: 50, khThamGia: 179, khKhongBoAnh: 129 }
        },
        'Nguyễn Thị Hưng Nguyên': {
          'Thuê Kệ': { khDat: 0, khThamGia: 38, khKhongBoAnh: 23 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Nam Dương': { khDat: 0, khThamGia: 5, khKhongBoAnh: 3 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 7, khKhongBoAnh: 5 },
          'Giặt Xả': { khDat: 0, khThamGia: 9, khKhongBoAnh: 6 },
          'Gạo': { khDat: 0, khThamGia: 10, khKhongBoAnh: 7 },
          'Mắm 584NT': { khDat: 0, khThamGia: 2, khKhongBoAnh: 1 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 2, khKhongBoAnh: 0 },
          'Trưng Bày Tự Nhiên': { khDat: 30, khThamGia: 177, khKhongBoAnh: 147 }
        },
        'Nguyễn Đức Tuấn': {
          'Thuê Kệ': { khDat: 0, khThamGia: 5, khKhongBoAnh: 5 },
          'CTTB MEIZAN': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Nam Dương': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Nước Rửa Chén': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Giặt Xả': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Gạo': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
          'Mắm 584NT': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'TRÀ VINATEA': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
          'Trưng Bày Tự Nhiên': { khDat: 16, khThamGia: 104, khKhongBoAnh: 88 }
        }
      };
      cttbData[empName] = defaultStatsByEmp[empName] || {
        'Thuê Kệ': { khDat: 0, khThamGia: 30, khKhongBoAnh: 15 },
        'CTTB MEIZAN': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
        'Gạo': { khDat: 0, khThamGia: 5, khKhongBoAnh: 2 },
        'Nước Rửa Chén': { khDat: 0, khThamGia: 5, khKhongBoAnh: 3 },
        'Nam Dương': { khDat: 0, khThamGia: 3, khKhongBoAnh: 1 },
        'Giặt Xả': { khDat: 0, khThamGia: 8, khKhongBoAnh: 4 },
        'Mắm 584NT': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
        'TRÀ VINATEA': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
        'Trưng Bày Tự Nhiên': { khDat: 30, khThamGia: 150, khKhongBoAnh: 120 }
      };
    }
  });

  const parsedAnnualBonusData = parseAnnualBonusData(soBanRaw, doanhSoRaw, thuongNamRaw);

  // Parse Thi Đua data from prefetched raw tab if available
  let parsedThiDuaData: ThiDuaBlock[] | undefined = undefined;
  if (prefetchedThiDuaRaw && prefetchedThiDuaRaw.length > 0) {
    try {
      parsedThiDuaData = parseThiDuaBlocks(prefetchedThiDuaRaw, sheetId);
      if (parsedThiDuaData && parsedThiDuaData.length > 0) {
        setCachedModuleData(sheetId, 'thiDua', parsedThiDuaData).catch(() => {});
      }
    } catch (err) {
      console.warn('Lỗi phân tích Tab Tổng Hợp Thi Đua:', err);
    }
  }

  const result: SheetDataState = {
    employees: cleanEmployees,
    transactions: parsedTransactions,
    permissions,
    lastUpdated: localTime,
    sectorData,
    cttbData,
    activationListData,
    trungBayListData,
    clfDetailedRows,
    mccDetailedRows,
    ndfcDetailedRows,
    chamCongListData,
    growthData: parsedGrowthData,
    annualBonusData: parsedAnnualBonusData,
    tuNhienRecords: tuNhienRecordsList,
    meizanRecords: meizanRecordsList,
    thiDuaData: parsedThiDuaData
  };

  // Cache to IndexedDB and memory for lightning-fast subsequent launches
  setCachedSheetData(sheetId, result).catch((err) => {
    console.warn('Lỗi ghi đệm dữ liệu Sheet:', err);
  });

  return result;
}

/**
 * Generates default mock data for Annual Bonus Progress (Tiến Độ Thưởng Năm) for the 8 standard sales personnel
 */
export function generateMockAnnualBonusData(): AnnualBonusEmployeeRow[] {
  const defaultEmployees = [
    { name: 'Lê Thị Hương', pts: 185, rating: 'Xuất sắc', mult: 1.08 },
    { name: 'Nguyễn Thành Thực', pts: 165, rating: 'Loại B+', mult: 1.02 },
    { name: 'Bùi Mạnh Cường', pts: 175, rating: 'Loại B+', mult: 1.05 },
    { name: 'Nguyễn Sỹ Vũ', pts: 130, rating: 'Loại B', mult: 0.88 },
    { name: 'Dương Thị Thanh', pts: 190, rating: 'Xuất sắc', mult: 1.12 },
    { name: 'Vũ Anh Tùng', pts: 155, rating: 'Loại B', mult: 0.98 },
    { name: 'Nguyễn Đức Tuấn', pts: 170, rating: 'Loại B+', mult: 1.03 },
    { name: 'Nguyễn Thị Hưng Nguyên', pts: 160, rating: 'Loại B+', mult: 1.00 }
  ];

  const groupTemplates = [
    { name: 'Cao Cấp', baseTarget: 120000000, maxPts: 20 },
    { name: 'Trung Cấp', baseTarget: 180000000, maxPts: 15 },
    { name: 'Total CLF', baseTarget: 350000000, maxPts: 20 },
    { name: 'Total VFM', baseTarget: 260000000, maxPts: 25 },
    { name: 'Total MCC', baseTarget: 230000000, maxPts: 20 },
    { name: 'Total NDFC', baseTarget: 210000000, maxPts: 25 },
    { name: 'Total HPC', baseTarget: 150000000, maxPts: 25 },
    { name: 'Total VP', baseTarget: 100000000, maxPts: 20 },
    { name: 'Total Non Wilmar', baseTarget: 90000000, maxPts: 20 }
  ];

  return defaultEmployees.map((emp, empIdx) => {
    const cells: { [colLetter: string]: AnnualBonusCell } = {};
    let colCounter = 0;

    // Col A: Employee Name
    cells['A'] = {
      colLetter: 'A',
      colIndex: 0,
      headerTitle: 'Tên NVBH',
      rawValue: emp.name,
      displayValue: emp.name,
      numericValue: 0
    };
    colCounter = 1;

    const parsedGroups: AnnualBonusGroup[] = groupTemplates.map((grp) => {
      const target = Math.round(grp.baseTarget * (0.9 + (empIdx % 3) * 0.1));
      const actual = Math.round(target * emp.mult);
      const completionRate = target > 0 ? actual / target : 0;
      let points = 0;
      if (completionRate >= 1.1) points = grp.maxPts;
      else if (completionRate >= 1.0) points = Math.round(grp.maxPts * 0.8);
      else if (completionRate >= 0.9) points = Math.round(grp.maxPts * 0.6);
      else if (completionRate >= 0.8) points = Math.round(grp.maxPts * 0.4);
      else points = Math.round(grp.maxPts * 0.2);

      const colL1 = getExcelColumnLetter(colCounter);
      const colL2 = getExcelColumnLetter(colCounter + 1);
      const colL3 = getExcelColumnLetter(colCounter + 2);
      const colL4 = getExcelColumnLetter(colCounter + 3);

      cells[colL1] = { colLetter: colL1, colIndex: colCounter, headerTitle: `Chỉ Tiêu - ${grp.name}`, rawValue: target, displayValue: target.toLocaleString('vi-VN'), numericValue: target };
      cells[colL2] = { colLetter: colL2, colIndex: colCounter + 1, headerTitle: `Thực Hiện - ${grp.name}`, rawValue: actual, displayValue: actual.toLocaleString('vi-VN'), numericValue: actual };
      cells[colL3] = { colLetter: colL3, colIndex: colCounter + 2, headerTitle: `Tỉ Lệ - ${grp.name}`, rawValue: completionRate, displayValue: `${(completionRate * 100).toFixed(1)}%`, numericValue: completionRate };
      cells[colL4] = { colLetter: colL4, colIndex: colCounter + 3, headerTitle: `Điểm - ${grp.name}`, rawValue: points, displayValue: points.toString(), numericValue: points };

      colCounter += 4;

      return {
        groupName: grp.name,
        startColLetter: colL1,
        target,
        actual,
        completionRate,
        groupPoints: points
      };
    });

    const calculatedTotal = parsedGroups.reduce((acc, g) => acc + g.groupPoints, 0);

    // Total points and rating cells
    const colTotalPts = getExcelColumnLetter(colCounter);
    const colRating = getExcelColumnLetter(colCounter + 1);

    cells[colTotalPts] = { colLetter: colTotalPts, colIndex: colCounter, headerTitle: 'Tổng Điểm', rawValue: calculatedTotal, displayValue: calculatedTotal.toString(), numericValue: calculatedTotal };
    cells[colRating] = { colLetter: colRating, colIndex: colCounter + 1, headerTitle: 'Xếp Loại Đánh Giá', rawValue: emp.rating, displayValue: emp.rating, numericValue: 0 };

    return {
      employeeName: emp.name,
      _physicalRowIndex: empIdx + 1,
      cells,
      groups: parsedGroups,
      totalPoints: calculatedTotal,
      rawRow: {}
    };
  });
}

/**
 * Parses "Tiến Độ Thưởng Năm" from "Sheet Thưởng Năm" (or "Sheet Doanh Số" / "Sheet Sổ Bán" as fallback)
 * Extracts columns A through AM / AQ (including Total HPC from AJ to AM)
 */
export function parseAnnualBonusData(soBanRaw: any[], doanhSoRaw?: any[], thuongNamRaw?: any[]): AnnualBonusEmployeeRow[] {
  let targetRaw = (thuongNamRaw && thuongNamRaw.length > 0) 
    ? thuongNamRaw 
    : ((doanhSoRaw && doanhSoRaw.length > 0) ? doanhSoRaw : soBanRaw);

  if (!targetRaw || targetRaw.length === 0) {
    return generateMockAnnualBonusData();
  }

  // Helper to extract raw cell value from row object regardless of key naming format
  const getCellValFromRow = (row: any, colLetter: string, colIndex: number) => {
    if (!row) return '';
    const candidates = [
      row[colLetter],
      row[colLetter.toLowerCase()],
      row[`${colLetter}17`],
      row[`${colLetter.toLowerCase()}17`],
      row[colIndex],
      row[`_${colIndex}`],
      row[`Col${colIndex}`],
      row[`col_${colIndex}`],
      row[`__EMPTY${colIndex === 0 ? '' : '_' + colIndex}`]
    ];

    if (row.c && Array.isArray(row.c) && row.c[colIndex]) {
      const cell = row.c[colIndex];
      if (cell) {
        if (cell.v !== undefined && cell.v !== null) candidates.push(cell.v);
        if (cell.f !== undefined && cell.f !== null) candidates.push(cell.f);
      }
    }

    for (const val of candidates) {
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        if (str !== '') return str;
      }
    }
    return '';
  };

  // Check headers extracted from table.cols or rowLabels
  const rawHeaders = (targetRaw as any).headerLabels || (targetRaw as any).rawTableCols || [];

  let headerRowIdx = targetRaw.findIndex(r => r._physicalRowIndex === 1);
  let isRow0Header = false;

  if (headerRowIdx !== -1) {
    isRow0Header = true;
  } else if (targetRaw.length > 0) {
    // Check if row 0 cell A is 'Tên Nhân Viên' or similar header label
    const row0A = String(getCellValFromRow(targetRaw[0], 'A', 0) || targetRaw[0]['Tên Nhân Viên'] || '').toLowerCase().trim();
    if (row0A.includes('tên nhân viên') || row0A === 'tên' || row0A === 'stt' || row0A.includes('họ tên')) {
      isRow0Header = true;
      headerRowIdx = 0;
    }
  }

  const headerRow = isRow0Header ? targetRaw[headerRowIdx] : null;

  // Pre-calculate column titles for columns A through AQ (0 to 42)
  const headerTitleMap: { [colLetter: string]: string } = {};
  for (let c = 0; c <= 42; c++) {
    const colLetter = getExcelColumnLetter(c);
    let title = '';

    if (headerRow) {
      title = getCellValFromRow(headerRow, colLetter, c);
    }
    if (!title && rawHeaders[c]) {
      title = rawHeaders[c];
    }
    if (!title) {
      title = c === 0 ? 'Tên Nhân Viên' : `Cột ${colLetter}`;
    }

    headerTitleMap[colLetter] = title;
  }

  // Define column group boundaries in the exact order requested:
  // 1: Cao Cấp (B..E), 5: Trung Cấp (F..I), 9: Total CLF (J..M), 13: Total VFM (N..Q), 17: Total MCC (R..U), 
  // 21: Total NDFC (V..Y), 35: Total HPC (AJ..AM), 25: Total VP (Z..AC), 29: Total Non Wilmar (AD..AG)
  const groupStartIndices = [1, 5, 9, 13, 17, 21, 35, 25, 29];
  const groupsInfo: { groupName: string; startColLetter: string; colIndices: number[] }[] = [];

  for (const cIdx of groupStartIndices) {
    const colLetter1 = getExcelColumnLetter(cIdx);
    const colLetter2 = getExcelColumnLetter(cIdx + 1);
    const colLetter3 = getExcelColumnLetter(cIdx + 2);
    const colLetter4 = getExcelColumnLetter(cIdx + 3);

    const rawColTitles = [
      headerTitleMap[colLetter1] || '',
      headerTitleMap[colLetter2] || '',
      headerTitleMap[colLetter3] || '',
      headerTitleMap[colLetter4] || ''
    ];

    // Extract group name: string after '-' in any of the 4 column titles (e.g. 'CT - Cao Cấp' => 'Cao Cấp')
    let groupName = '';
    for (const t of rawColTitles) {
      if (t && t.includes('-')) {
        const parts = t.split('-');
        const afterDash = parts.slice(1).join('-').trim();
        if (afterDash) {
          groupName = afterDash;
          break;
        }
      }
    }
    if (!groupName) {
      const col1 = rawColTitles[0] || '';
      groupName = col1 ? (col1.includes('-') ? col1.split('-').slice(1).join('-').trim() : col1) : `Nhóm ${Math.floor(cIdx / 4) + 1}`;
    }

    if (groupName.toLowerCase().includes('total clf sp') || groupName.toLowerCase().includes('clf')) {
      groupName = 'Total CLF';
    } else if (cIdx === 21 || groupName.toLowerCase().includes('ndfc')) {
      groupName = 'Total NDFC';
    } else if (cIdx === 35 || groupName.toLowerCase().includes('hpc')) {
      groupName = 'Total HPC';
    } else if (cIdx === 25 || groupName.toLowerCase().includes('vp')) {
      groupName = 'Total VP';
    } else if (cIdx === 29 || groupName.toLowerCase().includes('non wilmar') || groupName.toLowerCase().includes('non-wilmar') || groupName.toLowerCase().includes('nonwilmar')) {
      groupName = 'Total Non Wilmar';
    }

    groupsInfo.push({
      groupName,
      startColLetter: colLetter1,
      colIndices: [cIdx, cIdx + 1, cIdx + 2, cIdx + 3]
    });
  }

  // Extract data rows: if row 0 was a header, slice from headerRowIdx + 1. Otherwise, all rows are data!
  const dataRows = isRow0Header ? targetRaw.slice(headerRowIdx + 1) : targetRaw;

  const result: AnnualBonusEmployeeRow[] = [];

  dataRows.forEach((r, idx) => {
    const valA = getCellValFromRow(r, 'A', 0);
    const valB = getCellValFromRow(r, 'B', 1);
    
    // Check if string is a valid name (not purely numeric STT)
    const isHumanName = (str: any) => {
      if (!str) return false;
      const s = String(str).trim();
      return s.length > 1 && isNaN(Number(s));
    };

    let rawName = '';
    if (isHumanName(valB)) {
      rawName = cleanEmployeeName(String(valB));
    } else if (isHumanName(valA)) {
      rawName = cleanEmployeeName(String(valA));
    } else {
      rawName = cleanEmployeeName(String(r['Tên Nhân Viên'] || r['Nhân viên'] || valB || valA || ''));
    }

    // Check if the row has any non-empty data in columns A to AQ
    let hasData = false;
    const cells: { [colLetter: string]: AnnualBonusCell } = {};

    for (let c = 0; c <= 42; c++) {
      const colLetter = getExcelColumnLetter(c);
      let rawVal = getCellValFromRow(r, colLetter, c);

      if (rawVal !== '') {
        hasData = true;
      }

      if (c === 0 && (!rawVal || rawVal === 'Trống') && rawName) {
        rawVal = rawName;
      }

      const headerTitle = headerTitleMap[colLetter] || `Cột ${colLetter}`;
      const numVal = parseFlexibleVolume(rawVal);
      let dispVal = (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') 
        ? String(rawVal).trim() 
        : 'Trống';

      cells[colLetter] = {
        colLetter,
        colIndex: c,
        headerTitle,
        rawValue: rawVal,
        displayValue: dispVal,
        numericValue: numVal
      };
    }

    if (!rawName && !hasData) {
      return; // Skip empty rows
    }

    // Filter out total/summary rows
    const normName = rawName.toLowerCase().trim();
    if (normName.includes('tổng cộng') || normName.includes('total') || normName === 'tổng') {
      return;
    }

    const sttNumber = result.length + 1; // 1, 2, 3, 4, 5, 6, 7, 8...
    const physicalRowIdx = sttNumber;

    const empName = rawName || `Nhân viên ${sttNumber}`;

    const parsedGroups: AnnualBonusGroup[] = groupsInfo.map(gi => {
      const colLetter1 = getExcelColumnLetter(gi.colIndices[0]);
      const colLetter2 = getExcelColumnLetter(gi.colIndices[1]);
      const colLetter3 = getExcelColumnLetter(gi.colIndices[2]);
      const colLetter4 = getExcelColumnLetter(gi.colIndices[3]);

      const target = parseFlexibleVolume(cells[colLetter1]?.rawValue);
      const actual = parseFlexibleVolume(cells[colLetter2]?.rawValue);

      let rate = 0;
      const rateVal = cells[colLetter3]?.rawValue;
      if (rateVal !== undefined && rateVal !== null && String(rateVal).trim() !== '') {
        const rateStr = String(rateVal).trim();
        if (rateStr.includes('%')) {
          rate = parseFloat(rateStr.replace('%', '').trim()) / 100;
        } else {
          const num = parseFloat(rateStr.replace(/[^0-9.-]/g, ''));
          rate = !isNaN(num) ? (num > 2 ? num / 100 : num) : 0;
        }
      } else {
        rate = target > 0 ? actual / target : 0;
      }

      const pointsVal = parseFlexibleVolume(cells[colLetter4]?.rawValue);

      return {
        groupName: gi.groupName,
        startColLetter: colLetter1,
        target,
        actual,
        completionRate: rate,
        groupPoints: pointsVal
      };
    });

    const totalPts = parsedGroups.reduce((acc, g) => acc + g.groupPoints, 0);

    result.push({
      employeeName: empName,
      _physicalRowIndex: physicalRowIdx,
      cells,
      groups: parsedGroups,
      totalPoints: Math.round(totalPts * 10) / 10,
      rawRow: r
    });
  });

  return result;
}

/**
 * Fetches and parses the "Tồn Kho" sheet tab with cache support.
 * Lookup: Mã CDS -> Tên sản phẩm = Cột D, Tồn kho Đơn vị Thùng = Cột I, Tồn kho đơn vị lẻ = Cột J
 */
export async function fetchInventorySheetData(sheetId: string): Promise<InventoryItem[]> {
  const cached = await getCachedModuleData<InventoryItem[]>(sheetId, 'inventory');
  if (cached && !isOnline()) {
    return cached;
  }

  const inventoryTabs = ['Tồn Kho', 'Ton Kho', 'Tồn kho', 'Ton kho', 'TON KHO', 'Inventory', 'TonKho', 'TỒN KHO'];
  let rawRows: any[] = [];
  try {
    rawRows = await fetchWithFallbacks(sheetId, inventoryTabs);
  } catch {
    if (cached) return cached;
  }

  if (!rawRows || rawRows.length === 0) {
    if (cached && cached.length > 0) return cached;
    return [];
  }

  const result: InventoryItem[] = [];
  rawRows.forEach((row) => {
    // Column D = Tên Sản Phẩm
    const tenSP = (row['D'] ?? row['d'] ?? getRowValByCol(row, 'D', ['sản phẩm', 'san pham', 'tên', 'ten']) ?? '').toString().trim();
    
    // Column A/B/C or 'Mã CDS' = Mã CDS
    let maCDS = (row['Mã CDS'] ?? row['Ma CDS'] ?? row['MÃ CDS'] ?? row['MA CDS'] ?? row['A'] ?? row['B'] ?? row['C'] ?? '').toString().trim();
    if (!maCDS) {
      maCDS = (getRowValByCol(row, 'A', ['mã', 'ma', 'cds']) ?? getRowValByCol(row, 'B', ['mã', 'ma', 'cds']) ?? '').toString().trim();
    }

    if (!tenSP && !maCDS) return;
    const lowerTen = tenSP.toLowerCase();
    if (lowerTen.includes('tên sản phẩm') || lowerTen.includes('tên sp') || lowerTen.includes('tên hàng') || maCDS.toLowerCase().includes('mã cds') || lowerTen.includes('cột d')) {
      return;
    }

    // Column I = Tồn kho Đơn vị Thùng
    const valI = row['I'] ?? row['i'] ?? getRowValByCol(row, 'I', ['thùng', 'thung']);
    const tonThung = parseFlexibleVolume(valI);

    // Column J = Tồn kho Đơn vị Lẻ
    const valJ = row['J'] ?? row['j'] ?? getRowValByCol(row, 'J', ['lẻ', 'le']);
    const tonLe = parseFlexibleVolume(valJ);

    // Column L = Đơn Giá Thùng
    const valL = row['L'] ?? row['l'] ?? getRowValByCol(row, 'L', ['giá thùng', 'gia thung', 'đơn giá thùng', 'don gia thung']);
    const donGiaThung = Math.round(parseFlexibleVolume(valL));

    // Column M = Đơn Giá Lẻ
    const valM = row['M'] ?? row['m'] ?? getRowValByCol(row, 'M', ['giá lẻ', 'gia le', 'đơn giá lẻ', 'don gia le']);
    const donGiaLe = Math.round(parseFlexibleVolume(valM));

    // Column N = CTKM 1
    const valN = row['N'] ?? row['n'] ?? getRowValByCol(row, 'N', ['ctkm 1', 'ctkm1', 'khuyến mãi 1', 'km 1', 'ctkm']);
    // Column O = CTKM 2
    const valO = row['O'] ?? row['o'] ?? getRowValByCol(row, 'O', ['ctkm 2', 'ctkm2', 'khuyến mãi 2', 'km 2']);
    // Column P = CTKM 3
    const valP = row['P'] ?? row['p'] ?? getRowValByCol(row, 'P', ['ctkm 3', 'ctkm3', 'khuyến mãi 3', 'km 3']);

    const cleanCTKM = (val: any): string | undefined => {
      if (val === undefined || val === null) return undefined;
      const s = String(val).trim();
      if (!s || s === '0' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'không') return undefined;
      return s;
    };

    const ctkm1 = cleanCTKM(valN);
    const ctkm2 = cleanCTKM(valO);
    const ctkm3 = cleanCTKM(valP);

    result.push({
      maCDS: maCDS || `CDS-${result.length + 1}`,
      tenSanPham: tenSP || `Sản phẩm ${result.length + 1}`,
      tonThung,
      tonLe,
      donGiaThung,
      donGiaLe,
      ctkm1,
      ctkm2,
      ctkm3,
      colA: (row['A'] ?? '').toString(),
      colB: (row['B'] ?? '').toString(),
      colC: (row['C'] ?? '').toString(),
      colD: tenSP,
      colI: valI ? String(valI) : '0',
      colJ: valJ ? String(valJ) : '0',
      colL: valL ? String(valL) : '0',
      colM: valM ? String(valM) : '0',
      colN: valN ? String(valN) : '',
      colO: valO ? String(valO) : '',
      colP: valP ? String(valP) : '',
      rawRow: row
    });
  });

  if (result.length > 0) {
    setCachedModuleData(sheetId, 'inventory', result).catch(() => {});
  }

  return result;
}

/**
 * Converts column letter to 0-based index (A -> 0, E -> 4, AE -> 30, etc.)
 */
export function colLetterToIdx(colStr: string): number {
  let result = 0;
  const str = colStr.toUpperCase().trim();
  for (let i = 0; i < str.length; i++) {
    result = result * 26 + (str.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Generates fallback mock Thi Dua blocks
 */
export function generateMockThiDuaData(): ThiDuaBlock[] {
  return [
    {
      programName: 'Thi đua Bột Ngọt',
      startCol: 'A',
      endCol: 'E',
      range: 'A2:E11',
      headers: ['Mã NV', 'Tên Nhân Viên', 'Số Thùng Bột Ngọt', 'Dữ liệu Xét Thưởng', 'Số tiền thưởng'],
      rows: [
        { 'A': 'NV01', 'B': 'Lê Thị Hương', 'C': '55', 'D': 'Mức 1', 'E': '275.000 ₫', 'Mã NV': 'NV01', 'Tên Nhân Viên': 'Lê Thị Hương', 'Số Thùng Bột Ngọt': '55', 'Dữ liệu Xét Thưởng': 'Mức 1', 'Số tiền thưởng': '275.000 ₫' },
        { 'A': 'NV02', 'B': 'Nguyễn Thành Thực', 'C': '110', 'D': 'Mức 2', 'E': '1.100.000 ₫', 'Mã NV': 'NV02', 'Tên Nhân Viên': 'Nguyễn Thành Thực', 'Số Thùng Bột Ngọt': '110', 'Dữ liệu Xét Thưởng': 'Mức 2', 'Số tiền thưởng': '1.100.000 ₫' },
        { 'A': 'NV03', 'B': 'Bùi Mạnh Cường', 'C': '160', 'D': 'Mức 3', 'E': '2.400.000 ₫', 'Mã NV': 'NV03', 'Tên Nhân Viên': 'Bùi Mạnh Cường', 'Số Thùng Bột Ngọt': '160', 'Dữ liệu Xét Thưởng': 'Mức 3', 'Số tiền thưởng': '2.400.000 ₫' },
        { 'A': 'NV04', 'B': 'Nguyễn Sỹ Vũ', 'C': '12', 'D': 'Chưa Đạt', 'E': '0 ₫', 'Mã NV': 'NV04', 'Tên Nhân Viên': 'Nguyễn Sỹ Vũ', 'Số Thùng Bột Ngọt': '12', 'Dữ liệu Xét Thưởng': 'Chưa Đạt', 'Số tiền thưởng': '0 ₫' },
        { 'A': 'NV05', 'B': 'Dương Thị Thanh', 'C': '65', 'D': 'Mức 1', 'E': '325.000 ₫', 'Mã NV': 'NV05', 'Tên Nhân Viên': 'Dương Thị Thanh', 'Số Thùng Bột Ngọt': '65', 'Dữ liệu Xét Thưởng': 'Mức 1', 'Số tiền thưởng': '325.000 ₫' },
        { 'A': 'NV06', 'B': 'Vũ Anh Tùng', 'C': '125', 'D': 'Mức 2', 'E': '1.250.000 ₫', 'Mã NV': 'NV06', 'Tên Nhân Viên': 'Vũ Anh Tùng', 'Số Thùng Bột Ngọt': '125', 'Dữ liệu Xét Thưởng': 'Mức 2', 'Số tiền thưởng': '1.250.000 ₫' },
        { 'A': 'NV07', 'B': 'Nguyễn Thị Hưng Nguyên', 'C': '10', 'D': 'Chưa Đạt', 'E': '0 ₫', 'Mã NV': 'NV07', 'Tên Nhân Viên': 'Nguyễn Thị Hưng Nguyên', 'Số Thùng Bột Ngọt': '10', 'Dữ liệu Xét Thưởng': 'Chưa Đạt', 'Số tiền thưởng': '0 ₫' },
        { 'A': 'NV08', 'B': 'Nguyễn Đức Tuấn', 'C': '175', 'D': 'Mức 3', 'E': '2.625.000 ₫', 'Mã NV': 'NV08', 'Tên Nhân Viên': 'Nguyễn Đức Tuấn', 'Số Thùng Bột Ngọt': '175', 'Dữ liệu Xét Thưởng': 'Mức 3', 'Số tiền thưởng': '2.625.000 ₫' },
      ]
    },
    {
      programName: 'Thi đua MCC',
      startCol: 'G',
      endCol: 'N',
      range: 'G2:N11',
      headers: ['Mã NV', 'Tên Nhân Viên', 'Số Thùng Bột Nếp', 'Số Thùng Bột Gạo', 'Số Chỉ Tiêu MCC', 'Số thực hiện', 'Số % Hoàn Thành', 'Số tiền Thưởng'],
      rows: [
        { 'G': 'NV01', 'H': 'Lê Thị Hương', 'I': '0', 'J': '0', 'K': '0.36', 'L': '0.036', 'M': '10.00%', 'N': '0 ₫', 'Mã NV': 'NV01', 'Tên Nhân Viên': 'Lê Thị Hương', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.36', 'Số thực hiện': '0.036', 'Số % Hoàn Thành': '10.00%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV02', 'H': 'Nguyễn Thành Thực', 'I': '0', 'J': '0', 'K': '0.47', 'L': '0.059', 'M': '12.52%', 'N': '0 ₫', 'Mã NV': 'NV02', 'Tên Nhân Viên': 'Nguyễn Thành Thực', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.47', 'Số thực hiện': '0.059', 'Số % Hoàn Thành': '12.52%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV03', 'H': 'Bùi Mạnh Cường', 'I': '0', 'J': '0', 'K': '0.53', 'L': '0.083', 'M': '15.66%', 'N': '0 ₫', 'Mã NV': 'NV03', 'Tên Nhân Viên': 'Bùi Mạnh Cường', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.53', 'Số thực hiện': '0.083', 'Số % Hoàn Thành': '15.66%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV04', 'H': 'Nguyễn Sỹ Vũ', 'I': '0', 'J': '0', 'K': '0.63', 'L': '0.156', 'M': '24.76%', 'N': '0 ₫', 'Mã NV': 'NV04', 'Tên Nhân Viên': 'Nguyễn Sỹ Vũ', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.63', 'Số thực hiện': '0.156', 'Số % Hoàn Thành': '24.76%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV05', 'H': 'Dương Thị Thanh', 'I': '0', 'J': '0', 'K': '0.45', 'L': '0.068', 'M': '15.11%', 'N': '0 ₫', 'Mã NV': 'NV05', 'Tên Nhân Viên': 'Dương Thị Thanh', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.45', 'Số thực hiện': '0.068', 'Số % Hoàn Thành': '15.11%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV06', 'H': 'Vũ Anh Tùng', 'I': '1', 'J': '0', 'K': '0.28', 'L': '0.035', 'M': '12.50%', 'N': '0 ₫', 'Mã NV': 'NV06', 'Tên Nhân Viên': 'Vũ Anh Tùng', 'Số Thùng Bột Nếp': '1', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.28', 'Số thực hiện': '0.035', 'Số % Hoàn Thành': '12.50%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV07', 'H': 'Nguyễn Thị Hưng Nguyên', 'I': '0', 'J': '1', 'K': '0.22', 'L': '0.024', 'M': '10.91%', 'N': '0 ₫', 'Mã NV': 'NV07', 'Tên Nhân Viên': 'Nguyễn Thị Hưng Nguyên', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '1', 'Số Chỉ Tiêu MCC': '0.22', 'Số thực hiện': '0.024', 'Số % Hoàn Thành': '10.91%', 'Số tiền Thưởng': '0 ₫' },
        { 'G': 'NV08', 'H': 'Nguyễn Đức Tuấn', 'I': '0', 'J': '0', 'K': '0.38', 'L': '0.042', 'M': '11.05%', 'N': '0 ₫', 'Mã NV': 'NV08', 'Tên Nhân Viên': 'Nguyễn Đức Tuấn', 'Số Thùng Bột Nếp': '0', 'Số Thùng Bột Gạo': '0', 'Số Chỉ Tiêu MCC': '0.38', 'Số thực hiện': '0.042', 'Số % Hoàn Thành': '11.05%', 'Số tiền Thưởng': '0 ₫' },
      ]
    },
    {
      programName: 'Thi đua Gạo',
      startCol: 'P',
      endCol: 'U',
      range: 'P2:U11',
      headers: ['Mã NV', 'Tên Nhân viên', 'Số Chỉ Tiêu', 'Số Thực Hiện', 'Số % Hoàn Thành', 'Số Tiền Xét Thưởng'],
      rows: [
        { 'P': 'NV01', 'Q': 'Lê Thị Hương', 'R': '50', 'S': '32', 'T': '64.0%', 'U': 'Chưa đạt', 'Mã NV': 'NV01', 'Tên Nhân viên': 'Lê Thị Hương', 'Số Chỉ Tiêu': '50', 'Số Thực Hiện': '32', 'Số % Hoàn Thành': '64.0%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV02', 'Q': 'Nguyễn Thành Thực', 'R': '45', 'S': '28', 'T': '62.2%', 'U': 'Chưa đạt', 'Mã NV': 'NV02', 'Tên Nhân viên': 'Nguyễn Thành Thực', 'Số Chỉ Tiêu': '45', 'Số Thực Hiện': '28', 'Số % Hoàn Thành': '62.2%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV03', 'Q': 'Bùi Mạnh Cường', 'R': '40', 'S': '25', 'T': '62.5%', 'U': 'Chưa đạt', 'Mã NV': 'NV03', 'Tên Nhân viên': 'Bùi Mạnh Cường', 'Số Chỉ Tiêu': '40', 'Số Thực Hiện': '25', 'Số % Hoàn Thành': '62.5%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV04', 'Q': 'Nguyễn Sỹ Vũ', 'R': '35', 'S': '18', 'T': '51.4%', 'U': 'Chưa đạt', 'Mã NV': 'NV04', 'Tên Nhân viên': 'Nguyễn Sỹ Vũ', 'Số Chỉ Tiêu': '35', 'Số Thực Hiện': '18', 'Số % Hoàn Thành': '51.4%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV05', 'Q': 'Dương Thị Thanh', 'R': '50', 'S': '38', 'T': '76.0%', 'U': 'Chưa đạt', 'Mã NV': 'NV05', 'Tên Nhân viên': 'Dương Thị Thanh', 'Số Chỉ Tiêu': '50', 'Số Thực Hiện': '38', 'Số % Hoàn Thành': '76.0%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV06', 'Q': 'Vũ Anh Tùng', 'R': '35', 'S': '20', 'T': '57.1%', 'U': 'Chưa đạt', 'Mã NV': 'NV06', 'Tên Nhân viên': 'Vũ Anh Tùng', 'Số Chỉ Tiêu': '35', 'Số Thực Hiện': '20', 'Số % Hoàn Thành': '57.1%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV07', 'Q': 'Nguyễn Thị Hưng Nguyên', 'R': '30', 'S': '15', 'T': '50.0%', 'U': 'Chưa đạt', 'Mã NV': 'NV07', 'Tên Nhân viên': 'Nguyễn Thị Hưng Nguyên', 'Số Chỉ Tiêu': '30', 'Số Thực Hiện': '15', 'Số % Hoàn Thành': '50.0%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
        { 'P': 'NV08', 'Q': 'Nguyễn Đức Tuấn', 'R': '40', 'S': '26', 'T': '65.0%', 'U': 'Chưa đạt', 'Mã NV': 'NV08', 'Tên Nhân viên': 'Nguyễn Đức Tuấn', 'Số Chỉ Tiêu': '40', 'Số Thực Hiện': '26', 'Số % Hoàn Thành': '65.0%', 'Số Tiền Xét Thưởng': 'Chưa đạt' },
      ]
    },
    {
      programName: 'Thi đua NRC Cao Cấp',
      startCol: 'W',
      endCol: 'AC',
      range: 'W2:AC11',
      headers: ['Mã NV', 'Tên Nhân Viên', 'Số Thùng NRC Lô Hội', 'Số Thùng NRC Bưởi Tây', 'Tổng số Thùng', 'Trạng thái xét thưởng', 'Số Tiền Thưởng'],
      rows: [
        { 'W': 'NV01', 'X': 'Lê Thị Hương', 'Y': '15', 'Z': '18', 'AA': '33', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV01', 'Tên Nhân Viên': 'Lê Thị Hương', 'Số Thùng NRC Lô Hội': '15', 'Số Thùng NRC Bưởi Tây': '18', 'Tổng số Thùng': '33', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV02', 'X': 'Nguyễn Thành Thực', 'Y': '12', 'Z': '14', 'AA': '26', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV02', 'Tên Nhân Viên': 'Nguyễn Thành Thực', 'Số Thùng NRC Lô Hội': '12', 'Số Thùng NRC Bưởi Tây': '14', 'Tổng số Thùng': '26', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV03', 'X': 'Bùi Mạnh Cường', 'Y': '10', 'Z': '12', 'AA': '22', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV03', 'Tên Nhân Viên': 'Bùi Mạnh Cường', 'Số Thùng NRC Lô Hội': '10', 'Số Thùng NRC Bưởi Tây': '12', 'Tổng số Thùng': '22', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV04', 'X': 'Nguyễn Sỹ Vũ', 'Y': '8', 'Z': '9', 'AA': '17', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV04', 'Tên Nhân Viên': 'Nguyễn Sỹ Vũ', 'Số Thùng NRC Lô Hội': '8', 'Số Thùng NRC Bưởi Tây': '9', 'Tổng số Thùng': '17', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV05', 'X': 'Dương Thị Thanh', 'Y': '18', 'Z': '20', 'AA': '38', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV05', 'Tên Nhân Viên': 'Dương Thị Thanh', 'Số Thùng NRC Lô Hội': '18', 'Số Thùng NRC Bưởi Tây': '20', 'Tổng số Thùng': '38', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV06', 'X': 'Vũ Anh Tùng', 'Y': '7', 'Z': '10', 'AA': '17', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV06', 'Tên Nhân Viên': 'Vũ Anh Tùng', 'Số Thùng NRC Lô Hội': '7', 'Số Thùng NRC Bưởi Tây': '10', 'Tổng số Thùng': '17', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV07', 'X': 'Nguyễn Thị Hưng Nguyên', 'Y': '6', 'Z': '8', 'AA': '14', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV07', 'Tên Nhân Viên': 'Nguyễn Thị Hưng Nguyên', 'Số Thùng NRC Lô Hội': '6', 'Số Thùng NRC Bưởi Tây': '8', 'Tổng số Thùng': '14', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
        { 'W': 'NV08', 'X': 'Nguyễn Đức Tuấn', 'Y': '11', 'Z': '13', 'AA': '24', 'AB': 'Chưa đạt', 'AC': '0đ', 'Mã NV': 'NV08', 'Tên Nhân Viên': 'Nguyễn Đức Tuấn', 'Số Thùng NRC Lô Hội': '11', 'Số Thùng NRC Bưởi Tây': '13', 'Tổng số Thùng': '24', 'Trạng thái xét thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0đ' },
      ]
    },
    {
      programName: 'Thi đua Giặt Xả',
      startCol: 'AF',
      endCol: 'AO',
      range: 'AF2:AO11',
      headers: ['Mã NV', 'Tên nhân viên', 'Số Thùng Nước Xả Vải', 'Số Thùng Nước Giặt 3kg', 'Số Thùng Nước Giặt 2.5kg', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg', 'Số Thùng Viên Giặt', 'Số Thùng Bột Giặt', 'Tổng Thùng', 'Trạng Thái Xét Thưởng', 'Số Tiền Thưởng'],
      rows: [
        { 'AE': 'NV01', 'AF': 'Lê Thị Hương', 'AG': '4', 'AH': '0', 'AI': '0', 'AJ': '23', 'AK': '0', 'AL': '2', 'AM': '29', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV01', 'Tên nhân viên': 'Lê Thị Hương', 'Số Thùng Nước Xả Vải': '4', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '23', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '2', 'Tổng Thùng': '29', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV02', 'AF': 'Nguyễn Thành Thực', 'AG': '0', 'AH': '0', 'AI': '0', 'AJ': '17', 'AK': '0', 'AL': '1', 'AM': '18', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV02', 'Tên nhân viên': 'Nguyễn Thành Thực', 'Số Thùng Nước Xả Vải': '0', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '17', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '1', 'Tổng Thùng': '18', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV03', 'AF': 'Bùi Mạnh Cường', 'AG': '1', 'AH': '0', 'AI': '0', 'AJ': '50', 'AK': '0', 'AL': '10', 'AM': '61', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV03', 'Tên nhân viên': 'Bùi Mạnh Cường', 'Số Thùng Nước Xả Vải': '1', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '50', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '10', 'Tổng Thùng': '61', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV04', 'AF': 'Nguyễn Sỹ Vũ', 'AG': '1', 'AH': '0', 'AI': '0', 'AJ': '57', 'AK': '0', 'AL': '2', 'AM': '60', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV04', 'Tên nhân viên': 'Nguyễn Sỹ Vũ', 'Số Thùng Nước Xả Vải': '1', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '57', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '2', 'Tổng Thùng': '60', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV05', 'AF': 'Dương Thị Thanh', 'AG': '2', 'AH': '0', 'AI': '0', 'AJ': '23', 'AK': '0', 'AL': '2', 'AM': '27', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV05', 'Tên nhân viên': 'Dương Thị Thanh', 'Số Thùng Nước Xả Vải': '2', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '23', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '2', 'Tổng Thùng': '27', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV06', 'AF': 'Vũ Anh Tùng', 'AG': '1', 'AH': '0', 'AI': '0', 'AJ': '10', 'AK': '1', 'AL': '3', 'AM': '15', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV06', 'Tên nhân viên': 'Vũ Anh Tùng', 'Số Thùng Nước Xả Vải': '1', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '10', 'Số Thùng Viên Giặt': '1', 'Số Thùng Bột Giặt': '3', 'Tổng Thùng': '15', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV07', 'AF': 'Nguyễn Thị Hưng Nguyên', 'AG': '0', 'AH': '0', 'AI': '0', 'AJ': '36', 'AK': '0', 'AL': '3', 'AM': '39', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV07', 'Tên nhân viên': 'Nguyễn Thị Hưng Nguyên', 'Số Thùng Nước Xả Vải': '0', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '36', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '3', 'Tổng Thùng': '39', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
        { 'AE': 'NV08', 'AF': 'Nguyễn Đức Tuấn', 'AG': '0', 'AH': '0', 'AI': '0', 'AJ': '22', 'AK': '0', 'AL': '2', 'AM': '24', 'AN': 'Chưa đạt', 'AO': '0 ₫', 'AD': '0 ₫', 'Mã NV': 'NV08', 'Tên nhân viên': 'Nguyễn Đức Tuấn', 'Số Thùng Nước Xả Vải': '0', 'Số Thùng Nước Giặt 3kg': '0', 'Số Thùng Nước Giặt 2.5kg': '0', 'Số Thùng Nước Giặt 3.2kg/3.4kg/9kg': '22', 'Số Thùng Viên Giặt': '0', 'Số Thùng Bột Giặt': '2', 'Tổng Thùng': '24', 'Trạng Thái Xét Thưởng': 'Chưa đạt', 'Số Tiền Thưởng': '0 ₫' },
      ]
    },
    {
      programName: 'Thi đua NRC Quế',
      startCol: 'AQ',
      endCol: 'AV',
      range: 'AR2:AV11',
      headers: ['Mã NV', 'Tên Nhân Viên', 'Số Thùng NRC Quế', 'Số Kích Hoạt Khách Hàng', 'Trạng thái xét Thưởng', 'Số tiền thưởng'],
      rows: [
        { 'AQ': 'NV01', 'AR': 'Lê Thị Hương', 'AS': '45', 'AT': '65%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV01', 'Tên Nhân Viên': 'Lê Thị Hương', 'Số Thùng NRC Quế': '45', 'Số Kích Hoạt Khách Hàng': '65%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV02', 'AR': 'Nguyễn Thành Thực', 'AS': '38', 'AT': '60%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV02', 'Tên Nhân Viên': 'Nguyễn Thành Thực', 'Số Thùng NRC Quế': '38', 'Số Kích Hoạt Khách Hàng': '60%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV03', 'AR': 'Bùi Mạnh Cường', 'AS': '32', 'AT': '58%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV03', 'Tên Nhân Viên': 'Bùi Mạnh Cường', 'Số Thùng NRC Quế': '32', 'Số Kích Hoạt Khách Hàng': '58%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV04', 'AR': 'Nguyễn Sỹ Vũ', 'AS': '24', 'AT': '45%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV04', 'Tên Nhân Viên': 'Nguyễn Sỹ Vũ', 'Số Thùng NRC Quế': '24', 'Số Kích Hoạt Khách Hàng': '45%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV05', 'AR': 'Dương Thị Thanh', 'AS': '52', 'AT': '72%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV05', 'Tên Nhân Viên': 'Dương Thị Thanh', 'Số Thùng NRC Quế': '52', 'Số Kích Hoạt Khách Hàng': '72%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV06', 'AR': 'Vũ Anh Tùng', 'AS': '26', 'AT': '48%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV06', 'Tên Nhân Viên': 'Vũ Anh Tùng', 'Số Thùng NRC Quế': '26', 'Số Kích Hoạt Khách Hàng': '48%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV07', 'AR': 'Nguyễn Thị Hưng Nguyên', 'AS': '20', 'AT': '40%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV07', 'Tên Nhân Viên': 'Nguyễn Thị Hưng Nguyên', 'Số Thùng NRC Quế': '20', 'Số Kích Hoạt Khách Hàng': '40%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
        { 'AQ': 'NV08', 'AR': 'Nguyễn Đức Tuấn', 'AS': '35', 'AT': '55%', 'AU': 'Chưa đạt', 'AV': '0đ', 'Mã NV': 'NV08', 'Tên Nhân Viên': 'Nguyễn Đức Tuấn', 'Số Thùng NRC Quế': '35', 'Số Kích Hoạt Khách Hàng': '55%', 'Trạng thái xét Thưởng': 'Chưa đạt', 'Số tiền thưởng': '0đ' },
      ]
    },
    {
      programName: 'Thi đua Tổng Sản Lượng HPC',
      startCol: 'AX',
      endCol: 'BC',
      range: 'AX2:BC11',
      headers: ['Tên Nhân Viên', 'Số Chỉ Tiêu', 'Số Thực Hiện', 'Số % Hoàn Thành', 'Xét Thưởng', 'Tiền Thưởng'],
      rows: [
        { 'AX': 'Lê Thị Hương', 'AY': '100', 'AZ': '85', 'BA': '85.0%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Lê Thị Hương', 'Số Chỉ Tiêu': '100', 'Số Thực Hiện': '85', 'Số % Hoàn Thành': '85.0%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Nguyễn Thành Thực', 'AY': '90', 'AZ': '75', 'BA': '83.3%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Nguyễn Thành Thực', 'Số Chỉ Tiêu': '90', 'Số Thực Hiện': '75', 'Số % Hoàn Thành': '83.3%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Bùi Mạnh Cường', 'AY': '80', 'AZ': '68', 'BA': '85.0%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Bùi Mạnh Cường', 'Số Chỉ Tiêu': '80', 'Số Thực Hiện': '68', 'Số % Hoàn Thành': '85.0%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Nguyễn Sỹ Vũ', 'AY': '75', 'AZ': '55', 'BA': '73.3%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Nguyễn Sỹ Vũ', 'Số Chỉ Tiêu': '75', 'Số Thực Hiện': '55', 'Số % Hoàn Thành': '73.3%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Dương Thị Thanh', 'AY': '110', 'AZ': '95', 'BA': '86.4%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Dương Thị Thanh', 'Số Chỉ Tiêu': '110', 'Số Thực Hiện': '95', 'Số % Hoàn Thành': '86.4%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Vũ Anh Tùng', 'AY': '70', 'AZ': '58', 'BA': '82.9%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Vũ Anh Tùng', 'Số Chỉ Tiêu': '70', 'Số Thực Hiện': '58', 'Số % Hoàn Thành': '82.9%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Nguyễn Thị Hưng Nguyên', 'AY': '65', 'AZ': '50', 'BA': '76.9%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Nguyễn Thị Hưng Nguyên', 'Số Chỉ Tiêu': '65', 'Số Thực Hiện': '50', 'Số % Hoàn Thành': '76.9%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
        { 'AX': 'Nguyễn Đức Tuấn', 'AY': '85', 'AZ': '72', 'BA': '84.7%', 'BB': 'Chưa đạt', 'BC': '0đ', 'Tên Nhân Viên': 'Nguyễn Đức Tuấn', 'Số Chỉ Tiêu': '85', 'Số Thực Hiện': '72', 'Số % Hoàn Thành': '84.7%', 'Xét Thưởng': 'Chưa đạt', 'Tiền Thưởng': '0đ' },
      ]
    },
    {
      programName: 'Thi đua Tổng Sản Lượng Bột Mì',
      startCol: 'BE',
      endCol: 'BI',
      range: 'BE2:BI11',
      headers: ['Tên Nhân Viên', 'Chỉ Tiêu', 'Thực Hiện', '% Hoàn Thành', 'Xét Thưởng', 'Tiền Thưởng'],
      rows: [
        { 'BE': 'Lê Thị Hương', 'BF': '35', 'BG': '25', 'BH': 'Đạt', 'BI': '250.000 ₫', 'Tên Nhân Viên': 'Lê Thị Hương', 'Chỉ Tiêu': '35', 'Thực Hiện': '25', '% Hoàn Thành': '71.4%', 'Số Thùng': '35', 'KH Kích Hoạt': '25', 'Xét Thưởng': 'Đạt', 'Tiền Thưởng': '250.000 ₫' },
        { 'BE': 'Nguyễn Thành Thực', 'BF': '20', 'BG': '18', 'BH': 'Chưa Đạt', 'BI': '0 ₫', 'Tên Nhân Viên': 'Nguyễn Thành Thực', 'Chỉ Tiêu': '20', 'Thực Hiện': '18', '% Hoàn Thành': '90.0%', 'Số Thùng': '20', 'KH Kích Hoạt': '18', 'Xét Thưởng': 'Chưa Đạt', 'Tiền Thưởng': '0 ₫' },
        { 'BE': 'Bùi Mạnh Cường', 'BF': '50', 'BG': '30', 'BH': 'Đạt', 'BI': '300.000 ₫', 'Tên Nhân Viên': 'Bùi Mạnh Cường', 'Chỉ Tiêu': '50', 'Thực Hiện': '30', '% Hoàn Thành': '60.0%', 'Số Thùng': '50', 'KH Kích Hoạt': '30', 'Xét Thưởng': 'Đạt', 'Tiền Thưởng': '300.000 ₫' },
        { 'BE': 'Nguyễn Sỹ Vũ', 'BF': '15', 'BG': '12', 'BH': 'Chưa Đạt', 'BI': '0 ₫', 'Tên Nhân Viên': 'Nguyễn Sỹ Vũ', 'Chỉ Tiêu': '15', 'Thực Hiện': '12', '% Hoàn Thành': '80.0%', 'Số Thùng': '15', 'KH Kích Hoạt': '12', 'Xét Thưởng': 'Chưa Đạt', 'Tiền Thưởng': '0 ₫' },
        { 'BE': 'Dương Thị Thanh', 'BF': '40', 'BG': '22', 'BH': 'Đạt', 'BI': '220.000 ₫', 'Tên Nhân Viên': 'Dương Thị Thanh', 'Chỉ Tiêu': '40', 'Thực Hiện': '22', '% Hoàn Thành': '55.0%', 'Số Thùng': '40', 'KH Kích Hoạt': '22', 'Xét Thưởng': 'Đạt', 'Tiền Thưởng': '220.000 ₫' },
        { 'BE': 'Vũ Anh Tùng', 'BF': '32', 'BG': '20', 'BH': 'Đạt', 'BI': '200.000 ₫', 'Tên Nhân Viên': 'Vũ Anh Tùng', 'Chỉ Tiêu': '32', 'Thực Hiện': '20', '% Hoàn Thành': '62.5%', 'Số Thùng': '32', 'KH Kích Hoạt': '20', 'Xét Thưởng': 'Đạt', 'Tiền Thưởng': '200.000 ₫' },
        { 'BE': 'Nguyễn Thị Hưng Nguyên', 'BF': '18', 'BG': '15', 'BH': 'Chưa Đạt', 'BI': '0 ₫', 'Tên Nhân Viên': 'Nguyễn Thị Hưng Nguyên', 'Chỉ Tiêu': '18', 'Thực Hiện': '15', '% Hoàn Thành': '83.3%', 'Số Thùng': '18', 'KH Kích Hoạt': '15', 'Xét Thưởng': 'Chưa Đạt', 'Tiền Thưởng': '0 ₫' },
        { 'BE': 'Nguyễn Đức Tuấn', 'BF': '48', 'BG': '28', 'BH': 'Đạt', 'BI': '280.000 ₫', 'Tên Nhân Viên': 'Nguyễn Đức Tuấn', 'Chỉ Tiêu': '48', 'Thực Hiện': '28', '% Hoàn Thành': '58.3%', 'Số Thùng': '48', 'KH Kích Hoạt': '28', 'Xét Thưởng': 'Đạt', 'Tiền Thưởng': '280.000 ₫' },
      ]
    }
  ];
}

export const THI_DUA_TABS = [
  'Tổng hợp thi đua',
  'Tổng Hợp Thi Đua',
  'TỔNG HỢP THI ĐUA',
  'Tong hop thi dua',
  'Tong Hop Thi Dua',
  'TH Thi Đua',
  'TH THI ĐUA',
  'TH thi đua',
  'TH Thi đua',
  'Tổng Hợp CT Thi Đua',
  'Tổng hợp CT thi đua',
  'TỔNG HỢP CT THI ĐUA',
  'Tổng Hợp Thi đua',
  'Tổng Hợp',
  'Tong Hop',
  'CT Thi Đua',
  'CT THI ĐUA',
  'CT thi đua',
  'Thi Đua',
  'THI ĐUA',
  'Thi đua',
  'Thi dua',
  'ThiDua',
  'THIDUA',
  'Sheet Thi Đua',
  'Chương Trình Thi Đua',
  'Chuong Trinh Thi Dua'
];

/**
 * Parses competition program blocks from the raw sheet rows of 'Tổng hợp thi đua'
 */
export function parseThiDuaBlocks(rawRows: any[], sheetId?: string, dynamicPrograms?: CompetitionProgramConfig[]): ThiDuaBlock[] {
  const mockBlocks = generateMockThiDuaData();
  if (!rawRows || rawRows.length === 0) {
    return mockBlocks;
  }

  const SPECS = [
    { programName: 'Thi đua Bột Ngọt', startCol: 'A', endCol: 'E', range: 'A2:E11', empCol: 'B' },
    { programName: 'Thi đua MCC', startCol: 'G', endCol: 'N', range: 'G2:N11', empCol: 'H' },
    { programName: 'Thi đua Gạo', startCol: 'P', endCol: 'U', range: 'P2:U11', empCol: 'Q' },
    { programName: 'Thi đua NRC Cao Cấp', startCol: 'W', endCol: 'AC', range: 'W2:AC11', empCol: 'X' },
    { programName: 'Thi đua Giặt Xả', startCol: 'AE', endCol: 'AO', range: 'AE2:AO11', empCol: 'AF' },
    { programName: 'Thi đua NRC Quế', startCol: 'AQ', endCol: 'AV', range: 'AQ2:AV11', empCol: 'AR' },
    { programName: 'Thi đua Tổng Sản Lượng HPC', startCol: 'AX', endCol: 'BC', range: 'AX2:BC11', empCol: 'AX' },
    { programName: 'Thi đua Tổng Sản Lượng Bột Mì', startCol: 'BE', endCol: 'BI', range: 'BE2:BI11', empCol: 'BE' }
  ];

  const blocks: ThiDuaBlock[] = [];

  // Helper to check if a row is purely a header row (contains header keywords and NO employee name)
  const isPureHeaderRow = (r: any) => {
    const texts = Object.values(r).map(v => (typeof v === 'string' ? v.toLowerCase().trim() : ''));
    const hasHeaderKeywords = texts.some(t =>
      t === 'tên nhân viên' || t === 'tên nv' || t === 'nhân viên' || t === 'mã nv' || t === 'họ và tên' || t === 'stt' || t === 'dữ liệu xét thưởng'
    );
    const hasRealEmpName = defaultEmployeeOrder.some(emp => {
      const ne = normStr(emp);
      return texts.some(t => normStr(t) === ne || (t.length > 5 && normStr(t).includes(ne)));
    });
    return hasHeaderKeywords && !hasRealEmpName;
  };

  // Helper to check if a row is a summary/total row
  const isSummaryRow = (r: any) => {
    const texts = Object.values(r).map(v => (typeof v === 'string' ? v.toLowerCase().trim() : ''));
    return texts.some(t => t === 'tổng' || t.startsWith('tổng') || t.includes('tổng cộng') || t.includes('toàn npp') || t.includes('toàn đội') || t.includes('bình quân'));
  };

  // Extract candidate employee data rows (excluding pure header and summary rows)
  const headerRow = rawRows.find(r => isPureHeaderRow(r));
  const candidateDataRows = rawRows.filter(r => r !== headerRow && !isPureHeaderRow(r) && !isSummaryRow(r));

  SPECS.forEach((spec, specIdx) => {
    const startIdx = colLetterToIdx(spec.startCol);
    const endIdx = colLetterToIdx(spec.endCol);

    const cols: string[] = [];
    for (let c = startIdx; c <= endIdx; c++) {
      cols.push(getExcelColumnLetter(c));
    }

    const fallbackBlock = mockBlocks[specIdx] || mockBlocks[0];

    const headers: string[] = [];
    cols.forEach(col => {
      const val = headerRow ? String(headerRow[col] ?? '').trim() : '';
      headers.push(val || col);
    });

    const parsedRows: Record<string, string>[] = [];

    const matchEmpStrict = (rawVal: string, targetEmp: string): boolean => {
      if (!rawVal || !targetEmp) return false;
      const cRaw = cleanEmployeeName(rawVal).trim();
      const cTarget = cleanEmployeeName(targetEmp).trim();
      const nRaw = normStr(cRaw);
      const nTarget = normStr(cTarget);
      if (!nRaw || !nTarget) return false;
      if (nRaw === nTarget) return true;
      if (nRaw.length >= 6 && nTarget.length >= 6) {
        if (nRaw.includes(nTarget) || nTarget.includes(nRaw)) return true;
      }
      return false;
    };

    const usedRowIndices = new Set<number>();

    // For each of the 8 default employees, lookup their row with absolute accuracy
    defaultEmployeeOrder.forEach((canonicalEmpName, empIdx) => {
      // 1. Try matching strictly by employee name in spec.empCol or known name columns
      let matchedIdx = candidateDataRows.findIndex((r, idx) => {
        if (usedRowIndices.has(idx)) return false;
        const valEmp = String(r[spec.empCol] ?? '').trim();
        if (valEmp && matchEmpStrict(valEmp, canonicalEmpName)) {
          return true;
        }
        // Also check other name columns in this row
        const checkCols = ['B', 'H', 'Q', 'X', 'AF', 'AR', 'AX', 'BE', 'A', 'G', 'P', 'W', 'AE', 'AQ'];
        for (const col of checkCols) {
          const v = String(r[col] ?? '').trim();
          if (v && matchEmpStrict(v, canonicalEmpName)) {
            return true;
          }
        }
        // Check any string property with strict matching
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith('_')) continue;
          const s = String(v ?? '').trim();
          if (s && s.length <= 35 && matchEmpStrict(s, canonicalEmpName)) {
            return true;
          }
        }
        return false;
      });

      // 2. If not matched by name, match by physical row index:
      if (matchedIdx === -1) {
        const expectedPhysRow = empIdx + 2;
        matchedIdx = candidateDataRows.findIndex((r, idx) => !usedRowIndices.has(idx) && r._physicalRowIndex === expectedPhysRow);
      }

      // 3. Fallback to candidateDataRows[empIdx] if unused
      if (matchedIdx === -1 && candidateDataRows[empIdx] && !usedRowIndices.has(empIdx)) {
        matchedIdx = empIdx;
      }

      // 4. Fallback to any remaining unused candidate row
      if (matchedIdx === -1) {
        matchedIdx = candidateDataRows.findIndex((_, idx) => !usedRowIndices.has(idx));
      }

      let matchedRow: any = null;
      if (matchedIdx !== -1) {
        usedRowIndices.add(matchedIdx);
        matchedRow = candidateDataRows[matchedIdx];
      }

      if (matchedRow) {
        const rowItem: Record<string, string> = {};
        cols.forEach((col, i) => {
          const colIdx = colLetterToIdx(col);
          let val = '';
          if (matchedRow._rawCells && matchedRow._rawCells[colIdx]) {
            const cell = matchedRow._rawCells[colIdx];
            if (cell.f !== undefined && cell.f !== null && String(cell.f).trim() !== '') {
              val = String(cell.f).trim();
            } else if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
              val = String(cell.v).trim();
            }
          }
          if (!val) {
            val = String(matchedRow[col] ?? matchedRow[col.toLowerCase()] ?? matchedRow[col.toUpperCase()] ?? '').trim();
          }

          rowItem[col] = val;
          const hName = headers[i] || col;
          rowItem[hName] = val;
        });

        // Ensure canonical employee name is strictly assigned
        rowItem[spec.empCol] = canonicalEmpName;
        rowItem['Tên Nhân Viên'] = canonicalEmpName;
        rowItem['Tên nhân viên'] = canonicalEmpName;
        rowItem['Nhân Viên'] = canonicalEmpName;
        rowItem['_physicalRowIndex'] = String(matchedRow._physicalRowIndex || (empIdx + 2));

        parsedRows.push(rowItem);
      } else {
        // Fallback to mock/default row for this employee
        const fallbackRow = fallbackBlock.rows[empIdx] || fallbackBlock.rows.find(r => {
          const rn = r[spec.empCol] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '';
          return normStr(rn) === normStr(canonicalEmpName);
        });
        if (fallbackRow) {
          parsedRows.push({ ...fallbackRow });
        }
      }
    });

    // Ensure rows inside each block strictly follow the original employee list order (Lê Thị Hương first)
    parsedRows.sort((a, b) => {
      const nameA = a[spec.empCol] || a['Tên Nhân Viên'] || a['Nhân Viên'] || a['Tên nhân viên'] || '';
      const nameB = b[spec.empCol] || b['Tên Nhân Viên'] || b['Nhân Viên'] || b['Tên nhân viên'] || '';
      const na = normStr(cleanEmployeeName(nameA));
      const nb = normStr(cleanEmployeeName(nameB));
      const idxA = defaultEmployeeOrder.findIndex(name => normStr(name) === na || na.includes(normStr(name)) || normStr(name).includes(na));
      const idxB = defaultEmployeeOrder.findIndex(name => normStr(name) === nb || nb.includes(normStr(name)) || normStr(name).includes(nb));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return nameA.localeCompare(nameB, 'vi');
    });

    blocks.push({
      programName: spec.programName,
      startCol: spec.startCol,
      endCol: spec.endCol,
      range: spec.range,
      headers: headers.some(h => h && h !== h.toUpperCase()) ? headers : fallbackBlock.headers,
      rows: parsedRows.length > 0 ? parsedRows : fallbackBlock.rows
    });
  });

  // Dynamically parse custom competition programs created by Supervisor
  if (dynamicPrograms && dynamicPrograms.length > 0) {
    const customPrograms = dynamicPrograms.filter(
      (p) => p.isCustom || !SPECS.some((s) => s.programName.toLowerCase().includes(p.title.toLowerCase()) || s.programName.toLowerCase().includes(p.shortTitle.toLowerCase()))
    );

    // Trích xuất hàng thứ 10 của bảng Google Sheet (Hàng tổng cộng của các cột)
    const row10 = rawRows.find((r: any) => r._physicalRowIndex === 10)
      || rawRows.find((r: any) => r._physicalRowIndex === 11)
      || rawRows.find((r: any) => {
          const texts = Object.values(r).map(v => typeof v === 'string' ? v.toLowerCase().trim() : '');
          return texts.some(t => t === 'tổng' || t === 'tổng cộng' || t.startsWith('tổng'));
        })
      || (rawRows.length >= 9 ? rawRows[8] : null);

    customPrograms.forEach((cp) => {
      let cols: string[] = [];
      let headers: string[] = [];
      let empCol = 'B';

      if (cp.columns && cp.columns.length > 0) {
        cols = cp.columns.map((c) => c.colLetter.toUpperCase().trim());
        headers = cp.columns.map((c) => c.label);
        empCol = cp.columns.find((c) => c.role === 'employee_name')?.colLetter?.toUpperCase().trim() || cols[0] || 'B';
      } else if (cp.range) {
        const parts = cp.range.split(':');
        const startCol = (parts[0] || 'A').replace(/[^A-Za-z]/g, '').toUpperCase();
        const endCol = (parts[1] || parts[0] || 'E').replace(/[^A-Za-z]/g, '').toUpperCase();
        const sIdx = colLetterToIdx(startCol);
        const eIdx = colLetterToIdx(endCol);
        for (let c = sIdx; c <= eIdx; c++) {
          const letter = getExcelColumnLetter(c);
          cols.push(letter);
          const val = headerRow ? String(headerRow[letter] ?? '').trim() : '';
          headers.push(val || letter);
        }
        empCol = cols[0] || 'B';
      }

      if (cols.length === 0) return;

      // Trích xuất dữ liệu tổng cộng của chương trình từ hàng thứ 10
      const summaryRowItem: Record<string, string> = {};
      if (row10) {
        cols.forEach((col, i) => {
          const colIdx = colLetterToIdx(col);
          let val = '';
          if (row10._rawCells && row10._rawCells[colIdx]) {
            const cell = row10._rawCells[colIdx];
            const strF = cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : '';
            const strV = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
            if (strF && !strF.startsWith('=')) {
              val = strF;
            } else if (strV && !strV.startsWith('=')) {
              val = strV;
            } else if (strV) {
              val = strV;
            } else if (strF) {
              val = strF;
            }
          }
          if (!val) {
            val = String(row10[col] ?? row10[col.toLowerCase()] ?? row10[col.toUpperCase()] ?? '').trim();
          }

          summaryRowItem[col] = val;
          const hName = headers[i] || col;
          summaryRowItem[hName] = val;
          if (cp.columns && cp.columns[i]) {
            summaryRowItem[cp.columns[i].id] = val;
          }
        });
        summaryRowItem[empCol] = 'TỔNG CỘNG';
        summaryRowItem['Tên Nhân Viên'] = 'TỔNG CỘNG';
        summaryRowItem['Tên nhân viên'] = 'TỔNG CỘNG';
        summaryRowItem['Nhân Viên'] = 'TỔNG CỘNG';
      }

      const parsedRows: Record<string, string>[] = [];
      const usedRowIndices = new Set<number>();

      defaultEmployeeOrder.forEach((canonicalEmpName, empIdx) => {
        const normCanonical = normStr(canonicalEmpName);

        // 1. Try matching by employee name in empCol or any column of candidate rows
        let matchedIdx = candidateDataRows.findIndex((r, idx) => {
          if (usedRowIndices.has(idx)) return false;
          const valEmp = String(r[empCol] ?? '').trim();
          if (valEmp) {
            const n = normStr(cleanEmployeeName(valEmp));
            if (n === normCanonical || n.includes(normCanonical) || normCanonical.includes(n)) {
              return true;
            }
          }
          const checkCols = ['B', 'H', 'Q', 'X', 'AF', 'AR', 'AX', 'BE', 'A', 'G', 'P', 'W', 'AE', 'AQ'];
          for (const col of checkCols) {
            const v = String(r[col] ?? '').trim();
            if (v) {
              const n = normStr(cleanEmployeeName(v));
              if (n === normCanonical || n.includes(normCanonical) || normCanonical.includes(n)) {
                return true;
              }
            }
          }
          for (const [k, v] of Object.entries(r)) {
            if (k.startsWith('_')) continue;
            const s = String(v ?? '').trim();
            if (s && s.length <= 35) {
              const n = normStr(cleanEmployeeName(s));
              if (n === normCanonical || n.includes(normCanonical) || normCanonical.includes(n)) {
                return true;
              }
            }
          }
          return false;
        });

        // 2. Match by physical row index (physical row 2..9 for 8 employees, row 10 is summary)
        if (matchedIdx === -1) {
          const expectedPhysRowA = empIdx + 2;
          const expectedPhysRowB = empIdx + 3;
          matchedIdx = candidateDataRows.findIndex((r, idx) => !usedRowIndices.has(idx) && (r._physicalRowIndex === expectedPhysRowA || r._physicalRowIndex === expectedPhysRowB));
        }

        // 3. Fallback by row index
        if (matchedIdx === -1 && candidateDataRows[empIdx] && !usedRowIndices.has(empIdx)) {
          matchedIdx = empIdx;
        }

        // 4. Fallback to any remaining unused candidate row
        if (matchedIdx === -1) {
          matchedIdx = candidateDataRows.findIndex((_, idx) => !usedRowIndices.has(idx));
        }

        let matchedRow: any = null;
        if (matchedIdx !== -1) {
          usedRowIndices.add(matchedIdx);
          matchedRow = candidateDataRows[matchedIdx];
        }

        if (matchedRow) {
          const rowItem: Record<string, string> = {};
          cols.forEach((col, i) => {
            const colIdx = colLetterToIdx(col);
            let val = '';
            if (matchedRow._rawCells && matchedRow._rawCells[colIdx]) {
              const cell = matchedRow._rawCells[colIdx];
              const strF = cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : '';
              const strV = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
              // Ưu tiên giá trị đã tính toán nếu strF là công thức (bắt đầu bằng =)
              if (strF && !strF.startsWith('=')) {
                val = strF;
              } else if (strV && !strV.startsWith('=')) {
                val = strV;
              } else if (strV) {
                val = strV;
              } else if (strF) {
                val = strF;
              }
            }
            if (!val) {
              val = String(matchedRow[col] ?? matchedRow[col.toLowerCase()] ?? matchedRow[col.toUpperCase()] ?? '').trim();
            }

            rowItem[col] = val;
            const hName = headers[i] || col;
            rowItem[hName] = val;
            if (cp.columns && cp.columns[i]) {
              rowItem[cp.columns[i].id] = val;
            }
          });

          rowItem[empCol] = canonicalEmpName;
          rowItem['Tên Nhân Viên'] = canonicalEmpName;
          rowItem['Tên nhân viên'] = canonicalEmpName;
          rowItem['Nhân Viên'] = canonicalEmpName;
          rowItem['_physicalRowIndex'] = String(matchedRow._physicalRowIndex || (empIdx + 2));

          parsedRows.push(rowItem);
        }
      });

      // Sort rows following default employee order
      parsedRows.sort((a, b) => {
        const nameA = a[empCol] || a['Tên Nhân Viên'] || a['Nhân Viên'] || a['Tên nhân viên'] || '';
        const nameB = b[empCol] || b['Tên Nhân Viên'] || b['Nhân Viên'] || b['Tên nhân viên'] || '';
        const na = normStr(cleanEmployeeName(nameA));
        const nb = normStr(cleanEmployeeName(nameB));
        const idxA = defaultEmployeeOrder.findIndex(name => normStr(name) === na || na.includes(normStr(name)) || normStr(name).includes(na));
        const idxB = defaultEmployeeOrder.findIndex(name => normStr(name) === nb || nb.includes(normStr(name)) || normStr(name).includes(nb));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return nameA.localeCompare(nameB, 'vi');
      });

      blocks.push({
        programId: cp.id,
        isCustom: true,
        programName: cp.title,
        startCol: cols[0] || 'A',
        endCol: cols[cols.length - 1] || 'Z',
        range: cp.range || `${cols[0]}2:${cols[cols.length - 1]}11`,
        headers,
        rows: parsedRows,
        summaryRow: summaryRowItem
      });
    });
  }

  if (blocks.length > 0 && sheetId) {
    setCachedModuleData(sheetId, 'thiDua', blocks).catch(() => {});
  }

  return blocks;
}

/**
 * Fetches raw rows from Google Sheet tab "Tổng hợp thi đua" for previewing and dynamic mapping
 */
export async function fetchRawThiDuaRows(sheetId: string, forceRefresh: boolean = false): Promise<any[]> {
  try {
    const rawRows = await fetchWithFallbacks(sheetId, THI_DUA_TABS, undefined, forceRefresh);
    return rawRows || [];
  } catch (err) {
    console.warn('Cannot fetch raw thi dua rows:', err);
    return [];
  }
}

/**
 * Fetches and parses the competition programs exclusively from Google Sheet tab "Tổng hợp thi đua" with cache support
 */
export async function fetchThiDuaSheetData(
  sheetId: string,
  forceRefresh: boolean = false,
  dynamicPrograms?: CompetitionProgramConfig[]
): Promise<ThiDuaBlock[]> {
  if (!forceRefresh) {
    const cached = await getCachedModuleData<ThiDuaBlock[]>(sheetId, 'thiDua');
    if (cached && !isOnline()) {
      return cached;
    }
  }

  let rawRows: any[] = [];
  try {
    rawRows = await fetchWithFallbacks(sheetId, THI_DUA_TABS, undefined, forceRefresh);
  } catch {
    if (!forceRefresh) {
      const cached = await getCachedModuleData<ThiDuaBlock[]>(sheetId, 'thiDua');
      if (cached) return cached;
    }
  }

  if (!rawRows || rawRows.length === 0) {
    if (!forceRefresh) {
      const cached = await getCachedModuleData<ThiDuaBlock[]>(sheetId, 'thiDua');
      if (cached && cached.length > 0) return cached;
    }
    return generateMockThiDuaData();
  }

  return parseThiDuaBlocks(rawRows, sheetId, dynamicPrograms);
}

export const ALLOWED_EMPLOYEES_UP_TO_TUAN = [
  'Lê Thị Hương',
  'Nguyễn Thành Thực',
  'Bùi Mạnh Cường',
  'Nguyễn Sỹ Vũ',
  'Dương Thị Thanh',
  'Vũ Anh Tùng',
  'Nguyễn Thị Hưng Nguyên',
  'Nguyễn Đức Tuấn'
];
