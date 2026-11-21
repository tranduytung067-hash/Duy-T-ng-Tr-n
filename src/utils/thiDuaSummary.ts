import { ThiDuaBlock, CompetitionProgramConfig } from '../types';
import { cleanEmployeeName } from './sheetParser';
import { isProgramActiveStrict, isProgramArchivedStrict } from './competitionService';

export function parseStatusAndAmount(rawStatus: string, rawAmount: string) {
  let status = (rawStatus || '').trim();
  let amount = (rawAmount || '').trim();

  if (status && status !== '-') {
    if (/^Mức\s+\d+/i.test(status)) {
      const tierMatch = status.match(/^(Mức\s+\d+)(?:\s*[-–:]\s*([\d.,\s]+\s*(?:đ|₫|vnd|vnđ)?))?$/i);
      if (tierMatch) {
        status = tierMatch[1].trim();
        if (tierMatch[2] && (!amount || amount === '-' || amount === '0' || amount === '0đ' || amount === '0 ₫')) {
          amount = tierMatch[2].includes('đ') || tierMatch[2].includes('₫') ? tierMatch[2].trim() : tierMatch[2].trim() + 'đ';
        }
      }
    } else {
      const match = status.match(/^([^\d]+?)\s+([\d.,\s]+\s*(?:đ|₫|vnd|vnđ)?)$/i);
      if (match) {
        const secondPart = match[2].trim();
        if (/[đ₫vnd]/i.test(secondPart) || secondPart.replace(/[^0-9]/g, '').length >= 4) {
          status = match[1].replace(/[-–:()]/g, '').trim();
          if (!amount || amount === '-' || amount === '0' || amount === '0đ' || amount === '0 ₫') {
            amount = secondPart.includes('đ') || secondPart.includes('₫') ? secondPart : secondPart + 'đ';
          }
        }
      }
    }
  }

  if (!/^Mức\s+\d+/i.test(status)) {
    status = status.replace(/[\d.,\s]*(?:đ|₫|vnd|vnđ)$/i, '').trim();
  }
  if (!status) status = '-';

  return { status, amount };
}

