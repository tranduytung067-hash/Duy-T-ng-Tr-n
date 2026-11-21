import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Calendar, List, X, Search, Info, Filter, Download, ArrowLeft, User, Eye, RefreshCw, CheckCircle2, TrendingUp, Camera, LayoutGrid, Maximize2, Minimize2, ArrowUpDown } from 'lucide-react';
import { SheetDataState, TuNhienRecord, MeizanRecord } from '../types';
import { mockTrungBayListData } from '../mockData';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { cleanEmployeeName, sortAndFormatEmployeeNames, normStr, matchCttbEmployee, matchCttbProgram } from '../utils/sheetParser';
import { EmployeeSelect } from './EmployeeSelect';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

const formatNoPhotoPercentage = (noPhotos: number, total: number): string => {
  if (total <= 0) return '0%';
  if (noPhotos === 0) return '0%';
  const pct = (noPhotos / total) * 100;
  if (pct < 0.1) {
    return `${pct.toFixed(2)}%`;
  }
  if (pct < 1) {
    return `${pct.toFixed(1)}%`;
  }
  return `${pct.toFixed(0)}%`;
};

export const DEFAULT_TU_NHIEN_RECORDS: TuNhienRecord[] = [
  { rowNum: 2, employeeName: 'Lê Thị Hương', khThamGia: 145, khDat: 50, khKhongBoAnh: 95, rate: (50 / 145) * 100 },
  { rowNum: 3, employeeName: 'Nguyễn Thành Thực', khThamGia: 175, khDat: 20, khKhongBoAnh: 155, rate: (20 / 175) * 100 },
  { rowNum: 4, employeeName: 'Bùi Mạnh Cường', khThamGia: 192, khDat: 40, khKhongBoAnh: 152, rate: (40 / 192) * 100 },
  { rowNum: 5, employeeName: 'Nguyễn Sỹ Vũ', khThamGia: 174, khDat: 26, khKhongBoAnh: 148, rate: (26 / 174) * 100 },
  { rowNum: 6, employeeName: 'Dương Thị Thanh', khThamGia: 178, khDat: 48, khKhongBoAnh: 130, rate: (48 / 178) * 100 },
  { rowNum: 7, employeeName: 'Vũ Anh Tùng', khThamGia: 179, khDat: 50, khKhongBoAnh: 129, rate: (50 / 179) * 100 },
  { rowNum: 8, employeeName: 'Nguyễn Thị Hưng Nguyên', khThamGia: 144, khDat: 34, khKhongBoAnh: 110, rate: (34 / 144) * 100 },
  { rowNum: 9, employeeName: 'Nguyễn Đức Tuấn', khThamGia: 24, khDat: 14, khKhongBoAnh: 10, rate: (14 / 24) * 100 }
];

export const DEFAULT_MEIZAN_RECORDS: MeizanRecord[] = [
  { rowNum: 32, employeeName: 'Lê Thị Hương', khThamGia: 1, khDat: 0, rate: 0, khKhongBoAnh: 1 },
  { rowNum: 33, employeeName: 'Nguyễn Thành Thực', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
  { rowNum: 34, employeeName: 'Bùi Mạnh Cường', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
  { rowNum: 35, employeeName: 'Nguyễn Sỹ Vũ', khThamGia: 1, khDat: 0, rate: 0, khKhongBoAnh: 1 },
  { rowNum: 36, employeeName: 'Dương Thị Thanh', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
  { rowNum: 37, employeeName: 'Vũ Anh Tùng', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 },
  { rowNum: 38, employeeName: 'Nguyễn Thị Hưng Nguyên', khThamGia: 1, khDat: 0, rate: 0, khKhongBoAnh: 1 },
  { rowNum: 39, employeeName: 'Nguyễn Đức Tuấn', khThamGia: 0, khDat: 0, rate: 0, khKhongBoAnh: 0 }
];

interface CttbProgressProps {
  cttbData: SheetDataState['cttbData'];
  selectedEmployeeName: string; // Could be 'Tất cả' or specific name
  isEmployeeView: boolean;
  trungBayListData?: any[];
  employees?: any[];
  tuNhienRecords?: SheetDataState['tuNhienRecords'];
  meizanRecords?: SheetDataState['meizanRecords'];
  onSelectEmployee?: (name: string) => void;
}

// Full, realistic mock details matching programSummaries baseline targets
export const mockCttbEmployeeDetails: { [prog: string]: { [empName: string]: { khDat: number; khThamGia: number; khKhongBoAnh: number } } } = {
  'Thuê Kệ': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 60, khKhongBoAnh: 41 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 46, khKhongBoAnh: 23 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 46, khKhongBoAnh: 19 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 37, khKhongBoAnh: 14 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 56, khKhongBoAnh: 29 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 45, khKhongBoAnh: 20 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 38, khKhongBoAnh: 23 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 5, khKhongBoAnh: 5 }
  },
  'CTTB MEIZAN': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 }
  },
  'Nước Rửa Chén': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 12, khKhongBoAnh: 8 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 3, khKhongBoAnh: 3 },
    'Bùi Mạnh Cường': { khDat: 1, khThamGia: 15, khKhongBoAnh: 4 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 6, khKhongBoAnh: 1 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 4, khKhongBoAnh: 3 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 10, khKhongBoAnh: 5 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 7, khKhongBoAnh: 5 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 }
  },
  'Giặt Xả': {
    'Lê Thị Hương': { khDat: 1, khThamGia: 14, khKhongBoAnh: 12 },
    'Nguyễn Thành Thực': { khDat: 1, khThamGia: 9, khKhongBoAnh: 7 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 11, khKhongBoAnh: 4 },
    'Nguyễn Sỹ Vũ': { khDat: 2, khThamGia: 15, khKhongBoAnh: 5 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 14, khKhongBoAnh: 11 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 7, khKhongBoAnh: 1 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 9, khKhongBoAnh: 6 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 }
  },
  'TRÀ VINATEA': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 1, khKhongBoAnh: 0 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 2, khKhongBoAnh: 0 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 }
  },
  'Gạo': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 10, khKhongBoAnh: 8 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 3, khKhongBoAnh: 1 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 3, khKhongBoAnh: 2 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 7, khKhongBoAnh: 1 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 6, khKhongBoAnh: 3 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 10, khKhongBoAnh: 7 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 }
  },
  'Nam Dương': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 7, khKhongBoAnh: 5 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 4, khKhongBoAnh: 0 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 6, khKhongBoAnh: 3 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 6, khKhongBoAnh: 4 },
    'Vũ Anh Tùng': { khDat: 5, khThamGia: 7, khKhongBoAnh: 1 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 5, khKhongBoAnh: 3 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 }
  },
  'Mắm 584NT': {
    'Lê Thị Hương': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Nguyễn Thành Thực': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 },
    'Bùi Mạnh Cường': { khDat: 0, khThamGia: 2, khKhongBoAnh: 0 },
    'Nguyễn Sỹ Vũ': { khDat: 0, khThamGia: 5, khKhongBoAnh: 0 },
    'Dương Thị Thanh': { khDat: 0, khThamGia: 1, khKhongBoAnh: 1 },
    'Vũ Anh Tùng': { khDat: 0, khThamGia: 2, khKhongBoAnh: 2 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 0, khThamGia: 2, khKhongBoAnh: 1 },
    'Nguyễn Đức Tuấn': { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 }
  },
  'Trưng Bày Tự Nhiên': {
    'Lê Thị Hương': { khDat: 50, khThamGia: 145, khKhongBoAnh: 95 },
    'Nguyễn Thành Thực': { khDat: 20, khThamGia: 175, khKhongBoAnh: 155 },
    'Bùi Mạnh Cường': { khDat: 40, khThamGia: 192, khKhongBoAnh: 152 },
    'Nguyễn Sỹ Vũ': { khDat: 26, khThamGia: 174, khKhongBoAnh: 148 },
    'Dương Thị Thanh': { khDat: 48, khThamGia: 178, khKhongBoAnh: 130 },
    'Vũ Anh Tùng': { khDat: 50, khThamGia: 179, khKhongBoAnh: 129 },
    'Nguyễn Thị Hưng Nguyên': { khDat: 30, khThamGia: 177, khKhongBoAnh: 147 },
    'Nguyễn Đức Tuấn': { khDat: 16, khThamGia: 104, khKhongBoAnh: 88 }
  }
};

const getRowKeyValueUncached = (row: any, searchTerms: string[], fallback: string = '') => {
  const rowKeys = Object.keys(row);
  
  const isEmployeeSearch = searchTerms.some(term => {
    const t = term.toLowerCase();
    return t.includes('nhan vien') || t.includes('nhân viên') || t === 'nv' || t === 'employee' || t === 'staff';
  });

  const cleanVal = (val: any) => {
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim();
    const sUpper = s.toUpperCase();
    if (
      s.toLowerCase() === 'null' || 
      s.toLowerCase() === 'undefined' || 
      sUpper === '#N/A' || 
      sUpper.startsWith('#N/A') || 
      sUpper === '#REF!' || 
      sUpper.startsWith('#REF!') || 
      sUpper === '#VALUE!' || 
      sUpper.startsWith('#VALUE!') ||
      sUpper === '#NAME?' ||
      sUpper === '#DIV/0!'
    ) {
      return fallback;
    }
    return isEmployeeSearch ? cleanEmployeeName(s) : s;
  };

  // 1. Direct exact match (case insensitive, trimmed)
  for (const term of searchTerms) {
    const found = rowKeys.find(k => k.toLowerCase().trim() === term.toLowerCase().trim());
    if (found !== undefined && row[found] !== undefined) {
      return cleanVal(row[found]);
    }
  }

  // 2. Exact normalized match
  const normalizedTerms = searchTerms.map(term => 
    term.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '')
  );

  const normKList = rowKeys.map(k => ({
    original: k,
    norm: k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '')
  }));

  for (const normTerm of normalizedTerms) {
    if (!normTerm) continue;
    const found = normKList.find(nk => nk.norm === normTerm);
    if (found && row[found.original] !== undefined) {
      return cleanVal(row[found.original]);
    }
  }

  // 3. Fallback to containing substring but matching word boundaries or specifics
  for (const normTerm of normalizedTerms) {
    if (!normTerm) continue;
    const candidates = normKList.filter(nk => nk.norm.includes(normTerm));
    if (candidates.length > 0) {
      if (normTerm.includes('khachhang') || normTerm === 'khachhang') {
        const preferred = candidates.find(nk => nk.norm.includes('ten'));
        if (preferred && row[preferred.original] !== undefined) {
          return cleanVal(row[preferred.original]);
        }
      }
      if (normTerm.includes('cttb') || normTerm === 'cttb') {
        const preferred = candidates.find(nk => nk.norm.includes('ten'));
        if (preferred && row[preferred.original] !== undefined) {
          return cleanVal(row[preferred.original]);
        }
      }
      if (row[candidates[0].original] !== undefined) {
        return cleanVal(row[candidates[0].original]);
      }
    }
  }

  return fallback;
};

const getRowKeyValue = (row: any, searchTerms: string[], fallback: string = '') => {
  if (!row) return fallback;
  if (!row.__keyCache) {
    row.__keyCache = {};
  }
  const cacheKey = searchTerms.join('|');
  if (row.__keyCache[cacheKey] !== undefined) {
    return row.__keyCache[cacheKey];
  }
  const result = getRowKeyValueUncached(row, searchTerms, fallback);
  row.__keyCache[cacheKey] = result;
  return result;
};

export const normalizeNameCompare = (name: unknown): string => {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .toLowerCase();
};

const cleanNameCompare = (aStr: string | undefined | null, bStr: string | undefined | null) => {
  if (!aStr || !bStr) return false;
  const normA = normalizeNameCompare(aStr);
  const normB = normalizeNameCompare(bStr);
  if (normA === normB) return true;

  const cleanA = normA.replace(/^(nv|nhân viên|nhan vien)\s*[:.-]?\s*/i, '').trim();
  const cleanB = normB.replace(/^(nv|nhân viên|nhan vien)\s*[:.-]?\s*/i, '').trim();
  if (cleanA === cleanB) return true;

  const clean = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, '');
  return clean(cleanA) === clean(cleanB);
};

export const normalizeProgText = (s: string): string => {
  if (!s) return '';
  return s.toLowerCase().trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
};

export const getProgramCategory = (progName: string): string | null => {
  if (!progName) return null;
  const norm = normalizeProgText(progName);
  
  // 1. Trưng Bày Tự Nhiên (MUST check first to avoid generic 'trung bay' or 'ke')
  if (norm.includes('tu nhien') || norm.includes('tbtn') || norm.includes('tbnt') || norm.includes('tb tn') || norm === 'tn' || norm.includes('tu-nhien')) {
    return 'Trưng Bày Tự Nhiên';
  }
  
  // 2. Nam Dương
  if (norm.includes('nam duong') || norm.includes('namduong')) {
    return 'Nam Dương';
  }
  
  // 3. Nước Rửa Chén
  if (norm.includes('nuoc rua chen') || norm.includes('rua chen') || norm.includes('nrc')) {
    return 'Nước Rửa Chén';
  }
  
  // 4. Giặt Xả
  if (norm.includes('giat xa') || norm.includes('giat') || norm.includes('xa')) {
    return 'Giặt Xả';
  }
  
  // 5. Gạo
  if (norm.includes('gao')) {
    return 'Gạo';
  }
  
  // 6. Mắm 584NT
  if (norm.includes('584') || norm.includes('mam')) {
    return 'Mắm 584NT';
  }
  
  // 7. TRÀ VINATEA
  if (norm.includes('vinatea') || (norm.includes('tra') && !norm.includes('trang') && !norm.includes('trung'))) {
    return 'TRÀ VINATEA';
  }
  
  // 8. Thuê Kệ
  if (norm.includes('thue ke') || norm.includes('thueke') || (norm.includes('ke') && !norm.includes('ket') && !norm.includes('ken') && !norm.includes('meizan'))) {
    return 'Thuê Kệ';
  }

  // 9. CTTB MEIZAN
  if (norm.includes('meizan')) {
    return 'CTTB MEIZAN';
  }

  return null;
};

export const matchProgramName = (progInRow: string, targetProg: string): boolean => {
  if (!progInRow || !targetProg) return false;
  if (cleanNameCompare(progInRow, targetProg)) return true;
  
  const normRow = normalizeProgText(progInRow);
  const normTarget = normalizeProgText(targetProg);
  
  if (normRow === normTarget) return true;

  const catRow = getProgramCategory(progInRow);
  const catTarget = getProgramCategory(targetProg);
  
  if (catRow && catTarget) {
    return catRow === catTarget;
  }
  
  // Strict substring matching only if target is not generic and length >= 4
  if (normTarget.length >= 4 && normRow.includes(normTarget)) {
    return true;
  }

  return false;
};

