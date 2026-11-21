import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  Plus,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Eye,
  Settings2,
  Award,
  Calendar,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Sliders,
  DollarSign,
  TrendingUp,
  Percent,
  Check,
  RotateCcw
} from 'lucide-react';
import {
  CompetitionProgramConfig,
  DynamicColumnConfig,
  CompetitionColumnRole,
  CompetitionColumnFormat,
  CompetitionSchemeTier
} from '../types';
import {
  DYNAMIC_PROGRAM_TEMPLATES,
  validateDynamicProgram,
  isValidColLetter,
  colLetterToIndex,
  indexToColLetter
} from '../utils/competitionUtils';
import { saveCompetitionProgram, deleteCompetitionProgram } from '../utils/competitionService';
import { cleanEmployeeName } from '../utils/sheetParser';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

interface DynamicProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  programToEdit?: CompetitionProgramConfig | null;
  rawSheetRows?: any[];
  currentUserName: string;
  isMarketSupervisor?: boolean;
  onSaved?: (program: CompetitionProgramConfig) => void;
}

const DEFAULT_EMPLOYEES = [
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
 * Phân tích chuỗi số từ Google Sheet một cách chuẩn xác:
 * - Hỗ trợ chuẩn Việt Nam: 1.200 (1 nghìn 2 trăm), 1.500.000, 12,5 (12 phẩy 5)
 * - Hỗ trợ số thập phân: 0.36, 0.036
 * - Hỗ trợ tiền tệ và phần trăm
 */
function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || val === '-' || val === '') return 0;
  let s = String(val).trim().replace(/[₫đvndvnđ%]/gi, '').trim();
  if (!s || s === '-' || s.toLowerCase() === 'chưa đạt' || s.toLowerCase() === 'không') return 0;

  s = s.replace(/\s+/g, '');

  // 1. Dạng có cả chấm và phẩy:
  // 1.1 Chấm hàng nghìn, phẩy thập phân: 1.234,56 hoặc 1.234.567,89
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // 1.2 Phẩy hàng nghìn, chấm thập phân: 1,234.56 hoặc 1,234,567.89
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  // 2. Nhiều dấu chấm (chắc chắn là hàng nghìn): 1.500.000
  else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  // 3. Nhiều dấu phẩy (chắc chắn là hàng nghìn): 1,500,000
  else if (/^\d{1,3}(,\d{3}){2,}$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  // 4. Có 1 dấu chấm với đúng 3 chữ số đằng sau, và không bắt đầu bằng "0": 1.000, 15.000, 250.000
  else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  // 5. Có 1 dấu phẩy với đúng 3 chữ số đằng sau, và không bắt đầu bằng "0": 1,000, 15,000, 250,000
  else if (/^[1-9]\d{0,2},\d{3}$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  // 6. Dấu phẩy thập phân thông thường: 12,5 hoặc 0,36
  else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function parseMoneyNum(str: string | number): number {
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

export default function DynamicProgramModal({
  isOpen,
  onClose,
  programToEdit,
  rawSheetRows = [],
  currentUserName,
  isMarketSupervisor = true,
  onSaved
}: DynamicProgramModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'scheme' | 'preview'>('config');

  // Form states
  const [title, setTitle] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [time, setTime] = useState('');
  const [sheetTab, setSheetTab] = useState('Tổng hợp thi đua');
  const [range, setRange] = useState('');
  const [intro, setIntro] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [columns, setColumns] = useState<DynamicColumnConfig[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [tiers, setTiers] = useState<CompetitionSchemeTier[]>([]);
  const [details, setDetails] = useState<string[]>([]);

  // UI state
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(isOpen && isMarketSupervisor !== false), dialogRef, onClose);

  // Initialize or reset form when modal opens or programToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (programToEdit) {
      setTitle(programToEdit.title || '');
      setShortTitle(programToEdit.shortTitle || '');
      setTime(programToEdit.time || '');
      setSheetTab(programToEdit.sheetTab || 'Tổng hợp thi đua');
      setRange(programToEdit.range || '');
      setIntro(programToEdit.intro || '');
      setIsActive(programToEdit.isActive === true && programToEdit.isArchived !== true);
      setConditions(programToEdit.conditions || []);
      setTiers(programToEdit.tiers || []);
      setDetails(programToEdit.details || []);

      if (programToEdit.columns && programToEdit.columns.length > 0) {
        setColumns(JSON.parse(JSON.stringify(programToEdit.columns)));
      } else {
        // Generate default columns from template
        applyTemplate(DYNAMIC_PROGRAM_TEMPLATES[0], 'BK');
      }
    } else {
      // New program: apply default template starting at column BK
      applyTemplate(DYNAMIC_PROGRAM_TEMPLATES[0], 'BK');
    }
    setErrors([]);
    setShowDeleteConfirm(false);
    setActiveTab('config');
  }, [isOpen, programToEdit]);

  // Apply preset template
  const applyTemplate = (template: typeof DYNAMIC_PROGRAM_TEMPLATES[0], baseCol = 'BK') => {
    setTitle(template.defaultTitle);
    setShortTitle(template.defaultShortTitle);
    setTime(template.defaultTime);
    setConditions([...template.conditions]);
    setTiers([...template.tiers]);
    setIntro(`Chương trình thi đua ${template.defaultTitle.toLowerCase()}`);

    const baseIdx = isValidColLetter(baseCol) ? colLetterToIndex(baseCol) : 62; // BK is 62
    const generatedCols: DynamicColumnConfig[] = template.columns.map((c, i) => {
      const letter = indexToColLetter(baseIdx + c.offset);
      return {
        id: `col_${Date.now()}_${i}`,
        label: c.label,
        colLetter: letter,
        role: c.role,
        format: c.format || 'text',
        isVisible: true
      };
    });
    setColumns(generatedCols);

    if (generatedCols.length > 0) {
      const start = generatedCols[0].colLetter;
      const end = generatedCols[generatedCols.length - 1].colLetter;
      setRange(`${start}2:${end}11`);
    }
    setShowPresetPicker(false);
  };

  // Add new empty column
  const handleAddColumn = () => {
    let nextLetter = 'A';
    if (columns.length > 0) {
      const lastCol = columns[columns.length - 1].colLetter;
      if (isValidColLetter(lastCol)) {
        nextLetter = indexToColLetter(colLetterToIndex(lastCol) + 1);
      }
    }
    const newCol: DynamicColumnConfig = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'Cột Mới',
      colLetter: nextLetter,
      role: 'general',
      format: 'text',
      isVisible: true
    };
    setColumns([...columns, newCol]);
  };

  // Update column attribute
  const handleUpdateColumn = (id: string, updates: Partial<DynamicColumnConfig>) => {
    setColumns(columns.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  // Remove column
  const handleRemoveColumn = (id: string) => {
    if (columns.length <= 2) {
      notify.warning('Chương trình cần có tối thiểu 2 cột dữ liệu.');
      return;
    }
    setColumns(columns.filter((c) => c.id !== id));
  };

  // Move column order
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const newCols = [...columns];
    const temp = newCols[index];
    newCols[index] = newCols[targetIndex];
    newCols[targetIndex] = temp;
    setColumns(newCols);
  };

  // Condition handlers
  const handleAddCondition = () => {
    setConditions([...conditions, '']);
  };
  const handleUpdateCondition = (idx: number, val: string) => {
    const updated = [...conditions];
    updated[idx] = val;
    setConditions(updated);
  };
  const handleRemoveCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  // Tier handlers
  const handleAddTier = () => {
    setTiers([...tiers, { condition: '', reward: '' }]);
  };
  const handleUpdateTier = (idx: number, field: 'condition' | 'reward', val: string) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: val };
    setTiers(updated);
  };
  const handleRemoveTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  // Normalize string for employee name matching in preview
  const normStr = (s: string) =>
    s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '') : '';

  // Extract preview data using real rawSheetRows
  const previewRows = useMemo(() => {
    if (!columns || columns.length === 0) return [];

    const empCol = columns.find((c) => c.role === 'employee_name')?.colLetter?.toUpperCase() || columns[0].colLetter.toUpperCase();

    // Helper to check if a row is purely a header row (contains header keywords and NO employee name)
    const isPureHeaderRow = (r: any) => {
      const texts = Object.values(r).map(v => (typeof v === 'string' ? v.toLowerCase().trim() : ''));
      const hasHeaderKeywords = texts.some(t =>
        t === 'tên nhân viên' || t === 'tên nv' || t === 'nhân viên' || t === 'mã nv' || t === 'họ và tên' || t === 'stt' || t === 'dữ liệu xét thưởng'
      );
      const hasRealEmpName = DEFAULT_EMPLOYEES.some(emp => {
        const ne = normStr(emp);
        return texts.some(t => {
          const nt = normStr(t);
          return nt === ne || (nt.length >= 6 && (nt.includes(ne) || ne.includes(nt)));
        });
      });
      return hasHeaderKeywords && !hasRealEmpName;
    };

    // Helper to check if a row is a summary/total row
    const isSummaryRow = (r: any) => {
      const texts = Object.values(r).map(v => (typeof v === 'string' ? v.toLowerCase().trim() : ''));
      return texts.some(t => t === 'tổng' || t.startsWith('tổng') || t.includes('tổng cộng') || t.includes('toàn npp') || t.includes('toàn đội') || t.includes('bình quân'));
    };

    // Separate candidate rows from raw sheet, strictly excluding header and summary rows
    const candidateRows = rawSheetRows.length > 0
      ? rawSheetRows.filter((r: any) => {
          if (!r) return false;
          if (isPureHeaderRow(r)) return false;
          if (isSummaryRow(r)) return false;
          return Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
        })
      : [];

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

    return DEFAULT_EMPLOYEES.map((empName, empIdx) => {
      // 1. Strict match employee row by name (never re-use an already matched row)
      let matchedIdx = candidateRows.findIndex((r: any, idx: number) => {
        if (usedRowIndices.has(idx)) return false;
        const valEmp = String(r[empCol] ?? '').trim();
        if (valEmp && matchEmpStrict(valEmp, empName)) return true;
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith('_')) continue;
          const s = String(v ?? '').trim();
          if (s && s.length <= 35 && matchEmpStrict(s, empName)) return true;
        }
        return false;
      });

      // 2. If not matched by name, match by physical row index if still available
      if (matchedIdx === -1) {
        const expectedPhysRow = empIdx + 3; // headers usually at row 2, data at row 3
        matchedIdx = candidateRows.findIndex((r: any, idx: number) => !usedRowIndices.has(idx) && r._physicalRowIndex === expectedPhysRow);
      }

      // 3. Fallback to candidateRows[empIdx] if not yet used
      if (matchedIdx === -1 && candidateRows[empIdx] && !usedRowIndices.has(empIdx)) {
        matchedIdx = empIdx;
      }

      // 4. Fallback to any remaining unused candidate row
      if (matchedIdx === -1) {
        matchedIdx = candidateRows.findIndex((_, idx: number) => !usedRowIndices.has(idx));
      }

      let matchedRow: any = null;
      if (matchedIdx !== -1) {
        usedRowIndices.add(matchedIdx);
        matchedRow = candidateRows[matchedIdx];
      }

      // Build cell values
      const rowItem: Record<string, string> = {
        _empName: empName
      };

      columns.forEach((c) => {
        const letter = c.colLetter.toUpperCase().trim();
        const colIdx = colLetterToIndex(letter);
        let val = '';

        if (matchedRow) {
          if (matchedRow._rawCells && matchedRow._rawCells[colIdx]) {
            const cell = matchedRow._rawCells[colIdx];
            const strF = cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : '';
            const strV = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';

            // Nếu strF là công thức (bắt đầu bằng =), ưu tiên lấy strV là giá trị đã tính toán
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
            val = String(matchedRow[letter] ?? matchedRow[letter.toLowerCase()] ?? matchedRow[letter.toUpperCase()] ?? '').trim();
          }
        }

        if (c.role === 'employee_name') {
          val = empName;
        }

        rowItem[c.id] = val || '-';
      });

      return rowItem;
    });
  }, [columns, rawSheetRows]);

  // Preview totals - Lấy dữ liệu tổng cộng từ hàng thứ 10 của bảng Google Sheet (theo yêu cầu)
  const previewTotals = useMemo(() => {
    const totals: Record<string, string> = {};

    // Tìm hàng thứ 10 của bảng Google Sheet (hàng tổng kết các cột thi đua)
    const row10 = rawSheetRows.find((r: any) => r._physicalRowIndex === 10)
      || rawSheetRows.find((r: any) => r._physicalRowIndex === 11)
      || rawSheetRows.find((r: any) => {
          const texts = Object.values(r).map(v => typeof v === 'string' ? v.toLowerCase().trim() : '');
          return texts.some(t => t === 'tổng' || t === 'tổng cộng' || t.startsWith('tổng'));
        })
      || (rawSheetRows.length >= 9 ? rawSheetRows[8] : null);

    // Helper xác định cột Chỉ Tiêu và Thực Hiện
    const targetCol = columns.find((col) => {
      if (col.role === 'target') return true;
      const l = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
      return l.includes('chỉ tiêu') || l.includes('chi tieu') || l.includes('kế hoạch') || l.includes('target');
    });

    const actualCol = columns.find((col) => {
      if (col.role === 'actual') return true;
      const l = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
      return l.includes('thực hiện') || l.includes('thuc hien') || l.includes('actual') || l.includes('đã bán') || l.includes('kích hoạt');
    });

    columns.forEach((c) => {
      if (c.role === 'employee_name') {
        totals[c.id] = 'TỔNG CỘNG';
        return;
      }

      // Ưu tiên lấy trực tiếp từ hàng thứ 10 của bảng theo đúng cấu hình cột Sheet
      let row10Val = '';
      if (row10) {
        const letter = c.colLetter.toUpperCase().trim();
        const colIdx = colLetterToIndex(letter);
        if (row10._rawCells && row10._rawCells[colIdx]) {
          const cell = row10._rawCells[colIdx];
          const strF = cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : '';
          const strV = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
          if (strF && !strF.startsWith('=')) {
            row10Val = strF;
          } else if (strV && !strV.startsWith('=')) {
            row10Val = strV;
          } else if (strV) {
            row10Val = strV;
          } else if (strF) {
            row10Val = strF;
          }
        }
        if (!row10Val) {
          row10Val = String(row10[letter] ?? row10[letter.toLowerCase()] ?? row10[letter.toUpperCase()] ?? '').trim();
        }
      }

      if (row10Val && row10Val !== '-' && row10Val.toLowerCase() !== 'null') {
        if (c.role === 'bonus' || c.format === 'currency') {
          if (row10Val.includes('₫')) {
            totals[c.id] = row10Val;
          } else {
            const n = parseCleanNumber(row10Val);
            totals[c.id] = `${n.toLocaleString('vi-VN')} ₫`;
          }
          return;
        }

        if (c.role === 'percentage' || c.format === 'percentage') {
          if (row10Val.includes('%')) {
            totals[c.id] = row10Val;
          } else {
            const n = parseCleanNumber(row10Val);
            const pct = n <= 1 && n > 0 ? n * 100 : n;
            totals[c.id] = `${pct.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
          }
          return;
        }

        if (c.role === 'evaluation') {
          totals[c.id] = row10Val.toLowerCase() === 'tổng' ? '-' : row10Val;
          return;
        }

        totals[c.id] = row10Val;
        return;
      }

      // Fallback: nếu hàng 10 không có giá trị ở cột này, tính toán theo các hàng phía trên
      if (c.role === 'evaluation') {
        totals[c.id] = '-';
        return;
      }

      if (c.role === 'bonus' || c.format === 'currency') {
        let sumBonus = 0;
        let countBonus = 0;
        previewRows.forEach((r) => {
          const raw = r[c.id];
          if (!raw || raw === '-' || raw.trim() === '') return;
          const n = parseMoneyNum(raw);
          sumBonus += n;
          countBonus++;
        });
        totals[c.id] = countBonus > 0 ? `${sumBonus.toLocaleString('vi-VN')} ₫` : '0 ₫';
        return;
      }

      if (c.role === 'percentage' || c.format === 'percentage') {
        // Tổng % = (Tổng Thực Hiện / Tổng Chỉ Tiêu) * 100
        if (targetCol && actualCol) {
          const totTarget = previewRows.reduce((acc, r) => acc + parseCleanNumber(r[targetCol.id]), 0);
          const totActual = previewRows.reduce((acc, r) => acc + parseCleanNumber(r[actualCol.id]), 0);
          if (totTarget > 0) {
            const pct = (totActual / totTarget) * 100;
            totals[c.id] = `${(Math.round(pct * 100) / 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
            return;
          }
        }
        totals[c.id] = '-';
        return;
      }

      // Các cột Chỉ Tiêu, Thực Hiện và số lượng khác: tính tổng số học chính xác từ các giá trị phía trên
      let sum = 0;
      let count = 0;
      let maxDecimals = 0;

      previewRows.forEach((r) => {
        const raw = r[c.id];
        if (!raw || raw === '-' || raw.trim() === '') return;

        const num = parseCleanNumber(raw);
        if (!isNaN(num)) {
          sum += num;
          count++;

          // Xác định số chữ số thập phân từ chuỗi hiển thị của ô
          const cleanStr = String(raw).trim().replace(/[₫đvndvnđ%]/gi, '').trim();
          const dotIdx = cleanStr.lastIndexOf('.');
          const commaIdx = cleanStr.lastIndexOf(',');
          if (commaIdx > -1 && commaIdx > dotIdx) {
            const decPart = cleanStr.substring(commaIdx + 1).replace(/\D/g, '');
            maxDecimals = Math.max(maxDecimals, decPart.length);
          } else if (dotIdx > -1 && dotIdx > commaIdx) {
            if (!/^[1-9]\d{0,2}\.\d{3}$/.test(cleanStr.replace(/\s+/g, ''))) {
              const decPart = cleanStr.substring(dotIdx + 1).replace(/\D/g, '');
              maxDecimals = Math.max(maxDecimals, decPart.length);
            }
          }
        }
      });

      if (count === 0) {
        totals[c.id] = '-';
      } else {
        const decLimit = Math.min(3, Math.max(0, maxDecimals));
        const factor = Math.pow(10, decLimit);
        const roundedSum = Math.round(sum * factor) / factor;
        totals[c.id] = roundedSum.toLocaleString('vi-VN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: decLimit
        });
      }
    });

    return totals;
  }, [columns, previewRows, rawSheetRows]);

  // Save handler
  const handleSave = async () => {
    const programId = programToEdit?.id || `prog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isNew = !programToEdit;

    // Build payload
    const payload: CompetitionProgramConfig = {
      id: programId,
      title: title.trim(),
      shortTitle: (shortTitle || title).trim(),
      time: time.trim(),
      sheetTab: sheetTab.trim() || 'Tổng hợp thi đua',
      range: columns.length > 0 ? `${columns[0].colLetter}2:${columns[columns.length - 1].colLetter}11` : (range.trim() || ''),
      intro: intro.trim(),
      isActive,
      isArchived: programToEdit?.isArchived === true ? (isActive ? false : true) : false,
      isCustom: true,
      columns,
      conditions: conditions.filter((c) => c.trim() !== ''),
      tiers: tiers.filter((t) => t.condition.trim() !== '' || t.reward.trim() !== ''),
      details: details.filter((d) => d.trim() !== '')
    };

    // Validate
    const validation = validateDynamicProgram(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    setIsSaving(true);

    try {
      await saveCompetitionProgram(
        payload,
        currentUserName,
        `${isNew ? 'Tạo mới' : 'Cập nhật'} chương trình thi đua động: ${payload.title} (${payload.time})`,
        isNew
      );

      if (onSaved) {
        onSaved(payload);
      }
      onClose();
    } catch (err: any) {
      setErrors([err?.message || 'Có lỗi xảy ra khi lưu chương trình thi đua. Vui lòng thử lại.']);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!programToEdit) return;
    setIsSaving(true);
    try {
      await deleteCompetitionProgram(programToEdit.id, programToEdit.title, currentUserName);
      onClose();
    } catch (err: any) {
      setErrors([err?.message || 'Có lỗi khi xóa chương trình thi đua.']);
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen || isMarketSupervisor === false) return null;

  return (
    <AnimatePresence>
      <div
        className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={programToEdit ? 'Chỉnh sửa chương trình thi đua' : 'Tạo chương trình thi đua mới'}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 outline-none"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    {programToEdit ? 'Chỉnh Sửa Chương Trình Thi Đua' : 'Tạo Chương Trình Thi Đua Mới'}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-400 text-slate-900 shadow-sm">
                    Cấu Trúc Động
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  Tự động ánh xạ dải ô & cột từ Sheet &ldquo;Tổng Hợp Thi Đua&rdquo; mà không cần viết lại mã nguồn
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Sub-header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Tabs */}
            <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'config'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span>1. Thông Tin & Cột Dữ Liệu</span>
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
                  {columns.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scheme')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'scheme'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>2. Thể Lệ & Mức Thưởng</span>
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
                  {tiers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>3. Xem Trước Dữ Liệu Sheet</span>
                <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-slate-900 rounded-full text-[10px] font-bold">
                  Live
                </span>
              </button>
            </div>

            {/* Template Presets dropdown toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetPicker(!showPresetPicker)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold shadow-sm transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mẫu Có Sẵn ({DYNAMIC_PROGRAM_TEMPLATES.length})</span>
              </button>

              {showPresetPicker && (
                <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 text-left">
                  <div className="text-[11px] font-bold text-slate-500 uppercase px-2 py-1">
                    Chọn mẫu cấu trúc chuẩn:
                  </div>
                  {DYNAMIC_PROGRAM_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyTemplate(tmpl, 'BK')}
                      className="w-full text-left p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-900 transition-colors group"
                    >
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                        {tmpl.name}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {tmpl.description}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-mono mt-1">
                        {tmpl.columns.length} cột ({tmpl.columns.map((c) => c.label.replace('\n', ' ')).join(', ')})
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error notifications */}
          {errors.length > 0 && (
            <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 text-rose-800 text-xs flex items-start gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <div className="font-bold">Vui lòng kiểm tra lại cấu hình:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Modal Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: Config & Columns */}
            {activeTab === 'config' && (
              <div className="space-y-6">
                {/* General Program Info Card */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Thông Tin Cơ Bản Chương Trình</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tên Chương Trình Thi Đua <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ví dụ: Thi đua Dầu Ăn Marvela, Thi đua Tương Ớt..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tên Viết Tắt (Hiển thị ngắn) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={shortTitle}
                        onChange={(e) => setShortTitle(e.target.value)}
                        placeholder="Ví dụ: Dầu Ăn, Tương Ớt..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Thời Gian Triển Khai <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="Ví dụ: Từ 21/08 - 20/09"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tab Google Sheet Nguồn
                      </label>
                      <input
                        type="text"
                        value={sheetTab}
                        onChange={(e) => setSheetTab(e.target.value)}
                        placeholder="Tổng hợp thi đua"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Trạng Thái Áp Dụng
                      </label>
                      <div className="flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                          <input
                            type="radio"
                            checked={isActive}
                            onChange={() => setIsActive(true)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Đang Áp Dụng
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                          <input
                            type="radio"
                            checked={!isActive}
                            onChange={() => setIsActive(false)}
                            className="text-slate-400 focus:ring-slate-400"
                          />
                          <span className="flex items-center gap-1 text-slate-500 font-medium">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            Tạm Dừng
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column Structure Configuration Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-700" />
                        <span>Danh Sách Cột & Ánh Xạ Vùng Sheet ({columns.length} Cột)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Chỉ định ký tự cột trong Google Sheet (ví dụ BK, BL, BM...) và vai trò tương ứng để hệ thống tự động tính thưởng
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddColumn}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm Cột Mới</span>
                    </button>
                  </div>

                  {/* Columns Table / Form */}
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3 w-48">Tên Cột Hiển Thị</th>
                          <th className="py-2.5 px-3 w-28">Cột Sheet</th>
                          <th className="py-2.5 px-3 w-44">Vai Trò Dữ Liệu</th>
                          <th className="py-2.5 px-3 w-32">Định Dạng</th>
                          <th className="py-2.5 px-3 w-24 text-center">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {columns.map((col, idx) => {
                          const isColValid = isValidColLetter(col.colLetter);
                          return (
                            <tr key={col.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={col.label}
                                  onChange={(e) => handleUpdateColumn(col.id, { label: e.target.value })}
                                  placeholder="Nhãn cột (hỗ trợ \n)"
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={col.colLetter}
                                    onChange={(e) =>
                                      handleUpdateColumn(col.id, {
                                        colLetter: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase()
                                      })
                                    }
                                    placeholder="VD: BK"
                                    maxLength={3}
                                    className={`w-full px-2.5 py-1.5 uppercase font-mono font-bold text-xs rounded-lg border focus:outline-none focus:ring-1 ${
                                      isColValid
                                        ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900 focus:ring-emerald-500'
                                        : 'bg-rose-50 border-rose-300 text-rose-900 focus:ring-rose-500'
                                    }`}
                                  />
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                <select
                                  value={col.role}
                                  onChange={(e) =>
                                    handleUpdateColumn(col.id, {
                                      role: e.target.value as CompetitionColumnRole,
                                      format:
                                        e.target.value === 'bonus'
                                          ? 'currency'
                                          : e.target.value === 'percentage'
                                          ? 'percentage'
                                          : col.format
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="employee_name">Tên Nhân Viên</option>
                                  <option value="target">Chỉ Tiêu</option>
                                  <option value="actual">Thực Hiện</option>
                                  <option value="percentage">% Hoàn Thành</option>
                                  <option value="evaluation">Xét Thưởng</option>
                                  <option value="bonus">Tiền Thưởng (₫)</option>
                                  <option value="general">Dữ Liệu Khác</option>
                                </select>
                              </td>

                              <td className="py-2.5 px-3">
                                <select
                                  value={col.format || 'text'}
                                  onChange={(e) =>
                                    handleUpdateColumn(col.id, {
                                      format: e.target.value as CompetitionColumnFormat
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="text">Văn bản</option>
                                  <option value="number">Số nguyên/thập phân</option>
                                  <option value="currency">Tiền tệ (₫)</option>
                                  <option value="percentage">Phần trăm (%)</option>
                                </select>
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveColumn(idx, 'up')}
                                    disabled={idx === 0}
                                    title="Di chuyển lên"
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveColumn(idx, 'down')}
                                    disabled={idx === columns.length - 1}
                                    title="Di chuyển xuống"
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveColumn(col.id)}
                                    title="Xóa cột này"
                                    className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
                    <div>
                      Mẹo: Nhập nhãn cột dạng <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">Tên\nNhân Viên</span> để tiêu đề cột tự ngắt thành 2 dòng.
                    </div>
                    <div>
                      Dải ô tính toán:{' '}
                      <span className="font-mono font-bold text-emerald-800">
                        {columns.length > 0
                          ? `${columns[0].colLetter}2:${columns[columns.length - 1].colLetter}11`
                          : 'Trống'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Scheme & Tiers */}
            {activeTab === 'scheme' && (
              <div className="space-y-6">
                {/* Intro / Guidance */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lời Giới Thiệu / Hướng Dẫn Thể Lệ
                  </label>
                  <textarea
                    rows={2}
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                    placeholder="Ví dụ: Trong chu kỳ thi đua, nhân viên bán hàng đạt các mốc sau sẽ được xét thưởng..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Conditions list */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Điều Kiện Xét Thưởng ({conditions.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm Điều Kiện</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {conditions.length === 0 ? (
                      <div className="text-xs text-slate-400 italic py-2">
                        Chưa có điều kiện nào. Bấm &ldquo;Thêm Điều Kiện&rdquo; để thiết lập.
                      </div>
                    ) : (
                      conditions.map((cond, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-6 text-center text-xs font-bold text-slate-400">
                            {i + 1}.
                          </span>
                          <input
                            type="text"
                            value={cond}
                            onChange={(e) => handleUpdateCondition(i, e.target.value)}
                            placeholder="Ví dụ: Hoàn thành chỉ tiêu ≥ 100% trong chu kỳ thi đua"
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(i)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reward Tiers list */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Các Mức Thưởng / Tiêu Chí Đạt ({tiers.length} Mức)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm Mức Thưởng</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {tiers.length === 0 ? (
                      <div className="text-xs text-slate-400 italic py-2">
                        Chưa có mức thưởng nào. Bấm &ldquo;Thêm Mức Thưởng&rdquo; để thiết lập.
                      </div>
                    ) : (
                      tiers.map((tier, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl"
                        >
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="w-6 text-center text-xs font-bold text-amber-700">
                              #{i + 1}
                            </span>
                          </div>
                          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={tier.condition}
                              onChange={(e) => handleUpdateTier(i, 'condition', e.target.value)}
                              placeholder="Tiêu chí / Mức đạt (Ví dụ: Sản lượng ≥ 50 thùng)"
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <input
                              type="text"
                              value={tier.reward}
                              onChange={(e) => handleUpdateTier(i, 'reward', e.target.value)}
                              placeholder="Phần thưởng (Ví dụ: Thưởng thêm 10.000đ / thùng)"
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(i)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded self-end sm:self-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Live Preview Tab */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        XEM TRƯỚC DỮ LIỆU THỰC TẾ TỪ GOOGLE SHEET
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Bảng dưới đây trích xuất dữ liệu của 8 nhân viên bán hàng theo đúng cấu hình các cột {columns.map((c) => c.colLetter).join(', ')} từ Tab &ldquo;{sheetTab}&rdquo;.
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      8 Nhân Viên Đã Khớp
                    </span>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm bg-white">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white font-bold border-b border-emerald-900">
                        {columns.map((c, colIdx) => (
                          <th
                            key={c.id}
                            className={`py-2.5 px-3 ${colIdx > 0 ? 'border-l border-emerald-700/50' : ''} ${
                              c.role === 'employee_name'
                                ? 'text-left'
                                : c.role === 'bonus' || c.role === 'target' || c.role === 'actual' || c.role === 'percentage'
                                ? 'text-right'
                                : 'text-center'
                            }`}
                          >
                            <div className="whitespace-pre-line leading-tight">{c.label}</div>
                            <div className="text-[10px] font-mono text-emerald-200 font-normal mt-0.5">
                              [Cột {c.colLetter}]
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewRows.map((r, rowIdx) => (
                        <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          {columns.map((c, colIdx) => {
                            const val = r[c.id] || '-';
                            const isEmp = c.role === 'employee_name';
                            const isBonus = c.role === 'bonus';
                            const isPct = c.role === 'percentage';

                            return (
                              <td
                                key={c.id}
                                className={`py-2 px-3 ${colIdx > 0 ? 'border-l border-slate-200' : ''} ${
                                  isEmp
                                    ? 'font-bold text-slate-900'
                                    : isBonus
                                    ? 'text-right font-bold text-emerald-800'
                                    : isPct
                                    ? 'text-right font-semibold text-sky-700'
                                    : c.role === 'target' || c.role === 'actual'
                                    ? 'text-right font-medium text-slate-800'
                                    : 'text-center text-slate-700'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Totals row */}
                      <tr className="bg-emerald-50/80 font-bold border-t-2 border-emerald-300 text-slate-900">
                        {columns.map((c, colIdx) => {
                          const tot = previewTotals[c.id] || '-';
                          const isEmp = c.role === 'employee_name';
                          const isBonus = c.role === 'bonus';
                          const isPct = c.role === 'percentage';

                          return (
                            <td
                              key={c.id}
                              className={`py-2.5 px-3 ${colIdx > 0 ? 'border-l border-emerald-200' : ''} ${
                                isEmp
                                  ? 'font-extrabold text-emerald-900'
                                  : isBonus
                                  ? 'text-right font-extrabold text-emerald-800 text-sm'
                                  : isPct
                                  ? 'text-right font-bold text-sky-800'
                                  : c.role === 'target' || c.role === 'actual'
                                  ? 'text-right font-bold text-slate-900'
                                  : 'text-center text-slate-500'
                              }`}
                            >
                              {tot}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    Nếu số liệu xem trước ở các cột chưa đúng, hãy bấm sang tab &ldquo;1. Thông Tin & Cột Dữ Liệu&rdquo; để đổi ký tự Cột Sheet tương ứng.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div>
              {programToEdit && (
                <div>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa Chương Trình Này</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
                      <span className="text-xs text-rose-800 font-semibold">Xác nhận xóa?</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSaving}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
                      >
                        Xóa Vĩnh Viễn
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs hover:bg-slate-300"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-semibold transition-colors"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{programToEdit ? 'Lưu & Đồng Bộ Ngay' : 'Tạo Chương Trình & Áp Dụng'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