export function parseMoneyNum(str: string | number): number {
  if (typeof str === 'number') return isNaN(str) ? 0 : str;
  if (!str || str === '-') return 0;
  const s = String(str).trim().toLowerCase();
  if (s === '-' || s === '0' || s === '0đ' || s === '0 ₫' || s === 'chưa đạt' || s === 'không') return 0;

  if (s.includes('tỷ') || s.includes('tỉ')) {
    const numPart = parseFloat(s.replace(/tỷ|tỉ|[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numPart)) return Math.round(numPart * 1000000000);
  }
  if (s.includes('triệu') || s.includes('tr')) {
    const numPart = parseFloat(s.replace(/triệu|tr|[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numPart)) return Math.round(numPart * 1000000);
  }
  if (s.endsWith('k') || s.includes(' k')) {
    const numPart = parseFloat(s.replace(/k|[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numPart)) return Math.round(numPart * 1000);
  }

  const clean = s.replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || val === '-' || val === '') return 0;
  let s = String(val).trim().replace(/[₫đvndvnđ%]/gi, '').trim();
  if (!s || s === '-' || s.toLowerCase() === 'chưa đạt' || s.toLowerCase() === 'không') return 0;

  s = s.replace(/\s+/g, '');

  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3}){2,}$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (/^[1-9]\d{0,2},\d{3}$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

export function formatGeneralNumber(num: number): string {
  if (isNaN(num)) return '-';
  const rounded = Math.round(num * 100) / 100;
  return rounded.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function formatMoneyBonus(val: string | number): string {
  if (typeof val === 'number') {
    if (val <= 0) return '0 ₫';
    return val.toLocaleString('vi-VN') + ' ₫';
  }
  if (!val || val === '-' || val === '0' || val === '0đ' || val === '0 ₫') return '0 ₫';
  const num = parseMoneyNum(val);
  if (num > 0) {
    return num.toLocaleString('vi-VN') + ' ₫';
  }
  return '0 ₫';
}

export function formatPercentage(raw: string | number): string {
  if (raw === null || raw === undefined || raw === '' || raw === '-') return '-';
  let num: number;
  if (typeof raw === 'number') {
    num = raw;
  } else {
    const cleanStr = String(raw).trim();
    if (!cleanStr || cleanStr === '-') return '-';
    const hasPercent = cleanStr.includes('%');
    let s = cleanStr.replace(/[₫đvndvnđ%]/gi, '').trim();
    if (/^\d+,\d+$/.test(s)) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const parsed = parseFloat(s);
    if (isNaN(parsed)) return cleanStr;

    if (hasPercent) {
      num = parsed;
    } else {
      if (parsed <= 5.0 && parsed >= 0) {
        num = parsed * 100;
      } else {
        num = parsed;
      }
    }
  }

  const rounded = Math.round(num * 100) / 100;
  return `${rounded.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
}

export function formatCellValue(
  rawVal: string,
  colLabel: string,
  colCode?: string,
  colRole?: string,
  colFormat?: string,
  isCustom?: boolean
): string {
  if (!rawVal || rawVal === '-') return '-';
  const labelLower = colLabel.toLowerCase().replace(/[\s\n]+/g, ' ');

  if (colRole === 'employee_name' || labelLower.includes('nhân viên') || colCode === 'Mã NV') {
    return cleanEmployeeName(rawVal);
  }

  if (isCustom) {
    if (colRole === 'bonus' || colFormat === 'currency' || labelLower.includes('tiền thưởng') || labelLower.includes('tổng thưởng')) {
      return formatMoneyBonus(rawVal);
    }
    if (colRole === 'percentage' || colFormat === 'percentage' || labelLower.includes('%') || labelLower.includes('hoàn thành')) {
      if (typeof rawVal === 'string' && rawVal.includes('%')) return rawVal;
      return formatPercentage(rawVal);
    }
    return rawVal;
  }

  if (
    colRole === 'bonus' ||
    colFormat === 'currency' ||
    labelLower.includes('tiền thưởng') ||
    labelLower.includes('tiền xét thưởng') ||
    labelLower.includes('số tiền thưởng') ||
    (labelLower.includes('thưởng') && !labelLower.includes('xét thưởng') && !labelLower.includes('trạng thái') && !labelLower.includes('mức')) ||
    colCode === 'E' ||
    colCode === 'N' ||
    colCode === 'U' ||
    colCode === 'AC' ||
    colCode === 'AD' ||
    colCode === 'AV' ||
    colCode === 'BC' ||
    colCode === 'BI'
  ) {
    return formatMoneyBonus(rawVal);
  }

  if (colRole === 'percentage' || colFormat === 'percentage' || labelLower.includes('%') || labelLower.includes('hoàn thành') || colCode === 'M' || colCode === 'T' || colCode === 'BA') {
    return formatPercentage(rawVal);
  }

  if (colRole === 'evaluation' || labelLower.includes('xét thưởng') || labelLower.includes('trạng thái') || labelLower.includes('mức')) {
    return rawVal;
  }

  let s = rawVal.trim().replace(/[₫đvndvnđ]/gi, '').trim();
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  }

  const parsedNum = parseFloat(s);
  if (!isNaN(parsedNum) && !isNaN(Number(s))) {
    return formatGeneralNumber(parsedNum);
  }

  return rawVal;
}

export const BASE_PROGRAM_SPECS = [
  {
    id: 'bot_ngot',
    title: 'Thi đua Bột Ngọt',
    shortTitle: 'Bột Ngọt',
    range: 'A2:E11',
    scheme: {
      intro: 'Trong chu kỳ thi đua, nhân viên bán hàng đạt được các mốc sau, sẽ thưởng thêm trên mỗi đầu thùng:',
      tiers: [
        { condition: 'Mức 1: Số thùng Bột Ngọt ≥ 50', reward: 'Thưởng thêm 5.000đ / thùng' },
        { condition: 'Mức 2: Số thùng Bột Ngọt ≥ 100', reward: 'Thưởng thêm 10.000đ / thùng' },
        { condition: 'Mức 3: Số thùng Bột Ngọt ≥ 150', reward: 'Thưởng thêm 15.000đ / thùng' },
      ]
    },
    columns: [
      { key: 'B', label: 'Tên\nNhân Viên', colCode: 'B' },
      { key: 'C', label: 'Bột\nNgọt', colCode: 'C' },
      { key: 'D', label: 'Xét\nThưởng', colCode: 'D' },
      { key: 'E', label: 'Tiền\nThưởng', colCode: 'E' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'B') return r['B'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
      if (colCode === 'C') return r['C'] || r['Số Thùng Bột Ngọt'] || r['Bột Ngọt'] || r['Số Thùng Đã Bán'] || '-';
      if (colCode === 'D') return r['D'] || r['Dữ liệu Xét Thưởng'] || r['Mức Thưởng'] || r['Xét Thưởng'] || '-';
      if (colCode === 'E') return r['E'] || r['Số tiền thưởng'] || r['Tiền Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'mcc',
    title: 'Thi đua MCC',
    shortTitle: 'MCC',
    range: 'G2:N11',
    scheme: {
      time: 'Từ 21/07/2026 - 20/09/2026 (Lũy kế 3 Chu kỳ)',
      conditions: [
        'Trong kỳ triển khai, mỗi NVBH cần bán tối thiểu 15 thùng Bột Nếp và Bột Gạo',
        'Hoàn thành chỉ tiêu lũy kế trong chu kỳ thi đua ≥ 100%'
      ],
      tiers: [
        { condition: 'Sản lượng bán ≥ 6.5 tấn đến dưới 10 tấn', reward: 'Thưởng 3.500.000đ / đội bán hàng' },
        { condition: 'Sản lượng bán ≥ 10 tấn đến dưới 14 tấn', reward: 'Thưởng 4.500.000đ / đội bán hàng' }
      ]
    },
    columns: [
      { key: 'H', label: 'Tên\nNhân Viên', colCode: 'H' },
      { key: 'I', label: 'Bột Nếp\n(Thùng)', colCode: 'I' },
      { key: 'J', label: 'Bột Gạo\n(Thùng)', colCode: 'J' },
      { key: 'K', label: 'Chỉ Tiêu\n(Tấn)', colCode: 'K' },
      { key: 'L', label: 'Thực Hiện\n(Tấn)', colCode: 'L' },
      { key: 'M', label: '% Hoàn\nThành', colCode: 'M' },
      { key: 'N', label: 'Tiền\nThưởng', colCode: 'N' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'H') return r['H'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || r['Tên nhân viên'] || '-';
      if (colCode === 'I') return r['I'] || r['Số Thùng Bột Nếp'] || r['Bột Nếp'] || r['Bột Nếp (Thùng)'] || r['Bột nếp'] || '-';
      if (colCode === 'J') return r['J'] || r['Số Thùng Bột Gạo'] || r['Bột Gạo'] || r['Bột Gạo (Thùng)'] || r['Bột gạo'] || '-';
      if (colCode === 'K') return r['K'] || r['Số Chỉ Tiêu MCC'] || r['Chỉ Tiêu MCC'] || r['Chỉ Tiêu (Tấn)'] || r['Chỉ tiêu (Tấn)'] || r['Chỉ Tiêu\n(Tấn)'] || r['Chỉ Tiêu'] || r['Chỉ tiêu'] || '-';
      if (colCode === 'L') return r['L'] || r['Số thực hiện'] || r['Thực Hiện (Tấn)'] || r['Thực hiện (Tấn)'] || r['Thực Hiện\n(Tấn)'] || r['Thực Hiện'] || r['Thực hiện'] || '-';
      if (colCode === 'M') return r['M'] || r['Số % Hoàn Thành'] || r['% Hoàn Thành'] || r['% Hoàn\nThành'] || r['% Hoàn thành'] || r['Hoàn Thành'] || r['Hoàn thành'] || '-';
      if (colCode === 'N') return r['N'] || r['Số tiền Thưởng'] || r['Tiền Thưởng'] || r['Tiền\nThưởng'] || r['Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'gao',
    title: 'Thi Đua Gạo',
    shortTitle: 'Gạo',
    range: 'P2:U11',
    scheme: {
      time: '21/07/2026 - 20/08/2026',
      conditions: [
        'Hoàn thành tối thiểu 100% chỉ tiêu ngành hàng Gạo trong chu kỳ triển khai'
      ],
      tiers: [
        { condition: 'Mức 1: Hoàn thành từ 100% đến < 110%', reward: 'Thưởng 300.000đ / NVBH, OM' },
        { condition: 'Mức 2: Hoàn thành từ 110% đến < 120%', reward: 'Thưởng 500.000đ / NVBH, OM' },
        { condition: 'Mức 3: Hoàn thành từ 120% trở lên', reward: 'Thưởng 700.000đ / NVBH, OM' }
      ]
    },
    columns: [
      { key: 'Q', label: 'Tên\nNhân Viên', colCode: 'Q' },
      { key: 'R', label: 'Chỉ\nTiêu', colCode: 'R' },
      { key: 'S', label: 'Thực\nHiện', colCode: 'S' },
      { key: 'T', label: '% Hoàn\nThành', colCode: 'T' },
      { key: 'U', label: 'Tiền\nThưởng', colCode: 'U' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'Q') return r['Q'] || r['Tên Nhân viên'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
      if (colCode === 'R') return r['R'] || r['Số Chỉ Tiêu'] || r['Chỉ Tiêu'] || '-';
      if (colCode === 'S') return r['S'] || r['Số Thực Hiện'] || r['Thực Hiện'] || '-';
      if (colCode === 'T') return r['T'] || r['Số % Hoàn Thành'] || r['Hoàn Thành'] || r['% Hoàn Thành'] || '-';
      if (colCode === 'U') return r['U'] || r['Số Tiền Xét Thưởng'] || r['Tiền Thưởng'] || r['Xét Thưởng'] || r['Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'nrc_cao_cap',
    title: 'Thi đua NRC Cao Cấp',
    shortTitle: 'NRC Cao Cấp',
    range: 'W2:AC11',
    scheme: {
      time: 'Từ 21/07 - 20/08',
      conditions: [
        'Điều kiện 1: Sản lượng NRC Lô Hội đạt tối thiểu 5 thùng',
        'Điều kiện 2: Tổng sản lượng NRC Lô Hội & Bưởi Tây đạt tối thiểu 20 thùng'
      ],
      tiers: [
        { condition: 'Đạt đủ điều kiện trên', reward: 'Thưởng thêm 30.000đ / thùng' }
      ]
    },
    columns: [
      { key: 'X', label: 'Tên\nNhân Viên', colCode: 'X' },
      { key: 'Y', label: 'NRC\nLô Hội', colCode: 'Y' },
      { key: 'Z', label: 'NRC\nBưởi Tây', colCode: 'Z' },
      { key: 'AA', label: 'Tổng\nThùng', colCode: 'AA' },
      { key: 'AB', label: 'Xét\nThưởng', colCode: 'AB' },
      { key: 'AC', label: 'Tiền\nThưởng', colCode: 'AC' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'X') return r['X'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
      if (colCode === 'Y') return r['Y'] || r['Số Thùng NRC Lô Hội'] || r['NRC Lô Hội'] || '-';
      if (colCode === 'Z') return r['Z'] || r['Số Thùng NRC Bưởi Tây'] || r['NRC Bưởi Tây'] || '-';
      if (colCode === 'AA') {
        if (r['AA'] !== undefined && r['AA'] !== null && String(r['AA']).trim() !== '') return r['AA'];
        const y = parseFloat((r['Y'] || r['Số Thùng NRC Lô Hội'] || r['NRC Lô Hội'] || '0').toString().replace(/,/g, '')) || 0;
        const z = parseFloat((r['Z'] || r['Số Thùng NRC Bưởi Tây'] || r['NRC Bưởi Tây'] || '0').toString().replace(/,/g, '')) || 0;
        const sum = y + z;
        return sum > 0 ? sum.toString() : (r['AA'] || '-');
      }
      if (colCode === 'AB') return r['AB'] || r['Trạng thái xét thưởng'] || r['Xét Thưởng'] || '-';
      if (colCode === 'AC') return r['AC'] || r['Số Tiền Thưởng'] || r['Tiền Thưởng'] || r['Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'giat_xa',
    title: 'Thi đua Giặt Xả',
    shortTitle: 'Giặt Xả',
    range: 'AE2:AO11',
    scheme: {
      time: '21/07 - 20/08',
      conditions: [
        'Nước xả vải đạt tối thiểu 6 thùng',
        'Tổng sản lượng các sản phẩm áp dụng đạt tối thiểu 70 thùng'
      ],
      tiers: [
        { condition: 'Nước xả vải', reward: '35.000đ / thùng' },
        { condition: 'Nước giặt 3kg / 2.5kg', reward: '20.000đ / thùng' },
        { condition: 'Nước giặt 3.2kg / 3.4kg / 9kg', reward: '10.000đ / thùng' },
        { condition: 'Bột giặt QR', reward: '25.000đ / thùng' },
        { condition: 'Viên giặt', reward: '100.000đ / thùng' }
      ]
    },
    columns: [
      { key: 'AF', label: 'Tên\nNhân Viên', colCode: 'AF' },
      { key: 'AG', label: 'Xả\nVải', colCode: 'AG' },
      { key: 'AH', label: 'Giặt\n3kg', colCode: 'AH' },
      { key: 'AI', label: 'Giặt\n2.5kg', colCode: 'AI' },
      { key: 'AJ', label: 'Giặt\nMẫu Cũ', colCode: 'AJ' },
      { key: 'AK', label: 'Viên\nGiặt', colCode: 'AK' },
      { key: 'AL', label: 'Bột\nGiặt', colCode: 'AL' },
      { key: 'AM', label: 'Tổng\nThùng', colCode: 'AM' },
      { key: 'AN', label: 'Xét\nThưởng', colCode: 'AN' },
      { key: 'AO', label: 'Tiền\nThưởng', colCode: 'AO' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'AF') return r['AF'] || r['Tên nhân viên'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
      if (colCode === 'AG') return r['AG'] || r['Số Thùng Nước Xả Vải'] || r['Nước Xả Vải'] || '-';
      if (colCode === 'AH') return r['AH'] || r['Số Thùng Nước Giặt 3kg'] || r['Nước Giặt 3kg'] || '-';
      if (colCode === 'AI') return r['AI'] || r['Số Thùng Nước Giặt 2.5kg'] || r['Nước Giặt 2.5kg'] || '-';
      if (colCode === 'AJ') return r['AJ'] || r['Số Thùng Nước Giặt 3.2kg/3.4kg/9kg'] || r['Nước Giặt Mẫu Cũ'] || r['Nước Giặt 3.2kg, 3.4kg, 9kg'] || '-';
      if (colCode === 'AK') return r['AK'] || r['Số Thùng Viên Giặt'] || r['Viên Giặt'] || '-';
      if (colCode === 'AL') return r['AL'] || r['Số Thùng Bột Giặt'] || r['Bột Giặt QR'] || r['Bột Giặt'] || '-';
      if (colCode === 'AM') {
        if (r['AM'] !== undefined && r['AM'] !== null && String(r['AM']).trim() !== '') return r['AM'];
        const ag = parseFloat((r['AG'] || r['Số Thùng Nước Xả Vải'] || r['Nước Xả Vải'] || '0').toString().replace(/,/g, '')) || 0;
        const ah = parseFloat((r['AH'] || r['Số Thùng Nước Giặt 3kg'] || r['Nước Giặt 3kg'] || '0').toString().replace(/,/g, '')) || 0;
        const ai = parseFloat((r['AI'] || r['Số Thùng Nước Giặt 2.5kg'] || r['Nước Giặt 2.5kg'] || '0').toString().replace(/,/g, '')) || 0;
        const aj = parseFloat((r['AJ'] || r['Số Thùng Nước Giặt 3.2kg/3.4kg/9kg'] || r['Nước Giặt Mẫu Cũ'] || '0').toString().replace(/,/g, '')) || 0;
        const ak = parseFloat((r['AK'] || r['Số Thùng Viên Giặt'] || r['Viên Giặt'] || '0').toString().replace(/,/g, '')) || 0;
        const al = parseFloat((r['AL'] || r['Số Thùng Bột Giặt'] || r['Bột Giặt QR'] || '0').toString().replace(/,/g, '')) || 0;
        const sum = ag + ah + ai + aj + ak + al;
        return sum > 0 ? sum.toString() : (r['AM'] || '-');
      }
      if (colCode === 'AN') return r['AN'] || r['Trạng Thái Xét Thưởng'] || r['Trạng thái xét thưởng'] || r['Xét Thưởng'] || '-';
      if (colCode === 'AO' || colCode === 'AD') return r['AO'] || r['Số Tiền Thưởng'] || r['Tiền Thưởng'] || r['Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'nrc_que',
    title: 'Thi đua NRC Quế',
    shortTitle: 'NRC Quế',
    range: 'AR2:AV11',
    scheme: {
      time: '21/07 - 20/08',
      conditions: [
        'Kích hoạt tối thiểu 20 khách hàng mua hàng (Đơn vị tính kích hoạt: 0,5 thùng)'
      ],
      tiers: [
        { condition: 'Đạt đủ điều kiện trên', reward: 'Thưởng thêm 20.000đ / thùng' }
      ]
    },
    columns: [
      { key: 'AR', label: 'Tên\nNhân Viên', colCode: 'AR' },
      { key: 'AS', label: 'NRC\nQuế', colCode: 'AS' },
      { key: 'AT', label: 'Kích Hoạt\nKhách Hàng', colCode: 'AT' },
      { key: 'AU', label: 'Xét\nThưởng', colCode: 'AU' },
      { key: 'AV', label: 'Tiền\nThưởng', colCode: 'AV' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'AR') return r['AR'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
      if (colCode === 'AS') return r['AS'] || r['Số Thùng NRC Quế'] || r['NRC Quế'] || r['Số Thùng'] || '-';
      if (colCode === 'AT') return r['AT'] || r['Số Kích Hoạt Khách Hàng'] || r['Kích Hoạt'] || '-';
      if (colCode === 'AU') return r['AU'] || r['Trạng thái xét Thưởng'] || r['Trạng Thái Xét Thưởng'] || r['Xét Thưởng'] || '-';
      if (colCode === 'AV') return r['AV'] || r['Số tiền thưởng'] || r['Tiền Thưởng'] || r['Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'tong_san_luong_hpc',
    title: 'Thi đua Tổng Sản Lượng HPC',
    shortTitle: 'Tổng SL HPC',
    range: 'AX2:BC11',
    scheme: {
      time: '21/07 - 20/08',
      conditions: [
        'Đạt tối thiểu từ 101% tổng chỉ tiêu của NPP'
      ],
      tiers: [
        { condition: 'Đạt từ 101% trở lên', reward: 'Thưởng 500.000đ / NVBH, OM' },
        { condition: 'Đạt từ 105% trở lên', reward: 'Thưởng 1.000.000đ / NVBH, OM' }
      ]
    },
    columns: [
      { key: 'AX', label: 'Tên\nNhân Viên', colCode: 'AX' },
      { key: 'AY', label: 'Chỉ\nTiêu', colCode: 'AY' },
      { key: 'AZ', label: 'Thực\nHiện', colCode: 'AZ' },
      { key: 'BA', label: '% Hoàn\nThành', colCode: 'BA' },
      { key: 'BB', label: 'Xét\nThưởng', colCode: 'BB' },
      { key: 'BC', label: 'Tiền\nThưởng', colCode: 'BC' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      if (colCode === 'AX') return r['AX'] || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
      if (colCode === 'AY') return r['AY'] || r['Số Chỉ Tiêu'] || r['Chỉ Tiêu'] || '-';
      if (colCode === 'AZ') return r['AZ'] || r['Số Thực Hiện'] || r['Thực Hiện'] || '-';
      if (colCode === 'BA') return r['BA'] || r['Số % Hoàn Thành'] || r['% Hoàn Thành'] || r['Hoàn Thành'] || '-';
      if (colCode === 'BB') return r['BB'] || r['Xét Thưởng'] || r['Trạng thái xét thưởng'] || r['Trạng Thái Xét Thưởng'] || '-';
      if (colCode === 'BC') return r['BC'] || r['Tiền Thưởng'] || r['Số tiền thưởng'] || r['Thưởng'] || '0 ₫';
      return r[colCode] || '-';
    }
  },
  {
    id: 'bot_mi_meizan',
    title: 'Thi đua Tổng Sản Lượng Bột Mì',
    shortTitle: 'Tổng SL Bột Mì',
    range: 'BE2:BI11',
    scheme: {
      time: 'Từ 01/07 - 30/08',
      conditions: [
        'NVBH hoàn thành chỉ tiêu tổng sản lượng Bột Mì theo phân bổ của NPP'
      ],
      tiers: [
        { condition: 'Khách hàng đạt kích hoạt (≥ 20 KH)', reward: 'Thưởng 10.000đ / Cửa hàng đạt kích hoạt' }
      ]
    },
    columns: [
      { key: 'BE', label: 'Tên\nNhân Viên', colCode: 'BE' },
      { key: 'BF', label: 'Chỉ\nTiêu', colCode: 'BF' },
      { key: 'BG', label: 'Thực\nHiện', colCode: 'BG' },
      { key: 'BOT_MI_PCT', label: '% Hoàn\nThành', colCode: 'BOT_MI_PCT' },
      { key: 'BH', label: 'Xét\nThưởng', colCode: 'BH' },
      { key: 'BI', label: 'Tiền\nThưởng', colCode: 'BI' },
    ],
    getValue: (r: Record<string, string>, colCode: string) => {
      let rawBE = r['BE'] || r['Tên Nhân Viên'] || r['Tên nhân viên'] || r['Nhân Viên'] || '';
      let rawBF = r['BF'] || r['Chỉ Tiêu'] || r['Số Chỉ Tiêu'] || r['Chỉ tiêu'] || r['Số Thùng'] || r['Số thùng'] || r['Thùng'] || '';
      let rawBG = r['BG'] || r['Thực Hiện'] || r['Số Thực Hiện'] || r['Thực hiện'] || r['KH Kích Hoạt'] || r['Số KH Kích Hoạt'] || r['Cửa hàng kích hoạt'] || r['Kích Hoạt'] || r['Số KH'] || '';
      let rawBH = r['BH'] || r['Xét Thưởng'] || r['Trạng thái xét thưởng'] || r['Trạng Thái Xét Thưởng'] || '';
      let rawBI = r['BI'] || r['Tiền Thưởng'] || r['Số tiền thưởng'] || r['Thưởng'] || '';

      if (/^NV\d+/i.test(rawBE) && rawBF && isNaN(parseFloat(rawBF.replace(/,/g, '')))) {
        rawBE = rawBF;
        rawBF = rawBG;
        rawBG = r['BH'] || '';
        rawBH = r['BI'] || '';
        rawBI = r['BJ'] || r['Tiền Thưởng'] || '';
      }

      if (colCode === 'BE') return rawBE || '-';
      if (colCode === 'BF') return rawBF || '-';
      if (colCode === 'BG') return rawBG || '-';
      if (colCode === 'BOT_MI_PCT' || colCode === 'PERCENT_HOAN_THANH' || colCode === '% Hoàn Thành') {
        const explicitPct = r['% Hoàn Thành'] || r['% Hoàn thành'] || r['Hoàn Thành'] || r['Số % Hoàn Thành'];
        if (explicitPct && String(explicitPct).trim() !== '' && String(explicitPct).trim() !== '-') {
          return explicitPct;
        }
        const chiTieu = parseCleanNumber(rawBF);
        const thucHien = parseCleanNumber(rawBG);
        if (chiTieu > 0) {
          return formatPercentage((thucHien / chiTieu) * 100);
        }
        return '-';
      }
      if (colCode === 'BH') return rawBH || '-';
      if (colCode === 'BI') return rawBI || '0 ₫';
      return r[colCode] || '-';
    }
  }
];

export const PROGRAM_COL_MAP: Record<string, { nameCol: string; bonusCol: string; statusCol?: string }> = {
  bot_ngot: { nameCol: 'B', bonusCol: 'E', statusCol: 'D' },
  mcc: { nameCol: 'H', bonusCol: 'N', statusCol: 'M' },
  gao: { nameCol: 'Q', bonusCol: 'U', statusCol: 'T' },
  nrc_cao_cap: { nameCol: 'X', bonusCol: 'AC', statusCol: 'AB' },
  giat_xa: { nameCol: 'AF', bonusCol: 'AO', statusCol: 'AN' },
  nrc_que: { nameCol: 'AR', bonusCol: 'AV', statusCol: 'AU' },
  tong_san_luong_hpc: { nameCol: 'AX', bonusCol: 'BC', statusCol: 'BB' },
  bot_mi_meizan: { nameCol: 'BE', bonusCol: 'BI', statusCol: 'BH' },
  prog_1790484173459_a09i: { nameCol: 'BR', bonusCol: 'BX', statusCol: 'BW' },
  prog_1790487414931_ny62: { nameCol: 'BZ', bonusCol: 'CG', statusCol: 'CF' },
};

export const DEFAULT_EMPLOYEE_ORDER = [
  'Lê Thị Hương',
  'Nguyễn Thành Thực',
  'Bùi Mạnh Cường',
  'Nguyễn Sỹ Vũ',
  'Dương Thị Thanh',
  'Vũ Anh Tùng',
  'Nguyễn Thị Hưng Nguyên',
  'Nguyễn Đức Tuấn'
];

export const normThiDuaStr = (s: string) =>
  s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '') : '';

export const sortEmployeesByOriginalOrder = (nameA: string, nameB: string): number => {
  const na = normThiDuaStr(cleanEmployeeName(nameA));
  const nb = normThiDuaStr(cleanEmployeeName(nameB));
  const idxA = DEFAULT_EMPLOYEE_ORDER.findIndex(
    (name) => normThiDuaStr(name) === na || na.includes(normThiDuaStr(name)) || normThiDuaStr(name).includes(na)
  );
  const idxB = DEFAULT_EMPLOYEE_ORDER.findIndex(
    (name) => normThiDuaStr(name) === nb || nb.includes(normThiDuaStr(name)) || normThiDuaStr(name).includes(nb)
  );
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return nameA.localeCompare(nameB, 'vi');
};

export function buildProgramSpecs(customPrograms: CompetitionProgramConfig[]) {
  const matchedConfigIds = new Set<string>();

  const baseList = BASE_PROGRAM_SPECS.map((base) => {
    const liveConfig =
      customPrograms.find((p) => p.id === base.id) ||
      customPrograms.find(
        (p) =>
          (p.title && base.title && p.title.trim().toLowerCase() === base.title.trim().toLowerCase()) ||
          (p.shortTitle && base.shortTitle && p.shortTitle.trim().toLowerCase() === base.shortTitle.trim().toLowerCase())
      );

    if (liveConfig) {
      matchedConfigIds.add(liveConfig.id);
    }

    let title = liveConfig?.title || base.title;
    if (base.id === 'bot_mi_meizan' && (title === 'Thi đua Bột Mì Meizan Gold Số 11' || !title)) {
      title = 'Thi đua Tổng Sản Lượng Bột Mì';
    }
    let shortTitle = liveConfig?.shortTitle || base.shortTitle;
    if (base.id === 'bot_mi_meizan' && (shortTitle === 'Bột Mì Meizan' || !shortTitle)) {
      shortTitle = 'Tổng SL Bột Mì';
    }
    const range = liveConfig?.range || base.range;
    const isActive = liveConfig ? isProgramActiveStrict(liveConfig) : false;
    const isArchived = liveConfig ? isProgramArchivedStrict(liveConfig) : false;
    const baseScheme = (base.scheme || {}) as Record<string, any>;
    const scheme = {
      intro: liveConfig?.intro || baseScheme.intro,
      time: liveConfig?.time || baseScheme.time || 'Đang cập nhật',
      conditions: liveConfig?.conditions || baseScheme.conditions || [],
      tiers: liveConfig?.tiers || baseScheme.tiers || [],
      details: liveConfig?.details || baseScheme.details || []
    };

    return {
      ...base,
      title,
      shortTitle,
      range,
      isActive,
      isArchived,
      isCustom: false,
      scheme
    };
  });

  const customList = customPrograms
    .filter((p) => !matchedConfigIds.has(p.id) && (p.isCustom || !BASE_PROGRAM_SPECS.some((b) =>
      b.id === p.id ||
      (p.title && b.title && p.title.trim().toLowerCase() === b.title.trim().toLowerCase()) ||
      (p.shortTitle && b.shortTitle && p.shortTitle.trim().toLowerCase() === b.shortTitle.trim().toLowerCase())
    )))
    .map((cp) => {
      const columns = (cp.columns && cp.columns.length > 0)
        ? cp.columns.map((c, cIdx) => ({
            id: c.id,
            key: c.id || `${c.colLetter.toUpperCase()}_${cIdx}`,
            label: c.label,
            colCode: c.colLetter.toUpperCase(),
            colLetter: c.colLetter.toUpperCase(),
            role: c.role,
            format: c.format
          }))
        : [
            { id: 'col_name', key: 'B', label: 'Tên\nNhân Viên', colCode: 'B', colLetter: 'B', role: 'employee_name' as const },
            { id: 'col_bonus', key: 'E', label: 'Tiền\nThưởng', colCode: 'E', colLetter: 'E', role: 'bonus' as const }
          ];

      return {
        id: cp.id,
        title: cp.title,
        shortTitle: cp.shortTitle,
        range: cp.range || '',
        isActive: isProgramActiveStrict(cp),
        isArchived: isProgramArchivedStrict(cp),
        isCustom: true,
        columns,
        scheme: {
          intro: cp.intro || `Chương trình thi đua ${cp.title.toLowerCase()}`,
          time: cp.time || 'Đang áp dụng',
          conditions: cp.conditions || [],
          tiers: cp.tiers || [],
          details: cp.details || []
        },
        getValue: (r: Record<string, string>, colCode: string) => {
          const matchedCol = columns.find((c) => c.colCode === colCode || c.key === colCode || c.id === colCode);
          let val = (matchedCol?.id ? r[matchedCol.id] : '') || r[colCode] || r[matchedCol?.label || ''] || '';
          if (!val && matchedCol) {
            val = r[matchedCol.colCode] || r[matchedCol.colCode.toLowerCase()] || '';
          }
          if (matchedCol?.role === 'employee_name') {
            return val || r['Tên Nhân Viên'] || r['Nhân Viên'] || '-';
          }
          if (matchedCol?.role === 'bonus' || matchedCol?.format === 'currency') {
            if (!val || val === '0' || val === '-') return '0 ₫';
            if (typeof val === 'string' && val.includes('₫')) return val;
            const n = parseCleanNumber(val);
            return n > 0 ? `${n.toLocaleString('vi-VN')} ₫` : '0 ₫';
          }
          if (matchedCol?.role === 'percentage' || matchedCol?.format === 'percentage') {
            if (val && String(val).includes('%')) return val;
            const n = parseCleanNumber(val);
            const pct = n <= 1 && n > 0 ? n * 100 : n;
            return n > 0 ? `${pct.toFixed(1)}%` : (val || '-');
          }
          return val || '-';
        }
      };
    });

  return [...baseList, ...customList];
}

export function getProgramColMap(progId: string, customPrograms: CompetitionProgramConfig[]) {
  if (PROGRAM_COL_MAP[progId]) return PROGRAM_COL_MAP[progId];
  const cp = customPrograms.find((p) => p.id === progId);
  if (cp && cp.columns && cp.columns.length > 0) {
    const nameCol = cp.columns.find((c) => c.role === 'employee_name')?.colLetter?.toUpperCase() || cp.columns[0].colLetter.toUpperCase();
    const bonusCol = cp.columns.slice().reverse().find((c) => c.role === 'bonus' || c.label.toLowerCase().includes('tổng thưởng') || c.label.toLowerCase().includes('tiền thưởng'))?.colLetter?.toUpperCase() ||
      cp.columns.find((c) => c.role === 'bonus')?.colLetter?.toUpperCase() ||
      cp.columns[cp.columns.length - 1].colLetter.toUpperCase();
    const statusCol = cp.columns.find((c) => c.role === 'evaluation')?.colLetter?.toUpperCase();
    return { nameCol, bonusCol, statusCol };
  }
  return { nameCol: 'B', bonusCol: 'E', statusCol: 'D' };
}

export type BuiltProgramSpec = ReturnType<typeof buildProgramSpecs>[number];

export function computeThiDuaEmployeeSummary(
  blocks: ThiDuaBlock[],
  visibleProgramSpecs: BuiltProgramSpec[],
  customPrograms: CompetitionProgramConfig[]
) {
  const empMap = new Map<string, Record<string, { rawAmount: string; numAmount: number; status: string }>>();

  visibleProgramSpecs.forEach((spec) => {
    const blockData = blocks.find((b) => {
      if (b.programId && b.programId === spec.id) return true;
      if (b.programName.trim().toLowerCase() === spec.title.trim().toLowerCase()) return true;
      if (spec.shortTitle && b.programName.trim().toLowerCase() === spec.shortTitle.trim().toLowerCase()) return true;
      if (spec.id === 'bot_mi_meizan') {
        return b.programName.toLowerCase().includes('bột mì');
      }
      if (spec.title.toLowerCase().includes('hạt nêm') || spec.id.includes('hat_nem')) {
        return b.programName.toLowerCase().includes('hạt nêm');
      }
      if (spec.title.toLowerCase().includes('horeca') || spec.id.includes('horeca')) {
        return b.programName.toLowerCase().includes('horeca') || b.startCol.toUpperCase() === 'BZ';
      }
      if (spec.range && b.range && b.range.toUpperCase() === spec.range.toUpperCase()) return true;
      if (spec.range && b.startCol && b.startCol.toUpperCase() === spec.range.split(':')[0].replace(/\d+/g, '')) return true;
      return false;
    });
    const rows = blockData?.rows || [];

    const colMap = getProgramColMap(spec.id, customPrograms);
    const nameColCode = colMap?.nameCol || spec.columns.find((c) => c.label.toLowerCase().replace(/[\s\n]+/g, ' ').includes('nhân viên') || (c as any).role === 'employee_name')?.colCode || spec.columns[0].colCode;
    const bonusColCode = colMap?.bonusCol ||
      spec.columns.slice().reverse().find((c) => (c as any).role === 'bonus' || c.label.toLowerCase().includes('tổng thưởng') || c.label.toLowerCase().includes('tiền thưởng'))?.colCode ||
      spec.columns.find((c) => (c as any).role === 'bonus' || c.label.toLowerCase().includes('tiền thưởng') || c.label.toLowerCase().includes('thưởng'))?.colCode;
    const statusColCode = colMap?.statusCol || spec.columns.find((c) => (c as any).role === 'evaluation' || c.label.toLowerCase().replace(/[\s\n]+/g, ' ').includes('xét thưởng') || c.label.toLowerCase().replace(/[\s\n]+/g, ' ').includes('trạng thái'))?.colCode;

    rows.forEach((r) => {
      const rawName = spec.getValue(r, nameColCode);
      let empName = cleanEmployeeName(rawName);

      if (!empName || empName === '-' || empName.toLowerCase().includes('tổng') || empName.toLowerCase().includes('cộng') || empName.toLowerCase().includes('chỉ tiêu')) {
        for (const defName of DEFAULT_EMPLOYEE_ORDER) {
          const normDef = normThiDuaStr(defName);
          const foundInRow = Object.values(r).some(v => {
            if (!v || typeof v !== 'string') return false;
            const nv = normThiDuaStr(cleanEmployeeName(v));
            return nv === normDef || nv.includes(normDef) || normDef.includes(nv);
          });
          if (foundInRow) {
            empName = defName;
            break;
          }
        }
      }

      if (!empName || empName === '-' || empName.toLowerCase().includes('tổng') || empName.toLowerCase().includes('cộng') || empName.toLowerCase().includes('chỉ tiêu')) return;

      const bonusStr = bonusColCode ? spec.getValue(r, bonusColCode) : '-';
      const statusStr = statusColCode ? spec.getValue(r, statusColCode) : '-';
      const numVal = parseMoneyNum(bonusStr);

      const standardName = DEFAULT_EMPLOYEE_ORDER.find(o => {
        const no = normThiDuaStr(o);
        const ne = normThiDuaStr(empName);
        return no === ne || no.includes(ne) || ne.includes(no);
      }) || empName;

      if (!empMap.has(standardName)) {
        empMap.set(standardName, {});
      }
      empMap.get(standardName)![spec.id] = {
        rawAmount: bonusStr,
        numAmount: numVal,
        status: statusStr
      };
    });
  });

  DEFAULT_EMPLOYEE_ORDER.forEach((standardName) => {
    let matchedKey: string | null = null;
    for (const existingKey of empMap.keys()) {
      const ne = normThiDuaStr(cleanEmployeeName(existingKey));
      const ns = normThiDuaStr(standardName);
      if (ne === ns || ne.includes(ns) || ns.includes(ne)) {
        matchedKey = existingKey;
        break;
      }
    }
    if (!matchedKey) {
      empMap.set(standardName, {});
    }
  });

  const list: Array<{
    empName: string;
    programRewards: Record<string, { rawAmount: string; numAmount: number; status: string }>;
    totalBonus: number;
    completedCount: number;
  }> = [];

  empMap.forEach((rewards, empName) => {
    let totalBonus = 0;
    let completedCount = 0;

    visibleProgramSpecs.forEach((spec) => {
      const r = rewards[spec.id];
      if (r) {
        const isAchieved =
          r.numAmount > 0 ||
          (r.status &&
            r.status !== '-' &&
            !r.status.toLowerCase().includes('không') &&
            !r.status.toLowerCase().includes('chưa'));

        totalBonus += r.numAmount;
        if (isAchieved) {
          completedCount += 1;
        }
      }
    });

    list.push({
      empName,
      programRewards: rewards,
      totalBonus,
      completedCount,
    });
  });

  list.sort((a, b) => sortEmployeesByOriginalOrder(a.empName, b.empName));

  const grandTotalBonus = list.reduce((acc, curr) => acc + curr.totalBonus, 0);
  const rewardedEmpCount = list.filter((e) => e.totalBonus > 0).length;

  return {
    employeeSummaryList: list,
    grandTotalBonus,
    rewardedEmpCount,
    totalEmployees: list.length,
    activeCount: visibleProgramSpecs.length,
  };
}