export default function CttbProgress({ cttbData, selectedEmployeeName, isEmployeeView, trungBayListData, employees, tuNhienRecords, meizanRecords, onSelectEmployee }: CttbProgressProps) {
  const [selectedDetailProgram, setSelectedDetailProgram] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'khThamGia' | 'khDat' | 'rate' | 'chuaDat' | 'zeroPhoto'; direction: 'asc' | 'desc' } | null>(null);
  const [selectedEmpInDetail, setSelectedEmpInDetail] = useState<string | null>(null);
  const [isDetailFullscreen, setIsDetailFullscreen] = useState<boolean>(false);

  const toggleDetailFullscreen = () => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      isDetailFullscreen
    );

    if (!isCurrentlyFullscreen) {
      const docEl = document.documentElement as any;
      const requestFs =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (document.fullscreenEnabled !== false && typeof requestFs === 'function') {
        try {
          const promise = requestFs.call(docEl);
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch {
          // Ignore sync errors
        }
      }
      setIsDetailFullscreen(true);
    } else {
      const exitFs =
        document.exitFullscreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).mozCancelFullScreen ||
        (document as any).msExitFullscreen;

      const hasNativeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (hasNativeFs && typeof exitFs === 'function') {
        try {
          const promise = exitFs.call(document);
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch {
          // Ignore sync errors
        }
      }
      setIsDetailFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const hasNativeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (hasNativeFs) {
        setIsDetailFullscreen(true);
      } else if (!hasNativeFs && isDetailFullscreen && document.fullscreenEnabled !== false) {
        setIsDetailFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isDetailFullscreen]);

  const detailModalCaptureRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(!!selectedDetailProgram, detailModalCaptureRef, () => setSelectedDetailProgram(null));
  // States for "Danh Sách Trưng Bày"
  const trungBayPrintRef = useRef<HTMLDivElement>(null);
  const [trungBayExporting, setTrungBayExporting] = useState(false);
  const [isTrungBayExportingPDF, setIsTrungBayExportingPDF] = useState(false);
  const [isTrungBayModalOpen, setIsTrungBayModalOpen] = useState(false);
  const [filterLichVT, setFilterLichVT] = useState('Tất cả');
  const [filterCttbName, setFilterCttbName] = useState('Tất cả');
  const [filterStatusDat, setFilterStatusDat] = useState('Tất cả');
  const [filterNumPhotos, setFilterNumPhotos] = useState('Tất cả');
  const [filterEmployeeName, setFilterEmployeeName] = useState('Tất cả');
  const [trungBaySearchText, setTrungBaySearchText] = useState('');

  const handleExportTrungBay = async () => {
    if (!trungBayPrintRef.current) return;
    setTrungBayExporting(true);

    const originalNode = trungBayPrintRef.current;
    
    // Save original styles of the live DOM elements
    const originalWidth = originalNode.style.width;
    const originalMaxHeight = originalNode.style.maxHeight;
    const originalOverflow = originalNode.style.overflow;
    
    // Find nested scrollable wrappers
    const scrollContainers = originalNode.querySelectorAll('.overflow-x-auto, .overflow-y-auto');
    const originalScrollStyles = Array.from(scrollContainers).map((el) => {
      const htmlEl = el as HTMLElement;
      return {
        element: htmlEl,
        overflow: htmlEl.style.overflow,
        overflowX: htmlEl.style.overflowX,
        overflowY: htmlEl.style.overflowY,
        width: htmlEl.style.width,
        maxHeight: htmlEl.style.maxHeight,
      };
    });

    // Apply temporary layout expansion styles directly to the live DOM
    originalNode.style.width = '1200px';
    originalNode.style.maxHeight = 'none';
    originalNode.style.overflow = 'visible';
    
    scrollContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.overflow = 'visible';
      htmlEl.style.overflowX = 'visible';
      htmlEl.style.overflowY = 'visible';
      htmlEl.style.width = '100%';
      htmlEl.style.maxHeight = 'none';
    });

    try {
      // Small pause for the browser to register visual style updates and paint
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const dataUrl = await toPng(originalNode, {
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      
      const link = document.createElement('a');
      const suffixName = selectedEmployeeName !== 'Tất cả' ? selectedEmployeeName : 'Tất_Cả';
      link.download = `Danh_Sach_Trung_Bay_${suffixName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Lỗi xuất ảnh trưng bày:', err);
    } finally {
      // Restore original live DOM styles perfectly
      originalNode.style.width = originalWidth;
      originalNode.style.maxHeight = originalMaxHeight;
      originalNode.style.overflow = originalOverflow;
      
      originalScrollStyles.forEach((cfg) => {
        cfg.element.style.overflow = cfg.overflow;
        cfg.element.style.overflowX = cfg.overflowX;
        cfg.element.style.overflowY = cfg.overflowY;
        cfg.element.style.width = cfg.width;
        cfg.element.style.maxHeight = cfg.maxHeight;
      });
      
      setTrungBayExporting(false);
    }
  };

  const getTrungBayChunks = (rows: any[]) => {
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentHeight = 0;
    const maxBodyHeight = 1240; // max body height in pixels for table body to fit perfectly inside A4 page
    const maxRowsPerPage = 40;  // max 40 customers per page as requested

    rows.forEach((row) => {
      const custName = getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']) || '';
      const progName = getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']) || '';
      const level = getRowKeyValue(row, ['muc', 'mức', 'level', 'hang', 'hạng']) || '';
      
      let displayProg = progName ? progName.trim() : '';
      if (!displayProg || displayProg.toUpperCase() === 'N/A' || displayProg.toUpperCase().includes('#N/A')) {
        displayProg = 'Chưa xác định';
      }
      let cttbText = displayProg;
      if (level && !level.toUpperCase().includes('#N/A')) {
        const cleanLevel = level.trim();
        if (cleanLevel.toLowerCase().startsWith('mức') || cleanLevel.toLowerCase().startsWith('muc')) {
          cttbText = `${cttbText} - ${cleanLevel}`;
        } else {
          cttbText = `${cttbText} - Mức ${cleanLevel}`;
        }
      }
      const fullCttbString = cttbText.toUpperCase();
      const index = custName.indexOf('(');
      const formattedCustName = index !== -1 ? `${custName.substring(0, index).trim()} ${custName.substring(index).trim()}` : custName;

      // Estimate wrapped lines
      // max-w-[280px] with text-[9.5px] fits approx 38 chars
      const custLines = Math.max(1, Math.ceil(formattedCustName.length / 38));
      // max-w-[280px] with text-[8.5px] fits approx 42 chars
      const progLines = Math.max(1, Math.ceil(fullCttbString.length / 42));

      // Row height calculation in pixels:
      // Padding py-[2.5px] (5px total) + Name lines * 12px + Prog lines * 11px + 2px spacing + 1px border
      const rowHeight = 5 + (custLines * 12) + (progLines * 11) + 2 + 1;

      if (currentChunk.length > 0 && (currentHeight + rowHeight > maxBodyHeight || currentChunk.length >= maxRowsPerPage)) {
        chunks.push(currentChunk);
        currentChunk = [row];
        currentHeight = rowHeight;
      } else {
        currentChunk.push(row);
        currentHeight += rowHeight;
      }
    });

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    return chunks;
  };

  const getPdfPagesData = () => {
    const empRows = rawList.filter(row => {
      const empInRow = getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']);
      return cleanNameCompare(empInRow, selectedEmployeeName);
    });
    
    // get unique Lịch VT
    const uniqueLichVTList = Array.from(new Set(
      empRows
        .map(row => getRowKeyValue(row, ['lich vt', 'lịch vt', 'tuyen', 'tuyến', 'schedule']).trim())
        .filter(Boolean)
    )).sort((a, b) => {
      const weekdayOrder: { [key: string]: number } = {
        't2': 1, 't3': 2, 't4': 3, 't5': 4, 't6': 5, 't7': 6, 'cn': 7
      };
      const getOrder = (s: string) => {
        const lower = s.toLowerCase();
        if (weekdayOrder[lower] !== undefined) return weekdayOrder[lower];
        for (const [k, v] of Object.entries(weekdayOrder)) {
          if (lower.includes(k)) return v;
        }
        return 99;
      };
      return getOrder(a) - getOrder(b);
    });

    if (uniqueLichVTList.length === 0) {
      return [{
        lichVT: 'Tất cả',
        pageLabel: 'Trang 1/1',
        rows: empRows
      }];
    }

    const pages: { lichVT: string; pageLabel: string; rows: any[] }[] = [];

    uniqueLichVTList.forEach(lichVT => {
      const filteredRows = empRows.filter(row => {
        const schInRow = getRowKeyValue(row, ['lich vt', 'lịch vt', 'tuyen', 'tuyến', 'schedule']);
        return schInRow.toUpperCase() === lichVT.toUpperCase();
      }).sort((a, b) => {
        const nameA = getRowKeyValue(a, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
        const nameB = getRowKeyValue(b, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
        return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
      });

      // Chunk the rows of this specific Lịch VT so they fit on A4 nicely (max 35 rows per page for safety)
      const maxRows = 35;
      const totalLichVTPages = Math.ceil(filteredRows.length / maxRows) || 1;
      
      for (let pIdx = 0; pIdx < totalLichVTPages; pIdx++) {
        const start = pIdx * maxRows;
        const chunkRows = filteredRows.slice(start, start + maxRows);
        pages.push({
          lichVT,
          pageLabel: `${lichVT} - Trang ${pIdx + 1}/${totalLichVTPages}`,
          rows: chunkRows
        });
      }
    });

    return pages;
  };

  const handleExportTrungBayPDF = async () => {
    if (!isEmployeeView && selectedEmployeeName === 'Tất cả') {
      notify.info("Vui lòng chọn tên nhân viên trước khi xuất PDF.");
      return;
    }

    setIsTrungBayExportingPDF(true);
    setTrungBayExporting(true);

    // Give browser time to render offscreen elements
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = getPdfPagesData();
      const totalPages = pages.length || 1;

      for (let i = 0; i < totalPages; i++) {
        const pageEl = document.getElementById(`pdf-page-trungbay-${i}`);
        if (!pageEl) continue;

        const dataUrl = await toPng(pageEl, {
          backgroundColor: '#ffffff',
          cacheBust: true,
          pixelRatio: 2, // High quality crisp resolution
        });

        if (i > 0) {
          pdf.addPage();
        }

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
      }

      const suffixName = selectedEmployeeName !== 'Tất cả' ? selectedEmployeeName : 'Tất_Cả';
      pdf.save(`Danh_Sach_Trung_Bay_${suffixName}.pdf`);
    } catch (err) {
      console.error('Lỗi xuất PDF trưng bày:', err);
    } finally {
      setIsTrungBayExportingPDF(false);
      setTrungBayExporting(false);
    }
  };

  const formatCustomerName = (name: string) => {
    if (!name) return 'N/A';
    const index = name.indexOf('(');
    if (index !== -1) {
      const mainName = name.substring(0, index).trim();
      const shopName = name.substring(index).trim();
      return (
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-500 leading-tight">{mainName}</span>
          <span className="text-[13.5px] font-extrabold text-slate-900 leading-snug mt-0.5">{shopName}</span>
        </div>
      );
    }
    return <span className="text-[13.5px] font-extrabold text-slate-900">{name}</span>;
  };

  const formatFinancialVal = (val: string): string => {
    if (!val) return '0';
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === '0') return '0';

    // Remove any trailing decimal part for check if it's e.g. "12500000.00"
    let cleaned = trimmed;
    if (cleaned.includes('.') && !cleaned.includes(',')) {
      const parts = cleaned.split('.');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = parts[0];
      }
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = parts[0];
      }
    }

    const digitsOnly = cleaned.replace(/[^0-9-]/g, '');
    if (digitsOnly.length === 0) {
      return trimmed;
    }
    const parsedNum = parseInt(digitsOnly, 10);
    if (isNaN(parsedNum)) {
      return trimmed;
    }
    return parsedNum.toLocaleString('vi-VN');
  };

  const rawList = (trungBayListData && trungBayListData.length > 0) ? trungBayListData : mockTrungBayListData;

  const programs = useMemo(() => {
    // Primary display programs: 'CTTB MEIZAN' placed alongside 'Thuê Kệ' (same row)
    const basePrograms = [
      'Thuê Kệ',
      'CTTB MEIZAN',
      'Nam Dương',
      'Nước Rửa Chén',
      'Giặt Xả',
      'Gạo',
      'Mắm 584NT',
      'TRÀ VINATEA',
      'Trưng Bày Tự Nhiên'
    ];

    const getProgOrder = (p: string): number => {
      const norm = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      if (norm.includes('thue ke') || (norm.includes('ke') && !norm.includes('nuoc') && !norm.includes('rua') && !norm.includes('meizan'))) return 1;
      if (norm.includes('meizan')) return 2;
      if (norm.includes('nam duong')) return 3;
      if (norm.includes('nuoc rua chen') || norm.includes('rua chen') || norm.includes('nrc')) return 4;
      if (norm.includes('giat xa') || norm.includes('giat') || norm.includes('xa')) return 5;
      if (norm.includes('gao')) return 6;
      if (norm.includes('584') || norm.includes('mam')) return 7;
      if (norm.includes('tra') || norm.includes('vinatea')) return 8;
      if (norm.includes('tu nhien') || norm.includes('tbtn') || norm.includes('tbnt')) return 9;
      return 99;
    };

    const progList = [...basePrograms];

    // If rawList is available and has rows, get any extra custom programs
    if (rawList && rawList.length > 0) {
      rawList.forEach(row => {
        const progInRow = (getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']) || row['F'] || row['f'] || '').toString().trim();
        const lower = progInRow.toLowerCase();
        if (progInRow && lower !== 'tên cttb' && lower !== 'tên chương trình' && lower !== 'cttb' && lower !== 'f') {
          const exists = progList.some(p => cleanNameCompare(p, progInRow) || matchProgramName(progInRow, p));
          if (!exists) {
            progList.push(progInRow);
          }
        }
      });
    }

    // If cttbData is present, get any extra custom programs
    if (cttbData && Object.keys(cttbData).length > 0) {
      Object.values(cttbData).forEach(empObj => {
        Object.keys(empObj).forEach(pName => {
          if (pName && !pName.toLowerCase().includes('total')) {
            const exists = progList.some(p => cleanNameCompare(p, pName) || matchProgramName(pName, p));
            if (!exists) {
              progList.push(pName);
            }
          }
        });
      });
    }

    return progList.sort((a, b) => getProgOrder(a) - getProgOrder(b));
  }, [rawList, cttbData]);

  // Dynamic union calculation of employeeNames from all data pools
  const employeeNames = useMemo(() => {
    const namesSet = new Set<string>();

    // 1. Add keys from cttbData summary
    if (cttbData && Object.keys(cttbData).length > 0) {
      Object.keys(cttbData).forEach(name => {
        if (name && name !== 'Tất cả') {
          namesSet.add(name.trim());
        }
      });
    }

    // 2. Add names from master employees list
    if (employees && employees.length > 0) {
      employees.forEach(emp => {
        const nameVal = emp.name || emp['Nhân Viên'] || emp['Nhân viên'];
        if (nameVal && typeof nameVal === 'string') {
          namesSet.add(nameVal.trim());
        }
      });
    }

    // 3. Add names from tuNhienRecords
    if (tuNhienRecords && tuNhienRecords.length > 0) {
      tuNhienRecords.forEach(rec => {
        if (rec.employeeName) {
          const cleaned = cleanEmployeeName(rec.employeeName);
          if (cleaned) namesSet.add(cleaned.trim());
        }
      });
    }

    // 3b. Add names from meizanRecords
    if (meizanRecords && meizanRecords.length > 0) {
      meizanRecords.forEach(rec => {
        if (rec.employeeName) {
          const cleaned = cleanEmployeeName(rec.employeeName);
          if (cleaned) namesSet.add(cleaned.trim());
        }
      });
    }

    // 4. Add names from raw list
    if (rawList && rawList.length > 0) {
      rawList.forEach(row => {
        const empInRow = getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']);
        if (empInRow) {
          const cleaned = cleanEmployeeName(empInRow);
          if (cleaned) namesSet.add(cleaned.trim());
        }
      });
    }

    // 5. Ensure all standard employees are guaranteed to be in namesSet
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
    defaultOrder.forEach(defName => {
      const normDef = normStr(defName);
      const exists = Array.from(namesSet).some(n => {
        const ne = normStr(n);
        return ne === normDef || ne.includes(normDef) || normDef.includes(ne);
      });
      if (!exists) {
        namesSet.add(defName);
      }
    });

    const finalNames: string[] = Array.from(namesSet);

    const cleanedNames = finalNames
      .map(name => name.trim())
      .filter(name => {
        if (!name) return false;
        const lower = name.toLowerCase();
        const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lower === 'tất cả' || lower === 'tat ca' || lower === 'all' || lower === 'tuyen' || lower === 'tuyến') return false;
        if (
          lower === 'undefined' || 
          lower === 'null' || 
          lower === 'nan' || 
          lower === 'none' || 
          lower === 'n/a' || 
          lower === 'na' || 
          lower === 'n.a' || 
          lower === 'n_a' || 
          lower === '-' || 
          lower === '#ref!' || 
          lower === '#n/a' || 
          lower === '#value!' ||
          norm.includes('total') ||
          norm.startsWith('tong') ||
          norm.includes('nhan vien') || 
          norm.includes('ten nv') || 
          norm.includes('stt') || 
          lower === 'employee' || 
          lower === 'staff'
        ) return false;
        return true;
      });

    return sortAndFormatEmployeeNames(cleanedNames);
  }, [cttbData, employees, rawList, tuNhienRecords, meizanRecords]);

  useEffect(() => {
    if (selectedEmployeeName !== 'Tất cả') {
      setFilterEmployeeName(selectedEmployeeName);
    } else if (employeeNames.length > 0) {
      if (filterEmployeeName === 'Tất cả' || !employeeNames.includes(filterEmployeeName)) {
        setFilterEmployeeName(employeeNames[0]);
      }
    }
  }, [selectedEmployeeName, employeeNames, filterEmployeeName]);

  const activeTuNhienList = useMemo(() => {
    return tuNhienRecords || [];
  }, [tuNhienRecords]);

  const activeMeizanList = useMemo(() => {
    return (meizanRecords && meizanRecords.length > 0) ? meizanRecords : DEFAULT_MEIZAN_RECORDS;
  }, [meizanRecords]);

  // Unified helper to get stats for a given employee and program
  const getEmployeeProgramStats = useCallback((emp: string, prog: string) => {
    const isTuNhienProg = cleanNameCompare(prog, 'Trưng Bày Tự Nhiên') || getProgramCategory(prog) === 'Trưng Bày Tự Nhiên';
    const targetNorm = normalizeNameCompare(emp);

    // 1. If Trưng Bày Tự Nhiên, strictly prioritize activeTuNhienList (Sheet Tổng Hợp TB: Cột V đến Cột AA)
    if (isTuNhienProg) {
      if (activeTuNhienList && activeTuNhienList.length > 0) {
        const rec = activeTuNhienList.find(r => normalizeNameCompare(r.employeeName) === targetNorm || cleanNameCompare(r.employeeName, emp));
        if (rec) {
          return {
            khDat: rec.khDat,
            khThamGia: rec.khThamGia,
            khKhongBoAnh: rec.khKhongBoAnh
          };
        }
      }
      if (cttbData && Object.keys(cttbData).length > 0) {
        const empKey = Object.keys(cttbData).find(k => normalizeNameCompare(k) === targetNorm || cleanNameCompare(k, emp));
        if (empKey && cttbData[empKey]) {
          const progKey = Object.keys(cttbData[empKey]).find(p => cleanNameCompare(p, 'Trưng Bày Tự Nhiên') || getProgramCategory(p) === 'Trưng Bày Tự Nhiên');
          if (progKey && cttbData[empKey][progKey]) {
            const entry = cttbData[empKey][progKey];
            const tg = Math.max(0, entry.khThamGia || 0);
            const dat = Math.max(0, entry.khDat || 0);
            return {
              khDat: dat,
              khThamGia: tg,
              khKhongBoAnh: Math.max(0, entry.khKhongBoAnh || 0)
            };
          }
        }
      }
      // Employee not in Sheet -> return 0 (no fallback to mock details or indexes)
      return { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 };
    }

    // 2. FOR ALL OTHER CTTB CARDS (except Trưng Bày Tự Nhiên):
    // Source of truth: Sheet "Danh Sách Trưng Bày" (rawList)
    if (rawList && rawList.length > 0) {
      let rawKhDat = 0;
      let rawKhThamGia = 0;
      let rawKhongBoAnh = 0;
      let matchCount = 0;

      rawList.forEach((row) => {
        const empInRow = (
          row['Nhân Viên'] ||
          row['Tên Nhân Viên'] ||
          getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']) ||
          row['B'] ||
          (row._rawCells?.[1]?.f || row._rawCells?.[1]?.v) ||
          ''
        ).toString().trim();

        const canonicalEmp = matchCttbEmployee(empInRow) || empInRow;
        const empMatches = cleanNameCompare(canonicalEmp, emp) || normalizeNameCompare(canonicalEmp) === targetNorm || cleanNameCompare(empInRow, emp);
        if (!empMatches) return;

        const progCode = (
          row['Mã CTTB'] ||
          getRowKeyValue(row, ['ma cttb', 'mã cttb', 'code', 'e']) ||
          row['E'] ||
          (row._rawCells?.[4]?.f || row._rawCells?.[4]?.v) ||
          ''
        ).toString().trim();

        const progName = (
          row['Tên CTTB'] ||
          getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program', 'f']) ||
          row['F'] ||
          (row._rawCells?.[5]?.f || row._rawCells?.[5]?.v) ||
          ''
        ).toString().trim();

        const canonicalProg = matchCttbProgram(progCode, progName) || progName;
        const progMatches = cleanNameCompare(canonicalProg, prog) || matchProgramName(canonicalProg, prog) || matchProgramName(progName, prog);

        if (!progMatches) return;

        matchCount++;
        rawKhThamGia++;

        // Cột L: Đạt Tiêu Chuẩn
        const valL = (
          row['Đạt Tiêu Chuẩn'] ||
          row['L'] ||
          row['l'] ||
          (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
          getRowKeyValue(row, ['trang thai dat', 'trạng thái đạt', 'dat tieu chuan', 'dat chuan', 'dat tieu chi', 'đạt tiêu chuẩn', 'đạt chuẩn', 'status']) ||
          ''
        ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
        if ((valL.includes('dat') || valL === 'd') && !valL.includes('khong') && !valL.includes('kh') && !valL.includes('chua')) {
          rawKhDat++;
        }

        // Cột H: Số Bộ Ảnh (< 1 hoặc rỗng hoặc 0)
        const valH = (
          row['Số Bộ Ảnh'] ||
          getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']) ||
          row['H'] ||
          (row._rawCells?.[7]?.f || row._rawCells?.[7]?.v) ||
          ''
        ).toString().trim();
        const numH = parseFloat(valH.replace(/[^0-9.]/g, ''));
        if (!valH || isNaN(numH) || numH < 1) {
          rawKhongBoAnh++;
        }
      });

      if (matchCount > 0) {
        return {
          khDat: rawKhDat,
          khThamGia: rawKhThamGia,
          khKhongBoAnh: rawKhongBoAnh
        };
      }
    }

    // 3. Fallback to cttbData
    if (cttbData && Object.keys(cttbData).length > 0) {
      const empKey = Object.keys(cttbData).find(k => normalizeNameCompare(k) === targetNorm || cleanNameCompare(k, emp));
      if (empKey && cttbData[empKey]) {
        const progKey = Object.keys(cttbData[empKey]).find(p => cleanNameCompare(p, prog) || matchProgramName(p, prog));
        if (progKey && cttbData[empKey][progKey]) {
          const entry = cttbData[empKey][progKey];
          return {
            khDat: entry.khDat || 0,
            khThamGia: entry.khThamGia || 0,
            khKhongBoAnh: entry.khKhongBoAnh || 0
          };
        }
      }
    }

    // 4. Fallback to mockCttbEmployeeDetails for demo when rawList is empty
    const mockProgKey = Object.keys(mockCttbEmployeeDetails).find(p => cleanNameCompare(p, prog) || matchProgramName(p, prog));
    if (mockProgKey && mockCttbEmployeeDetails[mockProgKey]) {
      const mockEmpKey = Object.keys(mockCttbEmployeeDetails[mockProgKey]).find(e => normalizeNameCompare(e) === targetNorm || cleanNameCompare(e, emp));
      if (mockEmpKey && mockCttbEmployeeDetails[mockProgKey][mockEmpKey]) {
        return mockCttbEmployeeDetails[mockProgKey][mockEmpKey];
      }
    }

    return { khDat: 0, khThamGia: 0, khKhongBoAnh: 0 };
  }, [activeTuNhienList, cttbData, rawList]);

  // Dedicated memoized calculation block for 'Trưng Bày Tự Nhiên' card:
  // Strictly from Sheet Tổng Hợp TB (Cột V đến Cột AA) via activeTuNhienList & name mapping
  const tuNhienStats = useMemo(() => {
    // 1. Primary: From Sheet Tổng Hợp TB! Cột V đến Cột AA (activeTuNhienList)
    if (activeTuNhienList && activeTuNhienList.length > 0) {
      if (selectedEmployeeName === 'Tất cả') {
        let khDatTotal = 0;
        let khThamGiaTotal = 0;
        let khKhongBoAnhTotal = 0;
        activeTuNhienList.forEach((rec) => {
          const empNorm = (rec.employeeName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (empNorm.includes('total') || empNorm.startsWith('tong') || empNorm.includes('nhan vien') || empNorm.includes('ten nv')) {
            return;
          }
          khThamGiaTotal += (rec.khThamGia || 0);
          khDatTotal += (rec.khDat || 0);
          khKhongBoAnhTotal += (rec.khKhongBoAnh || 0);
        });

        const finalKhThamGia = Math.max(0, khThamGiaTotal);
        const finalKhDat = Math.max(0, khDatTotal);
        const finalKhKhongBoAnh = khKhongBoAnhTotal > 0 ? khKhongBoAnhTotal : Math.max(0, finalKhThamGia - finalKhDat);
        const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;

        return {
          programName: 'Trưng Bày Tự Nhiên',
          khDat: finalKhDat,
          khThamGia: finalKhThamGia,
          khKhongBoAnh: finalKhKhongBoAnh,
          rate,
          levelCounts: { 'Mức 1': finalKhThamGia }
        };
      } else {
        const targetNorm = normalizeNameCompare(selectedEmployeeName);
        const match = activeTuNhienList.find(r => normalizeNameCompare(r.employeeName) === targetNorm || cleanNameCompare(r.employeeName, selectedEmployeeName));
        if (match) {
          const finalKhThamGia = Math.max(0, match.khThamGia || 0);
          const finalKhDat = Math.max(0, match.khDat || 0);
          const finalKhKhongBoAnh = (match.khKhongBoAnh !== undefined && match.khKhongBoAnh !== null)
            ? Math.max(0, match.khKhongBoAnh)
            : Math.max(0, finalKhThamGia - finalKhDat);
          const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;

          return {
            programName: 'Trưng Bày Tự Nhiên',
            khDat: finalKhDat,
            khThamGia: finalKhThamGia,
            khKhongBoAnh: finalKhKhongBoAnh,
            rate,
            levelCounts: { 'Mức 1': finalKhThamGia }
          };
        } else {
          // Employee not found in Google Sheet -> Return 0 (no fallback to other people or indexes)
          return {
            programName: 'Trưng Bày Tự Nhiên',
            khDat: 0,
            khThamGia: 0,
            khKhongBoAnh: 0,
            rate: 0,
            levelCounts: { 'Mức 1': 0 }
          };
        }
      }
    }

    // 2. Secondary: From cttbData summary if activeTuNhienList was empty
    if (cttbData && Object.keys(cttbData).length > 0) {
      if (selectedEmployeeName === 'Tất cả') {
        let khDatTotal = 0;
        let khThamGiaTotal = 0;
        let khKhongBoAnhTotal = 0;
        Object.values(cttbData).forEach(empObj => {
          const entry = empObj['Trưng Bày Tự Nhiên'];
          if (entry) {
            khThamGiaTotal += (entry.khThamGia || 0);
            khDatTotal += (entry.khDat || 0);
            khKhongBoAnhTotal += (entry.khKhongBoAnh || 0);
          }
        });
        const finalKhThamGia = Math.max(0, khThamGiaTotal);
        const finalKhDat = Math.max(0, khDatTotal);
        const finalKhKhongBoAnh = khKhongBoAnhTotal > 0 ? khKhongBoAnhTotal : Math.max(0, finalKhThamGia - finalKhDat);
        const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;
        return {
          programName: 'Trưng Bày Tự Nhiên',
          khDat: finalKhDat,
          khThamGia: finalKhThamGia,
          khKhongBoAnh: finalKhKhongBoAnh,
          rate,
          levelCounts: { 'Mức 1': finalKhThamGia }
        };
      } else {
        const targetNorm = normalizeNameCompare(selectedEmployeeName);
        const empKey = Object.keys(cttbData).find(k => normalizeNameCompare(k) === targetNorm || cleanNameCompare(k, selectedEmployeeName));
        if (empKey && cttbData[empKey] && cttbData[empKey]['Trưng Bày Tự Nhiên']) {
          const entry = cttbData[empKey]['Trưng Bày Tự Nhiên'];
          const finalKhThamGia = Math.max(0, entry.khThamGia || 0);
          const finalKhDat = Math.max(0, entry.khDat || 0);
          const finalKhKhongBoAnh = Math.max(0, entry.khKhongBoAnh || 0);
          const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;
          return {
            programName: 'Trưng Bày Tự Nhiên',
            khDat: finalKhDat,
            khThamGia: finalKhThamGia,
            khKhongBoAnh: finalKhKhongBoAnh,
            rate,
            levelCounts: { 'Mức 1': finalKhThamGia }
          };
        }
      }
    }

    return {
      programName: 'Trưng Bày Tự Nhiên',
      khDat: 0,
      khThamGia: 0,
      khKhongBoAnh: 0,
      rate: 0,
      levelCounts: { 'Mức 1': 0 }
    };
  }, [activeTuNhienList, cttbData, selectedEmployeeName]);

  // Dedicated memoized calculation block for 'CTTB MEIZAN' card:
  // Strictly from Sheet Tổng Hợp Trưng Bày (H35:M42) via activeMeizanList & lookup by employee name
  const meizanStats = useMemo(() => {
    // 1. Primary: From Sheet Tổng Hợp Trưng Bày (H35:M42) via activeMeizanList
    if (activeMeizanList && activeMeizanList.length > 0) {
      if (selectedEmployeeName === 'Tất cả') {
        let khDatTotal = 0;
        let khThamGiaTotal = 0;
        let khKhongBoAnhTotal = 0;
        activeMeizanList.forEach((rec) => {
          const empNorm = (rec.employeeName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (empNorm.includes('total') || empNorm.startsWith('tong') || empNorm.includes('nhan vien') || empNorm.includes('ten nv')) {
            return;
          }
          khThamGiaTotal += (rec.khThamGia || 0);
          khDatTotal += (rec.khDat || 0);
          khKhongBoAnhTotal += (rec.khKhongBoAnh || 0);
        });

        const finalKhThamGia = Math.max(0, khThamGiaTotal);
        const finalKhDat = Math.max(0, khDatTotal);
        const finalKhKhongBoAnh = khKhongBoAnhTotal > 0 ? khKhongBoAnhTotal : Math.max(0, finalKhThamGia - finalKhDat);
        const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;

        return {
          programName: 'CTTB MEIZAN',
          khDat: finalKhDat,
          khThamGia: finalKhThamGia,
          khKhongBoAnh: finalKhKhongBoAnh,
          rate,
          levelCounts: { 'Mức 1': finalKhThamGia }
        };
      } else {
        const targetNorm = normalizeNameCompare(selectedEmployeeName);
        const match = activeMeizanList.find(r => normalizeNameCompare(r.employeeName) === targetNorm || cleanNameCompare(r.employeeName, selectedEmployeeName));
        if (match) {
          const finalKhThamGia = Math.max(0, match.khThamGia || 0);
          const finalKhDat = Math.max(0, match.khDat || 0);
          const finalKhKhongBoAnh = (match.khKhongBoAnh !== undefined && match.khKhongBoAnh !== null)
            ? Math.max(0, match.khKhongBoAnh)
            : Math.max(0, finalKhThamGia - finalKhDat);
          const rate = match.rate !== undefined ? match.rate : (finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0);

          return {
            programName: 'CTTB MEIZAN',
            khDat: finalKhDat,
            khThamGia: finalKhThamGia,
            khKhongBoAnh: finalKhKhongBoAnh,
            rate,
            levelCounts: { 'Mức 1': finalKhThamGia }
          };
        } else {
          return {
            programName: 'CTTB MEIZAN',
            khDat: 0,
            khThamGia: 0,
            khKhongBoAnh: 0,
            rate: 0,
            levelCounts: { 'Mức 1': 0 }
          };
        }
      }
    }

    // 2. Secondary: From cttbData summary if activeMeizanList was empty
    if (cttbData && Object.keys(cttbData).length > 0) {
      if (selectedEmployeeName === 'Tất cả') {
        let khDatTotal = 0;
        let khThamGiaTotal = 0;
        let khKhongBoAnhTotal = 0;
        Object.values(cttbData).forEach(empObj => {
          const entry = empObj['CTTB MEIZAN'];
          if (entry) {
            khThamGiaTotal += (entry.khThamGia || 0);
            khDatTotal += (entry.khDat || 0);
            khKhongBoAnhTotal += (entry.khKhongBoAnh || 0);
          }
        });
        const finalKhThamGia = Math.max(0, khThamGiaTotal);
        const finalKhDat = Math.max(0, khDatTotal);
        const finalKhKhongBoAnh = khKhongBoAnhTotal > 0 ? khKhongBoAnhTotal : Math.max(0, finalKhThamGia - finalKhDat);
        const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;
        return {
          programName: 'CTTB MEIZAN',
          khDat: finalKhDat,
          khThamGia: finalKhThamGia,
          khKhongBoAnh: finalKhKhongBoAnh,
          rate,
          levelCounts: { 'Mức 1': finalKhThamGia }
        };
      } else {
        const targetNorm = normalizeNameCompare(selectedEmployeeName);
        const empKey = Object.keys(cttbData).find(k => normalizeNameCompare(k) === targetNorm || cleanNameCompare(k, selectedEmployeeName));
        if (empKey && cttbData[empKey] && cttbData[empKey]['CTTB MEIZAN']) {
          const entry = cttbData[empKey]['CTTB MEIZAN'];
          const finalKhThamGia = Math.max(0, entry.khThamGia || 0);
          const finalKhDat = Math.max(0, entry.khDat || 0);
          const finalKhKhongBoAnh = Math.max(0, entry.khKhongBoAnh || 0);
          const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;
          return {
            programName: 'CTTB MEIZAN',
            khDat: finalKhDat,
            khThamGia: finalKhThamGia,
            khKhongBoAnh: finalKhKhongBoAnh,
            rate,
            levelCounts: { 'Mức 1': finalKhThamGia }
          };
        }
      }
    }

    return {
      programName: 'CTTB MEIZAN',
      khDat: 0,
      khThamGia: 0,
      khKhongBoAnh: 0,
      rate: 0,
      levelCounts: { 'Mức 1': 0 }
    };
  }, [activeMeizanList, cttbData, selectedEmployeeName]);

  // Calculate targets & actuals for each program
  const programSummaries = useMemo(() => {
    return programs.map((prog) => {
      const isTuNhienProg = cleanNameCompare(prog, 'Trưng Bày Tự Nhiên') || getProgramCategory(prog) === 'Trưng Bày Tự Nhiên';
      
      // If Trưng Bày Tự Nhiên, return the dedicated memoized calculation
      if (isTuNhienProg) {
        return tuNhienStats;
      }

      let aggDat = 0;
      let aggThamGia = 0;
      let aggKhongBoAnh = 0;
      const levelCounts: { [lvl: string]: number } = {};

      // Priority 1: Direct aggregation from rawList (Source of truth: Sheet Danh Sách Trưng Bày)
      // Exactly synchronized with Card tổng quan (cttbMetricsFromRaw)
      if (rawList && rawList.length > 0) {
        rawList.forEach((row) => {
          if (!row) return;

          const custInRow = (getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']) || row['D'] || row['d'] || '').toString().trim();
          const empVal = (
            row['Nhân Viên'] ||
            row['Tên Nhân Viên'] ||
            getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']) ||
            row['B'] ||
            (row._rawCells?.[1]?.f || row._rawCells?.[1]?.v) ||
            ''
          ).toString().trim();
          const canonicalEmp = matchCttbEmployee(empVal) || empVal;

          const normCust = custInRow.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const normEmp = empVal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (
            normCust.includes('total') || normCust.startsWith('tong') || normCust.includes('nhan vien') || normCust.includes('ten nv') || normCust.includes('stt') ||
            normEmp.includes('total') || normEmp.startsWith('tong') || normEmp.includes('nhan vien') || normEmp.includes('ten nv') || normEmp.includes('stt')
          ) {
            return;
          }

          if (selectedEmployeeName !== 'Tất cả') {
            if (!cleanNameCompare(canonicalEmp, selectedEmployeeName) && !cleanNameCompare(empVal, selectedEmployeeName)) {
              return;
            }
          }

          const progCode = (
            row['Mã CTTB'] ||
            getRowKeyValue(row, ['ma cttb', 'mã cttb', 'code', 'e']) ||
            row['E'] ||
            (row._rawCells?.[4]?.f || row._rawCells?.[4]?.v) ||
            ''
          ).toString().trim();

          const progName = (
            row['Tên CTTB'] ||
            getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program', 'f']) ||
            row['F'] ||
            (row._rawCells?.[5]?.f || row._rawCells?.[5]?.v) ||
            ''
          ).toString().trim();

          const lowerF = progName.toLowerCase();
          if (!progName || lowerF === 'tên cttb' || lowerF === 'tên chương trình' || lowerF === 'cttb' || lowerF === 'f') {
            return;
          }

          const canonicalProg = matchCttbProgram(progCode, progName) || progName;
          const progMatches = cleanNameCompare(canonicalProg, prog) || cleanNameCompare(progName, prog) || matchProgramName(canonicalProg, prog) || matchProgramName(progName, prog);
          if (!progMatches) return;

          aggThamGia++;

          // Cột L: Đạt Tiêu Chuẩn - Đếm chính xác như Card Tổng Quan
          const valL = (
            row['Đạt Tiêu Chuẩn'] ||
            row['L'] ||
            row['l'] ||
            (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
            getRowKeyValue(row, ['trang thai dat', 'trạng thái đạt', 'dat tieu chuan', 'dat chuan', 'dat tieu chi', 'đạt tiêu chuẩn', 'đạt chuẩn', 'status']) ||
            ''
          ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
          if ((valL.includes('dat') || valL === 'd') && !valL.includes('khong') && !valL.includes('kh') && !valL.includes('chua')) {
            aggDat++;
          }

          // Cột H: Số Bộ Ảnh
          const valH = (
            getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']) ||
            row['H'] ||
            row['h'] ||
            (row._rawCells?.[7]?.f || row._rawCells?.[7]?.v) ||
            ''
          ).toString().trim();
          const lowerH = valH.toLowerCase();
          if (lowerH !== 'số bộ ảnh' && lowerH !== 'h') {
            const numH = parseFloat(valH.replace(/[^0-9.]/g, ''));
            if (valH === '' || isNaN(numH) || numH < 1) {
              aggKhongBoAnh++;
            }
          }

          // Mức
          const mucRaw = (row['Mức'] || row['G'] || (row._rawCells?.[6]?.f || row._rawCells?.[6]?.v) || '').toString().trim();
          if (mucRaw && !mucRaw.toUpperCase().includes('#N/A')) {
            const cleanMuc = mucRaw.replace(/M[^c\d]*c\s*(\d+)/i, 'Mức $1').trim();
            levelCounts[cleanMuc] = (levelCounts[cleanMuc] || 0) + 1;
          }
        });
      } else {
        // Fallback: Aggregate per employee from getEmployeeProgramStats
        const activeEmployees = selectedEmployeeName === 'Tất cả' 
          ? employeeNames 
          : [selectedEmployeeName];

        activeEmployees.forEach((emp) => {
          const stats = getEmployeeProgramStats(emp, prog);
          aggDat += stats.khDat;
          aggThamGia += stats.khThamGia;
          aggKhongBoAnh += stats.khKhongBoAnh;
        });
      }

      const finalKhThamGia = Math.max(0, aggThamGia);
      const finalKhDat = Math.min(finalKhThamGia, Math.max(0, aggDat));
      const finalKhongBoAnh = Math.min(finalKhThamGia, Math.max(0, aggKhongBoAnh));

      if (Object.keys(levelCounts).length === 0 && finalKhThamGia > 0) {
        levelCounts['Mức 1'] = finalKhThamGia;
      }

      const rate = finalKhThamGia > 0 ? (finalKhDat / finalKhThamGia) * 100 : 0;

      return {
        programName: prog,
        khDat: finalKhDat,
        khThamGia: finalKhThamGia,
        khKhongBoAnh: finalKhongBoAnh,
        rate,
        levelCounts
      };
    });
  }, [programs, tuNhienStats, employeeNames, selectedEmployeeName, getEmployeeProgramStats, rawList]);

  const getProgramDetails = () => {
    if (!selectedDetailProgram) return [];

    const isTuNhien = cleanNameCompare(selectedDetailProgram, 'Trưng Bày Tự Nhiên') || getProgramCategory(selectedDetailProgram) === 'Trưng Bày Tự Nhiên';

    let details: { employeeName: string; khDat: number; khThamGia: number; khKhongBoAnh: number; rate: number; rowNum?: number }[] = [];

    if (isTuNhien) {
      details = activeTuNhienList
        .filter(r => {
          const lower = (r.employeeName || '').toLowerCase().trim();
          const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return (
            lower &&
            !norm.includes('total') &&
            !norm.startsWith('tong') &&
            !norm.includes('nhan vien') &&
            !norm.includes('ten nv')
          );
        })
        .map(r => ({
          employeeName: r.employeeName,
          khDat: r.khDat,
          khThamGia: r.khThamGia,
          khKhongBoAnh: r.khKhongBoAnh,
          rate: r.rate !== undefined ? r.rate : (r.khThamGia > 0 ? (r.khDat / r.khThamGia) * 100 : 0),
          rowNum: r.rowNum
        }));
    } else {
      details = employeeNames
        .filter(emp => {
          const lower = emp.toLowerCase().trim();
          const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return (
            lower &&
            !norm.includes('total') &&
            !norm.startsWith('tong') &&
            !norm.includes('nhan vien') &&
            !norm.includes('ten nv')
          );
        })
        .map((emp) => {
          const stats = getEmployeeProgramStats(emp, selectedDetailProgram);
          const rate = stats.khThamGia > 0 ? (stats.khDat / stats.khThamGia) * 100 : 0;

          return {
            employeeName: emp,
            khDat: stats.khDat,
            khThamGia: stats.khThamGia,
            khKhongBoAnh: stats.khKhongBoAnh,
            rate
          };
        });
    }

    if (selectedEmployeeName !== 'Tất cả') {
      const targetNorm = normalizeNameCompare(selectedEmployeeName);
      details = details.filter(row => normalizeNameCompare(row.employeeName) === targetNorm || cleanNameCompare(row.employeeName, selectedEmployeeName));
    }

    // 1. Search filter
    let processed = details;
    if (detailSearch.trim() !== '') {
      processed = processed.filter(row =>
        row.employeeName.toLowerCase().includes(detailSearch.toLowerCase().trim())
      );
    }

    // 2. Sort filter (sorts the entire record together, maintaining full integrity)
    if (sortConfig) {
      const { key, direction } = sortConfig;
      processed = [...processed].sort((a, b) => {
        let comparison = 0;
        if (key === 'name') {
          comparison = a.employeeName.localeCompare(b.employeeName, 'vi');
        } else if (key === 'khThamGia') {
          comparison = a.khThamGia - b.khThamGia;
        } else if (key === 'khDat') {
          comparison = a.khDat - b.khDat;
        } else if (key === 'rate') {
          comparison = a.rate - b.rate;
        } else if (key === 'chuaDat') {
          const chuaDatA = Math.max(0, a.khThamGia - a.khDat);
          const chuaDatB = Math.max(0, b.khThamGia - b.khDat);
          comparison = chuaDatA - chuaDatB;
        } else if (key === 'zeroPhoto') {
          comparison = a.khKhongBoAnh - b.khKhongBoAnh;
        }
        return direction === 'asc' ? comparison : -comparison;
      });
    } else {
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
      processed = [...processed].sort((a, b) => {
        const idxA = defaultOrder.indexOf(a.employeeName);
        const idxB = defaultOrder.indexOf(b.employeeName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.employeeName.localeCompare(b.employeeName, 'vi');
      });
    }

    return processed;
  };

  const handleSort = (key: 'name' | 'khThamGia' | 'khDat' | 'rate' | 'chuaDat' | 'zeroPhoto') => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'desc' };
      }
      if (prev.direction === 'desc') {
        return { key, direction: 'asc' };
      }
      return null;
    });
  };

  const processedList = useMemo(() => {
    return rawList.filter(row => {
      const custInRow = (getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']) || row['D'] || row['d'] || '').toString().trim();
      const empInRow = (getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']) || row['B'] || row['b'] || '').toString().trim();
      const normCust = custInRow.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normEmp = empInRow.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        normCust.includes('total') || normCust.startsWith('tong') || normCust.includes('nhan vien') || normCust.includes('ten nv') || normCust.includes('stt') ||
        normEmp.includes('total') || normEmp.startsWith('tong') || normEmp.includes('nhan vien') || normEmp.includes('ten nv') || normEmp.includes('stt')
      ) {
        return false;
      }

      // A. Filter by selectedEmployeeName (RLS)
      if (selectedEmployeeName !== 'Tất cả') {
        if (!cleanNameCompare(empInRow, selectedEmployeeName)) {
          return false;
        }
      }

      // A2. Filter by local filterEmployeeName inside details
      if (!isEmployeeView && filterEmployeeName !== 'Tất cả') {
        if (!cleanNameCompare(empInRow, filterEmployeeName)) {
          return false;
        }
      }

      // B. Filter by Lịch VT
      if (filterLichVT !== 'Tất cả') {
        const schInRow = getRowKeyValue(row, ['lich vt', 'lịch vt', 'tuyen', 'tuyến', 'schedule']);
        if (schInRow.toUpperCase() !== filterLichVT.toUpperCase()) {
          return false;
        }
      }

      // C. Filter by Tên CTTB
      if (filterCttbName !== 'Tất cả') {
        const progInRow = getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']);
        if (progInRow.toLowerCase() !== filterCttbName.toLowerCase()) {
          return false;
        }
      }

      // D. Filter by Trạng Thái Đạt Tiêu Chuẩn (theo Cột L)
      if (filterStatusDat !== 'Tất cả') {
        const rawStatus = (
          row['Đạt Tiêu Chuẩn'] ||
          row['L'] ||
          row['l'] ||
          (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
          getRowKeyValue(row, ['dat tieu chuan', 'dat chuan', 'dat tieu de', 'đạt tiêu chuẩn', 'đạt chuẩn', 'status']) ||
          ''
        ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
        const isDat = (rawStatus.includes('dat') || rawStatus === 'd') && !rawStatus.includes('khong') && !rawStatus.includes('kh') && !rawStatus.includes('chua');
        
        if (filterStatusDat === 'Đạt' && !isDat) return false;
        if (filterStatusDat === 'Không Đạt' && isDat) return false;
      }

      // E. Filter by Số Lượng Bộ Ảnh
      if (filterNumPhotos !== 'Tất cả') {
        const photosStr = getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']);
        const count = parseInt(photosStr.replace(/[^0-9]/g, ''), 10) || 0;
        if (filterNumPhotos === '0 bộ ảnh' && count !== 0) return false;
        if (filterNumPhotos === '1 bộ ảnh' && count !== 1) return false;
        if (filterNumPhotos === '2 bộ ảnh' && count !== 2) return false;
        if (filterNumPhotos === '>= 1 bộ ảnh' && count < 1) return false;
        if (filterNumPhotos === '>= 2 bộ ảnh' && count < 2) return false;
      }

      // F. Search Text
      if (trungBaySearchText.trim() !== '') {
        const custName = getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
        if (!custName.toLowerCase().includes(trungBaySearchText.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [rawList, selectedEmployeeName, isEmployeeView, filterEmployeeName, filterLichVT, filterCttbName, filterStatusDat, filterNumPhotos, trungBaySearchText]);

  // 2. Sort processedList alphabetically by customer name, then by program name
  const sortedProcessedList = useMemo(() => {
    return [...processedList].sort((a, b) => {
      const nameA = getRowKeyValue(a, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
      const nameB = getRowKeyValue(b, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
      const compName = nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
      if (compName !== 0) return compName;

      const progA = getRowKeyValue(a, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']);
      const progB = getRowKeyValue(b, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']);
      return progA.localeCompare(progB, 'vi', { sensitivity: 'base' });
    });
  }, [processedList]);

  // Calculate unique filters dynamically from the selection
  const uniqueLichVTFromSelection = useMemo(() => {
    return Array.from(new Set(
      rawList
        .filter(row => {
          const activeEmp = (!isEmployeeView && filterEmployeeName !== 'Tất cả') ? filterEmployeeName : selectedEmployeeName;
          if (activeEmp !== 'Tất cả') {
            const empInRow = getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']);
            return cleanNameCompare(empInRow, activeEmp);
          }
          return true;
        })
        .map(row => getRowKeyValue(row, ['lich vt', 'lịch vt', 'tuyen', 'tuyến', 'schedule']).trim())
        .filter(Boolean)
    )).sort((a, b) => {
      const weekdayOrder: { [key: string]: number } = {
        't2': 1, 't3': 2, 't4': 3, 't5': 4, 't6': 5, 't7': 6, 'cn': 7
      };
      const getOrder = (s: string) => {
        const lower = s.toLowerCase();
        if (weekdayOrder[lower] !== undefined) return weekdayOrder[lower];
        for (const [k, v] of Object.entries(weekdayOrder)) {
          if (lower.includes(k)) return v;
        }
        return 99;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [rawList, isEmployeeView, filterEmployeeName, selectedEmployeeName]);

  const uniqueCttbNamesFromSelection = useMemo(() => {
    return Array.from(new Set(
      rawList
        .filter(row => {
          const activeEmp = (!isEmployeeView && filterEmployeeName !== 'Tất cả') ? filterEmployeeName : selectedEmployeeName;
          if (activeEmp !== 'Tất cả') {
            const empInRow = getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']);
            return cleanNameCompare(empInRow, activeEmp);
          }
          return true;
        })
        .map(row => getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']).trim())
        .filter(Boolean)
    )).sort();
  }, [rawList, isEmployeeView, filterEmployeeName, selectedEmployeeName]);

  // Compute performance for each employee across ALL programs (excluding Trưng Bày Tự Nhiên from overall summary)
  const employeePerformance = useMemo(() => {
    return employeeNames.map((emp) => {
      let totalDat = 0;
      let totalThamGia = 0;
      let totalKhongBoAnh = 0;

      programs.forEach((prog) => {
        if (cleanNameCompare(prog, 'Trưng Bày Tự Nhiên') || prog.toLowerCase().includes('tự nhiên') || prog.toLowerCase().includes('tu nhien')) {
          return;
        }
        const stats = getEmployeeProgramStats(emp, prog);
        totalDat += stats.khDat;
        totalThamGia += stats.khThamGia;
        totalKhongBoAnh += stats.khKhongBoAnh;
      });

      return {
        name: emp,
        totalDat: Math.round(totalDat),
        totalThamGia: Math.round(totalThamGia),
        totalKhongBoAnh: Math.round(totalKhongBoAnh),
        overallRate: totalThamGia > 0 ? (totalDat / totalThamGia) * 100 : 0,
        noPhotoRate: totalThamGia > 0 ? (totalKhongBoAnh / totalThamGia) * 100 : 0,
      };
    });
  }, [employeeNames, programs, getEmployeeProgramStats]);

  // Computing comprehensive stats for all CTTB directly from rawList if present (excluding Trưng Bày Tự Nhiên)
  const cttbMetricsFromRaw = useMemo(() => {
    if (rawList && rawList.length > 0) {
      let countTotal = 0;
      let countDat = 0;
      let countThieuAnh = 0;

      rawList.forEach((row) => {
        if (!row) return;

        const custInRow = (getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']) || row['D'] || row['d'] || '').toString().trim();
        const empVal = (
          getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']) || row['B'] || row['b'] || ''
        ).toString().trim();
        const normCust = custInRow.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const normEmp = empVal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (
          normCust.includes('total') || normCust.startsWith('tong') || normCust.includes('nhan vien') || normCust.includes('ten nv') || normCust.includes('stt') ||
          normEmp.includes('total') || normEmp.startsWith('tong') || normEmp.includes('nhan vien') || normEmp.includes('ten nv') || normEmp.includes('stt')
        ) {
          return;
        }

        // Check employee filter if specific employee selected
        if (selectedEmployeeName !== 'Tất cả') {
          if (!cleanNameCompare(empVal, selectedEmployeeName)) {
            return;
          }
        }

        // 1. Cột F: Tên CTTB - đếm tất cả các ô Có giá trị, bỏ qua trống / whitespace / tiêu đề "Tên CTTB"
        const valF = (
          getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'program']) || row['F'] || row['f'] || ''
        ).toString().trim();
        const lowerF = valF.toLowerCase();
        if (!valF || lowerF === 'tên cttb' || lowerF === 'tên chương trình' || lowerF === 'cttb' || lowerF === 'f') {
          return;
        }

        // Bỏ qua CT Trưng bày tự nhiên khỏi phần tính tổng quan
        if (cleanNameCompare(valF, 'Trưng Bày Tự Nhiên') || lowerF.includes('tự nhiên') || lowerF.includes('tu nhien')) {
          return;
        }

        countTotal++;

        // 2. Cột L: Đạt Tiêu Chuẩn - đếm tất cả các ô Có giá trị "Đạt"
        const valL = (
          row['Đạt Tiêu Chuẩn'] ||
          row['L'] ||
          row['l'] ||
          (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
          getRowKeyValue(row, ['trang thai dat', 'trạng thái đạt', 'dat tieu chuan', 'đạt tiêu chuẩn', 'dat tieu chi', 'đạt tiêu chí', 'status']) ||
          ''
        ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
        if ((valL.includes('dat') || valL === 'd') && !valL.includes('khong') && !valL.includes('kh') && !valL.includes('chua')) {
          countDat++;
        }

        // 3. Cột H: Số Bộ Ảnh - đếm tất cả các ô có giá trị < 1 (thiếu bộ ảnh / 0 bộ ảnh)
        const valH = (
          getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']) || row['H'] || row['h'] || ''
        ).toString().trim();
        const lowerH = valH.toLowerCase();
        if (lowerH !== 'số bộ ảnh' && lowerH !== 'h') {
          const numH = parseFloat(valH.replace(/[^0-9.]/g, ''));
          if (valH === '' || isNaN(numH) || numH < 1) {
            countThieuAnh++;
          }
        }
      });

      return { countTotal, countDat, countThieuAnh };
    }
    return null;
  }, [rawList, selectedEmployeeName]);

  const filteredPerf = employeePerformance.filter(emp => selectedEmployeeName === 'Tất cả' || emp.name === selectedEmployeeName);
  const totalParticipants = cttbMetricsFromRaw ? cttbMetricsFromRaw.countTotal : filteredPerf.reduce((acc, curr) => acc + curr.totalThamGia, 0);
  const totalAchieved = cttbMetricsFromRaw ? cttbMetricsFromRaw.countDat : filteredPerf.reduce((acc, curr) => acc + curr.totalDat, 0);
  const totalNoPhotos = cttbMetricsFromRaw ? cttbMetricsFromRaw.countThieuAnh : filteredPerf.reduce((acc, curr) => acc + curr.totalKhongBoAnh, 0);

  // Top 5 lowest completion employees (having participation > 0 and clean name)
  const lowestCompletionEmployees = [...employeePerformance]
    .filter(a => {
      if (!a.name || a.name.trim() === '') return false;
      const lower = a.name.toLowerCase();
      if (
        lower.includes('nhân viên') || 
        lower.includes('nhan vien') || 
        lower === 'employee' || 
        lower === 'staff' || 
        lower === '-' ||
        lower === 'n/a' || 
        lower === 'na' || 
        lower === 'n.a' || 
        lower === 'n_a' || 
        lower === 'undefined' || 
        lower === 'null' || 
        lower === 'nan' || 
        lower === 'none' ||
        lower === '#ref!' || 
        lower === '#n/a' || 
        lower === '#value!'
      ) return false;
      return a.totalThamGia > 0;
    })
    .sort((a, b) => a.overallRate - b.overallRate)
    .slice(0, 5);

  // Top 5 employees with highest number of clients without photo sets (having clean name)
  const highestNoPhotoEmployees = [...employeePerformance]
    .filter(a => {
      if (!a.name || a.name.trim() === '') return false;
      const lower = a.name.toLowerCase();
      if (
        lower.includes('nhân viên') || 
        lower.includes('nhan vien') || 
        lower === 'employee' || 
        lower === 'staff' || 
        lower === '-' ||
        lower === 'n/a' || 
        lower === 'na' || 
        lower === 'n.a' || 
        lower === 'n_a' || 
        lower === 'undefined' || 
        lower === 'null' || 
        lower === 'nan' || 
        lower === 'none' ||
        lower === '#ref!' || 
        lower === '#n/a' || 
        lower === '#value!'
      ) return false;
      return a.totalKhongBoAnh > 0;
    })
    .sort((a, b) => b.totalKhongBoAnh - a.totalKhongBoAnh)
    .slice(0, 5);

  // Render inline Wide list of Trưng bày if toggled, exactly like Activation detailed view!
  if (isTrungBayModalOpen) {
    return (
      <div 
        id="trungbay-detail-container" 
        ref={trungBayPrintRef} 
        className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 w-full mb-6"
      >
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {!trungBayExporting && (
              <button
                type="button"
                onClick={() => {
                  setIsTrungBayModalOpen(false);
                  setFilterLichVT('Tất cả');
                  setFilterCttbName('Tất cả');
                  setFilterStatusDat('Tất cả');
                  setFilterNumPhotos('Tất cả');
                  setFilterEmployeeName('Tất cả');
                  setTrungBaySearchText('');
                }}
                className="p-2 rounded-lg bg-emerald-50 border-2 border-emerald-500 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 cursor-pointer transition-all shadow-sm ring-2 ring-emerald-500/10"
                title="Quay lại"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono">DANH SÁCH TRƯNG BÀY CHI TIẾT</span>
              <h2 className="text-base font-extrabold text-slate-800 leading-tight mt-0.5">
                <span>{selectedEmployeeName !== 'Tất cả' ? `Nhân viên: ${selectedEmployeeName}` : 'Toàn bộ hệ thống'}</span>
              </h2>
              {/* Dynamic current local timestamp so screenshots show identical context times */}
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-mono tabular-nums mt-1 leading-none select-none">
                <span>Thời điểm chụp: {new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
          
          {!trungBayExporting && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setIsTrungBayModalOpen(false);
                  setFilterLichVT('Tất cả');
                  setFilterCttbName('Tất cả');
                  setFilterStatusDat('Tất cả');
                  setFilterNumPhotos('Tất cả');
                  setTrungBaySearchText('');
                }}
                className="min-h-[42px] sm:min-h-0 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Trở Lại
              </button>
            </div>
          )}
        </div>

        {/* Filters and Actions block */}
        {!trungBayExporting && (
          <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 sm:mb-6 flex flex-col xl:flex-row xl:items-end gap-3 justify-between">
            <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 ${(!isEmployeeView && selectedEmployeeName === 'Tất cả') ? 'xl:grid-cols-6' : 'lg:grid-cols-5'} gap-2 sm:gap-3 flex-1 min-w-0`}>
              {/* Search Term - Spans 2 cols on mobile */}
              <div className="col-span-2 sm:col-span-2 md:col-span-1 xl:col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono truncate block">Tìm Khách Hàng</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Nhập tên khách..."
                    value={trungBaySearchText}
                    onChange={(e) => setTrungBaySearchText(e.target.value)}
                    className="h-11 sm:h-9 w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl pl-8 pr-3 outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Filter Employee Name (for Giám Sát / OM only, when selectedEmployeeName is 'Tất cả') */}
              {!isEmployeeView && selectedEmployeeName === 'Tất cả' && (
                <div className="col-span-2 sm:col-span-2 md:col-span-1 xl:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono truncate block">Nhân Viên</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-600 pointer-events-none" />
                    <select
                      value={filterEmployeeName}
                      onChange={(e) => setFilterEmployeeName(e.target.value)}
                      className="h-11 sm:h-9 w-full bg-white border border-slate-300 text-slate-700 text-xs rounded-xl pl-8 pr-3 outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer truncate"
                    >
                      {employeeNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Filter Lịch VT */}
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono truncate block">Lịch VT</label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={filterLichVT}
                    onChange={(e) => setFilterLichVT(e.target.value)}
                    className="h-11 sm:h-9 w-full bg-white border border-slate-300 text-slate-700 text-xs rounded-xl pl-7 pr-2 outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer truncate"
                  >
                    <option value="Tất cả">Lịch VT: Tất cả</option>
                    {uniqueLichVTFromSelection.map(day => (
                      <option key={day} value={day}>Lịch VT: {day}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter Name CTTB */}
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono truncate block">Tên CTTB</label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={filterCttbName}
                    onChange={(e) => setFilterCttbName(e.target.value)}
                    className="h-11 sm:h-9 w-full bg-white border border-slate-300 text-slate-700 text-xs rounded-xl pl-7 pr-2 outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer truncate"
                  >
                    <option value="Tất cả">CTTB: Tất cả</option>
                    {uniqueCttbNamesFromSelection.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter Status Dat */}
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono truncate block">Đạt Tiêu Chuẩn</label>
                <select
                  value={filterStatusDat}
                  onChange={(e) => setFilterStatusDat(e.target.value)}
                  className="h-11 sm:h-9 w-full bg-white border border-slate-300 text-slate-700 text-xs rounded-xl px-2.5 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
                >
                  <option value="Tất cả">Chuẩn: Tất cả</option>
                  <option value="Đạt">Chuẩn: Đạt</option>
                  <option value="Không Đạt">Chuẩn: K.Đạt</option>
                </select>
              </div>

              {/* Filter Số Lượng Bộ Ảnh */}
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono truncate block">Số Lượng Bộ Ảnh</label>
                <select
                  value={filterNumPhotos}
                  onChange={(e) => setFilterNumPhotos(e.target.value)}
                  className="h-11 sm:h-9 w-full bg-white border border-slate-300 text-slate-700 text-xs rounded-xl px-2.5 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
                >
                  <option value="Tất cả">Bộ ảnh: Tất cả</option>
                  <option value="0 bộ ảnh">Bộ ảnh: 0 bộ</option>
                  <option value="1 bộ ảnh">Bộ ảnh: 1 bộ</option>
                  <option value="2 bộ ảnh">Bộ ảnh: 2 bộ</option>
                  <option value=">= 1 bộ ảnh">Bộ ảnh: &ge; 1 bộ</option>
                  <option value=">= 2 bộ ảnh">Bộ ảnh: &ge; 2 bộ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:flex items-center gap-2 w-full xl:w-auto mt-1 xl:mt-0">
              <button
                type="button"
                onClick={handleExportTrungBay}
                disabled={trungBayExporting}
                className="min-h-[44px] sm:min-h-0 w-full xl:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Xuất Hình</span>
              </button>

              <button
                type="button"
                onClick={handleExportTrungBayPDF}
                disabled={trungBayExporting}
                className="min-h-[44px] sm:min-h-0 w-full xl:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Xuất PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Detailed Table view */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-emerald-500/50 bg-white custom-scrollbar w-full">
          <table className="w-full text-left border-collapse table-auto text-xs min-w-[750px] border border-emerald-500/40">
            <thead>
              <tr className="border-b border-emerald-500 text-emerald-800 font-extrabold tracking-wider bg-slate-50 text-[10.5px] uppercase">
                <th className="py-3 px-4 text-center min-w-[170px] border border-emerald-500/40">Tên Khách Hàng & CTTB</th>
                <th className="py-3 px-2 text-center min-w-[95px] leading-tight border border-emerald-500/40">Đạt Tiêu<br/>Chuẩn</th>
                <th className="py-3 px-2 text-center min-w-[85px] leading-tight border border-emerald-500/40">Số Bộ<br/>Ảnh</th>
                <th className="py-3 px-2 text-center min-w-[105px] leading-tight border border-emerald-500/40">Chấm<br/>Ảnh</th>
                <th className="py-3 px-2 text-center min-w-[110px] leading-tight border border-emerald-500/40">DS/SL<br/>Đạt Được</th>
                <th className="py-3 px-2 text-center min-w-[110px] leading-tight border border-emerald-500/40">Xét Đạt<br/>DS/SL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/30 text-slate-800">
              {sortedProcessedList.length > 0 ? (
                sortedProcessedList.map((row, idx) => {
                  const custName = getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
                  const progName = getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']);
                  const level = getRowKeyValue(row, ['muc', 'mức', 'level', 'hang', 'hạng']);
                  
                  const stdDat = (
                    row['Đạt Tiêu Chuẩn'] ||
                    row['L'] ||
                    row['l'] ||
                    (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
                    getRowKeyValue(row, ['dat tieu chuan', 'dat chuan', 'dat tieu de', 'đạt tiêu chuẩn', 'đạt chuẩn', 'status']) ||
                    ''
                  ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
                  const numPhotos = getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']);
                  const isStdDat = (stdDat.includes('dat') || stdDat === 'd') && !stdDat.includes('khong') && !stdDat.includes('kh') && !stdDat.includes('chua');
                  
                  const photoDat = getRowKeyValue(row, ['dat anh', 'đạt ảnh', 'dat anh chup', 'đạt ảnh chụp']);
                  const isPhotoDat = photoDat.toLowerCase().trim() === 'đạt' || photoDat.toLowerCase().trim() === 'dat' || photoDat.toLowerCase().trim() === 'true' || photoDat.toLowerCase().trim() === 'yes';

                  const revenue = getRowKeyValue(row, ['J', 'ds sl dat duoc', 'ds / sl dat duoc', 'ds/sl dat duoc', 'ds sl', 'doanh so thuc hien', 'sl dat duoc']);
                  
                  const performanceDat = (row['K'] !== undefined && row['K'] !== null)
                    ? String(row['K']).trim()
                    : getRowKeyValue(row, ['K', 'xet dat ds sl', 'xet dat ds / sl', 'xet dat ds/sl', 'xét đạt ds/sl', 'xet dat', 'xét đạt']);
                  const isPerformanceDat = performanceDat.toLowerCase().trim() === 'đạt' || performanceDat.toLowerCase().trim() === 'dat' || performanceDat.toLowerCase().trim() === 'true' || performanceDat.toLowerCase().trim() === 'yes';

                  let displayProg = progName ? progName.trim() : '';
                  if (!displayProg || displayProg.toUpperCase() === 'N/A' || displayProg.toUpperCase().includes('#N/A')) {
                    displayProg = 'Chưa xác định';
                  }
                  let cttbText = displayProg;
                  if (level && !level.toUpperCase().includes('#N/A')) {
                    const cleanLevel = level.trim();
                    if (cleanLevel.toLowerCase().startsWith('mức') || cleanLevel.toLowerCase().startsWith('muc')) {
                      cttbText = `${cttbText} - ${cleanLevel}`;
                    } else {
                      cttbText = `${cttbText} - Mức ${cleanLevel}`;
                    }
                  }
                  const fullCttbString = cttbText.toUpperCase();

                  return (
                    <tr key={idx} className="hover:bg-emerald-50/30 transition-all duration-150 bg-white">
                      {/* Tên KH */}
                      <td className="py-3 px-4 font-semibold text-slate-800 border border-emerald-500/30">
                        {formatCustomerName(custName)}
                        <div className="mt-1 flex items-center">
                          <span className="text-[9.5px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                            {fullCttbString}
                          </span>
                        </div>
                      </td>
                      {/* Đạt Tiêu Chuẩn */}
                      <td className="py-3 px-2 text-center border border-emerald-500/30">
                        <span className={`inline-block px-2 py-0.5 font-bold rounded text-[11px] min-w-[75px] text-center ${
                          isStdDat 
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                            : 'text-rose-700 bg-rose-50 border border-rose-200'
                        }`}>
                          {isStdDat ? 'Đạt' : 'Không Đạt'}
                        </span>
                      </td>
                      {/* Số Bộ  Ảnh */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-700 border border-emerald-500/30">
                        {numPhotos || '0'}
                      </td>
                      {/* Chấm Ảnh */}
                      <td className="py-3 px-2 text-center border border-emerald-500/30">
                        <span className={`inline-block px-2 py-0.5 font-bold rounded text-[11px] min-w-[75px] text-center ${
                          isPhotoDat 
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                            : 'text-rose-700 bg-rose-50 border border-rose-200'
                        }`}>
                          {isPhotoDat ? 'Đạt' : 'Không Đạt'}
                        </span>
                      </td>
                      {/* DS/SL Đạt Được */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-700 border border-emerald-500/30">
                        {formatFinancialVal(revenue)}
                      </td>
                      {/* Xét Đạt DS/SL */}
                      <td className="py-3 px-2 text-center border border-emerald-500/30">
                        <span className={`inline-block px-2 py-0.5 font-bold rounded text-[11px] min-w-[75px] text-center ${
                          isPerformanceDat 
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                            : 'text-rose-700 bg-rose-50 border border-rose-200'
                        }`}>
                          {performanceDat || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 font-medium text-xs border border-emerald-500/30">
                    Không tìm thấy bản ghi trưng bày nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Detailed Cards Deck View */}
        <div className="block md:hidden space-y-3">
          {sortedProcessedList.length > 0 ? (
            sortedProcessedList.map((row, idx) => {
              const custName = getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']);
              const progName = getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']);
              const level = getRowKeyValue(row, ['muc', 'mức', 'level', 'hang', 'hạng']);
              
              const stdDat = (
                row['Đạt Tiêu Chuẩn'] ||
                row['L'] ||
                row['l'] ||
                (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
                getRowKeyValue(row, ['dat tieu chuan', 'dat chuan', 'dat tieu de', 'đạt tiêu chuẩn', 'đạt chuẩn', 'status']) ||
                ''
              ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
              const numPhotos = getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']);
              const isStdDat = (stdDat.includes('dat') || stdDat === 'd') && !stdDat.includes('khong') && !stdDat.includes('kh') && !stdDat.includes('chua');
              
              const photoDat = getRowKeyValue(row, ['dat anh', 'đạt ảnh', 'dat anh chup', 'đạt ảnh chụp']);
              const isPhotoDat = photoDat.toLowerCase().trim() === 'đạt' || photoDat.toLowerCase().trim() === 'dat' || photoDat.toLowerCase().trim() === 'true' || photoDat.toLowerCase().trim() === 'yes';

              const revenue = getRowKeyValue(row, ['J', 'ds sl dat duoc', 'ds / sl dat duoc', 'ds/sl dat duoc', 'ds sl', 'doanh so thuc hien', 'sl dat duoc']);
              
              const performanceDat = (row['K'] !== undefined && row['K'] !== null)
                ? String(row['K']).trim()
                : getRowKeyValue(row, ['K', 'xet dat ds sl', 'xet dat ds / sl', 'xet dat ds/sl', 'xét đạt ds/sl', 'xet dat', 'xét đạt']);
              const isPerformanceDat = performanceDat.toLowerCase().trim() === 'đạt' || performanceDat.toLowerCase().trim() === 'dat' || performanceDat.toLowerCase().trim() === 'true' || performanceDat.toLowerCase().trim() === 'yes';

              let displayProg = progName ? progName.trim() : '';
              if (!displayProg || displayProg.toUpperCase() === 'N/A' || displayProg.toUpperCase().includes('#N/A')) {
                displayProg = 'Chưa xác định';
              }
              let cttbText = displayProg;
              if (level && !level.toUpperCase().includes('#N/A')) {
                const cleanLevel = level.trim();
                if (cleanLevel.toLowerCase().startsWith('mức') || cleanLevel.toLowerCase().startsWith('muc')) {
                  cttbText = `${cttbText} - ${cleanLevel}`;
                } else {
                  cttbText = `${cttbText} - Mức ${cleanLevel}`;
                }
              }
              const fullCttbString = cttbText.toUpperCase();

              return (
                <div key={idx} className="bg-white border border-emerald-500/50 rounded-xl p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs leading-snug">
                        {formatCustomerName(custName)}
                      </h4>
                      <span className="inline-block text-[9.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold mt-1">
                        {fullCttbString}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 font-bold rounded text-[10px] shrink-0 ${
                      isStdDat 
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                        : 'text-rose-700 bg-rose-50 border border-rose-200'
                    }`}>
                      {isStdDat ? 'Đạt Tiêu Chuẩn' : 'Chưa Đạt Chuẩn'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 font-semibold block text-[9px]">Số Bộ Ảnh</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">{numPhotos || '0'}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 font-semibold block text-[9px]">Chấm Ảnh</span>
                      <span className={`font-bold ${isPhotoDat ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPhotoDat ? 'Đạt' : 'Không Đạt'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 font-semibold block text-[9px]">DS/SL Đạt Được</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">{formatFinancialVal(revenue)}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 font-semibold block text-[9px]">Xét Đạt DS/SL</span>
                      <span className={`font-bold ${isPerformanceDat ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {performanceDat || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-500 font-medium text-xs bg-white rounded-xl border border-slate-200">
              Không tìm thấy bản ghi trưng bày nào phù hợp.
            </div>
          )}
        </div>

        {/* Card Footer info summary row */}
        <div className="mt-5 px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-[10px] font-semibold text-slate-600 font-mono">
            Hiển thị {sortedProcessedList.length} trên tổng số {rawList.filter(row => {
              if (selectedEmployeeName !== 'Tất cả') {
                const empInRow = getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']);
                return cleanNameCompare(empInRow, selectedEmployeeName);
              }
              return true;
            }).length} dòng trưng bày
          </span>
          {!trungBayExporting && (
            <div className="flex w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsTrungBayModalOpen(false);
                  setFilterLichVT('Tất cả');
                  setFilterCttbName('Tất cả');
                  setFilterStatusDat('Tất cả');
                  setFilterNumPhotos('Tất cả');
                  setFilterEmployeeName('Tất cả');
                  setTrungBaySearchText('');
                }}
                className="flex-grow sm:flex-none px-6 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 border border-slate-200 whitespace-nowrap shadow-md text-center"
              >
                Trở Lại
              </button>
            </div>
          )}
        </div>

        {/* PDF Offscreen Paginated Container */}
        {isTrungBayExportingPDF && (
          <div className="fixed top-0 left-[-9999px] z-[-1000] bg-white text-black" style={{ width: '950px' }}>
            {(() => {
              const pages = getPdfPagesData();
              const totalPages = pages.length || 1;
              if (pages.length === 0) {
                return (
                  <div className="bg-white text-black p-6 border border-black flex flex-col w-[950px] h-[1340px] font-sans justify-center items-center">
                    <p className="text-sm font-bold text-neutral-500">Không tìm thấy khách hàng nào khớp với bộ lọc hoạt động.</p>
                  </div>
                );
              }
              return pages.map((page, pageIndex) => (
                <div
                  key={pageIndex}
                  id={`pdf-page-trungbay-${pageIndex}`}
                  className="bg-white text-black px-8 py-5 border border-black flex flex-col w-[950px] h-[1340px] font-sans justify-between"
                  style={{ color: '#000000', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                >
                  <div className="flex flex-col flex-grow">
                    {/* Header block */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                      <div>
                        <h1 className="text-xl font-bold text-black uppercase tracking-wide">
                          DANH SÁCH TRƯNG BÀY CHI TIẾT - TUYẾN {page.lichVT.toUpperCase()}
                        </h1>
                        <p className="text-xs text-neutral-700 font-medium mt-1">
                          Nhân viên: {selectedEmployeeName || 'Tất cả'} • Chương trình: Tất cả • Trạng thái: Tất cả
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-neutral-500 mt-0.5">{page.pageLabel}</p>
                      </div>
                    </div>

                    {/* Table */}
                    {page.rows.length === 0 ? (
                      <div className="py-10 text-center text-xs text-neutral-500 font-bold border border-black border-dashed rounded-lg">
                        Không có dữ liệu trưng bày cho tuyến {page.lichVT}
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse table-auto text-xs border border-black">
                        <thead>
                          <tr className="border-b border-black text-black font-extrabold uppercase bg-neutral-100 text-[10px]">
                            <th className="py-2 px-2 text-center border border-black leading-tight">Tên Khách Hàng & CTTB</th>
                            <th className="py-2 px-1.5 text-center border border-black leading-tight">Đạt Tiêu Chuẩn</th>
                            <th className="py-2 px-1.5 text-center border border-black leading-tight">Số Bộ Ảnh</th>
                            <th className="py-2 px-1.5 text-center border border-black leading-tight">Chấm Ảnh</th>
                            <th className="py-2 px-1.5 text-center border border-black leading-tight">DS/SL Đạt Được</th>
                            <th className="py-2 px-1.5 text-center border border-black leading-tight">Xét Đạt DS/SL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-300 text-[10px]">
                          {page.rows.map((row, idx) => {
                            const custName = getRowKeyValue(row, ['ten khach hang', 'khach hang', 'ten kh', 'customer name', 'name', 'khách hàng']) || '';
                            const progName = getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'chuong trinh trung bay', 'program']) || '';
                            const level = getRowKeyValue(row, ['muc', 'mức', 'level', 'hang', 'hạng']) || '';
                            
                            const stdDat = (
                              row['Đạt Tiêu Chuẩn'] ||
                              row['L'] ||
                              row['l'] ||
                              (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
                              getRowKeyValue(row, ['dat tieu chuan', 'dat chuan', 'dat tieu de', 'đạt tiêu chuẩn', 'đạt chuẩn', 'status']) ||
                              ''
                            ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
                            const isStdDat = (stdDat.includes('dat') || stdDat === 'd') && !stdDat.includes('khong') && !stdDat.includes('kh') && !stdDat.includes('chua');

                            const numPhotos = getRowKeyValue(row, ['so bo anh', 'so luong bo anh', 'bo anh', 'số bộ ảnh', 'số lượng bộ ảnh', 'photos']);
                            
                            const photoDat = getRowKeyValue(row, ['dat anh', 'đạt ảnh', 'dat anh chup', 'đạt ảnh chụp']);
                            const isPhotoDat = photoDat.toLowerCase().trim() === 'đạt' || photoDat.toLowerCase().trim() === 'dat' || photoDat.toLowerCase().trim() === 'true' || photoDat.toLowerCase().trim() === 'yes';

                            const revenue = getRowKeyValue(row, ['J', 'ds sl dat duoc', 'ds / sl dat duoc', 'ds/sl dat duoc', 'ds sl', 'doanh so thuc hien', 'sl dat duoc']);
                            
                            const performanceDat = (row['K'] !== undefined && row['K'] !== null)
                              ? String(row['K']).trim()
                              : getRowKeyValue(row, ['K', 'xet dat ds sl', 'xet dat ds / sl', 'xet dat ds/sl', 'xét đạt ds/sl', 'xet dat', 'xét đạt']);
                            const isPerformanceDat = performanceDat.toLowerCase().trim() === 'đạt' || performanceDat.toLowerCase().trim() === 'dat' || performanceDat.toLowerCase().trim() === 'true' || performanceDat.toLowerCase().trim() === 'yes';

                            let displayProg = progName ? progName.trim() : '';
                            if (!displayProg || displayProg.toUpperCase() === 'N/A' || displayProg.toUpperCase().includes('#N/A')) {
                              displayProg = 'Chưa xác định';
                            }
                            let cttbText = displayProg;
                            if (level && !level.toUpperCase().includes('#N/A')) {
                              const cleanLevel = level.trim();
                              if (cleanLevel.toLowerCase().startsWith('mức') || cleanLevel.toLowerCase().startsWith('muc')) {
                                cttbText = `${cttbText} - ${cleanLevel}`;
                              } else {
                                cttbText = `${cttbText} - Mức ${cleanLevel}`;
                              }
                            }
                            const fullCttbString = cttbText.toUpperCase();

                            const index = custName.indexOf('(');
                            const formattedCustName = index !== -1 ? `${custName.substring(0, index).trim()} ${custName.substring(index).trim()}` : custName;

                            return (
                              <tr key={idx} className="border-b border-neutral-300">
                                <td className="py-[6px] px-2 border border-black max-w-[280px]">
                                  <div className="font-bold text-black text-[12px] whitespace-normal break-words leading-tight">{formattedCustName}</div>
                                  <div className="text-[9px] text-neutral-600 font-bold tracking-tight mt-0.5 whitespace-normal leading-tight">{fullCttbString}</div>
                                </td>
                                <td className="py-[6px] px-1.5 text-center border border-black">
                                  <span className="font-bold text-black text-[10px] tracking-wide">
                                    {isStdDat ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                  </span>
                                </td>
                                <td className="py-[6px] px-1.5 text-center border border-black font-mono font-bold text-black text-[10px]">
                                  {numPhotos}
                                </td>
                                <td className="py-[6px] px-1.5 text-center border border-black">
                                  <span className="font-bold text-black text-[10px] tracking-wide">
                                    {isPhotoDat ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                  </span>
                                </td>
                                <td className="py-[6px] px-1.5 text-right border border-black font-mono font-semibold text-black text-[10px]">
                                  {formatFinancialVal(revenue)}
                                </td>
                                <td className="py-[6px] px-1.5 text-center border border-black">
                                  <span className="font-bold text-black text-[10px] tracking-wide">
                                    {isPerformanceDat ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Footer block */}
                  <div className="border-t border-black pt-2 mt-3 flex justify-between text-[9px] text-neutral-600">
                    <span>Báo cáo tạo tự động vào {new Date().toLocaleDateString('vi-VN')}</span>
                    <span>Ký tên xác nhận</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="cttb-progress-card" className="space-y-3.5 mb-6">
      {/* 1. UNIFIED COMPACT HEADER + 1-ROW ACTION BAR */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono block leading-none">
                TIẾN ĐỘ THỰC HIỆN CTTB
              </span>
              <h2 className="text-xs sm:text-base font-extrabold text-slate-900 leading-tight mt-0.5 truncate">
                {selectedEmployeeName === 'Tất cả' ? 'Toàn Bộ Nhân Viên' : selectedEmployeeName}
              </h2>
            </div>
          </div>
        </div>

        {/* Action Buttons: 3 cols on 1 row on Mobile (no duplicate EmployeeSelect), 4 cols on Tablet/Desktop */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 w-full items-center pt-1.5 border-t border-slate-100">
          {/* 1. Bộ lọc nhân viên (Desktop only; Mobile uses bottom thumb quick-filter) */}
          {!isEmployeeView && onSelectEmployee ? (
            <div className="hidden md:block w-full">
              <EmployeeSelect
                selectedEmployeeName={selectedEmployeeName}
                onSelectEmployee={onSelectEmployee}
                availableEmployees={employeeNames}
                isEmployeeView={isEmployeeView}
                compact={true}
                buttonHeightClass="h-10"
                borderClass="border border-emerald-500 hover:border-emerald-600"
                className="w-full"
              />
            </div>
          ) : (
            <div className="hidden md:flex w-full h-10 bg-white border border-emerald-500 rounded-xl px-2.5 items-center justify-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-800 truncate">
                {selectedEmployeeName === 'Tất cả' ? 'NV: Tất cả' : selectedEmployeeName}
              </span>
            </div>
          )}

          {/* 2. Danh Sách */}
          <button
            id="btn-open-trungbay-list"
            type="button"
            onClick={() => setIsTrungBayModalOpen(true)}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap px-2"
            title="Danh Sách Trưng Bày"
          >
            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-100 shrink-0" />
            <span className="truncate">Danh Sách</span>
          </button>

          {/* 3. Xuất Hình */}
          <button
            type="button"
            onClick={handleExportTrungBay}
            disabled={trungBayExporting}
            className="w-full h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap px-2"
            title="Xuất Hình Ảnh"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Xuất Hình</span>
          </button>

          {/* 4. Xuất PDF */}
          <button
            type="button"
            onClick={handleExportTrungBayPDF}
            disabled={trungBayExporting}
            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap px-2"
            title="Xuất Báo Cáo PDF"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span className="truncate">Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* 3. CARD “TỔNG QUAN TIẾN ĐỘ” (Gộp biểu đồ trực quan + chỉ số tiến độ) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden space-y-4">
        {/* Tiêu đề Card: TỔNG QUAN TIẾN ĐỘ */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
          <h3 className="text-xs sm:text-sm font-black text-emerald-900 uppercase tracking-wide">
            TỔNG QUAN TIẾN ĐỘ
          </h3>
        </div>

        {/* KHU VỰC TỔNG QUAN: CỘT TRÁI (50%) LÀ BIỂU ĐỒ TRÒN PHÓNG TO, CỘT PHẢI (50%) LÀ 3 CHỈ SỐ TỪ TRÊN XUỐNG */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 items-stretch">
          {/* CỘT TRÁI (50% DIỆN TÍCH): Biểu đồ vòng % đạt chuẩn tăng kích thước tương xứng */}
          <div className="flex flex-col items-center justify-center p-2.5 sm:p-4 bg-slate-50/70 rounded-xl border border-emerald-500/20 shadow-2xs">
            <div className="relative w-full max-w-[155px] sm:max-w-[200px] md:max-w-[220px] aspect-square flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#f1f5f9"
                  strokeWidth="8.5"
                  fill="transparent"
                />
                {/* Outer loop: Achieved Rate */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8.5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - (totalParticipants > 0 ? totalAchieved / totalParticipants : 0))}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                {/* Inner loop: No Photo Rate */}
                <circle
                  cx="50"
                  cy="50"
                  r="30"
                  stroke="#f43f5e"
                  strokeWidth="6.5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 30}
                  strokeDashoffset={2 * Math.PI * 30 * (1 - (totalParticipants > 0 ? totalNoPhotos / totalParticipants : 0))}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out opacity-90"
                />
              </svg>
              <div className="absolute flex flex-col items-center text-center px-1">
                <span className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-600 font-mono leading-none">
                  {totalParticipants > 0 ? ((totalAchieved / totalParticipants) * 100).toFixed(1) : '0'}%
                </span>
                <span className="text-[8px] sm:text-[9.5px] text-emerald-700 font-bold uppercase tracking-widest mt-1">
                  ĐẠT CHUẨN
                </span>
              </div>
            </div>

            {/* Chú thích biểu đồ trực quan */}
            <div className="flex items-center justify-center gap-3 mt-2 sm:mt-2.5 text-[9.5px] sm:text-[11px] font-bold">
              <div className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Đạt chuẩn</span>
              </div>
              <div className="flex items-center gap-1 text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>Chưa ảnh</span>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (50% DIỆN TÍCH): 3 Chỉ số xếp từ trên xuống dưới (Tổng Số Xuất -> Số Xuất Đạt -> Chưa Có Ảnh) */}
          <div className="flex flex-col justify-between gap-2 sm:gap-2.5 h-full">
            {/* 1. TỔNG SỐ XUẤT */}
            <div className="flex-1 flex flex-col justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600 uppercase font-black tracking-tight leading-tight">
                TỔNG SỐ XUẤT
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 font-mono leading-none">
                  {totalParticipants}
                </span>
                <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-semibold">
                  suất
                </span>
              </div>
            </div>

            {/* 2. ĐÃ ĐẠT */}
            <div className="flex-1 flex flex-col justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-50/70 rounded-xl border border-emerald-500/25 hover:border-emerald-500/40 transition-colors">
              <span className="text-[10px] sm:text-xs md:text-sm text-emerald-800 uppercase font-black tracking-tight leading-tight">
                ĐÃ ĐẠT
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-600 font-mono tabular-nums leading-none">
                  {totalAchieved}
                </span>
                <span className="text-[11px] sm:text-xs text-emerald-700 font-bold font-mono tabular-nums">
                  {totalParticipants > 0 ? ((totalAchieved / totalParticipants) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            </div>

            {/* 3. CHƯA CÓ ẢNH */}
            <div className="flex-1 flex flex-col justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-rose-50/70 rounded-xl border border-rose-500/25 hover:border-rose-500/40 transition-colors">
              <span className="text-[10px] sm:text-xs md:text-sm text-rose-800 uppercase font-black tracking-tight leading-tight">
                CHƯA CÓ ẢNH
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-rose-600 font-mono tabular-nums leading-none">
                  {totalNoPhotos}
                </span>
                <span className="text-[11px] sm:text-xs text-rose-700 font-bold font-mono tabular-nums">
                  {totalParticipants > 0 ? ((totalNoPhotos / totalParticipants) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Thống kê nhân viên tỷ lệ thấp nhất / thiếu ảnh khi chọn 'Tất cả' */}
        {!isEmployeeView && selectedEmployeeName === 'Tất cả' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-slate-100 pt-4">
            {/* Top 5 Lowest Completion */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
              <div className="text-[10px] sm:text-xs font-extrabold text-amber-700 uppercase tracking-widest pb-1 border-b border-amber-200 flex items-center gap-1.5">
                <span>NHÂN VIÊN TỶ LỆ ĐẠT THẤP NHẤT</span>
              </div>
              <div className="space-y-1.5">
                {lowestCompletionEmployees.length === 0 ? (
                  <div className="text-slate-500 italic text-[10.5px] py-2 text-center">
                    Không có dữ liệu hiệu suất
                  </div>
                ) : (
                  lowestCompletionEmployees.map((emp, i) => (
                    <div key={i} className="flex justify-between items-center text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-800 truncate max-w-[170px]">{i+1}. {emp.name}</span>
                      <span className="text-amber-700 font-bold text-xs font-mono tabular-nums">
                        {emp.overallRate.toFixed(1)}% <span className="text-slate-500 font-normal">({emp.totalDat}/{emp.totalThamGia})</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top 5 Highest No-Photos */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
              <div className="text-[10px] sm:text-xs font-extrabold text-rose-700 uppercase tracking-widest pb-1 border-b border-rose-200 flex items-center gap-1.5">
                <span>NHÂN VIÊN THIẾU BỘ ẢNH NHIỀU NHẤT</span>
              </div>
              <div className="space-y-1.5">
                {highestNoPhotoEmployees.length === 0 ? (
                  <div className="text-slate-500 italic text-[10.5px] py-2 text-center">
                    Không có khách hàng thiếu ảnh
                  </div>
                ) : (
                  highestNoPhotoEmployees.map((emp, i) => (
                    <div key={i} className="flex justify-between items-center text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="font-bold text-slate-800 truncate max-w-[170px]">{i+1}. {emp.name}</span>
                      <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-xs border border-rose-200 font-mono">
                        {emp.noPhotoRate.toFixed(1)}% <span className="text-slate-500 font-normal">({emp.totalKhongBoAnh}/{emp.totalThamGia})</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TIÊU ĐỀ KHỐI CÁC CHƯƠNG TRÌNH TRƯNG BÀY */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/30 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
            <LayoutGrid className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-black text-emerald-950 uppercase tracking-wide">
              CÁC CHƯƠNG TRÌNH TRƯNG BÀY ({programSummaries.length})
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block">
              Chi tiết chỉ tiêu, tỷ lệ hoàn thành và tình trạng chụp ảnh từng chương trình
            </p>
          </div>
        </div>
      </div>

      {/* CTTB Program list: 2 per row on tablet/desktop, large & clear cards for meetings / presentations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {programSummaries.map((item) => {
          // Sort levels from smallest to largest
          const sortedLevels = Object.entries(item.levelCounts || {}).sort((a, b) => {
            const getNum = (s: string) => {
              const m = s.match(/\d+(\.\d+)?/);
              return m ? parseFloat(m[0]) : 9999;
            };
            return getNum(a[0]) - getNum(b[0]);
          });

          return (
            <div 
              key={item.programName}
              className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 border border-slate-200/90 hover:border-emerald-500 shadow-xs transition-all duration-200 flex flex-col justify-between gap-4"
            >
              {/* Header: Row 1 (Program Name + Compact Chi tiết button) + Row 2 (Full-width Level stats) */}
              <div className="pb-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm sm:text-lg md:text-xl font-black text-emerald-950 uppercase tracking-wide truncate min-w-0">
                    {item.programName}
                  </h4>

                  {/* Nút Chi Tiết thu gọn */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetailProgram(item.programName);
                      setDetailSearch('');
                    }}
                    className="h-7 sm:h-8 px-2 sm:px-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] sm:text-xs font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                    title={`Xem chi tiết toàn bộ nhân viên CT ${item.programName}`}
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Chi tiết</span>
                  </button>
                </div>

                {/* Level badges inline — 1 hàng ngang toàn chiều rộng card để không bị nút đè/chèn */}
                <div className="h-5 sm:h-6 mt-1.5 flex items-center gap-2.5 overflow-x-auto no-scrollbar whitespace-nowrap text-xs text-slate-600">
                  {sortedLevels.length > 0 ? (
                    sortedLevels.map(([lvlName, lvlCount]) => (
                      <span key={lvlName} className="inline-flex items-center gap-1 font-medium shrink-0">
                        <span className="text-slate-500">{lvlName}:</span>
                        <span className="font-extrabold text-emerald-800 font-mono tabular-nums">{lvlCount}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">Theo dõi chung</span>
                  )}
                </div>
              </div>

              {/* 3 Metric Chips Grid: Large, bold, projector-ready typography */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3.5 items-stretch">
                {/* Metric 1: Số xuất TB đạt */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center shadow-2xs hover:border-slate-300 transition-all text-center h-full">
                  <div className="h-6 sm:h-7 flex items-center justify-center gap-1 shrink-0 w-full">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                    <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-slate-600 uppercase tracking-wider truncate">
                      Đã Đạt
                    </span>
                  </div>
                  <div className="h-10 sm:h-12 flex items-center justify-center shrink-0 my-1 sm:my-1.5 w-full">
                    <div className="flex items-center justify-center gap-1 text-base sm:text-lg md:text-xl lg:text-2xl font-black font-mono leading-none tracking-tight">
                      <span className="text-slate-900 leading-none">
                        {item.khDat}
                      </span>
                      <span className="text-slate-400 font-bold leading-none">
                        /
                      </span>
                      <span className="text-slate-900 leading-none">
                        {item.khThamGia}
                      </span>
                    </div>
                  </div>
                  <div className="h-5 sm:h-6 flex items-center justify-center shrink-0 w-full">
                    <span className="text-[10px] sm:text-xs text-slate-500 font-bold truncate block leading-none">
                      Khách hàng đạt
                    </span>
                  </div>
                </div>

                {/* Metric 2: Tỷ lệ đạt */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center shadow-2xs hover:border-emerald-300 transition-all text-center h-full">
                  <div className="h-6 sm:h-7 flex items-center justify-center gap-1 shrink-0 w-full">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                    <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-emerald-800 uppercase tracking-wider truncate">
                      Tỷ lệ đạt
                    </span>
                  </div>
                  <div className="h-10 sm:h-12 flex items-center justify-center shrink-0 my-1 sm:my-1.5 w-full">
                    <div className="flex items-center justify-center gap-1 text-base sm:text-lg md:text-xl lg:text-2xl font-black font-mono leading-none tracking-tight">
                      <span className={`leading-none ${
                        item.rate >= 100 
                          ? 'text-emerald-700' 
                          : item.rate >= 80 
                          ? 'text-emerald-600' 
                          : 'text-amber-600'
                      }`}>
                        {item.rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-5 sm:h-6 flex items-center justify-center shrink-0 w-full">
                    <span className={`text-[10px] sm:text-xs font-bold truncate block leading-none ${
                      item.rate >= 100 ? 'text-emerald-700' : item.rate >= 80 ? 'text-emerald-600' : 'text-amber-700'
                    }`}>
                      {item.rate >= 100 ? 'Đạt mục tiêu' : item.rate >= 80 ? 'Tiến độ tốt' : 'Cần thúc đẩy'}
                    </span>
                  </div>
                </div>

                {/* Metric 3: KH 0 Bộ Ảnh */}
                <div className={`rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center shadow-2xs transition-all text-center h-full ${
                  item.khKhongBoAnh > 0 ? 'bg-rose-50/70 border border-rose-200 hover:border-rose-300' : 'bg-slate-50/90 border border-slate-200/90 hover:border-slate-300'
                }`}>
                  <div className="h-6 sm:h-7 flex items-center justify-center gap-1 shrink-0 w-full">
                    <Camera className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${item.khKhongBoAnh > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span className={`text-[11px] sm:text-xs md:text-sm font-extrabold uppercase tracking-wider truncate ${
                      item.khKhongBoAnh > 0 ? 'text-rose-800' : 'text-slate-600'
                    }`}>
                      Chưa có ảnh
                    </span>
                  </div>
                  <div className="h-10 sm:h-12 flex items-center justify-center shrink-0 my-1 sm:my-1.5 w-full">
                    <div className="flex items-center justify-center gap-1 text-base sm:text-lg md:text-xl lg:text-2xl font-black font-mono leading-none tracking-tight">
                      <span className={`leading-none ${item.khKhongBoAnh > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {item.khKhongBoAnh}
                      </span>
                      <span className="text-slate-400 font-bold leading-none">
                        /
                      </span>
                      <span className="text-slate-700 leading-none">
                        {item.khThamGia}
                      </span>
                    </div>
                  </div>
                  <div className="h-5 sm:h-6 flex items-center justify-center shrink-0 w-full">
                    <span className={`text-[10px] sm:text-xs font-bold truncate block leading-none ${
                      item.khKhongBoAnh > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {item.khKhongBoAnh > 0 ? `${((item.khKhongBoAnh / item.khThamGia) * 100).toFixed(1)}% chưa chụp` : '100% đã chụp ảnh'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* manager details drill-down Modal window popup: Portal + AnimatePresence matching TargetAnalysis */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedDetailProgram && (
            <div key="cttb-detail-portal" className="fixed inset-0 z-[999999] bg-slate-900/70 backdrop-blur-xs flex flex-col p-0 md:p-1.5 overflow-hidden">
              {/* Modal Box: Full-screen presentation mode with pure white background */}
              <motion.div 
                ref={detailModalCaptureRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={`Tiến độ CTTB: ${selectedDetailProgram}`}
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full max-w-full bg-white rounded-none md:rounded-xl shadow-2xl border-0 md:border md:border-slate-300 flex flex-col overflow-hidden font-sans outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Clean Presentation Header: Pure white background, high contrast */}
                <div className="px-3 md:px-6 py-3 md:py-3.5 bg-white border-b-2 border-slate-200 text-slate-900 flex items-center justify-between gap-3 shrink-0 shadow-xs">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Store className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex items-center gap-2 md:gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="hidden sm:inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs md:text-sm font-black uppercase tracking-wider border border-slate-300">
                          HỌP & TRÌNH CHIẾU
                        </span>
                        <h4 className="text-slate-900 text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight uppercase truncate">
                          TIẾN ĐỘ CTTB:
                        </h4>
                      </div>
                      <span className="text-emerald-700 font-black text-base sm:text-lg md:text-xl lg:text-2xl truncate">
                        {selectedDetailProgram}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
                    {/* Fast employee search */}
                    <div className="relative w-36 sm:w-48 md:w-64">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={detailSearch}
                        onChange={(e) => setDetailSearch(e.target.value)}
                        placeholder="Tìm nhân viên..."
                        className="w-full bg-slate-50 text-slate-900 rounded-lg border border-slate-300 py-2 pl-9 pr-7 text-xs md:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium shadow-2xs"
                      />
                      {detailSearch && (
                        <button
                          type="button"
                          onClick={() => setDetailSearch('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                          aria-label="Xóa tìm kiếm"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Fullscreen Presentation Mode Button */}
                    <button
                      type="button"
                      onClick={toggleDetailFullscreen}
                      className="px-3 md:px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs md:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 border border-slate-300 shrink-0"
                      title="Toàn màn hình (F11 Trình chiếu)"
                    >
                      {isDetailFullscreen ? <Minimize2 className="w-4 h-4 text-slate-700" /> : <Maximize2 className="w-4 h-4 text-slate-700" />}
                      <span className="hidden md:inline">{isDetailFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
                    </button>

                    {/* Close Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedDetailProgram(null)}
                      className="px-3 md:px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-lg text-xs md:text-sm font-black transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-300"
                      title="Đóng cửa sổ (ESC)"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden lg:inline text-xs text-slate-400 font-mono">ESC</span>
                    </button>
                  </div>
                </div>

                {/* Meeting KPI Summary Banner: Clean White Background, Large Bold Numbers */}
                {(() => {
                  const programRows = getProgramDetails();
                  const sumThamGia = programRows.reduce((acc, r) => acc + r.khThamGia, 0);
                  const sumDat = programRows.reduce((acc, r) => acc + r.khDat, 0);
                  const sumChuaDat = Math.max(0, sumThamGia - sumDat);
                  const sumZero = programRows.reduce((acc, r) => acc + r.khKhongBoAnh, 0);
                  const avgRate = sumThamGia > 0 ? (sumDat / sumThamGia) * 100 : 0;

                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-slate-200 bg-white border-b-2 border-slate-200 py-3 md:py-4 px-4 md:px-8 text-center shrink-0">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Tổng Đăng Ký:</span>
                        <span className="text-lg md:text-2xl lg:text-3xl font-arial font-black text-slate-900">
                          {sumThamGia}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Đã Đạt:</span>
                        <span className="text-lg md:text-2xl lg:text-3xl font-arial font-black text-emerald-700">
                          {sumDat}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Tỷ Lệ Đạt:</span>
                        <span className={`text-lg md:text-2xl lg:text-3xl font-arial font-black ${avgRate >= 100 ? 'text-emerald-700' : avgRate >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {avgRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Chưa Đạt:</span>
                        <span className="text-lg md:text-2xl lg:text-3xl font-arial font-black text-amber-700">
                          {sumChuaDat}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1 col-span-2 lg:col-span-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">0 Bộ Ảnh:</span>
                        <span className={`text-lg md:text-2xl lg:text-3xl font-arial font-black ${sumZero > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          {sumZero}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Big Presentation Data Table Container */}
                <div className="flex-1 min-h-0 flex flex-col p-1 sm:p-2 md:p-3 overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white">
                  {/* Desktop / Big Screen Table View - Tall Rows, Huge Crisp Text & Numbers, Pure White Background */}
                  <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg border-2 border-slate-300 shadow-sm bg-white">
                    <table className="w-full text-center border-collapse table-fixed border border-slate-300 bg-white">
                      <colgroup>
                        <col className="w-[30%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-20 bg-white shadow-xs">
                        <tr className="border-b-2 border-slate-400 text-sm md:text-base lg:text-lg font-black uppercase tracking-wider select-none h-14 md:h-16 bg-white text-slate-900">
                          <th 
                            onClick={() => handleSort('name')}
                            className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              Nhân Viên <ArrowUpDown className="w-4 h-4 text-slate-500" />
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('khThamGia')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1">
                              Đăng Ký <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('khDat')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1">
                              Đã Đạt <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('rate')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1">
                              Tỷ Lệ % <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('chuaDat')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1">
                              Chưa Đạt <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('zeroPhoto')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1">
                              0 Bộ Ảnh <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {getProgramDetails().length > 0 ? (
                          getProgramDetails().map((row, idx) => {
                            const isCurrentActive = selectedEmployeeName && selectedEmployeeName !== 'Tất cả' && (row.employeeName.toLowerCase().trim() === selectedEmployeeName.toLowerCase().trim() || cleanEmployeeName(row.employeeName).toLowerCase() === cleanEmployeeName(selectedEmployeeName).toLowerCase());
                            const soChuaDat = Math.max(0, row.khThamGia - row.khDat);
                            return (
                              <tr 
                                key={row.employeeName || idx} 
                                className={`transition-colors h-14 md:h-16 lg:h-18 bg-white hover:bg-slate-50 ${
                                  isCurrentActive ? 'bg-blue-50/70 font-black' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 font-semibold border border-slate-200 text-left bg-white">
                                  <div className="flex items-center justify-start gap-2.5 min-w-0">
                                    <span className="text-slate-400 font-mono text-sm md:text-base lg:text-lg w-6 text-right shrink-0">
                                      {(idx + 1).toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-slate-900 font-black text-base md:text-xl lg:text-2xl whitespace-nowrap">
                                      {row.employeeName}
                                    </span>
                                    {isCurrentActive && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold shrink-0">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black text-slate-900 border border-slate-200 bg-white">
                                  {row.khThamGia}
                                </td>
                                <td className="py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black text-emerald-700 border border-slate-200 bg-white">
                                  {row.khDat}
                                </td>
                                <td className="py-2.5 px-2 text-center border border-slate-200 bg-white">
                                  <span className={`font-arial text-lg md:text-2xl lg:text-3xl font-black ${
                                    row.rate >= 100
                                      ? 'text-emerald-700'
                                      : row.rate >= 80
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'
                                  }`}>
                                    {row.rate.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black text-amber-700 border border-slate-200 bg-white">
                                  {soChuaDat}
                                </td>
                                <td className="py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black border border-slate-200 bg-white">
                                  <span className={`${row.khKhongBoAnh > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                    {row.khKhongBoAnh}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-slate-500 text-base border border-slate-200 bg-white">
                              <Info className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                              <span className="text-slate-500 font-medium text-base">Không tìm thấy dữ liệu nhân viên trùng khớp.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {getProgramDetails().length > 0 && (() => {
                        const rows = getProgramDetails();
                        const sumThamGia = rows.reduce((acc, r) => acc + r.khThamGia, 0);
                        const sumDat = rows.reduce((acc, r) => acc + r.khDat, 0);
                        const sumChuaDat = Math.max(0, sumThamGia - sumDat);
                        const sumZero = rows.reduce((acc, r) => acc + r.khKhongBoAnh, 0);
                        const avgRate = sumThamGia > 0 ? (sumDat / sumThamGia) * 100 : 0;
                        return (
                          <tfoot className="sticky bottom-0 z-20 bg-white shadow-xl font-black border-t-4 border-slate-900">
                            <tr className="h-14 md:h-16 lg:h-18 text-slate-900 bg-white">
                              <td className="py-3 px-3 text-center border border-slate-300 tracking-wider font-extrabold text-base md:text-xl lg:text-2xl bg-white">
                                Tổng
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-slate-900 bg-white">
                                {sumThamGia}
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-emerald-800 bg-white">
                                {sumDat}
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-lg md:text-2xl lg:text-3xl text-emerald-800 bg-white">
                                {avgRate.toFixed(1)}%
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-amber-800 bg-white">
                                {sumChuaDat}
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-slate-800 bg-white">
                                <span className={`${sumZero > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                                  {sumZero}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  </div>

                  {/* Mobile Table View: Clean White Background, Larger Height & Text */}
                  <div className="block md:hidden flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white rounded-lg border-2 border-slate-300">
                    <table className="w-full text-center border-collapse table-fixed text-xs border border-slate-300 bg-white">
                      <thead className="sticky top-0 z-10 bg-white shadow-xs">
                        <tr className="border-b-2 border-slate-400 text-xs font-black uppercase tracking-tight h-10 bg-white text-slate-900">
                          <th 
                            onClick={() => handleSort('name')}
                            className="py-1.5 px-1 text-center border border-slate-300 bg-white w-[30%]"
                          >
                            Nhân Viên
                          </th>
                          <th 
                            onClick={() => handleSort('khThamGia')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[14%]"
                          >
                            ĐK
                          </th>
                          <th 
                            onClick={() => handleSort('khDat')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[14%]"
                          >
                            Đạt
                          </th>
                          <th 
                            onClick={() => handleSort('rate')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[14%]"
                          >
                            Tỷ Lệ
                          </th>
                          <th 
                            onClick={() => handleSort('chuaDat')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[14%]"
                          >
                            Chưa
                          </th>
                          <th 
                            onClick={() => handleSort('zeroPhoto')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[14%]"
                          >
                            0 Ảnh
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs text-slate-800 bg-white">
                        {getProgramDetails().length > 0 ? (
                          getProgramDetails().map((row) => {
                            const isCurrentActive = selectedEmployeeName && selectedEmployeeName !== 'Tất cả' && (row.employeeName.toLowerCase().trim() === selectedEmployeeName.toLowerCase().trim() || cleanEmployeeName(row.employeeName).toLowerCase() === cleanEmployeeName(selectedEmployeeName).toLowerCase());
                            const soChuaDat = Math.max(0, row.khThamGia - row.khDat);
                            return (
                              <tr 
                                key={row.employeeName} 
                                className={`hover:bg-slate-50 transition-colors h-12 bg-white ${
                                  isCurrentActive ? 'bg-blue-50 font-black' : ''
                                }`}
                              >
                                <td className="py-1.5 px-1 font-semibold border border-slate-200 text-left bg-white">
                                  <div className="whitespace-nowrap overflow-hidden text-slate-900 font-black text-sm">
                                    {row.employeeName}
                                  </div>
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-arial text-xs font-bold text-slate-900 border border-slate-200 bg-white">
                                  {row.khThamGia}
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-arial text-xs font-bold text-emerald-700 border border-slate-200 bg-white">
                                  {row.khDat}
                                </td>
                                <td className="py-1.5 px-0.5 text-center border border-slate-200 bg-white">
                                  <span className={`font-arial text-sm font-black ${
                                    row.rate >= 100
                                      ? 'text-emerald-700'
                                      : row.rate >= 80
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'
                                  }`}>
                                    {row.rate.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-arial text-xs font-bold text-amber-700 border border-slate-200 bg-white">
                                  {soChuaDat}
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-arial text-xs font-bold border border-slate-200 bg-white">
                                  <span className={`${row.khKhongBoAnh > 0 ? 'text-rose-600 font-black' : 'text-slate-600'}`}>
                                    {row.khKhongBoAnh}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500 text-xs border border-slate-200 bg-white">
                              <span className="text-slate-400">Không tìm thấy dữ liệu nhân viên.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Presentation Footer */}
                <div className="py-2 px-5 bg-white border-t border-slate-200 text-xs text-slate-700 text-center font-bold shrink-0 flex items-center justify-between">
                  <span className="hidden sm:inline text-xs text-slate-500">Nhấn phím <strong>ESC</strong> hoặc nút Đóng để thoát chế độ xem</span>
                  <span className="mx-auto sm:mx-0 font-medium">Dữ liệu tiến độ CTTB được cập nhật theo danh sách và báo cáo ảnh</span>
                  <span className="hidden sm:inline text-xs text-slate-600 font-mono">Tỉ lệ hiển thị tối ưu cho máy chiếu & TV</span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}
