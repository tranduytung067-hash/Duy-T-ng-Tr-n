import { CompetitionProgramConfig, DynamicColumnConfig, CompetitionColumnRole, CompetitionColumnFormat } from '../types';

/**
 * Checks if a string is a valid Excel/Google Sheet column letter (e.g. A, B, Z, AA, BK, etc.)
 */
export function isValidColLetter(letter: string): boolean {
  if (!letter) return false;
  return /^[A-Za-z]{1,3}$/.test(letter.trim());
}

/**
 * Converts column letter to 0-based column index (e.g. A -> 0, B -> 1, Z -> 25, AA -> 26)
 */
export function colLetterToIndex(col: string): number {
  const clean = col.toUpperCase().trim();
  let result = 0;
  for (let i = 0; i < clean.length; i++) {
    result = result * 26 + (clean.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Converts 0-based column index to letter (e.g. 0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
 */
export function indexToColLetter(index: number): string {
  let letter = '';
  let temp = index + 1;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Preset templates for instant dynamic competition program creation
 */
export interface ProgramTemplate {
  name: string;
  description: string;
  defaultTitle: string;
  defaultShortTitle: string;
  defaultTime: string;
  columns: Array<{ label: string; offset: number; role: CompetitionColumnRole; format?: CompetitionColumnFormat }>;
  conditions: string[];
  tiers: Array<{ condition: string; reward: string }>;
}

export const DYNAMIC_PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    name: 'Chỉ Tiêu & Doanh Số / Sản Lượng',
    description: 'Chương trình chuẩn theo Chỉ tiêu, Thực hiện, % Hoàn thành và Tiền thưởng',
    defaultTitle: 'Thi đua Doanh Số Ngành Hàng',
    defaultShortTitle: 'Doanh Số',
    defaultTime: 'Từ 21/08 - 20/09',
    columns: [
      { label: 'Tên\nNhân Viên', offset: 0, role: 'employee_name', format: 'text' },
      { label: 'Chỉ\nTiêu', offset: 1, role: 'target', format: 'number' },
      { label: 'Thực\nHiện', offset: 2, role: 'actual', format: 'number' },
      { label: '% Hoàn\nThành', offset: 3, role: 'percentage', format: 'percentage' },
      { label: 'Xét\nThưởng', offset: 4, role: 'evaluation', format: 'text' },
      { label: 'Tiền\nThưởng', offset: 5, role: 'bonus', format: 'currency' },
    ],
    conditions: [
      'Hoàn thành tối thiểu 100% chỉ tiêu được giao trong chu kỳ thi đua'
    ],
    tiers: [
      { condition: 'Hoàn thành từ 100% đến < 110%', reward: 'Thưởng 300.000 ₫' },
      { condition: 'Hoàn thành từ 110% đến < 120%', reward: 'Thưởng 500.000 ₫' },
      { condition: 'Hoàn thành từ 120% trở lên', reward: 'Thưởng 700.000 ₫' }
    ]
  },
  {
    name: 'Thưởng Theo Đầu Thùng / Sản Lượng',
    description: 'Thưởng trên mỗi đầu thùng sản phẩm bán ra theo từng mốc số lượng',
    defaultTitle: 'Thi đua Sản Lượng Thùng',
    defaultShortTitle: 'Sản Lượng',
    defaultTime: 'Từ 21/08 - 20/09',
    columns: [
      { label: 'Tên\nNhân Viên', offset: 0, role: 'employee_name', format: 'text' },
      { label: 'Số Thùng\nĐã Bán', offset: 1, role: 'actual', format: 'number' },
      { label: 'Xét\nThưởng', offset: 2, role: 'evaluation', format: 'text' },
      { label: 'Tiền\nThưởng', offset: 3, role: 'bonus', format: 'currency' },
    ],
    conditions: [
      'Nhân viên bán hàng đạt các mốc sản lượng thùng được quy định trong chu kỳ'
    ],
    tiers: [
      { condition: 'Mức 1: Số thùng ≥ 50', reward: 'Thưởng thêm 5.000 ₫ / thùng' },
      { condition: 'Mức 2: Số thùng ≥ 100', reward: 'Thưởng thêm 10.000 ₫ / thùng' },
      { condition: 'Mức 3: Số thùng ≥ 150', reward: 'Thưởng thêm 15.000 ₫ / thùng' }
    ]
  },
  {
    name: 'Kích Hoạt Điểm Bán / Khách Hàng',
    description: 'Thưởng theo số lượng khách hàng mua hàng mới hoặc mở điểm bán',
    defaultTitle: 'Thi đua Kích Hoạt Khách Hàng',
    defaultShortTitle: 'Kích Hoạt',
    defaultTime: 'Từ 21/08 - 20/09',
    columns: [
      { label: 'Tên\nNhân Viên', offset: 0, role: 'employee_name', format: 'text' },
      { label: 'Số KH\nKích Hoạt', offset: 1, role: 'actual', format: 'number' },
      { label: 'Xét\nThưởng', offset: 2, role: 'evaluation', format: 'text' },
      { label: 'Tiền\nThưởng', offset: 3, role: 'bonus', format: 'currency' },
    ],
    conditions: [
      'Kích hoạt tối thiểu từ 20 khách hàng mua hàng đạt tiêu chuẩn'
    ],
    tiers: [
      { condition: 'Đạt từ 20 khách hàng trở lên', reward: 'Thưởng 20.000 ₫ / khách hàng' }
    ]
  },
  {
    name: 'Đa Sản Phẩm / Đa SKU',
    description: 'Chương trình kết hợp nhiều sản phẩm SKU và tính tổng thùng',
    defaultTitle: 'Thi đua Đa Sản Phẩm',
    defaultShortTitle: 'Đa SKU',
    defaultTime: 'Từ 21/08 - 20/09',
    columns: [
      { label: 'Tên\nNhân Viên', offset: 0, role: 'employee_name', format: 'text' },
      { label: 'Sản Phẩm A\n(Thùng)', offset: 1, role: 'general', format: 'number' },
      { label: 'Sản Phẩm B\n(Thùng)', offset: 2, role: 'general', format: 'number' },
      { label: 'Tổng\nThùng', offset: 3, role: 'actual', format: 'number' },
      { label: 'Xét\nThưởng', offset: 4, role: 'evaluation', format: 'text' },
      { label: 'Tiền\nThưởng', offset: 5, role: 'bonus', format: 'currency' },
    ],
    conditions: [
      'Sản phẩm A đạt tối thiểu 5 thùng và Tổng thùng đạt tối thiểu 20 thùng'
    ],
    tiers: [
      { condition: 'Đạt đủ điều kiện tối thiểu', reward: 'Thưởng thêm 30.000 ₫ / thùng' }
    ]
  }
];

/**
 * Validates a dynamic competition program configuration
 */
export function validateDynamicProgram(program: Partial<CompetitionProgramConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!program.title || !program.title.trim()) {
    errors.push('Tên chương trình thi đua không được để trống.');
  }

  if (!program.shortTitle || !program.shortTitle.trim()) {
    errors.push('Tên viết tắt của chương trình không được để trống.');
  }

  if (!program.time || !program.time.trim()) {
    errors.push('Thời gian triển khai chương trình không được để trống.');
  }

  if (!program.columns || program.columns.length < 2) {
    errors.push('Chương trình cần có tối thiểu 2 cột dữ liệu (ví dụ: Tên Nhân Viên và Tiền Thưởng).');
  } else {
    const hasEmpName = program.columns.some((c) => c.role === 'employee_name');
    if (!hasEmpName) {
      errors.push('Bắt buộc phải chỉ định ít nhất 1 cột có vai trò là "Tên Nhân Viên".');
    }

    const colLetters = new Set<string>();
    program.columns.forEach((c, idx) => {
      if (!c.label || !c.label.trim()) {
        errors.push(`Cột #${idx + 1}: Vui lòng nhập tên/nhãn hiển thị.`);
      }
      if (!c.colLetter || !isValidColLetter(c.colLetter)) {
        errors.push(`Cột #${idx + 1} ("${c.label || 'Chưa đặt tên'}"): Ký tự cột Google Sheet không hợp lệ (ví dụ hợp lệ: A, B, Z, AA, BK).`);
      } else {
        const upper = c.colLetter.toUpperCase().trim();
        if (colLetters.has(upper)) {
          errors.push(`Ký tự cột "${upper}" bị trùng lặp ở nhiều cột khác nhau. Mỗi cột trong Sheet phải là duy nhất.`);
        }
        colLetters.add(upper);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
