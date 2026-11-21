import React, { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Eye, EyeOff, X, Search, TrendingUp, Info, ArrowUpDown, Award, Calendar, DollarSign, User, AlertTriangle, ShoppingBag, Trophy, BarChart2, Maximize2, Minimize2, Plus, Minus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { SoBanRaw, EmployeeTargetRow, GrowthRow, AnnualBonusEmployeeRow, AnnualBonusGroup } from '../types';
import { cleanEmployeeName, generateMockAnnualBonusData, parseFlexibleVolume } from '../utils/sheetParser';
import { getSalesCycleDates, getCycleNameFromStartDate, formatDateToVN } from '../utils/cycleHelper';
import { formatValue as centralFormatValue, formatQuantity as centralFormatQuantity, formatRevenue as centralFormatRevenue, formatGrowthPct as centralFormatGrowthPct, formatGapNumber as centralFormatGapNumber } from '../utils/formatters';
import { EmployeeSelect } from './EmployeeSelect';
import { MobileSectorTable } from './MobileSectorTable';
import { GrowthTableView } from './GrowthTableView';
import { SectorIconPickerModal, getStoredSectorIcons, saveStoredSectorIcon, SectorIconConfig, SECTOR_ICON_STORAGE_KEY } from './SectorIconPickerModal';
import { saveSectorIconsToFirestore, subscribeSectorIconsFromFirestore } from '../firebase';
import ZaloShareImageModal, { ZaloIcon } from './ZaloShareImageModal';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

// Pure utility helper functions defined outside of the component to avoid Temporal Dead Zone (hoisting) issues
const parseValueFromString = (v: any): number => {
  return parseFlexibleVolume(v);
};

const toProperCase = (str: string): string => {
  if (!str) return '';
  const trimmed = str.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'simply rbo' || lower === 'simply r.b.o' || lower === 'simply_rbo') {
    return 'Simply RBO';
  }
  if (lower === 'bcg' || lower === 'bột chiên giòn' || lower === 'bot chien gion') {
    return 'Bột Chiên Giòn';
  }
  if (lower === 'bột mì' || lower === 'bot mi' || lower === 'total vfm') {
    return 'TOTAL VFM';
  }
  if (lower === 'tổng các ngành hàng' || lower === 'tong cac nganh hang' || lower === 'tổng' || lower === 'tong') {
    return 'TỔNG CÁC NGÀNH HÀNG';
  }
  if (lower === 'meizan sbo' || lower === 'meizan bơ' || lower === 'meizan bo' || lower === 'meizan_sbo') {
    return 'Meizan SBO';
  }
  if (lower === 'mè' || lower === 'me' || lower === 'dầu mè' || lower === 'dau me') {
    return 'Dầu Mè';
  }
  if (lower === 'bp' || lower === 'dầu bp' || lower === 'dau bp') {
    return 'Dầu Đóng Gói Lớn (BP)';
  }
  if (lower === 'total clf' || lower === 'tổng clf' || lower === 'tong clf') {
    return 'TOTAL CLF';
  }
  return trimmed
    .split(/\s+/)
    .map(word => {
      const upperWord = word.toUpperCase();
      // Keep completely uppercase short words or acronyms (like CLF, MCC, HPC, NDFC, DH, RICE, VFM, RBO, BP) uppercase
      if (/^(CLF|MCC|HPC|NDFC|DH|RICE|VFM|RBO|BP)$/.test(upperWord)) {
        return upperWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

const getParentGroup = (nhomName: string): string | null => {
  if (!nhomName) return null;
  const norm = nhomName.trim().toLowerCase();
  
  // 1. CAO CẤP children: Neptune, Simply, Simply RBO
  const isNeptune = norm.includes('neptune');
  const isSimply = norm.includes('simply') && !norm.includes('gạo lứt') && !norm.includes('gao lut') && !norm.includes('rbo') && !norm.includes('cao cấp') && !norm.includes('cao cap') && !norm.includes('total') && !norm.includes('tổng');
  const isRbo = (norm.includes('gạo lứt') || norm.includes('gao lut') || norm.includes('rbo') || norm.includes('r.b.o')) && !norm.includes('cao cấp') && !norm.includes('cao cap') && !norm.includes('total') && !norm.includes('tổng');
  
  if (isNeptune || isSimply || isRbo) {
    return 'cao cấp';
  }
  
  // 2. NGÁCH children: Mè, Bơ, Olivoila & Kiddy Olive
  const isParentNgach = norm === 'ngách' || norm === 'ngach' || norm === 'sản phẩm ngách' || norm === 'san pham ngach' || norm.includes('sản phẩm ngách') || norm.includes('san pham ngach');
  if (!isParentNgach) {
    const isMe = (norm.includes('mè') || norm.includes('dau me') || norm.includes('dầu mè')) && !norm.includes('meizan');
    const isBo = (norm.includes('bơ') || norm.includes('bo')) && !norm.includes('meizan') && !norm.includes('bột') && !norm.includes('bot') && !norm.includes('bún') && !norm.includes('bun');
    const isOlive = norm.includes('olivoila') || norm.includes('kiddy') || norm.includes('olive');
    if (isMe || isBo || isOlive) {
      return 'ngách';
    }
  }

  // 3. TRUNG CẤP children: Meizan Gold, Meizan SBO
  const isMeizanGold = norm.includes('meizan gold') || norm.includes('meizan_gold');
  const isMeizanSbo = norm.includes('meizan sbo') || norm.includes('meizan bơ') || norm.includes('meizan bo');
  if (isMeizanGold || isMeizanSbo) {
    return 'trung cấp';
  }

  // 4. THẤP CẤP children: Cái Lân, Orchid
  const isParentThapCap = norm.includes('thấp cấp') || norm.includes('thap cap') || norm.includes('& orchid') || norm.includes('&orchid') || norm.includes(' sp') || norm.includes(' & ');
  if (!isParentThapCap) {
    const isCaiLan = norm.includes('cái lân') || norm.includes('cai lan');
    const isOrchid = norm.includes('orchid');
    if (isCaiLan || isOrchid) {
      return 'thấp cấp';
    }
  }

  // 5. TOTAL MCC children: BCG, Bột Khác, Mì Bún Tươi, Nui Bánh Tráng
  const isParentMcc = norm.includes('total mcc') || norm.includes('tổng mcc') || norm.includes('tong mcc');
  if (!isParentMcc) {
    const isVfm = norm.includes('vfm') || norm.includes('bột mì') || norm.includes('bot mi');
    if (!isVfm) {
      const isBcg = norm.includes('bcg') || norm.includes('bột chiên giòn') || norm.includes('bot chien gion') || norm.includes('bột chiên') || norm.includes('bot chien');
      const isBotKhac = norm.includes('bột khác') || norm.includes('bot khac');
      const isMiBun = norm.includes('mì') || norm.includes('mi') || norm.includes('bún') || norm.includes('bun') || norm.includes('tươi') || norm.includes('tuoi');
      const isNuiBanhTrang = norm.includes('nui') || norm.includes('bánh tráng') || norm.includes('banh trang');
      if (isBcg || isBotKhac || isMiBun || isNuiBanhTrang) {
        return 'total mcc';
      }
    }
  }

  // 6. TOTAL NDFC children: Nước Tương, Tương Sốt, Hạt Nêm, Bột Ngọt
  const isParentNdfc = norm.includes('total ndfc') || norm.includes('tổng ndfc') || norm.includes('tong ndfc');
  if (!isParentNdfc) {
    const isNuocTuong = norm.includes('nước tương') || norm.includes('nuoc tuong');
    const isTuongSot = norm.includes('tương sốt') || norm.includes('tuong sot') || norm.includes('tương xốt') || norm.includes('tuong xot') || norm.includes('tương ớt') || norm.includes('tuong ot') || norm.includes('mayo') || norm.includes('mayonnaise');
    const isHatNem = norm.includes('hạt nêm') || norm.includes('hat nem');
    const isBotNgot = norm.includes('bột ngọt') || norm.includes('bot ngot');
    if (isNuocTuong || isTuongSot || isHatNem || isBotNgot) {
      return 'total ndfc';
    }
  }
  
  return null;
};

const normalizeGroupNameForCollapse = (name: string): string => {
  if (!name) return '';
  const norm = name.trim().toLowerCase();
  
  if (norm === 'cao cấp' || norm === 'cao cap' || ((norm.includes('cao cấp') || norm.includes('cao cap')) && !norm.includes('tổng các'))) {
    return 'cao cấp';
  }
  if (norm === 'ngách' || norm === 'ngach' || norm === 'sản phẩm ngách' || norm === 'san pham ngach' || norm.includes('sản phẩm ngách') || norm.includes('san pham ngach')) {
    return 'ngách';
  }
  if (norm === 'trung cấp' || norm === 'trung cap' || (norm.includes('trung cấp') || norm.includes('trung cap'))) {
    return 'trung cấp';
  }
  if (norm === 'thấp cấp' || norm === 'thap cap' || norm.includes('thấp cấp') || norm.includes('thap cap') || norm === 'cái lân & orchid sp' || norm.includes('cái lân & orchid') || norm.includes('cai lan & orchid')) {
    return 'thấp cấp';
  }
  if (norm === 'total mcc' || norm === 'tổng mcc' || norm === 'tong mcc' || norm.includes('total mcc') || norm.includes('tổng mcc') || norm.includes('tong mcc')) {
    return 'total mcc';
  }
  if (norm === 'total ndfc' || norm === 'tổng ndfc' || norm === 'tong ndfc' || norm.includes('total ndfc') || norm.includes('tổng ndfc') || norm.includes('tong ndfc')) {
    return 'total ndfc';
  }
  return norm;
};

const parentGroups = [
  'cao cấp',
  'ngách',
  'trung cấp',
  'thấp cấp',
  'total mcc',
  'total ndfc'
];

const isParentRow = (nhomName: string): boolean => {
  const normKey = normalizeGroupNameForCollapse(nhomName);
  return parentGroups.includes(normKey);
};

const getRowHighlightClass = (nhomName: string): string => {
  if (!nhomName) return '';
  const norm = nhomName.trim().toLowerCase();
  
  // Exclude child rows from highlight!
  if (getParentGroup(norm)) {
    return '';
  }
  
  if (
    norm.startsWith('total') || norm.startsWith('tổng') || norm.startsWith('tong') ||
    norm.includes('sp') ||
    norm === 'cao cấp' || norm === 'cao cap' || norm.includes('cao cấp') || norm.includes('cao cap') ||
    norm === 'ngách' || norm === 'ngach' || norm.includes('ngách') || norm.includes('ngach') ||
    norm === 'trung cấp' || norm === 'trung cap' || norm.includes('trung cấp') || norm.includes('trung cap') ||
    norm === 'thấp cấp' || norm === 'thap cap' || norm.includes('thấp cấp') || norm.includes('thap cap') ||
    norm === 'cái lân & orchid sp' || norm.includes('cái lân & orchid') || norm.includes('cai lan & orchid') ||
    norm === 'bột mì' || norm === 'bot mi' || norm.includes('bột mì') || norm.includes('bot mi') ||
    norm === 'mắm' || norm === 'mam' || norm.includes('mắm') || norm.includes('mam') ||
    norm === 'trà' || norm === 'tra' || norm.includes('trà') || norm.includes('tra') ||
    norm === 'dh food' || norm === 'dhfood' || norm.includes('dh food') || norm.includes('dhfood')
  ) {
    if (norm !== 'tổng các ngành hàng' && norm !== 'tong cac nganh hang') {
      return 'bg-slate-800/60 hover:bg-slate-800/85 text-slate-100 font-bold';
    }
  }

  return '';
};

const getRowEmployeeName = (row: any) => {
  const rowKeys = Object.keys(row);
  const foundKey = rowKeys.find(k => {
    const normK = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
    return ['tennhanvien', 'nhanvien', 'hoten', 'hovaten', 'nhansu', 'tennv', 'saleman', 'nv', 'employee', 'staff'].includes(normK) || normK.includes('nhanvien');
  });
  if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined) {
    const valStr = String(row[foundKey]).trim();
    if (valStr.toLowerCase() !== 'null' && valStr.toLowerCase() !== 'undefined' && valStr) {
      return cleanEmployeeName(valStr);
    }
  }

  // Fallback to Column A or Column B
  if (row['A']) {
    const val = String(row['A']).trim();
    if (val && !val.toLowerCase().includes('tổng') && !val.toLowerCase().includes('chỉ tiêu') && !val.toLowerCase().includes('thực tế') && !val.toLowerCase().includes('nhân viên')) {
      return cleanEmployeeName(val);
    }
  }
  if (row['B']) {
    const val = String(row['B']).trim();
    if (val && !val.toLowerCase().includes('tổng') && !val.toLowerCase().includes('chỉ tiêu') && !val.toLowerCase().includes('thực tế') && !val.toLowerCase().includes('nhân viên') && val.length > 5) {
      return cleanEmployeeName(val);
    }
  }
  return '';
};

const matchesEmployee = (row: any, filterName: string) => {
  if (filterName === 'Tất cả') return true;
  const itemEmp = getRowEmployeeName(row);
  if (!itemEmp) return true;
  
  const clean = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, '');
  const c1 = clean(itemEmp);
  const c2 = clean(filterName);
  if (c1 === c2) return true;
  
  // Loose matching: check if one contains the other
  if (c1.length >= 4 && c2.length >= 4 && (c1.includes(c2) || c2.includes(c1))) {
    return true;
  }
  if (c1.length >= 2 && c2.includes(c1)) {
    return true;
  }
  return false;
};

export const getMonthToDateElapsedPercentage = (): number => {
  const now = new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  return Math.round((currentDay / (totalDays - 1)) * 100);
};

export const getCycleElapsedPercentage = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return getMonthToDateElapsedPercentage();
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 100;
  
  const totalDays = Math.round(totalMs / (1000 * 60 * 60 * 24)) + 1;
  
  if (today < start) {
    return 0;
  }
  if (today > end) {
    return 100;
  }
  
  const elapsedMs = today.getTime() - start.getTime();
  const elapsedDays = Math.round(elapsedMs / (1000 * 60 * 60 * 24)) + 1;
  
  const percentage = Math.round((elapsedDays / totalDays) * 100);
  return Math.min(100, Math.max(0, percentage));
};

const isTargetSumRow = (nhom: string): boolean => {
  if (!nhom) return false;
  const norm = nhom.trim().toLowerCase();
  return (
    norm === 'dh food' || norm === 'dhfood' || norm.includes('dh food') || norm.includes('dhfood') ||
    norm === 'trà' || norm === 'tra' || norm.includes('trà') || norm.includes('tra') ||
    norm === 'mắm' || norm === 'mam' || norm.includes('mắm') || norm.includes('mam') ||
    norm === 'total rice' || norm.includes('total rice') ||
    norm === 'total ndfc' || norm.includes('total ndfc') ||
    norm === 'total hpc' || norm.includes('total hpc') ||
    norm === 'total mcc' || norm.includes('total mcc') ||
    norm === 'total vfm' || norm === 'totalvfm' || norm.includes('total vfm') || norm.includes('totalvfm') ||
    norm === 'total clf' || norm.includes('total clf')
  );
};

const SECTOR_ROW_INDEX_MAP: { [key: string]: number } = {
  'CLF': 3,
  'VFM': 4,
  'MCC': 5,
  'NDFC': 6,
  'HPC': 7,
  'VP': 8,
  '584NT': 9,
  'VNT': 10,
  'DHF': 11,
  'NON - WM': 12
};

const MOCK_CUNG_KY_NAM_NGOAI: { [key: string]: number } = {
  'CLF': 125000000,
  'VFM': 185000000,
  'MCC': 45000000,
  'NDFC': 85000000,
  'HPC': 95000000,
  'VP': 65000000,
  '584NT': 35000000,
  'VNT': 28000000,
  'DHF': 22000000,
  'NON - WM': 85000000
};

const SECTOR_DENSITY_MAP: { [key: string]: number } = {
  'CLF': 0.01092,
  'VFM': 0.01,
  'MCC': 0.01,
  'NDFC': 0.012,
  'HPC': 0.013,
  'VP': 0.025,
  'VNT': 0.005,
  'DHF': 0.0078,
  '584NT': 0.024,
  'NON - WM': 0.01
};

interface TargetAnalysisProps {
  transactions: SoBanRaw[];
  employeeNameFilter: string;
  employees: EmployeeTargetRow[];
  sectorData?: {
    [employeeName: string]: {
      [sector: string]: {
        target: number;
        actual: number;
      };
    };
  };
  clfDetailedRows?: any[];
  mccDetailedRows?: any[];
  ndfcDetailedRows?: any[];
  isEmployeeView?: boolean;
  activationListData?: any[];
  growthData?: GrowthRow[];
  annualBonusData?: AnnualBonusEmployeeRow[];
  salesSubTab?: 'tiendo' | 'doanhso' | 'tangtruong' | 'thuongnam';
  onSalesSubTabChange?: (tab: 'tiendo' | 'doanhso' | 'tangtruong' | 'thuongnam') => void;
  onSelectEmployee?: (name: string) => void;
  availableEmployees?: string[];
  profileRole?: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
  onStartDateChange?: (val: string) => void;
  onEndDateChange?: (val: string) => void;
  isSidebarCollapsed?: boolean;
  onOpenZaloShare?: () => void;
}

export default function TargetAnalysis({ 
  transactions, 
  employeeNameFilter, 
  employees, 
  sectorData, 
  clfDetailedRows,
  mccDetailedRows,
  ndfcDetailedRows,
  isEmployeeView = false,
  activationListData = [],
  growthData = [],
  annualBonusData = [],
  salesSubTab: salesSubTabProp,
  onSalesSubTabChange,
  onSelectEmployee,
  availableEmployees,
  profileRole,
  cycleStartDate: cycleStartDateProp,
  cycleEndDate: cycleEndDateProp,
  onStartDateChange,
  onEndDateChange,
  isSidebarCollapsed = false,
  onOpenZaloShare,
}: TargetAnalysisProps) {
  const [localSalesSubTab, setLocalSalesSubTab] = useState<'tiendo' | 'doanhso' | 'tangtruong' | 'thuongnam'>('tiendo');
  const salesSubTab = salesSubTabProp !== undefined ? salesSubTabProp : localSalesSubTab;
  const setSalesSubTab = onSalesSubTabChange !== undefined ? onSalesSubTabChange : setLocalSalesSubTab;
  const [annualBonusViewMode, setAnnualBonusViewMode] = useState<'matrix' | 'grouped'>('matrix');
  const [annualBonusChartMetric, setAnnualBonusChartMetric] = useState<'rate' | 'points'>('rate');
  const [annualBonusSelectedEmp, setAnnualBonusSelectedEmp] = useState<string>('all');
  const [expandedBonusGroups, setExpandedBonusGroups] = useState<Record<number, boolean>>({});
  const [showBonusScoringModal, setShowBonusScoringModal] = useState<boolean>(false);
  const [bonusSearchKeyword, setBonusSearchKeyword] = useState<string>('');
  const [bonusRatingFilter, setBonusRatingFilter] = useState<'all' | 'A' | 'B+' | 'B' | 'C' | 'D'>('all');
  const [selectedBonusEmployee, setSelectedBonusEmployee] = useState<AnnualBonusEmployeeRow | null>(null);
  const bonusEmpModalRef = useRef<HTMLDivElement | null>(null);
  const bonusScoringModalRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(Boolean(selectedBonusEmployee), bonusEmpModalRef, () => setSelectedBonusEmployee(null));
  useDialogFocus(showBonusScoringModal, bonusScoringModalRef, () => setShowBonusScoringModal(false));

  const toggleBonusGroup = (gIdx: number) => {
    setExpandedBonusGroups(prev => ({
      ...prev,
      [gIdx]: !prev[gIdx]
    }));
  };

  const expandAllBonusGroups = (count: number) => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < count; i++) next[i] = true;
    setExpandedBonusGroups(next);
  };

  const collapseAllBonusGroups = () => {
    setExpandedBonusGroups({});
  };

  const isSupervisor = profileRole === 'Admin' || profileRole === 'MKT Sup' || profileRole === 'Supervisor';
  const [customSectorIcons, setCustomSectorIcons] = useState<Record<string, SectorIconConfig>>(() => getStoredSectorIcons());
  const [editingIconCategory, setEditingIconCategory] = useState<string | null>(null);

  // Subscribe to real-time custom sector icon changes from Firestore across all devices
  useEffect(() => {
    const unsub = subscribeSectorIconsFromFirestore((remoteIcons) => {
      if (remoteIcons && typeof remoteIcons === 'object') {
        setCustomSectorIcons(prev => {
          const merged = { ...prev, ...remoteIcons };
          try {
            localStorage.setItem(SECTOR_ICON_STORAGE_KEY, JSON.stringify(merged));
          } catch (e) {
            console.error('Error caching sector icons', e);
          }
          return merged;
        });
      }
    });
    return () => {
      unsub();
    };
  }, []);

  const handleSaveCustomIcon = async (category: string, config: SectorIconConfig) => {
    if (!isSupervisor) {
      notify.error('Chỉ Giám Sát mới có quyền chỉnh sửa biểu tượng/hình ảnh ngành hàng!');
      return;
    }
    saveStoredSectorIcon(category, config);
    const updated = { ...customSectorIcons, [category]: config };
    setCustomSectorIcons(updated);
    try {
      await saveSectorIconsToFirestore(updated, 'Supervisor');
    } catch (e) {
      console.error('Error saving sector icons to Firestore:', e);
    }
  };

  const [localCycleStartDate, setLocalCycleStartDate] = useState<string>(() => {
    let saved = localStorage.getItem('cycleStartDate');
    if (saved === '2026-07-01' || saved === '2026-06-01' || saved === '2026-07-31') {
      localStorage.removeItem('cycleStartDate');
      saved = null;
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (saved) {
      const savedEnd = localStorage.getItem('cycleEndDate');
      if (savedEnd && savedEnd < todayStr) {
        localStorage.removeItem('cycleStartDate');
        localStorage.removeItem('cycleEndDate');
        saved = null;
      }
    }
    if (saved) return saved;
    return getSalesCycleDates().startDate;
  });

  const [localCycleEndDate, setLocalCycleEndDate] = useState<string>(() => {
    let saved = localStorage.getItem('cycleEndDate');
    if (saved === '2026-07-31' || saved === '2026-06-30') {
      localStorage.removeItem('cycleEndDate');
      saved = null;
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (saved) {
      const savedStart = localStorage.getItem('cycleStartDate');
      if (savedStart) {
        if (saved < todayStr) {
          localStorage.removeItem('cycleStartDate');
          localStorage.removeItem('cycleEndDate');
          saved = null;
        }
      }
    }
    if (saved) return saved;
    return getSalesCycleDates().endDate;
  });

  const cycleStartDate = cycleStartDateProp !== undefined ? cycleStartDateProp : localCycleStartDate;
  const cycleEndDate = cycleEndDateProp !== undefined ? cycleEndDateProp : localCycleEndDate;

  const handleStartDateChange = async (val: string) => {
    if (onStartDateChange) {
      onStartDateChange(val);
    } else {
      setLocalCycleStartDate(val);
      localStorage.setItem('cycleStartDate', val);
    }
  };

  const handleEndDateChange = async (val: string) => {
    if (onEndDateChange) {
      onEndDateChange(val);
    } else {
      setLocalCycleEndDate(val);
      localStorage.setItem('cycleEndDate', val);
    }
  };

  const getCycleStats = () => {
    if (!cycleStartDate || !cycleEndDate) {
      return { totalDays: 0, currentDayNum: 0, percentage: 0 };
    }
    const start = new Date(cycleStartDate);
    const end = new Date(cycleEndDate);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    const today = new Date();
    today.setHours(0,0,0,0);

    const totalMs = end.getTime() - start.getTime();
    if (totalMs < 0) {
      return { totalDays: 0, currentDayNum: 0, percentage: 100 };
    }
    const totalDays = Math.round(totalMs / (1000 * 60 * 60 * 24)) + 1;

    let currentDayNum = 0;
    if (today < start) {
      currentDayNum = 0;
    } else if (today > end) {
      currentDayNum = totalDays;
    } else {
      currentDayNum = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const percentage = totalDays > 0 ? Math.round((currentDayNum / totalDays) * 100) : 0;
    return {
      totalDays,
      currentDayNum,
      percentage: Math.min(100, Math.max(0, percentage))
    };
  };

  const { totalDays: totalDaysInCycle, currentDayNum: currentDayInCycle, percentage: cyclePercentage } = getCycleStats();

  const getRemainingDaysExcludingSundays = () => {
    if (!cycleStartDate || !cycleEndDate) return 1;
    const start = new Date(cycleStartDate);
    const end = new Date(cycleEndDate);
    const today = new Date();
    
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    if (end < start) return 1;

    let current: Date;
    if (today < start) {
      current = new Date(start);
    } else {
      current = new Date(today);
    }

    let count = 0;
    while (current <= end) {
      if (current.getDay() !== 0) { // 0 is Sunday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return Math.max(1, count);
  };

  const remainingDays = getRemainingDaysExcludingSundays();

  // Clean group name helper
  const cleanGroupNameLabel = (name: string) => {
    if (!name) return '';
    let cleaned = name.replace(/^nhóm:\s*/i, '').replace(/^nhóm\s*/i, '').trim();
    cleaned = cleaned.replace(/total clf sp/i, 'Total CLF');
    return cleaned;
  };

  const sectorColumnMap: { [key: string]: string } = {
    'CLF': 'P',
    'VFM': 'Q',
    'MCC': 'R',
    'NDFC': 'S',
    'HPC': 'T',
    'VP': 'U',
    'DHF': 'V',
    'VNT': 'W',
    '584NT': 'X',
    'NON - WM': 'Y'
  };

  const matchesActivationEmployee = (row: any, filterName: string): boolean => {
    if (!row) return false;
    const rawEmp = row['Nhân Viên'] ?? row['Tên Nhân Viên'] ?? row['nhanVien'] ?? row['A'] ?? '';
    const empStr = String(rawEmp).trim();
    const custCode = String(row['Mã KH'] ?? row['Mã Khách Hàng'] ?? row['D'] ?? '').trim();
    const custName = String(row['Tên Khách Hàng'] ?? row['Tên khách hàng'] ?? row['Tên KH'] ?? row['E'] ?? '').trim();

    if (!empStr && !custCode && !custName) return false;

    const combinedCheck = `${empStr} ${custCode} ${custName}`.toLowerCase();
    if (
      empStr.toLowerCase() === 'nhân viên' ||
      empStr.toLowerCase() === 'nhan vien' ||
      custName.toLowerCase() === 'tên khách hàng' ||
      custName.toLowerCase() === 'ten khach hang' ||
      combinedCheck.includes('tổng cộng') ||
      combinedCheck.includes('tong cong') ||
      empStr.toLowerCase().startsWith('tổng') ||
      empStr.toLowerCase() === 'total'
    ) {
      return false;
    }

    if (!filterName || filterName === 'Tất cả' || filterName === 'Tất cả nhân viên') {
      return true;
    }

    const clean = (s: string) =>
      cleanEmployeeName(s)
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, '');

    const cFilterRaw = filterName.trim().toLowerCase();
    const cEmpRaw = empStr.toLowerCase();

    if (
      cFilterRaw === 'n/a => chưa gán khbh' ||
      cFilterRaw === 'n/a' ||
      cFilterRaw === 'na' ||
      cFilterRaw === '-' ||
      cFilterRaw === 'chưa gán khbh'
    ) {
      return (
        cEmpRaw === '' ||
        cEmpRaw === 'n/a' ||
        cEmpRaw === 'na' ||
        cEmpRaw === 'nan' ||
        cEmpRaw === '-' ||
        cEmpRaw === 'chưa gán khbh' ||
        cEmpRaw === 'n/a => chưa gán khbh'
      );
    }

    if (
      cEmpRaw === '' ||
      cEmpRaw === 'n/a' ||
      cEmpRaw === 'na' ||
      cEmpRaw === 'nan' ||
      cEmpRaw === '-' ||
      cEmpRaw === 'chưa gán khbh'
    ) {
      return false;
    }

    const c1 = clean(empStr);
    const c2 = clean(filterName);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.length >= 4 && c2.length >= 4 && (c1.includes(c2) || c2.includes(c1))) {
      return true;
    }
    return false;
  };

  const getTotalManagedCustomers = (filterName: string): number => {
    if (!activationListData || activationListData.length === 0) return 0;
    return activationListData.filter(row => matchesActivationEmployee(row, filterName)).length;
  };

  const getKHMHCount = (sector: string, filterName: string): number => {
    const colLetter = sectorColumnMap[sector];
    if (!colLetter || !activationListData) return 0;

    const filteredRows = activationListData.filter(row => {
      return matchesActivationEmployee(row, filterName);
    });

    const alternates = [colLetter, sector];

    return filteredRows.filter(row => {
      return alternates.some(key => {
        if (!key) return false;
        const val = row[key];
        if (val === null || val === undefined) return false;
        if (typeof val === 'boolean') return val;
        const str = String(val).trim().toUpperCase();
        return str === 'TRUE' || str === 'Y' || str === 'YES' || str === '1' || str === 'X' || str === 'TÍCH' || str === '✓' || str === 'KÍCH HOẠT' || str === 'ĐẠT';
      });
    }).length;
  };
  // Sector collapse accordion state (supports inline expansion per sector)
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});

  const toggleSectorExpanded = (category: string) => {
    setExpandedSectors((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const getSubgroupsForSector = (category: string) => {
    if (category === 'CLF') return { title: 'CLF', sector: 'CLF' as const, data: getProductGroupsData() };
    if (category === 'MCC') return { title: 'MCC', sector: 'MCC' as const, data: getMccGroupsData() };
    if (category === 'NDFC') return { title: 'NDFC', sector: 'NDFC' as const, data: getNdfcGroupsData() };
    return null;
  };

  // State for toggling "Cùng Kỳ Năm Ngoái" and "Tăng Trưởng Cùng Kỳ" columns
  const [showComparisonCols, setShowComparisonCols] = useState<boolean>(false);

  // Modal state for viewing slow progress sectors and product groups
  const [isSlowProgressModalOpen, setIsSlowProgressModalOpen] = useState<boolean>(false);

  // Modal state for viewing detail targets of all employees
  const [selectedTargetDetail, setSelectedTargetDetail] = useState<{
    title: string;
    sectorKey?: string;
    sector?: 'CLF' | 'MCC' | 'NDFC';
    targetCol?: string;
    actualCol?: string;
    fallbackKey?: string;
    compositeParts?: { targetCol: string; actualCol: string; fallbackKey: string }[];
  } | null>(null);

  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalSortField, setModalSortField] = useState<'name' | 'target' | 'actual' | 'completionRate' | 'conThieu' | 'soThungCanBan' | 'soThungT7' | 'none'>('none');
  const [modalSortOrder, setModalSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isModalFullscreen, setIsModalFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const hasNativeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (hasNativeFs) {
        setIsModalFullscreen(true);
      } else if (!hasNativeFs && isModalFullscreen && document.fullscreenEnabled !== false) {
        setIsModalFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTargetDetail) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          setSelectedTargetDetail(null);
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTargetDetail, isModalFullscreen]);

  const toggleModalFullscreen = () => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      isModalFullscreen
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
      setIsModalFullscreen(true);
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
      setIsModalFullscreen(false);
    }
  };

  const targetDetailCaptureRef = useRef<HTMLDivElement | null>(null);
  const [sharingTargetDetail, setSharingTargetDetail] = useState(false);
  const [targetZaloModalState, setTargetZaloModalState] = useState<{
    isOpen: boolean;
    title: string;
    subTitle: string;
    dataUrl: string;
    blob: Blob | null;
    fileName: string;
    copied: boolean;
  } | null>(null);

  const handleShareZaloTargetDetail = async () => {
    const targetEl = targetDetailCaptureRef.current;
    if (!targetEl || !selectedTargetDetail) return;

    setSharingTargetDetail(true);

    const titleText = selectedTargetDetail.title.replace(/^\d+[\.\-\s]+\s*/, '');
    const tableEl = targetEl.querySelector('table');
    const requiredWidth = Math.max(820, targetEl.scrollWidth, tableEl ? tableEl.scrollWidth + 20 : 0);

    const origStyle = {
      width: targetEl.style.width,
      minWidth: targetEl.style.minWidth,
      maxWidth: targetEl.style.maxWidth,
      overflow: targetEl.style.overflow,
    };

    const overflowEls = Array.from(targetEl.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-auto')) as HTMLElement[];
    const origOverflowStyles = overflowEls.map((el) => ({
      el,
      overflow: el.style.overflow,
      overflowX: el.style.overflowX,
      overflowY: el.style.overflowY,
      maxHeight: el.style.maxHeight,
      width: el.style.width,
      minWidth: el.style.minWidth,
    }));

    const buttons = Array.from(targetEl.querySelectorAll('button')) as HTMLButtonElement[];
    const origButtonDisplays = buttons.map((btn) => ({
      btn,
      display: btn.style.display,
    }));

    try {
      buttons.forEach((btn) => { btn.style.display = 'none'; });
      overflowEls.forEach((el) => {
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.overflowY = 'visible';
        el.style.maxHeight = 'none';
        el.style.width = '100%';
        el.style.minWidth = '100%';
      });

      targetEl.style.width = `${requiredWidth}px`;
      targetEl.style.minWidth = `${requiredWidth}px`;
      targetEl.style.maxWidth = 'none';
      targetEl.style.overflow = 'visible';

      await new Promise((resolve) => setTimeout(resolve, 80));

      const dataUrl = await toPng(targetEl, {
        quality: 0.98,
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: requiredWidth
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const cleanTitle = titleText
        .replace(/[^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const fileName = `ChiTiet_ChiTieu_${cleanTitle || 'NhomSP'}.png`;

      let copied = false;
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          copied = true;
        } catch (clipErr) {
          console.warn('Clipboard write failed:', clipErr);
        }
      }

      const imageFile = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        try {
          await navigator.share({
            title: `Bảng Thực Hiện Chỉ Tiêu - ${titleText}`,
            files: [imageFile]
          });
          return;
        } catch (shareErr) {
          console.log('Web share cancelled:', shareErr);
        }
      }

      setTargetZaloModalState({
        isOpen: true,
        title: 'Gửi Chi Tiết Chỉ Tiêu Qua Zalo',
        subTitle: titleText,
        dataUrl,
        blob,
        fileName,
        copied
      });
    } catch (err) {
      console.error('Lỗi xuất ảnh chi tiết qua Zalo:', err);
      notify.error('Không thể xuất hình ảnh chi tiết. Vui lòng thử lại!');
    } finally {
      origButtonDisplays.forEach(({ btn, display }) => { btn.style.display = display; });
      origOverflowStyles.forEach(({ el, overflow, overflowX, overflowY, maxHeight, width, minWidth }) => {
        el.style.overflow = overflow;
        el.style.overflowX = overflowX;
        el.style.overflowY = overflowY;
        el.style.maxHeight = maxHeight;
        el.style.width = width;
        el.style.minWidth = minWidth;
      });
      targetEl.style.width = origStyle.width;
      targetEl.style.minWidth = origStyle.minWidth;
      targetEl.style.maxWidth = origStyle.maxWidth;
      targetEl.style.overflow = origStyle.overflow;

      setSharingTargetDetail(false);
    }
  };

  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([
    'cao cấp',
    'ngách',
    'trung cấp',
    'thấp cấp',
    'total mcc',
    'total ndfc'
  ]);

  const [growthSearchTerm, setGrowthSearchTerm] = useState('');
  const [growthMetric, setGrowthMetric] = useState<'sanLuong' | 'doanhSo' | 'all'>('sanLuong');

  const processedGrowthData = useMemo(() => {
    if (!growthData || growthData.length === 0) return [];

    // 1. Filter out any existing sheet-level grand total row to avoid duplicates
    let list = growthData.filter(row => {
      if (!row || !row.nhomSanPham) return false;
      const norm = row.nhomSanPham.trim().toLowerCase();
      
      // Omit 'Tổng các ngành hàng' or similar
      if (norm === 'tổng' || norm === 'total' || norm === 'tổng các ngành hàng' || norm === 'tong cac nganh hang') {
        return false;
      }

      return true;
    });

    // 2. Find individual rows for Neptune, Simply, and Simply RBO
    const neptuneRow = list.find(row => row.nhomSanPham.toLowerCase().includes('neptune'));
    const simplyRow = list.find(row => 
      row.nhomSanPham.toLowerCase().includes('simply') && 
      !row.nhomSanPham.toLowerCase().includes('gạo lứt') && 
      !row.nhomSanPham.toLowerCase().includes('gao lut') && 
      !row.nhomSanPham.toLowerCase().includes('rbo')
    );
    const simplyRboRow = list.find(row => 
      row.nhomSanPham.toLowerCase().includes('gạo lứt') || 
      row.nhomSanPham.toLowerCase().includes('gao lut') || 
      row.nhomSanPham.toLowerCase().includes('rbo')
    );

    // 3. Recalculate "Cao Cấp" or "Tổng Cao Cấp" row if it exists
    const cap2025SL = (neptuneRow?.sanLuong2025 || 0) + (simplyRow?.sanLuong2025 || 0) + (simplyRboRow?.sanLuong2025 || 0);
    const cap2026SL = (neptuneRow?.sanLuong2026 || 0) + (simplyRow?.sanLuong2026 || 0) + (simplyRboRow?.sanLuong2026 || 0);
    const capSLChange = cap2026SL - cap2025SL;
    const capSLPct = cap2025SL !== 0 ? capSLChange / cap2025SL : 0;

    const cap2025DS = (neptuneRow?.doanhSo2025 || 0) + (simplyRow?.doanhSo2025 || 0) + (simplyRboRow?.doanhSo2025 || 0);
    const cap2026DS = (neptuneRow?.doanhSo2026 || 0) + (simplyRow?.doanhSo2026 || 0) + (simplyRboRow?.doanhSo2026 || 0);
    const capDSChange = cap2026DS - cap2025DS;
    const capDSPct = cap2025DS !== 0 ? capDSChange / cap2025DS : 0;

    list = list.map(row => {
      const norm = row.nhomSanPham.toLowerCase();
      if (norm === 'cao cấp' || norm === 'cao cap' || norm.includes('cao cấp') || norm.includes('cao cap')) {
        const sl2025 = (row.sanLuong2025 && row.sanLuong2025 !== 0) ? row.sanLuong2025 : cap2025SL;
        const sl2026 = (row.sanLuong2026 && row.sanLuong2026 !== 0) ? row.sanLuong2026 : cap2026SL;
        const slChange = sl2026 - sl2025;
        const slPct = sl2025 !== 0 ? (sl2026 / sl2025 - 1) : 0;

        const ds2025 = (row.doanhSo2025 && row.doanhSo2025 !== 0) ? row.doanhSo2025 : cap2025DS;
        const ds2026 = (row.doanhSo2026 && row.doanhSo2026 !== 0) ? row.doanhSo2026 : cap2026DS;
        const dsChange = ds2026 - ds2025;
        const dsPct = ds2025 !== 0 ? (ds2026 / ds2025 - 1) : 0;

        return {
          ...row,
          sanLuong2025: sl2025,
          sanLuong2026: sl2026,
          tangGiamSanLuong: slChange,
          tiLeTangTruongSanLuong: slPct,
          doanhSo2025: ds2025,
          doanhSo2026: ds2026,
          tangGiamDoanhSo: dsChange,
          tiLeTangTruongDoanhSo: dsPct
        };
      }
      return row;
    });

    // 4. Recalculate "TOTAL CLF" (or "Tổng CLF") row
    // TOTAL CLF is taken directly from the sheet's TOTAL CLF row if available with non-zero values, otherwise calculated as sum of all CLF groups
    const originalClfRow = growthData.find(row => {
      if (!row || !row.nhomSanPham) return false;
      const norm = row.nhomSanPham.trim().toLowerCase();
      return norm === 'total clf' || norm === 'tổng clf' || norm === 'tong clf' || norm.includes('total clf') || norm.includes('tổng clf');
    });

    const caoCapRow = list.find(row => {
      const norm = row.nhomSanPham.toLowerCase();
      return norm === 'cao cấp' || norm === 'cao cap' || norm.includes('cao cấp') || norm.includes('cao cap');
    });
    const trungCapRow = list.find(row => {
      const norm = row.nhomSanPham.toLowerCase();
      return norm === 'trung cấp' || norm === 'trung cap' || norm.includes('trung cấp') || norm.includes('trung cap');
    });
    const ngachRow = list.find(row => {
      const norm = row.nhomSanPham.toLowerCase();
      return norm === 'ngách' || norm === 'ngach' || norm.includes('ngách') || norm.includes('ngach');
    });
    const caiLanRow = list.find(row => {
      const norm = row.nhomSanPham.toLowerCase();
      return norm === 'thấp cấp' || norm === 'thap cap' || norm.includes('thấp cấp') || norm.includes('thap cap') || norm.includes('cái lân & orchid') || norm.includes('cai lan & orchid') || norm.includes('cái lân') || norm.includes('cai lan') || norm.includes('orchid');
    });
    const bpRow = list.find(row => {
      const norm = row.nhomSanPham.toLowerCase();
      return norm === 'bp' || norm === 'dầu đóng gói lớn (bp)' || norm === 'đóng gói lớn (bp)' || norm.includes('đóng gói lớn') || norm.includes('dong goi lon') || norm.includes('(bp)') || norm === 'dầu đóng gói lớn' || (norm.includes('bp') && !norm.includes('mcc') && !norm.includes('ndfc'));
    });

    const sumOfClfPartsSL2025 = (caoCapRow?.sanLuong2025 || 0) + (trungCapRow?.sanLuong2025 || 0) + (ngachRow?.sanLuong2025 || 0) + (caiLanRow?.sanLuong2025 || 0) + (bpRow?.sanLuong2025 || 0);
    const sumOfClfPartsSL2026 = (caoCapRow?.sanLuong2026 || 0) + (trungCapRow?.sanLuong2026 || 0) + (ngachRow?.sanLuong2026 || 0) + (caiLanRow?.sanLuong2026 || 0) + (bpRow?.sanLuong2026 || 0);

    const sumOfClfPartsDS2025 = (caoCapRow?.doanhSo2025 || 0) + (trungCapRow?.doanhSo2025 || 0) + (ngachRow?.doanhSo2025 || 0) + (caiLanRow?.doanhSo2025 || 0) + (bpRow?.doanhSo2025 || 0);
    const sumOfClfPartsDS2026 = (caoCapRow?.doanhSo2026 || 0) + (trungCapRow?.doanhSo2026 || 0) + (ngachRow?.doanhSo2026 || 0) + (caiLanRow?.doanhSo2026 || 0) + (bpRow?.doanhSo2026 || 0);

    const clf2025SL = (originalClfRow && originalClfRow.sanLuong2025 && originalClfRow.sanLuong2025 !== 0) 
      ? originalClfRow.sanLuong2025 
      : sumOfClfPartsSL2025;
    const clf2026SL = (originalClfRow && originalClfRow.sanLuong2026 && originalClfRow.sanLuong2026 !== 0) 
      ? originalClfRow.sanLuong2026 
      : sumOfClfPartsSL2026;
    const clfSLChange = (originalClfRow && originalClfRow.tangGiamSanLuong !== undefined && originalClfRow.tangGiamSanLuong !== 0)
      ? originalClfRow.tangGiamSanLuong
      : (clf2026SL - clf2025SL);
    const clfSLPct = clf2025SL !== 0 ? (clf2026SL / clf2025SL - 1) : 0;

    const clf2025DS = (originalClfRow && originalClfRow.doanhSo2025 && originalClfRow.doanhSo2025 !== 0) 
      ? originalClfRow.doanhSo2025 
      : sumOfClfPartsDS2025;
    const clf2026DS = (originalClfRow && originalClfRow.doanhSo2026 && originalClfRow.doanhSo2026 !== 0) 
      ? originalClfRow.doanhSo2026 
      : sumOfClfPartsDS2026;
    const clfDSChange = (originalClfRow && originalClfRow.tangGiamDoanhSo !== undefined && originalClfRow.tangGiamDoanhSo !== 0)
      ? originalClfRow.tangGiamDoanhSo
      : (clf2026DS - clf2025DS);
    const clfDSPct = clf2025DS !== 0 ? (clf2026DS / clf2025DS - 1) : 0;

    list = list.map(row => {
      const norm = row.nhomSanPham.toLowerCase().trim();
      if (norm === 'total clf' || norm === 'tổng clf' || norm === 'tong clf' || norm.includes('total clf') || norm.includes('tổng clf')) {
        return {
          ...row,
          sanLuong2025: clf2025SL,
          sanLuong2026: clf2026SL,
          tangGiamSanLuong: clfSLChange,
          tiLeTangTruongSanLuong: clfSLPct,
          doanhSo2025: clf2025DS,
          doanhSo2026: clf2026DS,
          tangGiamDoanhSo: clfDSChange,
          tiLeTangTruongDoanhSo: clfDSPct
        };
      }
      return row;
    });

    // Enforce uniform formula: 2026 / 2025 - 1 for all product groups and children
    list = list.map(row => {
      const sl2025 = row.sanLuong2025 || 0;
      const sl2026 = row.sanLuong2026 || 0;
      const tangGiamSL = row.tangGiamSanLuong !== undefined && row.tangGiamSanLuong !== 0 
        ? row.tangGiamSanLuong 
        : (sl2026 - sl2025);
      const tiLeSL = sl2025 !== 0 ? ((sl2026 / sl2025) - 1) : 0;

      const ds2025 = row.doanhSo2025 || 0;
      const ds2026 = row.doanhSo2026 || 0;
      const tangGiamDS = row.tangGiamDoanhSo !== undefined && row.tangGiamDoanhSo !== 0 
        ? row.tangGiamDoanhSo 
        : (ds2026 - ds2025);
      const tiLeDS = ds2025 !== 0 ? ((ds2026 / ds2025) - 1) : 0;

      return {
        ...row,
        sanLuong2025: sl2025,
        sanLuong2026: sl2026,
        tangGiamSanLuong: tangGiamSL,
        tiLeTangTruongSanLuong: tiLeSL,
        doanhSo2025: ds2025,
        doanhSo2026: ds2026,
        tangGiamDoanhSo: tangGiamDS,
        tiLeTangTruongDoanhSo: tiLeDS
      };
    });

    // 5. Group the rows so that Parent Rows come immediately BEFORE their Children,
    // ensuring they expand downwards and slide below the parent!
    const orderedList: GrowthRow[] = [];
    const processedIndices = new Set<number>();

    list.forEach((row, idx) => {
      if (processedIndices.has(idx)) return;
      
      const normParentKey = normalizeGroupNameForCollapse(row.nhomSanPham);
      const isParent = parentGroups.includes(normParentKey);
      
      if (isParent) {
        // This is a parent row!
        orderedList.push(row);
        processedIndices.add(idx);
        
        // Find and add all children of this parent group in original sequence
        list.forEach((subRow, subIdx) => {
          if (processedIndices.has(subIdx)) return;
          const parentOfSub = getParentGroup(subRow.nhomSanPham);
          if (parentOfSub === normParentKey) {
            orderedList.push(subRow);
            processedIndices.add(subIdx);
          }
        });
      } else {
        // Check if this row is a child whose parent is NOT yet processed but exists in the list.
        const parentOfRow = getParentGroup(row.nhomSanPham);
        if (parentOfRow) {
          const parentExists = list.some(r => normalizeGroupNameForCollapse(r.nhomSanPham) === parentOfRow);
          if (parentExists) {
            // Skip for now, parent will pull it down
            return;
          }
        }
        
        orderedList.push(row);
        processedIndices.add(idx);
      }
    });

    // Make sure we didn't miss any rows
    list.forEach((row, idx) => {
      if (!processedIndices.has(idx)) {
        orderedList.push(row);
      }
    });

    return orderedList;
  }, [growthData]);

  const handleOpenSectorTargetDetail = (sectorKey: string) => {
    setSelectedTargetDetail({
      title: `Chi Tiết Thực Hiện Chỉ Tiêu Ngành Hàng ${sectorKey}`,
      sectorKey
    });
    setModalSearchTerm('');
    setModalSortField('none');
    setModalSortOrder('desc');
  };

  const handleOpenSubgroupTargetDetail = (groupName: string, sector: 'CLF' | 'MCC' | 'NDFC') => {
    let targetCol = '';
    let actualCol = '';
    let fallbackKey = '';
    let compositeParts: { targetCol: string; actualCol: string; fallbackKey: string }[] | undefined = undefined;

    if (sector === 'CLF') {
      if (groupName.includes('Neptune')) {
        targetCol = 'I'; actualCol = 'J'; fallbackKey = 'CLF_I_J';
      } else if (groupName.includes('Simply') && !groupName.includes('Gạo Lứt')) {
        targetCol = 'O'; actualCol = 'P'; fallbackKey = 'CLF_O_P';
      } else if (groupName.includes('Tổng Cao Cấp')) {
        compositeParts = [
          { targetCol: 'I', actualCol: 'J', fallbackKey: 'CLF_I_J' }, // Neptune
          { targetCol: 'O', actualCol: 'P', fallbackKey: 'CLF_O_P' }  // Simply
        ];
      } else if (groupName.includes('Simply Dầu Gạo Lứt') || groupName.includes('Gạo Lứt')) {
        targetCol = 'T'; actualCol = 'U'; fallbackKey = 'CLF_T_U';
      } else if (groupName.includes('Meizan Gold')) {
        targetCol = 'Y'; actualCol = 'Z'; fallbackKey = 'CLF_Y_Z';
      } else if (groupName.includes('Meizan SBO')) {
        targetCol = 'AD'; actualCol = 'AE'; fallbackKey = 'CLF_AD_AE';
      } else if (groupName.includes('Tổng Trung Cấp')) {
        compositeParts = [
          { targetCol: 'Y', actualCol: 'Z', fallbackKey: 'CLF_Y_Z' },
          { targetCol: 'AD', actualCol: 'AE', fallbackKey: 'CLF_AD_AE' }
        ];
      } else if (groupName.includes('Bơ')) {
        targetCol = 'AI'; actualCol = 'AJ'; fallbackKey = 'CLF_AI_AJ';
      } else if (groupName.includes('Dầu Mè') || groupName.includes('dầu mè')) {
        targetCol = 'AX'; actualCol = 'AY'; fallbackKey = 'CLF_AX_AY';
      } else if (groupName.includes('Kiddy Olive') || groupName.includes('kiddy')) {
        targetCol = 'AS'; actualCol = 'AT'; fallbackKey = 'CLF_AS_AT';
      } else if (groupName.includes('Olivoila')) {
        targetCol = 'AN'; actualCol = 'AO'; fallbackKey = 'CLF_AN_AO';
      } else if (groupName.includes('Tổng Sản Phẩm Ngách')) {
        compositeParts = [
          { targetCol: 'AI', actualCol: 'AJ', fallbackKey: 'CLF_AI_AJ' },
          { targetCol: 'AX', actualCol: 'AY', fallbackKey: 'CLF_AX_AY' },
          { targetCol: 'AS', actualCol: 'AT', fallbackKey: 'CLF_AS_AT' },
          { targetCol: 'AN', actualCol: 'AO', fallbackKey: 'CLF_AN_AO' }
        ];
      } else if (groupName.includes('Cái Lân')) {
        targetCol = 'BH'; actualCol = 'BI'; fallbackKey = 'CLF_BH_BI';
      } else if (groupName.includes('Tổng Dầu Đóng Gói Nhỏ')) {
        compositeParts = [
          { targetCol: 'I', actualCol: 'J', fallbackKey: 'CLF_I_J' }, // Neptune
          { targetCol: 'O', actualCol: 'P', fallbackKey: 'CLF_O_P' }, // Simply
          { targetCol: 'T', actualCol: 'U', fallbackKey: 'CLF_T_U' }, // Simply RBO
          { targetCol: 'Y', actualCol: 'Z', fallbackKey: 'CLF_Y_Z' },
          { targetCol: 'AD', actualCol: 'AE', fallbackKey: 'CLF_AD_AE' },
          { targetCol: 'AI', actualCol: 'AJ', fallbackKey: 'CLF_AI_AJ' },
          { targetCol: 'AX', actualCol: 'AY', fallbackKey: 'CLF_AX_AY' },
          { targetCol: 'AS', actualCol: 'AT', fallbackKey: 'CLF_AS_AT' },
          { targetCol: 'AN', actualCol: 'AO', fallbackKey: 'CLF_AN_AO' },
          { targetCol: 'BH', actualCol: 'BI', fallbackKey: 'CLF_BH_BI' }
        ];
      } else if (groupName.includes('Tổng Dầu Đóng Gói Lớn')) {
        targetCol = 'BR'; actualCol = 'BS'; fallbackKey = 'CLF_BR_BS';
      }
    } else if (sector === 'MCC') {
      if (groupName.includes('Bột') || groupName.includes('bot') || groupName.includes('Mì')) {
        targetCol = 'I'; actualCol = 'J'; fallbackKey = 'MCC_I_J';
      } else if (groupName.includes('Các Sản Phẩm Khác') || groupName.includes('sản phẩm khác') || groupName.includes('san pham khac')) {
        targetCol = 'O'; actualCol = 'P'; fallbackKey = 'MCC_O_P';
      }
    } else if (sector === 'NDFC') {
      const lowerName = groupName.toLowerCase();
      if (lowerName.includes('xốt') || lowerName.includes('sốt') || lowerName.includes('tương xốt')) {
        targetCol = 'O'; actualCol = 'P'; fallbackKey = 'NDFC_O_P';
      } else if (lowerName.includes('nước tương') || lowerName.includes('tương')) {
        targetCol = 'I'; actualCol = 'J'; fallbackKey = 'NDFC_I_J';
      } else if (lowerName.includes('nêm') || lowerName.includes('hạt nêm')) {
        targetCol = 'T'; actualCol = 'U'; fallbackKey = 'NDFC_T_U';
      } else if (lowerName.includes('ngọt') || lowerName.includes('bột ngọt')) {
        targetCol = 'Y'; actualCol = 'Z'; fallbackKey = 'NDFC_Y_Z';
      }
    }

    setSelectedTargetDetail({
      title: `Chi Tiết Thực Hiện Chỉ Tiêu Nhóm Sản Phẩm ${groupName.replace(/^\d+[\.\-\s]+\s*/, '')}`,
      sector,
      targetCol,
      actualCol,
      fallbackKey,
      compositeParts
    });
    setModalSearchTerm('');
    setModalSortField('none');
    setModalSortOrder('desc');
  };

  const toggleModalSort = (field: 'name' | 'target' | 'actual' | 'completionRate' | 'conThieu' | 'soThungCanBan' | 'soThungT7') => {
    if (modalSortField === field) {
      setModalSortOrder(modalSortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setModalSortField(field);
      setModalSortOrder('desc');
    }
  };

  const sumDetailedColumnsForEmployee = (
    rows: any[] | undefined,
    targetCol: string,
    actualCol: string,
    fallbackKey: string,
    empName: string
  ): { target: number; actual: number } => {
    let targetSum = 0;
    let actualSum = 0;
    let hasMatchingRow = false;

    if (rows && rows.length > 0) {
      rows.forEach(row => {
        if (matchesEmployee(row, empName)) {
          const itemEmp = getRowEmployeeName(row);
          if (
            itemEmp &&
            !itemEmp.toLowerCase().includes('tổng cộng') &&
            !itemEmp.toLowerCase().includes('total') &&
            !itemEmp.toLowerCase().includes('tên nhân viên') &&
            !itemEmp.toLowerCase().startsWith('tổng') &&
            !itemEmp.toLowerCase().startsWith('tong')
          ) {
             hasMatchingRow = true;
            targetSum += parseValueFromString(row[targetCol]);
            actualSum += parseValueFromString(row[actualCol]);
          }
        }
      });
    }

    if (!hasMatchingRow) {
      const mockBaseByCol: { [key: string]: { target: number, actual: number } } = {
        'CLF_I_J': { target: 120, actual: 115 }, // Neptune
        'CLF_O_P': { target: 100, actual: 92 },  // Simply
        'CLF_BC_BD': { target: 220, actual: 207 }, // Tổng Cao Cấp
        'CLF_T_U': { target: 40, actual: 38 },   // Simply gạo lứt
        'CLF_Y_Z': { target: 80, actual: 75 },   // Meizan Gold
        'CLF_AD_AE': { target: 60, actual: 54 }, // Meizan SBO
        'CLF_AI_AJ': { target: 15, actual: 12 }, // Bơ
        'CLF_AX_AY': { target: 10, actual: 9 },  // Dầu mè
        'CLF_AS_AT': { target: 8, actual: 7.8 }, // Kiddy Olive
        'CLF_AN_AO': { target: 12, actual: 10.5 }, // Olivoila
        'CLF_BH_BI': { target: 50, actual: 48 },  // Cái Lân & Orchid SP
        'CLF_BR_BS': { target: 30, actual: 28 },  // Dầu Đóng Gói Lớn
        'MCC_I_J': { target: 120, actual: 110 }, // Nhóm Bột
        'MCC_O_P': { target: 110, actual: 100 }, // Các sản phẩm khác
        'NDFC_I_J': { target: 80, actual: 75 },   // Nước Tương
        'NDFC_O_P': { target: 60, actual: 55 },   // Tương Xốt
        'NDFC_T_U': { target: 40, actual: 38 },   // Hạt Nêm
        'NDFC_Y_Z': { target: 30, actual: 28 },   // Bột Ngọt
      };

      const base = mockBaseByCol[fallbackKey];
      if (base) {
        const hash = empName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const factor = 0.8 + (hash % 50) / 100;
        return {
          target: Math.round(base.target * factor),
          actual: parseFloat((base.actual * factor).toFixed(1)),
        };
      }
    }

    return { target: targetSum, actual: actualSum };
  };

  const getEmployeeValueForTargetDetail = (
    employeeName: string,
    detail: {
      title: string;
      sectorKey?: string;
      sector?: 'CLF' | 'MCC' | 'NDFC';
      targetCol?: string;
      actualCol?: string;
      fallbackKey?: string;
      compositeParts?: { targetCol: string; actualCol: string; fallbackKey: string }[];
    }
  ): { target: number; actual: number } => {
    // 1. Sector level
    if (detail.sectorKey) {
      if (sectorData && sectorData[employeeName] && sectorData[employeeName][detail.sectorKey]) {
        return {
          target: sectorData[employeeName][detail.sectorKey].target,
          actual: sectorData[employeeName][detail.sectorKey].actual,
        };
      }
      const filteredTx = transactions.filter(
        (tx) => tx.NganhHang === detail.sectorKey && matchesEmployee({ NhanVien: tx.NhanVien }, employeeName)
      );
      const actualSum = filteredTx.reduce((sum, tx) => sum + (tx.DoanhSo || 0), 0);
      return { target: 0, actual: actualSum };
    }

    // 2. Individual sub-column subgroup level
    if (detail.targetCol && detail.actualCol && detail.fallbackKey && detail.sector) {
      const rows =
        detail.sector === 'CLF'
          ? clfDetailedRows
          : detail.sector === 'MCC'
          ? mccDetailedRows
          : ndfcDetailedRows;
      return sumDetailedColumnsForEmployee(rows, detail.targetCol, detail.actualCol, detail.fallbackKey, employeeName);
    }

    // 3. Composite subgroup level
    if (detail.compositeParts && detail.sector) {
      const rows =
        detail.sector === 'CLF'
          ? clfDetailedRows
          : detail.sector === 'MCC'
          ? mccDetailedRows
          : ndfcDetailedRows;
      let totalTarget = 0;
      let totalActual = 0;
      detail.compositeParts.forEach((part) => {
        const valueObj = sumDetailedColumnsForEmployee(rows, part.targetCol, part.actualCol, part.fallbackKey, employeeName);
        totalTarget += valueObj.target;
        totalActual += valueObj.actual;
      });
      return { target: totalTarget, actual: totalActual };
    }

    return { target: 0, actual: 0 };
  };

  const isBotNgotDetail = selectedTargetDetail && selectedTargetDetail.title && (
    selectedTargetDetail.title.toLowerCase().includes('bột ngọt') ||
    selectedTargetDetail.title.toLowerCase().includes('bot ngot')
  );

  // Extract modal unique employee names and preparation metrics
  const modalEmployees = employees
    .map(e => e.name)
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '' && !name.toLowerCase().includes('tổng') && !name.toLowerCase().includes('total') && !name.toLowerCase().includes('tên nhân viên') && !name.toLowerCase().includes('total/tổng'));
  
  const uniqueModalEmployeeNames = Array.from(new Set(modalEmployees));

  const getModalDensity = (detail: { title: string; sectorKey?: string }): number => {
    if (detail.sectorKey) {
      return SECTOR_DENSITY_MAP[detail.sectorKey] || 0.01;
    }
    const title = detail.title || '';
    if (title.includes('Bơ')) return 0.0096;
    if (title.includes('Dầu Mè') || title.includes('Kiddy') || title.includes('Olivoila')) return 0.0027;
    if (title.includes('Đóng Gói Lớn') || title.includes('BP')) return 0.018;
    if (title.includes('Sản Phẩm Ngách')) return 0.0096;
    if (title.includes('Các Sản Phẩm Khác')) return 0.005;
    if (title.includes('Tương Xốt')) return 0.0126;
    if (title.includes('Hạt Nêm')) return 0.010;
    if (title.includes('Nước Tương') || title.includes('Bột Ngọt')) return 0.012;
    if (title.includes('Nhóm Bột')) return 0.01;
    return 0.01092;
  };

  const preparedModalData = selectedTargetDetail 
    ? uniqueModalEmployeeNames.map(empName => {
        const { target, actual } = getEmployeeValueForTargetDetail(empName, selectedTargetDetail);
        let completionRate = target > 0 ? (actual / target) * 100 : 0;
        if (target > 0 && actual < target) {
          completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
        }
        const conThieu = target - actual;
        
        const density = getModalDensity(selectedTargetDetail);
        const soThungCanBan = conThieu > 0 
          ? Math.ceil(conThieu / density) 
          : conThieu < 0 
            ? -Math.ceil(Math.abs(conThieu) / density) 
            : 0;

        let soThungT7 = 0;
        if (isBotNgotDetail && ndfcDetailedRows) {
          const match = ndfcDetailedRows.find(r => {
            const physIdx = r._physicalRowIndex;
            if (physIdx < 39 || physIdx > 46) return false;
            
            // Robust matching: check if any cell value matches the employee name
            const rowKeys = Object.keys(r);
            const matchesAnyCol = rowKeys.some(k => {
              if (k === '_detectedSector' || k === '_physicalRowIndex' || k === 'AA') return false;
              const val = r[k];
              if (!val || typeof val !== 'string') return false;
              
              const clean = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
              const c1 = clean(val);
              const c2 = clean(empName);
              if (!c1 || !c2) return false;
              return c1 === c2 || (c1.length >= 4 && c2.length >= 4 && (c1.includes(c2) || c2.includes(c1)));
            });
            
            if (matchesAnyCol) return true;
            return matchesEmployee(r, empName);
          });
          if (match) {
            const val = match['AA'];
            if (val !== null && val !== undefined) {
              if (typeof val === 'number') {
                soThungT7 = val;
              } else {
                const cleaned = String(val).replace(/[^0-9.-]/g, '');
                soThungT7 = parseFloat(cleaned) || 0;
              }
            }
          }
        }

        return {
          name: empName,
          target,
          actual,
          completionRate,
          conThieu,
          soThungCanBan,
          soThungT7
        };
      })
    : [];

  const filteredModalData = preparedModalData.filter(item => 
    item.name.toLowerCase().includes(modalSearchTerm.toLowerCase())
  );

  const sortedModalData = [...filteredModalData].sort((a, b) => {
    const valA = a[modalSortField];
    const valB = b[modalSortField];

    if (modalSortField === 'name') {
      return modalSortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB), 'vi') 
        : String(valB).localeCompare(String(valA), 'vi');
    }

    const numA = typeof valA === 'number' ? valA : 0;
    const numB = typeof valB === 'number' ? valB : 0;
    return modalSortOrder === 'asc' ? numA - numB : numB - numA;
  });

  const isClfExpanded = !!expandedSectors['CLF'];
  const isMccExpanded = !!expandedSectors['MCC'];
  const isNdfcExpanded = !!expandedSectors['NDFC'];

  const sumDetailedColumns = (
    rows: any[] | undefined,
    targetCol: string,
    actualCol: string,
    fallbackKey: string
  ): { target: number, actual: number } => {
    let targetSum = 0;
    let actualSum = 0;
    let hasMatchingRow = false;

    let resolvedTargetCol = targetCol;
    let resolvedActualCol = actualCol;

    if (rows && rows.length > 0) {
      // Find keys from the first row that has keys to match dynamically
      const firstRow = rows[0];
      if (firstRow) {
        const keys = Object.keys(firstRow);
        const hasExactCol = keys.includes(targetCol);
        if (!hasExactCol) {
          const searchKeywords: { [key: string]: { brand: string[], targetKeywords: string[], actualKeywords: string[] } } = {
            'CLF_I_J': { brand: ['neptune'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_O_P': { brand: ['simply'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_T_U': { brand: ['simply gao lut', 'gao lut'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_Y_Z': { brand: ['meizan gold', 'meizan_gold'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AD_AE': { brand: ['meizan sbo', 'meizan bơ', 'meizan bo'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AI_AJ': { brand: ['bơ', 'bo'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AX_AY': { brand: ['dau me', ' dầu mè', 'me'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AS_AT': { brand: ['kiddy'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AN_AO': { brand: ['olivoila'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_BH_BI': { brand: ['cai lan', 'orchid'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_BR_BS': { brand: ['lon'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
          };

          const config = searchKeywords[fallbackKey];
          if (config) {
            const cleanStr = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
            
            // Look for target key
            const matchedTargetKey = keys.find(k => {
              const kClean = cleanStr(k);
              const hasBrand = config.brand.some(b => kClean.includes(cleanStr(b)));
              const hasTarget = config.targetKeywords.some(tk => kClean.includes(tk));
              const isActual = config.actualKeywords.some(ak => kClean.includes(ak));
              return hasBrand && hasTarget && !isActual;
            });

            // Look for actual key
            const matchedActualKey = keys.find(k => {
              const kClean = cleanStr(k);
              const hasBrand = config.brand.some(b => kClean.includes(cleanStr(b)));
              const hasActual = config.actualKeywords.some(ak => kClean.includes(ak));
              return hasBrand && hasActual;
            });

            if (matchedTargetKey) resolvedTargetCol = matchedTargetKey;
            if (matchedActualKey) resolvedActualCol = matchedActualKey;
          }
        }
      }

      rows.forEach(row => {
        if (matchesEmployee(row, employeeNameFilter)) {
          const empName = getRowEmployeeName(row);
          if (
            empName &&
            !empName.toLowerCase().includes('tổng cộng') &&
            !empName.toLowerCase().includes('total') &&
            !empName.toLowerCase().includes('tên nhân viên') &&
            !empName.toLowerCase().startsWith('tổng') &&
            !empName.toLowerCase().startsWith('tong')
          ) {
            hasMatchingRow = true;
            // Parse numerical values safely from the exact column letters or resolved header names!
            targetSum += parseValueFromString(row[resolvedTargetCol]);
            actualSum += parseValueFromString(row[resolvedActualCol]);
          }
        }
      });
    }

    if (!hasMatchingRow) {
      const mockBaseByCol: { [key: string]: { target: number, actual: number } } = {
        'CLF_I_J': { target: 120, actual: 115 }, // Neptune
        'CLF_O_P': { target: 100, actual: 92 },  // Simply
        'CLF_BC_BD': { target: 220, actual: 207 }, // Tổng Cao Cấp
        'CLF_T_U': { target: 40, actual: 38 },   // Simply gạo lứt
        'CLF_Y_Z': { target: 80, actual: 75 },   // Meizan Gold
        'CLF_AD_AE': { target: 60, actual: 54 }, // Meizan SBO
        'CLF_AI_AJ': { target: 15, actual: 12 }, // Bơ
        'CLF_AX_AY': { target: 10, actual: 9 },  // Dầu mè
        'CLF_AS_AT': { target: 8, actual: 7.8 }, // Kiddy Olive
        'CLF_AN_AO': { target: 12, actual: 10.5 }, // Olivoila
        'CLF_BH_BI': { target: 50, actual: 48 },  // Cái Lân & Orchid SP
        'CLF_BR_BS': { target: 30, actual: 28 },  // Dầu Đóng Gói Lớn

        'MCC_I_J': { target: 120, actual: 110 }, // Nhóm Bột
        'MCC_O_P': { target: 110, actual: 100 }, // Các sản phẩm khác

        'NDFC_I_J': { target: 80, actual: 75 },   // Nước Tương
        'NDFC_O_P': { target: 60, actual: 55 },   // Tương Xốt
        'NDFC_T_U': { target: 40, actual: 38 },   // Hạt Nêm
        'NDFC_Y_Z': { target: 30, actual: 28 },   // Bột Ngọt
      };

      const base = mockBaseByCol[fallbackKey];
      if (base) {
        const mult = employeeNameFilter === 'Tất cả' ? employees.length : 1;
        const empFactor = employeeNameFilter === 'Trần Thị Bình' ? 1.08 : (employeeNameFilter === 'Nguyễn Văn An' ? 0.92 : 1.0);
        return {
          target: base.target * mult,
          actual: parseFloat((base.actual * mult * empFactor).toFixed(2))
        };
      }
    }

    return { target: targetSum, actual: actualSum };
  };

  const getProductGroupsData = () => {
    const neptune = sumDetailedColumns(clfDetailedRows, 'I', 'J', 'CLF_I_J');
    const simply = sumDetailedColumns(clfDetailedRows, 'O', 'P', 'CLF_O_P');
    const simplyGaoLut = sumDetailedColumns(clfDetailedRows, 'T', 'U', 'CLF_T_U');
    
    const tongCaoCap = {
      target: neptune.target + simply.target,
      actual: neptune.actual + simply.actual
    };
    
    const meizanGold = sumDetailedColumns(clfDetailedRows, 'Y', 'Z', 'CLF_Y_Z');
    const meizanSbo = sumDetailedColumns(clfDetailedRows, 'AD', 'AE', 'CLF_AD_AE');
    const tongTrungCap = { target: meizanGold.target + meizanSbo.target, actual: meizanGold.actual + meizanSbo.actual };
    
    const bo = sumDetailedColumns(clfDetailedRows, 'AI', 'AJ', 'CLF_AI_AJ');
    const dauMe = sumDetailedColumns(clfDetailedRows, 'AX', 'AY', 'CLF_AX_AY');
    const kiddyOlive = sumDetailedColumns(clfDetailedRows, 'AS', 'AT', 'CLF_AS_AT');
    const olivoila = sumDetailedColumns(clfDetailedRows, 'AN', 'AO', 'CLF_AN_AO');
    const tongSanPhamNgach = {
      target: bo.target + dauMe.target + kiddyOlive.target + olivoila.target,
      actual: bo.actual + dauMe.actual + kiddyOlive.actual + olivoila.actual
    };

    const caiLanOrchid = sumDetailedColumns(clfDetailedRows, 'BH', 'BI', 'CLF_BH_BI');

    const tongDauDongGoiNho = {
      target: tongCaoCap.target + simplyGaoLut.target + tongTrungCap.target + tongSanPhamNgach.target + caiLanOrchid.target,
      actual: tongCaoCap.actual + simplyGaoLut.actual + tongTrungCap.actual + tongSanPhamNgach.actual + caiLanOrchid.actual
    };

    const dauDongGoiLon = sumDetailedColumns(clfDetailedRows, 'BR', 'BS', 'CLF_BR_BS');

    // Calculate individual soThungCanBan using rounding up (support negative when overachieved)
    const calcThung = (conThieu: number, density: number) => {
      if (conThieu > 0) return Math.ceil(conThieu / density);
      if (conThieu < 0) return -Math.ceil(Math.abs(conThieu) / density);
      return 0;
    };

    const neptuneConThieu = neptune.target - neptune.actual;
    const neptuneThung = calcThung(neptuneConThieu, 0.01092);

    const simplyConThieu = simply.target - simply.actual;
    const simplyThung = calcThung(simplyConThieu, 0.01092);

    const simplyGaoLutConThieu = simplyGaoLut.target - simplyGaoLut.actual;
    const simplyGaoLutThung = calcThung(simplyGaoLutConThieu, 0.01092);

    const meizanGoldConThieu = meizanGold.target - meizanGold.actual;
    const meizanGoldThung = calcThung(meizanGoldConThieu, 0.01092);

    const meizanSboConThieu = meizanSbo.target - meizanSbo.actual;
    const meizanSboThung = calcThung(meizanSboConThieu, 0.01092);

    const boConThieu = bo.target - bo.actual;
    const boThung = calcThung(boConThieu, 0.0096);

    const dauMeConThieu = dauMe.target - dauMe.actual;
    const dauMeThung = calcThung(dauMeConThieu, 0.0027);

    const kiddyOliveConThieu = kiddyOlive.target - kiddyOlive.actual;
    const kiddyOliveThung = calcThung(kiddyOliveConThieu, 0.0027);

    const olivoilaConThieu = olivoila.target - olivoila.actual;
    const olivoilaThung = calcThung(olivoilaConThieu, 0.0027);

    const caiLanOrchidConThieu = caiLanOrchid.target - caiLanOrchid.actual;
    const caiLanOrchidThung = calcThung(caiLanOrchidConThieu, 0.01092);

    const dauDongGoiLonConThieu = dauDongGoiLon.target - dauDongGoiLon.actual;
    const dauDongGoiLonThung = calcThung(dauDongGoiLonConThieu, 0.018);

    // Derived sums
    const tongCaoCapThung = neptuneThung + simplyThung;
    const tongTrungCapThung = meizanGoldThung + meizanSboThung;

    const tongSanPhamNgachConThieu = tongSanPhamNgach.target - tongSanPhamNgach.actual;
    const tongSanPhamNgachThung = calcThung(tongSanPhamNgachConThieu, 0.0096);

    const tongDauDongGoiNhoConThieu = tongDauDongGoiNho.target - tongDauDongGoiNho.actual;
    const tongDauDongGoiNhoThung = calcThung(tongDauDongGoiNhoConThieu, 0.01092);

    const list = [
      { name: 'Neptune', ...neptune, isComp: false, soThungCanBan: neptuneThung },
      { name: 'Simply', ...simply, isComp: false, soThungCanBan: simplyThung },
      { name: 'Tổng Cao Cấp', ...tongCaoCap, isComp: true, soThungCanBan: tongCaoCapThung },
      { name: 'Simply Dầu Gạo Lứt', ...simplyGaoLut, isComp: false, soThungCanBan: simplyGaoLutThung },
      { name: 'Meizan Gold', ...meizanGold, isComp: false, soThungCanBan: meizanGoldThung },
      { name: 'Meizan SBO', ...meizanSbo, isComp: false, soThungCanBan: meizanSboThung },
      { name: 'Tổng Trung Cấp', ...tongTrungCap, isComp: true, soThungCanBan: tongTrungCapThung },
      { name: 'Bơ', ...bo, isComp: false, soThungCanBan: boThung },
      { name: 'Dầu Mè', ...dauMe, isComp: false, soThungCanBan: dauMeThung },
      { name: 'Kiddy Olive', ...kiddyOlive, isComp: false, soThungCanBan: kiddyOliveThung },
      { name: 'Olivoila', ...olivoila, isComp: false, soThungCanBan: olivoilaThung },
      { name: 'Tổng Sản Phẩm Ngách', ...tongSanPhamNgach, isComp: true, soThungCanBan: tongSanPhamNgachThung },
      { name: 'Cái Lân & Orchid SP', ...caiLanOrchid, isComp: false, soThungCanBan: caiLanOrchidThung },
      { name: 'Tổng Dầu Đóng Gói Nhỏ', ...tongDauDongGoiNho, isComp: true, soThungCanBan: tongDauDongGoiNhoThung },
      { name: 'Tổng Dầu Đóng Gói Lớn (BP)', ...dauDongGoiLon, isComp: true, soThungCanBan: dauDongGoiLonThung }
    ];

    return list.map(item => {
      let completionRate = item.target > 0 ? (item.actual / item.target) * 100 : 0;
      if (item.target > 0 && item.actual < item.target) {
        completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
      }
      const conThieu = item.target - item.actual;
      return {
        ...item,
        completionRate,
        conThieu
      };
    });
  };

  const getMccGroupsData = () => {
    const nhomBot = sumDetailedColumns(mccDetailedRows, 'I', 'J', 'MCC_I_J');
    const sanPhamKhac = sumDetailedColumns(mccDetailedRows, 'O', 'P', 'MCC_O_P');

    const calcThung = (conThieu: number, density: number) => {
      if (conThieu > 0) return Math.ceil(conThieu / density);
      if (conThieu < 0) return -Math.ceil(Math.abs(conThieu) / density);
      return 0;
    };

    const nhomBotConThieu = nhomBot.target - nhomBot.actual;
    const nhomBotThung = calcThung(nhomBotConThieu, 0.01);

    const sanPhamKhacConThieu = sanPhamKhac.target - sanPhamKhac.actual;
    const sanPhamKhacThung = calcThung(sanPhamKhacConThieu, 0.005);

    const list = [
      { name: 'Nhóm Bột', ...nhomBot, isComp: false, soThungCanBan: nhomBotThung },
      { name: 'Các Sản Phẩm Khác', ...sanPhamKhac, isComp: false, soThungCanBan: sanPhamKhacThung },
    ];

    return list.map(item => {
      let completionRate = item.target > 0 ? (item.actual / item.target) * 100 : 0;
      if (item.target > 0 && item.actual < item.target) {
        completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
      }
      const conThieu = item.target - item.actual;
      return {
        ...item,
        completionRate,
        conThieu
      };
    });
  };

  const getNdfcGroupsData = () => {
    const nuocTuong = sumDetailedColumns(ndfcDetailedRows, 'I', 'J', 'NDFC_I_J');
    const tuongXot = sumDetailedColumns(ndfcDetailedRows, 'O', 'P', 'NDFC_O_P');
    const hatNem = sumDetailedColumns(ndfcDetailedRows, 'T', 'U', 'NDFC_T_U');
    const botNgot = sumDetailedColumns(ndfcDetailedRows, 'Y', 'Z', 'NDFC_Y_Z');

    const calcThung = (conThieu: number, density: number) => {
      if (conThieu > 0) return Math.ceil(conThieu / density);
      if (conThieu < 0) return -Math.ceil(Math.abs(conThieu) / density);
      return 0;
    };

    const nuocTuongConThieu = nuocTuong.target - nuocTuong.actual;
    const nuocTuongThung = calcThung(nuocTuongConThieu, 0.012);

    const tuongXotConThieu = tuongXot.target - tuongXot.actual;
    const tuongXotThung = calcThung(tuongXotConThieu, 0.0126);

    const hatNemConThieu = hatNem.target - hatNem.actual;
    const hatNemThung = calcThung(hatNemConThieu, 0.010);

    const botNgotConThieu = botNgot.target - botNgot.actual;
    const botNgotThung = calcThung(botNgotConThieu, 0.012);

    const list = [
      { name: 'Nước Tương', ...nuocTuong, isComp: false, soThungCanBan: nuocTuongThung },
      { name: 'Tương Xốt', ...tuongXot, isComp: false, soThungCanBan: tuongXotThung },
      { name: 'Hạt Nêm', ...hatNem, isComp: false, soThungCanBan: hatNemThung },
      { name: 'Bột Ngọt', ...botNgot, isComp: false, soThungCanBan: botNgotThung },
    ];

    return list.map(item => {
      let completionRate = item.target > 0 ? (item.actual / item.target) * 100 : 0;
      if (item.target > 0 && item.actual < item.target) {
        completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
      }
      const conThieu = item.target - item.actual;
      return {
        ...item,
        completionRate,
        conThieu
      };
    });
  };

  const shouldHighlightYellow = (name: string): boolean => {
    const cleanName = name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
    return (
      cleanName.includes('tong cao cap') ||
      cleanName.includes('simply dau gao lut') ||
      cleanName.includes('tong trung cap') ||
      cleanName.includes('tong san pham ngach') ||
      cleanName.includes('tong dau dong goi nho') ||
      cleanName.includes('tong dau dong goi lon') ||
      cleanName.includes('dau dong goi lon')
    );
  };

  const sectorsInfo: { [key: string]: { name: string; desc: string; color: string } } = {
    CLF: { name: 'Dầu ăn và chất béo', desc: 'Dầu ăn và chất béo', color: 'bg-indigo-950/40 text-indigo-400 border-indigo-500/20' },
    VFM: { name: 'TOTAL VFM', desc: 'Bột mì', color: 'bg-amber-950/40 text-amber-400 border-amber-500/20' },
    MCC: { name: 'Các sản phẩm ngũ cốc gia tăng', desc: 'Các sản phẩm ngũ cốc gia tăng', color: 'bg-rose-950/40 text-rose-400 border-rose-500/20' },
    NDFC: { name: 'Gia vị Nam Dương', desc: 'Gia vị Nam Dương', color: 'bg-blue-950/40 text-blue-400 border-blue-500/20' },
    HPC: { name: 'Hóa phẩm nhãn hiệu Power100', desc: 'Hóa phẩm nhãn hiệu Power100', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' },
    VP: { name: 'Gạo Vinh Phát', desc: 'Gạo Vinh Phát', color: 'bg-yellow-950/40 text-yellow-550 border-yellow-500/20' },
    VNT: { name: 'Trà Vinatea', desc: 'Trà Vinatea', color: 'bg-teal-950/40 text-teal-400 border-teal-500/20' },
    DHF: { name: 'Gia vị DH Food', desc: 'Gia vị DH Food', color: 'bg-purple-950/40 text-purple-400 border-purple-500/20' },
    '584NT': { name: 'Nước mắm 584 Nha Trang', desc: 'Nước mắm 584 Nha Trang', color: 'bg-orange-950/40 text-orange-400 border-orange-500/20' },
    'NON - WM': { name: 'Non Wilmar', desc: 'Tổng VNT, DHF, 584NT', color: 'bg-fuchsia-950/40 text-fuchsia-400 border-fuchsia-500/20' },
  };

  const FMCG_SECTORS = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', 'VNT', 'DHF', '584NT', 'NON - WM'];

  const formatValue = (value: number, isSmall: boolean = false) => {
    return centralFormatValue(value, isSmall);
  };

  const cleanStr = (s: string) => s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  const resolveSectorKeys = (
    rawRow: any, 
    sector: string, 
    isTransactionRow = false
  ): { targetKey: string | null, actualKey: string | null } => {
    if (!rawRow) return { targetKey: null, actualKey: null };
    const keys = Object.keys(rawRow);
    const sectorLower = cleanStr(sector);

    const matchKeys = keys.filter(k => {
      const kNorm = cleanStr(k);
      return kNorm.includes(sectorLower);
    });

    if (matchKeys.length === 0) {
      return { targetKey: null, actualKey: null };
    }

    const targetKeywords = ['target', 'chi tieu', 'ct', 'muc tieu', 'ke hoach', 'kế hoạch', 'kehoach'];
    const actualKeywords = ['actual', 'thuc hien', 'thực hiện', 'thuc dat', 'thực đạt', 'thuc te', 'thực tế', 'doanh so', 'doanh số', 'so ban', 'số bán', 'ban ra', 'bán ra', 'dat', 'đạt'];

    const scored = matchKeys.map(k => {
      const kNorm = cleanStr(k);
      let targetScore = 0;
      let actualScore = 0;

      targetKeywords.forEach(kw => {
        if (kNorm.includes(cleanStr(kw))) targetScore += 10;
      });

      actualKeywords.forEach(kw => {
        if (kNorm.includes(cleanStr(kw))) actualScore += 10;
      });

      return { key: k, kNorm, targetScore, actualScore };
    });

    let targetKey: string | null = null;
    let actualKey: string | null = null;

    const clearTargets = scored.filter(s => s.targetScore > s.actualScore);
    const clearActuals = scored.filter(s => s.actualScore > s.targetScore);

    if (clearTargets.length > 0) {
      targetKey = clearTargets.reduce((max, curr) => curr.targetScore > max.targetScore ? curr : max, clearTargets[0]).key;
    }

    if (clearActuals.length > 0) {
      actualKey = clearActuals.reduce((max, curr) => curr.actualScore > max.actualScore ? curr : max, clearActuals[0]).key;
    }

    const undecided = scored.filter(s => s.targetScore === s.actualScore);
    
    undecided.forEach(u => {
      if (targetKey && !actualKey) {
        actualKey = u.key;
      } else if (actualKey && !targetKey) {
        targetKey = u.key;
      } else {
        if (isTransactionRow) {
          if (!actualKey) actualKey = u.key;
        } else {
          if (!targetKey) targetKey = u.key;
        }
      }
    });

    return { targetKey, actualKey };
  };

  const getEmployeeSectorPerformance = (empName: string, sector: string): { target: number, actual: number } => {
    if (sectorData) {
      if (empName === 'Tất cả') {
        let totalTarget = 0;
        let totalActual = 0;
        Object.values(sectorData).forEach(empPerf => {
          if (empPerf[sector]) {
            totalTarget += empPerf[sector].target || 0;
            totalActual += empPerf[sector].actual || 0;
          }
        });
        return { target: totalTarget, actual: totalActual };
      }

      const cleanEmpName = cleanStr(empName).replace(/\s+/g, '');
      const empKey = Object.keys(sectorData).find(
        (name) => cleanStr(name).replace(/\s+/g, '') === cleanEmpName
      );
      if (empKey) {
        const sectorPerf = sectorData[empKey][sector];
        if (sectorPerf) {
          return {
            target: sectorPerf.target || 0,
            actual: sectorPerf.actual || 0
          };
        }
      }
      return { target: 0, actual: 0 };
    }

    const emp = employees.find(e => e.name && e.name.toLowerCase().trim() === empName.toLowerCase().trim());
    
    let target = 0;
    let actual = 0;
    let hasSectorTarget = false;
    let hasSectorActual = false;

    if (emp && emp.rawRow) {
      const { targetKey, actualKey } = resolveSectorKeys(emp.rawRow, sector, false);
      
      if (targetKey) {
        target = parseValueFromString(emp.rawRow[targetKey]);
        if (target > 0) {
          hasSectorTarget = true;
        }
      }
      
      if (actualKey) {
        actual = parseValueFromString(emp.rawRow[actualKey]);
        if (actual > 0) {
          hasSectorActual = true;
        }
      }
    }

    const empTxs = transactions.filter(t => t.NhanVien && t.NhanVien.toLowerCase().trim() === empName.toLowerCase().trim());
    
    if (!hasSectorTarget && empTxs.length > 0) {
      for (const tx of empTxs) {
        if (tx.rawRow) {
          const { targetKey } = resolveSectorKeys(tx.rawRow, sector, true);
          if (targetKey) {
            const tVal = parseValueFromString(tx.rawRow[targetKey]);
            if (tVal > 0) {
              target = tVal;
              hasSectorTarget = true;
              break;
            }
          }
        }
      }
    }

    if (!hasSectorActual && empTxs.length > 0) {
      let sumActual = 0;
      let hasExplicitActualCol = false;
      
      for (const tx of empTxs) {
        if (tx.rawRow) {
          const { actualKey } = resolveSectorKeys(tx.rawRow, sector, true);
          if (actualKey) {
            const aVal = parseValueFromString(tx.rawRow[actualKey]);
            if (aVal > 0) {
              sumActual += aVal;
              hasExplicitActualCol = true;
            }
          }
        }
      }

      if (hasExplicitActualCol) {
        actual = sumActual;
        hasSectorActual = true;
      } else {
        const sectorTxs = empTxs.filter(t => t.NganhHang.toUpperCase().includes(sector.toUpperCase()));
        actual = sectorTxs.reduce((sum, t) => sum + (t.ThucHien !== undefined && t.ThucHien > 0 ? t.ThucHien : (t.SoLuong || 0)), 0);
        hasSectorActual = actual > 0;
      }
    }

    if (!hasSectorTarget && !hasSectorActual) {
      const mockBaselineTargets: { [key: string]: number } = {
        CLF: 350,
        VFM: 260,
        MCC: 230,
        NDFC: 210,
        HPC: 150,
        VP: 100,
        VNT: 120,
        DHF: 140,
        '584NT': 110,
        'NON - WM': 180,
      };
      
      const multiplier = empName === 'Tất cả' ? employees.length : 1;
      target = (mockBaselineTargets[sector] || 0) * multiplier;

      const sectorTxs = empTxs.filter(t => t.NganhHang.toUpperCase().includes(sector.toUpperCase()));
      let sum = 0;
      sectorTxs.forEach(t => {
        let val = t.ThucHien !== undefined ? t.ThucHien : t.SoLuong;
        if (val > 10000) {
          val = val / 1000000; // Scale Currency units to tons for beautiful display in local mock preview
        }
        sum += val;
      });
      actual = sum;
    }

    return { target, actual };
  };

  const scrollToEmployeeTable = () => {
    const element = document.getElementById('employee-sales-table-card');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Add a subtle border glow / highlight effect to focus attention
      element.classList.add('ring-2', 'ring-emerald-500/50', 'transition-all');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-emerald-500/50');
      }, 1500);
    }
  };

  // Build metrics per category based on transactions and dynamic Google Sheet rawRow mapping
  const sectorRows = FMCG_SECTORS.map((sector) => {
    const filteredTx = transactions.filter((tx) => {
      const matchCategory = tx.NganhHang.toUpperCase().includes(sector);
      const matchEmployee = employeeNameFilter === 'Tất cả' || tx.NhanVien === employeeNameFilter;
      return matchCategory && matchEmployee;
    });

    const totalQty = filteredTx.reduce((sum, tx) => sum + tx.SoLuong, 0);
    const totalTransactions = filteredTx.length;

    let targetVal = 0;
    let actualVal = 0;

    if (employeeNameFilter !== 'Tất cả') {
      const perf = getEmployeeSectorPerformance(employeeNameFilter, sector);
      targetVal = perf.target;
      actualVal = perf.actual;
    } else {
      const uniqueEmpNames = Array.from(new Set([
        ...employees.map(e => e.name),
        ...transactions.map(t => t.NhanVien)
      ].filter(Boolean)));

      uniqueEmpNames.forEach((empName) => {
        const perf = getEmployeeSectorPerformance(empName, sector);
        targetVal += perf.target;
        actualVal += perf.actual;
      });
    }

    let completionRate = targetVal > 0 ? (actualVal / targetVal) * 100 : 0;
    if (targetVal > 0 && actualVal < targetVal) {
      completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
    }

    return {
      category: sector,
      target: targetVal,
      actual: actualVal,
      completionRate,
      totalQty,
      totalTransactions,
    };
  });

  const formatNumber = (num: number) => {
    return num !== undefined && num !== null ? num.toLocaleString('vi-VN') : '0';
  };

  const formatGapNumber = (num: number) => {
    if (num === undefined || num === null || num <= 0) return '0';
    if (num < 1) {
      return num.toLocaleString('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    return Math.ceil(num).toLocaleString('vi-VN');
  };

  const formatQuantity = (num: number) => {
    return centralFormatQuantity(num);
  };

  const formatRevenue = (num: number) => {
    return centralFormatRevenue(num);
  };

  const formatGrowthPct = (rate: number) => {
    return centralFormatGrowthPct(rate);
  };

  // Calculate slow items (completion rate < cycle percentage and target > 0)
  const slowSectors = useMemo(() => {
    return sectorRows.filter(row => 
      row.target > 0 && 
      row.completionRate < cyclePercentage && 
      row.category !== 'NON - WM'
    );
  }, [sectorRows, cyclePercentage]);

  const slowProductGroups = useMemo(() => {
    const allProductGroups = [
      ...getProductGroupsData().map(g => ({ ...g, sector: 'CLF' })),
      ...getMccGroupsData().map(g => ({ ...g, sector: 'MCC' })),
      ...getNdfcGroupsData().map(g => ({ ...g, sector: 'NDFC' }))
    ];
    return allProductGroups.filter(g => g.target > 0 && g.completionRate < cyclePercentage && !g.isComp);
  }, [clfDetailedRows, mccDetailedRows, ndfcDetailedRows, cyclePercentage, employeeNameFilter]);

  return (
    <div id="target-analysis-card" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-2 sm:p-4 md:p-5 mb-4 sm:mb-6">
      <div className="flex flex-col gap-2 sm:gap-4 mb-2.5 sm:mb-4 border-b border-slate-200 pb-2.5 sm:pb-4">
        {/* Top Header Row: Desktop shows Title + EmployeeSelect; Mobile stays compact without duplicate EmployeeSelect (bottom quick-filter handles it) */}
        <div className="hidden md:flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between gap-2.5 w-full lg:w-auto">
            <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2 text-emerald-800">
              <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Số Bán</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto w-full lg:w-auto justify-between lg:justify-end">
            {/* Top Employee Filter (Desktop only; Mobile uses thumb quick-filter pill) */}
            {!isEmployeeView && onSelectEmployee && (
              <div className="shrink-0 w-full sm:w-auto">
                <EmployeeSelect
                  selectedEmployeeName={employeeNameFilter}
                  onSelectEmployee={onSelectEmployee}
                  availableEmployees={availableEmployees || []}
                  isEmployeeView={isEmployeeView}
                />
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW: Unified 1-Card Sales Header + Cycle Progress (Compact & No Duplicate Filter) */}
        <div className="block md:hidden w-full">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs px-2.5 py-2 w-full space-y-1.5">
            {/* Row 1: SỐ BÁN • CHU KỲ 8 [██████████░░] 97% */}
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-1 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-black text-xs uppercase tracking-tight text-emerald-900 whitespace-nowrap">
                  {getCycleNameFromStartDate(cycleStartDate).toUpperCase()}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300/60 min-w-[56px]">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, cyclePercentage))}%` }}
                />
              </div>

              {/* Progress % on the right */}
              <span className="font-black text-xs text-emerald-700 font-mono shrink-0 whitespace-nowrap">
                {Math.round(cyclePercentage)}%
              </span>
            </div>

            {/* Row 2: Số ngày làm việc còn lại | Tiến độ ngày X/Y */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100/90">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Còn:</span>
                <span className="font-extrabold text-emerald-800 font-mono tabular-nums">
                  {remainingDays} ngày làm việc
                </span>
              </div>

              <div className="flex items-center gap-1 text-slate-500 font-mono tabular-nums">
                <span className="text-slate-400">Tiến độ:</span>
                <span className="font-bold text-slate-700">{currentDayInCycle}/{totalDaysInCycle} ngày</span>
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP VIEW: Cycle Summary Panel (md and above) */}
        <div className="hidden md:flex p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-visible">
          
          {/* Left Col: Cycle Indicator */}
          <div className="flex items-center gap-3.5 shrink-0 z-10">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-inner">
              <Calendar className="w-5 h-5 shrink-0" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-600/95 uppercase tracking-widest font-mono font-black">Chu kỳ bán hàng</span>
              <span className="text-base font-extrabold text-emerald-800 tracking-wide mt-0.5 flex items-center gap-1.5">
                {getCycleNameFromStartDate(cycleStartDate)}
              </span>
            </div>
          </div>

          {/* Timeline & Progress Details */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 md:pl-6 border-t md:border-t-0 md:border-l border-emerald-100 pt-4 md:pt-0 flex-1 z-10">
            <div className="flex flex-col items-center min-w-[100px] text-center">
              <span className="text-[10px] text-emerald-600 uppercase tracking-widest font-mono font-semibold">Bắt đầu</span>
              <span className="text-xs font-bold text-emerald-700 font-mono tracking-wide mt-1 bg-emerald-50/50 px-3 py-1 rounded border border-emerald-100 w-full text-center">
                {formatDateToVN(cycleStartDate)}
              </span>
            </div>

            <div className="flex flex-col items-center min-w-[100px] text-center">
              <span className="text-[10px] text-emerald-600 uppercase tracking-widest font-mono font-semibold">Kết thúc</span>
              <span className="text-xs font-bold text-emerald-700 font-mono tracking-wide mt-1 bg-emerald-50/50 px-3 py-1 rounded border border-emerald-100 w-full text-center">
                {formatDateToVN(cycleEndDate)}
              </span>
            </div>

            <div className="flex flex-col items-center min-w-[130px] text-center">
              <span className="text-[10px] text-emerald-600 uppercase tracking-widest font-mono font-semibold">Ngày làm việc còn lại</span>
              <span className="text-xs font-bold text-emerald-700 font-mono tracking-wide mt-1 bg-emerald-50/70 px-3 py-1 rounded border border-emerald-100 w-full text-center">
                {remainingDays} ngày
              </span>
            </div>

            <div className="flex flex-col min-w-[150px] flex-1 max-w-xs">
              <div className="flex items-center justify-between text-[10px] text-emerald-600 uppercase tracking-widest font-mono font-semibold mb-1">
                <span>Tiến trình chu kỳ</span>
                <span className="text-emerald-600 font-extrabold font-mono">
                  {Math.round(Math.min(100, Math.max(0, (currentDayInCycle / totalDaysInCycle) * 100)))}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 bg-emerald-50/60 rounded-full flex-1 overflow-hidden border border-emerald-100/55">
                  <div 
                    className="h-full bg-emerald-600 rounded-full transition-[width] duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, (currentDayInCycle / totalDaysInCycle) * 100))}%` }}
                  />
                </div>
                <div className="text-xs font-bold text-emerald-700 font-mono whitespace-nowrap shrink-0">
                  Ngày {currentDayInCycle} <span className="text-emerald-400 text-[10px]">/</span> {totalDaysInCycle} ngày
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {salesSubTab === 'tiendo' ? (
        <>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 mb-3 sm:mb-4">
            {/* Title + Slow Progress Badge */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h3 className="text-sm sm:text-lg lg:text-2xl font-bold text-slate-900 uppercase tracking-wider truncate">
                <span className="sm:hidden">Tiến Độ Ngành Hàng</span>
                <span className="hidden sm:inline">Tiến Độ Số Bán Các Ngành Hàng</span>
              </h3>

              {/* Biểu tượng cảnh báo chậm tiến độ nằm gọn trong phần tiêu đề */}
              <button
                type="button"
                onClick={() => setIsSlowProgressModalOpen(true)}
                className={`min-h-[34px] sm:min-h-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs md:text-sm font-bold border transition-all cursor-pointer active:scale-95 shrink-0 ${
                  (slowSectors.length > 0 || slowProductGroups.length > 0)
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200 hover:border-rose-300'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
                title={
                  (slowSectors.length > 0 || slowProductGroups.length > 0)
                    ? `Xem cảnh báo: ${slowSectors.length} ngành hàng & ${slowProductGroups.length} nhóm sản phẩm chậm tiến độ`
                    : "Tất cả ngành hàng và nhóm sản phẩm đều đạt tiến độ"
                }
              >
                <AlertTriangle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${(slowSectors.length > 0 || slowProductGroups.length > 0) ? 'text-rose-600' : 'text-emerald-600'}`} />
                <span className="text-[11px] sm:text-xs">Chậm:</span>
                <span className={`font-mono tabular-nums font-black px-1.5 py-0.5 rounded text-[11px] sm:text-xs leading-none ${
                  (slowSectors.length > 0 || slowProductGroups.length > 0)
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}>
                  {slowSectors.length + slowProductGroups.length}
                </span>
              </button>
            </div>

            {/* Action Buttons: Desktop toggle + Gửi Zalo */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 ml-auto">
              {!isEmployeeView && (
                <button
                  onClick={() => setShowComparisonCols(!showComparisonCols)}
                  className={`hidden md:flex p-1.5 border rounded-lg transition-all duration-200 cursor-pointer shadow-sm items-center justify-center ${
                    showComparisonCols 
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  }`}
                  title={showComparisonCols ? "Thu gọn cột cùng kỳ" : "Mở rộng cột cùng kỳ"}
                >
                  {showComparisonCols ? (
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  )}
                </button>
              )}

              {/* Nút Gửi Zalo đồng bộ (chỉ 1 nút duy nhất) */}
              {onOpenZaloShare && (
                <button
                  type="button"
                  onClick={() => onOpenZaloShare()}
                  className="min-h-[36px] sm:min-h-0 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
                  title="Gửi báo cáo qua Zalo"
                >
                  <ZaloIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                  <span>Gửi Zalo</span>
                </button>
              )}
            </div>
          </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-auto max-h-[calc(100vh-140px)] bg-white rounded-xl p-1 shadow-md border border-slate-200 relative">
          <table className="w-full text-left border-collapse table-fixed min-w-[950px] border border-slate-200 bg-white">
            <colgroup>
              {isEmployeeView ? (
                <>
                  <col className="w-[22%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                </>
              ) : (
                <>
                  <col className={showComparisonCols ? "w-[18%]" : "w-[20%]"} />
                  <col className={showComparisonCols ? "w-[8.5%]" : "w-[11%]"} />
                  <col className={showComparisonCols ? "w-[8.5%]" : "w-[11%]"} />
                  <col className={showComparisonCols ? "w-[8.5%]" : "w-[11%]"} />
                  <col className={showComparisonCols ? "w-[8.5%]" : "w-[11%]"} />
                  <col className={showComparisonCols ? "w-[9.5%]" : "w-[12%]"} />
                  <col className={showComparisonCols ? "w-[7.5%]" : "w-[10%]"} />
                  {showComparisonCols && <col className="w-[8.5%]" />}
                  {showComparisonCols && <col className="w-[8.5%]" />}
                  <col className={showComparisonCols ? "w-[12%]" : "w-[15%]"} />
                </>
              )}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-white shadow-xs">
              <tr className="border-b border-slate-200 text-emerald-700 text-[13px] md:text-base lg:text-lg font-bold tracking-wider bg-white">
                <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">NGÀNH HÀNG</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">HOÀN THÀNH</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">CHỈ TIÊU</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">SỐ BÁN</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">CÒN THIẾU</th>
                <th className="sticky top-0 z-20 py-2 px-3 text-center uppercase leading-tight border border-slate-200 bg-white shadow-2xs">SỐ THÙNG<br />CẦN BÁN</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">KHMH</th>
                {!isEmployeeView && showComparisonCols && <th className="sticky top-0 z-20 py-2 px-3 text-center uppercase leading-tight border border-slate-200 bg-white shadow-2xs">CÙNG KỲ<br />NĂM NGOÁI</th>}
                {!isEmployeeView && showComparisonCols && <th className="sticky top-0 z-20 py-2 px-3 text-center uppercase leading-tight border border-slate-200 bg-white shadow-2xs">TĂNG TRƯỞNG<br />CÙNG KỲ</th>}
                {!isEmployeeView && <th className="sticky top-0 z-20 py-2.5 px-3 text-center uppercase border border-slate-200 bg-white shadow-2xs">THAO TÁC</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm md:text-lg lg:text-xl text-slate-700 bg-white">
              {sectorRows.map((row) => {
                const isOver = row.completionRate >= 100;
                const conThieu = row.target - row.actual;
                
                const density = SECTOR_DENSITY_MAP[row.category] || 0.01;
                const soThungCanBan = conThieu > 0 
                  ? Math.ceil(conThieu / density) 
                  : conThieu < 0 
                    ? -Math.ceil(Math.abs(conThieu) / density) 
                    : 0;
                
                const isClf = row.category === 'CLF';
                const isMcc = row.category === 'MCC';
                const isNdfc = row.category === 'NDFC';
                const isClickable = isClf || isMcc || isNdfc;

                const targetPhysicalRowIndex = SECTOR_ROW_INDEX_MAP[row.category];
                const matchedGrowthRow = growthData?.find(r => r._physicalRowIndex === targetPhysicalRowIndex);
                const cungKyVal = matchedGrowthRow && matchedGrowthRow.cungKyNamNgoai !== undefined && matchedGrowthRow.cungKyNamNgoai !== 0
                  ? matchedGrowthRow.cungKyNamNgoai 
                  : (MOCK_CUNG_KY_NAM_NGOAI[row.category] || 0);
                
                const scaleCungKy = (cungKyVal > 10000 && row.actual < 10000) ? cungKyVal / 1000000 : cungKyVal;
                const tangTruongCungKy = scaleCungKy > 0 ? (row.actual / scaleCungKy) - 1 : 0;
                const tangTruongPct = tangTruongCungKy * 100;

                let tangTruongStr = '0.0%';
                if (scaleCungKy > 0) {
                  if (Math.abs(tangTruongPct) < 0.05) {
                    tangTruongStr = '0.0%';
                  } else {
                    const sign = tangTruongPct > 0 ? '+' : '';
                    tangTruongStr = `${sign}${tangTruongPct.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
                  }
                }

                const pctVal = Math.abs(tangTruongPct) < 0.05 ? 0 : tangTruongPct;
                const growthColorClass = pctVal > 0 ? 'text-emerald-600 font-bold' : pctVal < 0 ? 'text-rose-600 font-bold' : 'text-slate-700 font-bold';

                let isExpanded = !!expandedSectors[row.category];

                const handleToggle = () => {
                  if (isClickable) {
                    toggleSectorExpanded(row.category);
                  }
                };

                const subInfo = isClickable ? getSubgroupsForSector(row.category) : null;

                return (
                  <React.Fragment key={`desktop-sector-frag-${row.category}`}>
                    <tr 
                      key={row.category} 
                      onClick={handleToggle}
                      className="transition-all duration-200 select-none cursor-pointer bg-white hover:bg-emerald-50/40 align-top"
                    >
                      <td className="py-2.5 px-3 align-top text-center border border-slate-200">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle();
                            }}
                            disabled={!isClickable}
                            title={isClickable ? (isExpanded ? "Thu gọn nhóm sản phẩm" : "Xem các nhóm sản phẩm") : undefined}
                            className={`w-full max-w-[210px] min-h-[30px] md:min-h-[38px] h-auto px-2.5 py-1 rounded text-[13px] md:text-base lg:text-lg font-black font-mono border transition-all flex items-center justify-between gap-1.5 ${
                              !isClickable 
                                ? 'bg-[#e6f4ea] text-[#137333] border-transparent cursor-default' 
                                : isExpanded 
                                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs cursor-pointer' 
                                  : 'bg-[#e6f4ea] hover:bg-emerald-100 text-[#137333] border-emerald-300 cursor-pointer'
                            }`}
                          >
                             <span className="text-center flex-1 break-words whitespace-normal leading-tight">{row.category}</span>
                             {isClickable ? (
                               isExpanded ? <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-white" /> : <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-emerald-700" />
                             ) : (
                               <span className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                             )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top text-center whitespace-nowrap border border-slate-200">
                        <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                          <span
                            className={`font-bold inline-block text-sm md:text-lg lg:text-xl font-arial ${
                              row.completionRate >= cyclePercentage 
                                ? 'text-emerald-600' 
                                : 'text-rose-600'
                            }`}
                          >
                            {row.completionRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top text-center font-arial text-sm md:text-lg lg:text-xl font-bold text-slate-700 whitespace-nowrap border border-slate-200">
                        <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                          {formatValue(row.target, row.target > 0 && row.target < 0.5)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top text-center font-arial text-sm md:text-lg lg:text-xl font-bold text-emerald-600 whitespace-nowrap border border-slate-200">
                        <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                          {formatValue(row.actual, row.target > 0 && row.target < 0.5)}
                        </div>
                      </td>
                      <td className={`py-2.5 px-3 align-top text-center font-arial text-sm md:text-lg lg:text-xl font-bold whitespace-nowrap border border-slate-200 ${
                        conThieu < -0.0001 ? 'text-emerald-600' : conThieu > 0.0001 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                          {formatValue(conThieu, (row.target > 0 && row.target < 0.5) || Math.abs(conThieu) < 0.1)}
                        </div>
                      </td>
                      <td className={`py-2.5 px-3 align-top text-center font-arial text-sm md:text-lg lg:text-xl font-bold whitespace-nowrap border border-slate-200 ${
                        soThungCanBan < 0 ? 'text-emerald-600' : soThungCanBan > 0 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                          {soThungCanBan !== 0 ? (soThungCanBan < 0 ? `-${Math.abs(soThungCanBan).toLocaleString('vi-VN')}` : soThungCanBan.toLocaleString('vi-VN')) : '0'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top text-center whitespace-nowrap border border-slate-200">
                        <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                          <span className="font-bold inline-block px-2 py-0.5 rounded text-sm md:text-lg lg:text-xl font-mono bg-[#e0f2fe] text-[#0369a1] border border-sky-500/15">
                            {getKHMHCount(row.category, employeeNameFilter)}
                          </span>
                        </div>
                      </td>
                      {!isEmployeeView && showComparisonCols && (
                        <td className="py-2.5 px-3 align-top text-center font-arial text-sm md:text-lg lg:text-xl font-bold text-slate-700 whitespace-nowrap border border-slate-200">
                          <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                            {formatValue(scaleCungKy, row.target > 0 && row.target < 0.5)}
                          </div>
                        </td>
                      )}
                      {!isEmployeeView && showComparisonCols && (
                        <td className="py-2.5 px-3 align-top text-center whitespace-nowrap border border-slate-200">
                          <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                            <span className={`font-bold inline-block text-sm md:text-lg lg:text-xl font-arial ${growthColorClass}`}>
                              {tangTruongStr}
                            </span>
                          </div>
                        </td>
                      )}

                      {!isEmployeeView && (
                        <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap border border-slate-200">
                          <div className="min-h-[36px] flex items-center justify-center py-0.5">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSectorTargetDetail(row.category);
                              }}
                              className="px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold border border-slate-200/60 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-600 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Chi Tiết Thực Hiện Chỉ Tiêu Ngành Hàng"
                            >
                              <Eye className="w-4 h-4 text-emerald-700" />
                              <span>Chi Tiết</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* INLINE EXPANDED SUBGROUPS FOR DESKTOP - THẲNG HÀNG 100% VỚI CỘT CỦA SẢN PHẨM CHA */}
                    {isClickable && isExpanded && subInfo && subInfo.data.length > 0 && (
                      <>
                        {/* Hàng Tiêu Đề Nhóm Sản Phẩm */}
                        <tr key={`subgroup-header-row-${row.category}`} className="bg-indigo-50 border-x border-slate-200">
                          <td colSpan={isEmployeeView ? 7 : (showComparisonCols ? 10 : 8)} className="py-2 px-3.5 border border-slate-200 bg-indigo-50/90">
                            <div className="flex items-center justify-between text-indigo-900">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                <span className="text-xs md:text-sm lg:text-base font-black uppercase tracking-wide">
                                  Các nhóm sản phẩm ngành hàng {row.category} ({subInfo.data.length} nhóm)
                                </span>
                              </div>
                              <span className="text-[11px] md:text-xs text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
                                Nhân viên: {employeeNameFilter}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Các hàng nhóm sản phẩm con - Mỗi nhóm là 1 tr có các td thẳng hàng tuyệt đối với cột cha */}
                        {subInfo.data.map((g, gIdx) => {
                          const isHighlighted = shouldHighlightYellow(g.name);
                          const isHeaderProduct = g.name.includes('Tổng') || g.name.includes('Lớn') || g.name.includes('Nhỏ');

                          let rowBgClass = gIdx % 2 === 0 ? 'bg-indigo-50/20' : 'bg-white';
                          if (isHighlighted) {
                            rowBgClass = 'bg-yellow-50 font-bold';
                          } else if (isHeaderProduct) {
                            rowBgClass = 'bg-indigo-50/60 font-bold';
                          }

                          return (
                            <tr
                              key={`subgroup-tr-${row.category}-${g.name}-${gIdx}`}
                              className={`${rowBgClass} hover:bg-indigo-100/40 transition-colors border-b border-slate-200`}
                            >
                              {/* Cột 1: NGÀNH HÀNG -> Nhóm Sản Phẩm Con */}
                              <td className="py-2 px-3 align-middle border border-slate-200">
                                <div className="flex items-center gap-2 pl-2 md:pl-4">
                                  <span className="text-indigo-400 font-mono text-xs select-none">↳</span>
                                  {isHighlighted ? (
                                    <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0"></span>
                                  ) : isHeaderProduct ? (
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0"></span>
                                  ) : (
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span>
                                  )}
                                  <span className={`text-xs md:text-sm lg:text-base leading-snug break-words ${
                                    isHighlighted ? 'text-yellow-900 font-black' : isHeaderProduct ? 'text-indigo-950 font-black' : 'text-slate-800 font-semibold'
                                  }`}>
                                    {g.name.replace(/^\d+[\.\-\s]+\s*/, '')}
                                  </span>
                                </div>
                              </td>

                              {/* Cột 2: HOÀN THÀNH - Thẳng hàng hoàn toàn */}
                              <td className="py-2 px-3 align-middle text-center whitespace-nowrap border border-slate-200">
                                <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                  <span className={`font-bold inline-block text-sm md:text-lg lg:text-xl font-arial ${
                                    g.completionRate >= cyclePercentage ? 'text-emerald-600' : 'text-rose-600'
                                  }`}>
                                    {g.completionRate.toFixed(1)}%
                                  </span>
                                </div>
                              </td>

                              {/* Cột 3: CHỈ TIÊU - Thẳng hàng hoàn toàn */}
                              <td className="py-2 px-3 align-middle text-center font-arial text-sm md:text-lg lg:text-xl font-bold text-slate-700 whitespace-nowrap border border-slate-200">
                                <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                  {formatValue(g.target, g.target > 0 && g.target < 0.5)}
                                </div>
                              </td>

                              {/* Cột 4: SỐ BÁN - Thẳng hàng hoàn toàn */}
                              <td className="py-2 px-3 align-middle text-center font-arial text-sm md:text-lg lg:text-xl font-bold text-emerald-600 whitespace-nowrap border border-slate-200">
                                <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                  {formatValue(g.actual, g.target > 0 && g.target < 0.5)}
                                </div>
                              </td>

                              {/* Cột 5: CÒN THIẾU - Thẳng hàng hoàn toàn */}
                              <td className={`py-2 px-3 align-middle text-center font-arial text-sm md:text-lg lg:text-xl font-bold whitespace-nowrap border border-slate-200 ${
                                g.conThieu < -0.0001 ? 'text-emerald-600' : g.conThieu > 0.0001 ? 'text-rose-600' : 'text-slate-500'
                              }`}>
                                <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                  {formatValue(g.conThieu, (g.target > 0 && g.target < 0.5) || Math.abs(g.conThieu) < 0.1)}
                                </div>
                              </td>

                              {/* Cột 6: SỐ THÙNG CẦN BÁN - Thẳng hàng hoàn toàn */}
                              <td className={`py-2 px-3 align-middle text-center font-arial text-sm md:text-lg lg:text-xl font-bold whitespace-nowrap border border-slate-200 ${
                                g.soThungCanBan < 0 ? 'text-emerald-600' : g.soThungCanBan > 0 ? 'text-amber-600' : 'text-slate-500'
                              }`}>
                                <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                  {g.soThungCanBan !== 0 ? (g.soThungCanBan < 0 ? `-${Math.abs(g.soThungCanBan).toLocaleString('vi-VN')}` : g.soThungCanBan.toLocaleString('vi-VN')) : '0'}
                                </div>
                              </td>

                              {/* Cột 7: KHMH - Thẳng hàng hoàn toàn */}
                              <td className="py-2 px-3 align-middle text-center whitespace-nowrap border border-slate-200">
                                <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                  <span className="text-slate-400 font-mono text-sm md:text-lg">-</span>
                                </div>
                              </td>

                              {/* Cột 8: CÙNG KỲ NĂM NGOÁI (Nếu showComparisonCols) */}
                              {!isEmployeeView && showComparisonCols && (
                                <td className="py-2 px-3 align-middle text-center font-arial text-sm md:text-lg lg:text-xl font-bold text-slate-400 whitespace-nowrap border border-slate-200">
                                  <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                    -
                                  </div>
                                </td>
                              )}

                              {/* Cột 9: TĂNG TRƯỞNG CÙNG KỲ (Nếu showComparisonCols) */}
                              {!isEmployeeView && showComparisonCols && (
                                <td className="py-2 px-3 align-middle text-center whitespace-nowrap border border-slate-200">
                                  <div className="h-[26px] md:h-[34px] lg:h-[38px] flex items-center justify-center">
                                    <span className="text-slate-400 font-arial text-sm md:text-lg">-</span>
                                  </div>
                                </td>
                              )}

                              {/* Cột 10: THAO TÁC - Nút Chi Tiết nhóm sản phẩm con */}
                              {!isEmployeeView && (
                                <td className="py-2 px-3 align-middle text-center whitespace-nowrap border border-slate-200">
                                  <div className="min-h-[36px] flex items-center justify-center py-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenSubgroupTargetDetail(g.name, subInfo.sector);
                                      }}
                                      className="px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold border border-slate-200/60 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-600 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                      title="Chi Tiết Thực Hiện Chỉ Tiêu Nhóm Sản Phẩm"
                                    >
                                      <Eye className="w-4 h-4 text-emerald-700" />
                                      <span>Chi Tiết</span>
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Sector View (4-Column Table) ⭐ */}
        <div className="block md:hidden">
          {(() => {
            const totalManagedCustomers = getTotalManagedCustomers(employeeNameFilter);
            return (
              <MobileSectorTable
                rows={sectorRows.map((row) => {
                  const conThieu = row.target - row.actual;
                  const density = SECTOR_DENSITY_MAP[row.category] || 0.01;
                  const soThungCanBan = conThieu > 0 
                    ? Math.ceil(conThieu / density) 
                    : conThieu < 0 
                      ? -Math.ceil(Math.abs(conThieu) / density) 
                      : 0;
                  const isClf = row.category === 'CLF';
                  const isMcc = row.category === 'MCC';
                  const isNdfc = row.category === 'NDFC';
                  const isClickable = isClf || isMcc || isNdfc;
                  const isExpanded = !!expandedSectors[row.category];
                  const subInfo = isClickable ? getSubgroupsForSector(row.category) : null;

                  return {
                    category: row.category,
                    actual: row.actual,
                    target: row.target,
                    completionRate: row.completionRate,
                    conThieu,
                    soThungCanBan,
                    khmhCount: getKHMHCount(row.category, employeeNameFilter),
                    totalCustomers: totalManagedCustomers,
                    isExpandable: isClickable,
                    isExpanded,
                    onToggleExpand: isClickable ? () => toggleSectorExpanded(row.category) : undefined,
                    onDetailClick: !isEmployeeView ? () => handleOpenSectorTargetDetail(row.category) : undefined,
                    isSmall: row.target > 0 && row.target < 0.5,
                    renderExpandedContent: subInfo && subInfo.data.length > 0 ? () => (
                      <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-black uppercase text-indigo-900 tracking-tight">
                            Các nhóm sản phẩm {row.category} ({subInfo.data.length} nhóm)
                          </span>
                        </div>
                        <MobileSectorTable
                          rows={subInfo.data.map((g) => ({
                            category: g.name.replace(/^\d+[\.\-\s]+\s*/, ''),
                            actual: g.actual,
                            target: g.target,
                            completionRate: g.completionRate,
                            conThieu: g.conThieu,
                            soThungCanBan: g.soThungCanBan,
                            isHighlighted: shouldHighlightYellow(g.name),
                            isHeader: g.name.includes('Tổng') || g.name.includes('Lớn') || g.name.includes('Nhỏ'),
                            isSmall: g.target > 0 && g.target < 0.5,
                            onDetailClick: !isEmployeeView ? () => handleOpenSubgroupTargetDetail(g.name, subInfo.sector) : undefined,
                          }))}
                          customIconMap={customSectorIcons}
                          onEditIcon={isSupervisor ? (cat) => setEditingIconCategory(cat) : undefined}
                          titleColName="NHÓM SẢN PHẨM"
                          cyclePercentage={cyclePercentage}
                          isNested={true}
                        />
                      </div>
                    ) : undefined,
                  };
                })}
                customIconMap={customSectorIcons}
                onEditIcon={isSupervisor ? (cat) => setEditingIconCategory(cat) : undefined}
                titleColName="NGÀNH HÀNG"
                cyclePercentage={cyclePercentage}
              />
            );
          })()}
        </div>

      {/* Modal Cảnh Báo Các Ngành Hàng & Nhóm Sản Phẩm Chậm Tiến Độ (Mở khi bấm biểu tượng ở tiêu đề) */}
      <AnimatePresence>
        {isSlowProgressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSlowProgressModalOpen(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="relative w-full max-w-5xl max-h-[92vh] bg-white border border-rose-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 font-sans"
            >
              {/* Modal Header */}
              <div className="p-3.5 sm:p-5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-rose-800 text-sm sm:text-lg lg:text-xl font-black tracking-tight uppercase truncate">
                        CÁC NGÀNH HÀNG VÀ NHÓM SẢN PHẨM CHẬM TIẾN ĐỘ
                      </h4>
                      <span className="text-[10px] sm:text-xs text-rose-700 bg-rose-100/90 border border-rose-200 px-2 py-0.5 rounded-full font-bold shrink-0">
                        {slowSectors.length} Ngành hàng &bull; {slowProductGroups.length} Nhóm sản phẩm
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] sm:text-xs font-semibold mt-0.5">
                      Danh sách các mặt hàng có tỷ lệ hoàn thành &lt; <span className="text-emerald-700 font-bold font-mono">{cyclePercentage}%</span> (cần tập trung đẩy nhanh tốc độ bán)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSlowProgressModalOpen(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-rose-200 bg-white hover:bg-rose-100 text-rose-700 flex items-center justify-center cursor-pointer transition-all shadow-2xs shrink-0"
                  title="Đóng cửa sổ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto p-3 sm:p-5 space-y-4 max-h-[calc(92vh-130px)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Column 1: Sectors */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
                      <span className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        Ngành hàng chậm tiến độ ({slowSectors.length})
                      </span>
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Hoàn thành &lt; {cyclePercentage}%
                      </span>
                    </div>

                    {slowSectors.length === 0 ? (
                      <div className="py-8 text-center text-xs sm:text-sm text-emerald-700 font-medium bg-emerald-50/50 rounded-lg border border-emerald-100">
                        Không có ngành hàng nào chậm tiến độ
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {slowSectors.map((row) => {
                          const deltaPct = cyclePercentage - row.completionRate;
                          const conThieuTons = Math.max(0, row.target - row.actual);
                          const density = SECTOR_DENSITY_MAP[row.category] || 0.01;
                          const soThungConThieu = conThieuTons > 0 ? Math.ceil(conThieuTons / density) : 0;
                          const canBanMoiNgayGapThung = soThungConThieu / remainingDays;

                          return (
                            <div key={row.category} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-2 hover:border-emerald-300 transition-all shadow-xs">
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="font-extrabold text-emerald-700 font-mono text-sm sm:text-base">{row.category}</span>
                                <div className="flex items-center gap-1.5 font-mono text-xs">
                                  <span className="text-slate-500">Đạt:</span>
                                  <span className="font-bold text-rose-600">{row.completionRate.toFixed(1)}%</span>
                                  <span className="text-slate-400">/</span>
                                  <span className="text-emerald-700">{cyclePercentage}%</span>
                                  <span className="text-rose-600 text-[11px] font-black">(-{deltaPct.toFixed(1)}%)</span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs text-slate-600 mt-0.5 border-t border-slate-100 pt-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Chỉ tiêu (Tấn):</span>
                                  <strong className="text-slate-700 font-mono">{formatQuantity(row.target)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Thực đạt (Tấn):</span>
                                  <strong className="text-slate-700 font-mono">{formatQuantity(row.actual)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Tấn còn thiếu:</span>
                                  <strong className="text-rose-600 font-mono font-bold">{formatQuantity(conThieuTons)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Thùng còn thiếu:</span>
                                  <strong className="text-rose-600 font-mono font-bold">{formatNumber(soThungConThieu)}</strong>
                                </div>
                                <div className="col-span-2 flex justify-between items-center bg-rose-50/80 border border-rose-100/55 rounded-md px-2.5 py-1.5 text-rose-700 font-bold mt-1">
                                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider">Số bán bù GAP:</span>
                                  <strong className="font-mono text-rose-700 text-xs sm:text-sm">{formatGapNumber(canBanMoiNgayGapThung)} thùng/ngày</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Product Groups */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
                      <span className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-emerald-600" />
                        Nhóm sản phẩm chậm tiến độ ({slowProductGroups.length})
                      </span>
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Hoàn thành &lt; {cyclePercentage}%
                      </span>
                    </div>

                    {slowProductGroups.length === 0 ? (
                      <div className="py-8 text-center text-xs sm:text-sm text-emerald-700 font-medium bg-emerald-50/50 rounded-lg border border-emerald-100">
                        Không có nhóm sản phẩm nào chậm tiến độ
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {slowProductGroups.map((g) => {
                          const deltaPct = cyclePercentage - g.completionRate;
                          const conThieu = Math.max(0, g.target - g.actual);
                          const soThungCanBan = g.soThungCanBan || 0;
                          const canBanMoiNgayGapThung = soThungCanBan / remainingDays;

                          return (
                            <div key={g.name} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-2 hover:border-emerald-300 transition-all shadow-xs">
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold font-mono shrink-0">{g.sector}</span>
                                  <span className="font-bold text-slate-800 break-words leading-tight" title={g.name}>{g.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-mono text-xs">
                                  <span className="text-slate-500">Đạt:</span>
                                  <span className="font-bold text-rose-600">{g.completionRate.toFixed(1)}%</span>
                                  <span className="text-slate-400">/</span>
                                  <span className="text-emerald-700">{cyclePercentage}%</span>
                                  <span className="text-rose-600 text-[11px] font-black">(-{deltaPct.toFixed(1)}%)</span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs text-slate-600 mt-0.5 border-t border-slate-100 pt-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Chỉ tiêu (Tấn):</span>
                                  <strong className="text-slate-700 font-mono">{formatQuantity(g.target)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Thực đạt (Tấn):</span>
                                  <strong className="text-slate-700 font-mono">{formatQuantity(g.actual)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Tấn còn thiếu:</span>
                                  <strong className="text-rose-600 font-mono font-bold">{formatQuantity(conThieu)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Thùng còn thiếu:</span>
                                  <strong className="text-rose-600 font-mono font-bold">{formatNumber(soThungCanBan)}</strong>
                                </div>
                                <div className="col-span-2 flex justify-between items-center bg-rose-50/80 border border-rose-100/55 rounded-md px-2.5 py-1.5 text-rose-700 font-bold mt-1">
                                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider">Số bán bù GAP:</span>
                                  <strong className="font-mono text-rose-700 text-xs sm:text-sm">{formatGapNumber(canBanMoiNgayGapThung)} thùng/ngày</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSlowProgressModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Target Detail Modal for all Employees */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedTargetDetail && (
            <div key="target-detail-portal" className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-sm flex flex-col p-0 md:p-1.5 overflow-hidden">
              {/* Modal Box: Full-screen presentation mode with 100% white background */}
              <motion.div
                ref={targetDetailCaptureRef}
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full max-w-full bg-white rounded-none md:rounded-xl shadow-2xl border-0 md:border md:border-slate-300 flex flex-col overflow-hidden font-sans"
              >
                {/* Clean Presentation Header: Pure white background, high contrast */}
                <div className="px-3 md:px-6 py-3 md:py-3.5 bg-white border-b-2 border-slate-200 text-slate-900 flex items-center justify-between gap-3 shrink-0 shadow-xs">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Award className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex items-center gap-2 md:gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="hidden sm:inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs md:text-sm font-black uppercase tracking-wider border border-slate-300">
                          HỌP & TRÌNH CHIẾU
                        </span>
                        <h4 className="text-slate-900 text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight uppercase truncate">
                          CHỈ TIÊU NV:
                        </h4>
                      </div>
                      <span className="text-emerald-700 font-black text-base sm:text-lg md:text-xl lg:text-2xl truncate">
                        {selectedTargetDetail.title.replace(/^\d+[\.\-\s]+\s*/, '')}
                      </span>
                      <div className="text-xs md:text-sm bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md px-3 py-0.5 font-bold flex items-center gap-2 shadow-2xs shrink-0">
                        <span>Tiến độ TG: <strong className="font-mono font-black text-emerald-900 text-sm md:text-base">{cyclePercentage}%</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
                    {/* Fast employee search */}
                    <div className="relative w-36 sm:w-48 md:w-64">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        placeholder="Tìm nhân viên..."
                        className="w-full bg-slate-50 text-slate-900 rounded-lg border border-slate-300 py-2 pl-9 pr-7 text-xs md:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium shadow-2xs"
                      />
                      {modalSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setModalSearchTerm('')}
                          aria-label="Xóa tìm kiếm"
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-rose-500 cursor-pointer flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Fullscreen Presentation Mode Button */}
                    <button
                      type="button"
                      onClick={toggleModalFullscreen}
                      className="px-3 md:px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs md:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 border border-slate-300 shrink-0"
                      title="Toàn màn hình (F11 Trình chiếu)"
                    >
                      {isModalFullscreen ? <Minimize2 className="w-4 h-4 text-slate-700" /> : <Maximize2 className="w-4 h-4 text-slate-700" />}
                      <span className="hidden md:inline">{isModalFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
                    </button>

                    {/* Zalo Button */}
                    <button
                      type="button"
                      disabled={sharingTargetDetail}
                      onClick={handleShareZaloTargetDetail}
                      className="px-3 py-1.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs disabled:opacity-50 shrink-0"
                      title={`Gửi kết quả ${selectedTargetDetail.title} qua Zalo`}
                    >
                      {sharingTargetDetail ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                      ) : (
                        <ZaloIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span>{sharingTargetDetail ? 'Đang tạo...' : 'Gửi Zalo'}</span>
                    </button>

                    {/* Close Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedTargetDetail(null)}
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
                  const totalTarget = preparedModalData.reduce((sum, item) => sum + item.target, 0);
                  const totalActual = preparedModalData.reduce((sum, item) => sum + item.actual, 0);
                  const totalSoThungCanBan = preparedModalData.reduce((sum, item) => sum + item.soThungCanBan, 0);
                  const totalConThieu = preparedModalData.reduce((sum, item) => sum + item.conThieu, 0);
                  const avgCompletion = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200 bg-white border-b-2 border-slate-200 py-3 md:py-4 px-4 md:px-8 text-center shrink-0">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Tổng Chỉ Tiêu:</span>
                        <span className="text-lg md:text-2xl lg:text-3xl font-arial font-black text-slate-900">
                          {formatValue(totalTarget, totalTarget > 0 && totalTarget < 0.5)}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Tổng Thực Hiện:</span>
                        <span className="text-lg md:text-2xl lg:text-3xl font-arial font-black text-emerald-700">
                          {formatValue(totalActual, totalTarget > 0 && totalTarget < 0.5)}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Số Thùng Cần Bán:</span>
                        <span className={`text-lg md:text-2xl lg:text-3xl font-arial font-black ${totalSoThungCanBan < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {totalSoThungCanBan !== 0 ? (totalSoThungCanBan < 0 ? `-${Math.abs(totalSoThungCanBan).toLocaleString('vi-VN')}` : totalSoThungCanBan.toLocaleString('vi-VN')) : '0'}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-1">
                        <span className="text-xs md:text-sm lg:text-base text-slate-600 font-extrabold uppercase tracking-wide">Hiệu Suất TB:</span>
                        <span className={`text-lg md:text-2xl lg:text-3xl font-arial font-black ${avgCompletion >= cyclePercentage ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {avgCompletion.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Big Presentation Data Table Container: Pure White Background Throughout */}
                <div className="flex-1 min-h-0 flex flex-col p-1 sm:p-2 md:p-3 overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white">
                  {/* Desktop / Big Screen Table View - Tall Rows, Huge Crisp Text & Numbers, Pure White Background */}
                  <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg border-2 border-slate-300 shadow-sm bg-white">
                    <table className="w-full text-center border-collapse table-fixed border border-slate-300 bg-white">
                      <colgroup>
                        <col className={isBotNgotDetail ? "w-[26%]" : selectedTargetDetail?.sectorKey ? "w-[28%]" : "w-[32%]"} />
                        <col className={isBotNgotDetail ? "w-[11%]" : selectedTargetDetail?.sectorKey ? "w-[12%]" : "w-[13%]"} />
                        <col className={isBotNgotDetail ? "w-[11%]" : selectedTargetDetail?.sectorKey ? "w-[12%]" : "w-[13%]"} />
                        <col className={isBotNgotDetail ? "w-[11%]" : selectedTargetDetail?.sectorKey ? "w-[12%]" : "w-[14%]"} />
                        <col className={isBotNgotDetail ? "w-[11%]" : selectedTargetDetail?.sectorKey ? "w-[12%]" : "w-[14%]"} />
                        <col className={isBotNgotDetail ? "w-[13%]" : selectedTargetDetail?.sectorKey ? "w-[12%]" : "w-[14%]"} />
                        {selectedTargetDetail?.sectorKey ? <col className="w-[12%]" /> : null}
                        {isBotNgotDetail ? <col className="w-[17%]" /> : null}
                      </colgroup>
                      <thead className="sticky top-0 z-20 bg-white shadow-xs">
                        <tr className="border-b-2 border-slate-400 text-sm md:text-base lg:text-lg font-black uppercase tracking-wider select-none h-14 md:h-16 bg-white text-slate-900">
                          <th 
                            onClick={() => toggleModalSort('name')}
                            className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              Nhân Viên <ArrowUpDown className="w-4 h-4 text-slate-500" />
                            </div>
                          </th>
                          <th 
                            onClick={() => toggleModalSort('completionRate')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            Hoàn thành
                          </th>
                          <th 
                            onClick={() => toggleModalSort('target')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            Chỉ tiêu
                          </th>
                          <th 
                            onClick={() => toggleModalSort('actual')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            Thực hiện
                          </th>
                          <th 
                            onClick={() => toggleModalSort('conThieu')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            Còn thiếu
                          </th>
                          <th 
                            onClick={() => toggleModalSort('soThungCanBan')}
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                          >
                            <div className="flex items-center justify-center gap-1">
                              Số Thùng Cần Bán <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                            </div>
                          </th>
                          {selectedTargetDetail?.sectorKey && (
                            <th className="py-3 px-2 text-center border border-slate-300 bg-white">
                              KHMH
                            </th>
                          )}
                          {isBotNgotDetail && (
                            <th 
                              onClick={() => toggleModalSort('soThungT7')}
                              className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-300 bg-white"
                            >
                              <div className="flex items-center justify-center gap-1">
                                Số Thùng T7 <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {sortedModalData.length > 0 ? (
                          sortedModalData.map((item, idx) => {
                            const isCurrentActive = employeeNameFilter !== 'Tất cả' && item.name.toLowerCase().trim() === employeeNameFilter.toLowerCase().trim();
                            return (
                              <tr 
                                key={item.name} 
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
                                      {item.name}
                                    </span>
                                    {isCurrentActive && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold shrink-0">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-center border border-slate-200 bg-white">
                                  <span className={`font-arial text-lg md:text-2xl lg:text-3xl font-black ${
                                    item.completionRate >= cyclePercentage
                                      ? 'text-emerald-700'
                                      : 'text-rose-600'
                                  }`}>
                                    {item.completionRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black text-slate-900 border border-slate-200 bg-white">
                                  {formatValue(item.target, item.target > 0 && item.target < 0.5)}
                                </td>
                                <td className="py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black text-emerald-700 border border-slate-200 bg-white">
                                  {formatValue(item.actual, item.target > 0 && item.target < 0.5)}
                                </td>
                                <td className={`py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black border border-slate-200 bg-white ${
                                  item.conThieu < -0.0001 ? 'text-emerald-700' : item.conThieu > 0.0001 ? 'text-rose-600' : 'text-slate-500'
                                }`}>
                                  {formatValue(item.conThieu, (item.target > 0 && item.target < 0.5) || Math.abs(item.conThieu) < 0.1)}
                                </td>
                                <td className={`py-2.5 px-2 text-center font-arial text-base md:text-xl lg:text-2xl font-black border border-slate-200 bg-white ${
                                  item.soThungCanBan < 0 ? 'text-emerald-700' : item.soThungCanBan > 0 ? 'text-amber-700' : 'text-slate-500'
                                }`}>
                                  {item.soThungCanBan !== 0 ? (item.soThungCanBan < 0 ? `-${Math.abs(item.soThungCanBan).toLocaleString('vi-VN')}` : item.soThungCanBan.toLocaleString('vi-VN')) : '0'}
                                </td>
                                {selectedTargetDetail?.sectorKey && (
                                  <td className="py-2.5 px-2 text-center border border-slate-200 bg-white">
                                    <span className="font-black inline-block px-3 py-1 rounded text-base md:text-xl lg:text-2xl font-mono bg-sky-50 text-sky-800 border border-sky-300">
                                      {getKHMHCount(selectedTargetDetail.sectorKey, item.name)}
                                    </span>
                                  </td>
                                )}
                                {isBotNgotDetail && (
                                  <td className="py-2.5 px-2 text-center border border-slate-200 font-black text-indigo-700 bg-white text-base md:text-xl lg:text-2xl">
                                    {item.soThungT7 !== undefined && item.soThungT7 !== null 
                                      ? item.soThungT7.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) 
                                      : '0.0'}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6 + (selectedTargetDetail?.sectorKey ? 1 : 0) + (isBotNgotDetail ? 1 : 0)} className="py-16 text-center text-slate-500 text-base border border-slate-200 bg-white">
                              <Info className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                              <span className="text-slate-500 font-medium text-base">Không tìm thấy dữ liệu nhân viên trùng khớp.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {sortedModalData.length > 0 && (() => {
                        const totalTarget = preparedModalData.reduce((sum, item) => sum + item.target, 0);
                        const totalActual = preparedModalData.reduce((sum, item) => sum + item.actual, 0);
                        const totalSoThungCanBan = preparedModalData.reduce((sum, item) => sum + item.soThungCanBan, 0);
                        const totalConThieu = preparedModalData.reduce((sum, item) => sum + item.conThieu, 0);
                        const totalSoThungT7 = preparedModalData.reduce((sum, item) => sum + (item.soThungT7 || 0), 0);
                        const avgCompletion = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
                        return (
                          <tfoot className="sticky bottom-0 z-20 bg-white shadow-xl font-black border-t-4 border-slate-900">
                            <tr className="h-14 md:h-16 lg:h-18 text-slate-900 bg-white">
                              <td className="py-3 px-3 text-center border border-slate-300 tracking-wider font-extrabold text-base md:text-xl lg:text-2xl bg-white">
                                Tổng
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-lg md:text-2xl lg:text-3xl text-emerald-800 bg-white">
                                {avgCompletion.toFixed(1)}%
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-slate-900 bg-white">
                                {formatValue(totalTarget, totalTarget > 0 && totalTarget < 0.5)}
                              </td>
                              <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-emerald-800 bg-white">
                                {formatValue(totalActual, totalTarget > 0 && totalTarget < 0.5)}
                              </td>
                              <td className={`py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl bg-white ${
                                totalConThieu < -0.0001 ? 'text-emerald-800' : totalConThieu > 0.0001 ? 'text-rose-700' : 'text-slate-700'
                              }`}>
                                {formatValue(totalConThieu, (totalTarget > 0 && totalTarget < 0.5) || Math.abs(totalConThieu) < 0.1)}
                              </td>
                              <td className={`py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl bg-white ${
                                totalSoThungCanBan < 0 ? 'text-emerald-800' : totalSoThungCanBan > 0 ? 'text-amber-800' : 'text-slate-700'
                              }`}>
                                {totalSoThungCanBan !== 0 ? (totalSoThungCanBan < 0 ? `-${Math.abs(totalSoThungCanBan).toLocaleString('vi-VN')}` : totalSoThungCanBan.toLocaleString('vi-VN')) : '0'}
                              </td>
                              {selectedTargetDetail?.sectorKey && (
                                <td className="py-3 px-2 text-center border border-slate-300 font-mono font-black text-base md:text-xl lg:text-2xl text-sky-900 bg-white">
                                  -
                                </td>
                              )}
                              {isBotNgotDetail && (
                                <td className="py-3 px-2 text-center border border-slate-300 font-arial font-black text-base md:text-xl lg:text-2xl text-indigo-900 bg-white">
                                  {totalSoThungT7.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </td>
                              )}
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
                            onClick={() => toggleModalSort('name')}
                            className={`py-1.5 px-1 text-center border border-slate-300 bg-white ${
                              selectedTargetDetail?.sectorKey || isBotNgotDetail ? 'w-[30%]' : 'w-[36%]'
                            }`}
                          >
                            Nhân Viên
                          </th>
                          <th 
                            onClick={() => toggleModalSort('completionRate')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[15%]"
                          >
                            HT %
                          </th>
                          <th 
                            onClick={() => toggleModalSort('target')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[17%]"
                          >
                            Chỉ tiêu
                          </th>
                          <th 
                            onClick={() => toggleModalSort('actual')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[17%]"
                          >
                            Thực hiện
                          </th>
                          <th 
                            onClick={() => toggleModalSort('soThungCanBan')}
                            className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[21%]"
                          >
                            Cần Bán
                          </th>
                          {selectedTargetDetail?.sectorKey && (
                            <th className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[15%]">
                              KHMH
                            </th>
                          )}
                          {isBotNgotDetail && (
                            <th 
                              onClick={() => toggleModalSort('soThungT7')}
                              className="py-1.5 px-0.5 text-center border border-slate-300 bg-white w-[17%]"
                            >
                              Thùng T7
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs text-slate-800 bg-white">
                        {sortedModalData.length > 0 ? (
                          sortedModalData.map((item) => {
                            const isCurrentActive = employeeNameFilter !== 'Tất cả' && item.name.toLowerCase().trim() === employeeNameFilter.toLowerCase().trim();
                            return (
                              <tr 
                                key={item.name} 
                                className={`hover:bg-slate-50 transition-colors h-12 bg-white ${
                                  isCurrentActive ? 'bg-blue-50 font-black' : ''
                                }`}
                              >
                                <td className="py-1.5 px-1 font-semibold border border-slate-200 text-left bg-white">
                                  <div className="whitespace-nowrap overflow-hidden text-slate-900 font-black text-sm">
                                    {item.name}
                                  </div>
                                </td>
                                <td className="py-1.5 px-0.5 text-center border border-slate-200 bg-white">
                                  <span className={`font-arial text-sm font-black ${
                                    item.completionRate >= cyclePercentage
                                      ? 'text-emerald-700'
                                      : 'text-rose-600'
                                  }`}>
                                    {item.completionRate.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-arial text-xs font-bold text-slate-900 border border-slate-200 bg-white">
                                  {formatValue(item.target, item.target > 0 && item.target < 0.5)}
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-arial text-xs font-bold text-emerald-700 border border-slate-200 bg-white">
                                  {formatValue(item.actual, item.target > 0 && item.target < 0.5)}
                                </td>
                                <td className={`py-1.5 px-0.5 text-center font-arial text-xs font-bold border border-slate-200 bg-white ${item.soThungCanBan < 0 ? 'text-emerald-700' : item.soThungCanBan > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                                  {item.soThungCanBan !== 0 ? (item.soThungCanBan < 0 ? `-${Math.abs(item.soThungCanBan).toLocaleString('vi-VN')}` : item.soThungCanBan.toLocaleString('vi-VN')) : '0'}
                                </td>
                                {selectedTargetDetail?.sectorKey && (
                                  <td className="py-1.5 px-0.5 text-center border border-slate-200 bg-white">
                                    <span className="font-bold inline-block px-1.5 rounded text-xs font-mono bg-sky-50 text-sky-800">
                                      {getKHMHCount(selectedTargetDetail.sectorKey, item.name)}
                                    </span>
                                  </td>
                                )}
                                {isBotNgotDetail && (
                                  <td className="py-1.5 px-0.5 text-center border border-slate-200 font-extrabold text-indigo-700 bg-white text-xs">
                                    {item.soThungT7 !== undefined && item.soThungT7 !== null 
                                      ? item.soThungT7.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) 
                                      : '0.0'}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5 + (selectedTargetDetail?.sectorKey ? 1 : 0) + (isBotNgotDetail ? 1 : 0)} className="py-8 text-center text-slate-500 text-xs border border-slate-200 bg-white">
                              <span className="text-slate-400">Không tìm thấy dữ liệu nhân viên.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sleek Presentation Footer - Pure White Background */}
                <div className="py-2 px-5 bg-white border-t border-slate-200 text-xs text-slate-700 text-center font-bold shrink-0 flex items-center justify-between">
                  <span className="hidden sm:inline text-xs text-slate-500">Nhấn phím <strong>ESC</strong> hoặc nút Đóng để thoát chế độ xem</span>
                  <span className="mx-auto sm:mx-0 font-medium">Dữ liệu được cập nhật liên tục từ tệp chấm công và phân bổ thị trường VIP</span>
                  <span className="hidden sm:inline text-xs text-slate-600 font-mono">Tỉ lệ hiển thị tối ưu cho máy chiếu & TV</span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
        </>
      ) : salesSubTab === 'doanhso' ? null : salesSubTab === 'tangtruong' ? (
        /* Render TĂNG TRƯỞNG NĂM table */
        (() => {
          const sumRows = processedGrowthData.filter(row => isTargetSumRow(row.nhomSanPham));
          
          const rawTotalRow = growthData?.find(row => {
            if (!row || !row.nhomSanPham) return false;
            const norm = row.nhomSanPham.trim().toLowerCase();
            return (
              norm === 'tổng các ngành hàng' || 
              norm === 'tong cac nganh hang' || 
              norm === 'tổng' || 
              norm === 'total' ||
              norm.includes('tổng các ngành hàng') ||
              norm.includes('tong cac nganh hang')
            );
          });

          const sanLuong2025Sum = rawTotalRow ? (rawTotalRow.sanLuong2025 || 0) : sumRows.reduce((acc, row) => acc + (row.sanLuong2025 || 0), 0);
          const sanLuong2026Sum = rawTotalRow ? (rawTotalRow.sanLuong2026 || 0) : sumRows.reduce((acc, row) => acc + (row.sanLuong2026 || 0), 0);
          const tangGiamSanLuongSum = sanLuong2026Sum - sanLuong2025Sum;
          const tiLeTangTruongSanLuongPct = sanLuong2025Sum !== 0 ? ((sanLuong2026Sum / sanLuong2025Sum) - 1) : 0;
          
          const doanhSo2025Sum = rawTotalRow ? (rawTotalRow.doanhSo2025 || 0) : sumRows.reduce((acc, row) => acc + (row.doanhSo2025 || 0), 0);
          const doanhSo2026Sum = rawTotalRow ? (rawTotalRow.doanhSo2026 || 0) : sumRows.reduce((acc, row) => acc + (row.doanhSo2026 || 0), 0);
          const tangGiamDoanhSoSum = doanhSo2026Sum - doanhSo2025Sum;
          const tiLeTangTruongDoanhSoPct = doanhSo2025Sum !== 0 ? ((doanhSo2026Sum / doanhSo2025Sum) - 1) : 0;
          
          const totalRow: GrowthRow = {
            nhomSanPham: 'TỔNG CÁC NGÀNH HÀNG',
            sanLuong2025: sanLuong2025Sum,
            sanLuong2026: sanLuong2026Sum,
            tangGiamSanLuong: tangGiamSanLuongSum,
            tiLeTangTruongSanLuong: tiLeTangTruongSanLuongPct,
            doanhSo2025: doanhSo2025Sum,
            doanhSo2026: doanhSo2026Sum,
            tangGiamDoanhSo: tangGiamDoanhSoSum,
            tiLeTangTruongDoanhSo: tiLeTangTruongDoanhSoPct
          };

          const isSlPositive = tangGiamSanLuongSum > 0;
          const isDsPositive = tangGiamDoanhSoSum > 0;

          // Search and Filter logic
          let displayRows = processedGrowthData;
          if (growthSearchTerm.trim() !== '') {
            const term = growthSearchTerm.toLowerCase();
            displayRows = processedGrowthData.filter(row => 
              row.nhomSanPham.toLowerCase().includes(term)
            );
          } else {
            displayRows = [...processedGrowthData, totalRow];
          }

          const visibleRows = displayRows.filter(row => {
            if (growthSearchTerm.trim() !== '') return true;
            if (row.nhomSanPham === 'TỔNG CÁC NGÀNH HÀNG') return true;
            
            const parent = getParentGroup(row.nhomSanPham);
            if (!parent) return true;
            
            const normParent = normalizeGroupNameForCollapse(parent);
            if (collapsedGroups.includes(normParent)) return false;
            
            const grandparent = getParentGroup(parent);
            if (grandparent) {
              const normGrandparent = normalizeGroupNameForCollapse(grandparent);
              if (collapsedGroups.includes(normGrandparent)) return false;
            }
            return true;
          });

          return (
            <div className="space-y-5 animate-fadeIn">
              {/* KPIs Header widgets: Mobile combines into 1 compact card, Desktop shows 2 cards */}
              {/* Mobile Combined Card: Gộp chung Tổng Sản Lượng & Tổng Doanh Số thành 1 card gọn gàng */}
              <div className="block md:hidden bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">TỔNG HỢP TĂNG TRƯỞNG NĂM</span>
                  </div>
                </div>

                {/* Phần 1: Tổng Sản Lượng */}
                <div className="space-y-2 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[11px] font-extrabold text-slate-700 uppercase">TỔNG SẢN LƯỢNG (TẤN)</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono shadow-2xs ${
                      tiLeTangTruongSanLuongPct >= 0 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {tiLeTangTruongSanLuongPct >= 0 ? '+' : ''}{(tiLeTangTruongSanLuongPct * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <div className="text-[9.5px] text-slate-500 font-semibold tracking-wider uppercase">NĂM 2025</div>
                      <div className="text-[13px] font-bold text-slate-700 font-mono mt-0.5">{formatQuantity(sanLuong2025Sum)} <span className="text-[10px] text-slate-500 font-normal">T</span></div>
                    </div>
                    <div className="border-l border-slate-200 pl-3">
                      <div className="text-[9.5px] text-slate-500 font-semibold tracking-wider uppercase">NĂM 2026</div>
                      <div className="text-[14px] font-black text-slate-900 font-mono mt-0.5">{formatQuantity(sanLuong2026Sum)} <span className="text-[10px] text-slate-600 font-normal">T</span></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200">
                    <span className="text-slate-500 font-medium">Thay đổi ròng:</span>
                    <strong className={`font-mono text-[11px] ${isSlPositive ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                      {isSlPositive ? '+' : ''}{formatQuantity(tangGiamSanLuongSum)} Tấn
                    </strong>
                  </div>
                </div>

                {/* Phần 2: Tổng Doanh Số */}
                <div className="space-y-2 pt-3 border-t border-dashed border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-extrabold text-slate-700 uppercase">TỔNG DOANH SỐ (VNĐ)</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono shadow-2xs ${
                      tiLeTangTruongDoanhSoPct >= 0 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {tiLeTangTruongDoanhSoPct >= 0 ? '+' : ''}{(tiLeTangTruongDoanhSoPct * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <div className="text-[9.5px] text-slate-500 font-semibold tracking-wider uppercase">NĂM 2025</div>
                      <div className="text-[13px] font-bold text-slate-700 font-mono mt-0.5">{formatRevenue(doanhSo2025Sum)}</div>
                    </div>
                    <div className="border-l border-slate-200 pl-3">
                      <div className="text-[9.5px] text-slate-500 font-semibold tracking-wider uppercase">NĂM 2026</div>
                      <div className="text-[14px] font-black text-slate-900 font-mono mt-0.5">{formatRevenue(doanhSo2026Sum)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200">
                    <span className="text-slate-500 font-medium">Thay đổi ròng:</span>
                    <strong className={`font-mono text-[11px] ${isDsPositive ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                      {isDsPositive ? '+' : ''}{formatRevenue(tangGiamDoanhSoSum)} VNĐ
                    </strong>
                  </div>
                </div>
              </div>

              {/* Desktop 2-Card Layout */}
              <div className="hidden md:grid md:grid-cols-2 gap-4">
                {/* Metric Card 1: Volume */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors">
                  <div className="space-y-2.5 w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
                          <Award className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TỔNG SẢN LƯỢNG (Tấn)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums flex items-center gap-1 ${
                        tiLeTangTruongSanLuongPct >= 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {tiLeTangTruongSanLuongPct >= 0 ? '+' : ''}{(tiLeTangTruongSanLuongPct * 100).toFixed(2)}% TĂNG TRƯỞNG
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">NĂM 2025</div>
                        <div className="text-base font-extrabold text-slate-600 font-mono tabular-nums tracking-tight mt-0.5">{formatQuantity(sanLuong2025Sum)}</div>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">NĂM 2026</div>
                        <div className="text-lg font-black text-slate-800 font-mono tabular-nums tracking-tight mt-0.5">{formatQuantity(sanLuong2026Sum)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium bg-slate-50 rounded-lg p-2 border border-slate-200">
                      <span className="text-slate-500 font-medium">Thay đổi ròng:</span>
                      <strong className={`font-mono tabular-nums ${isSlPositive ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                        {isSlPositive ? '+' : ''}{formatQuantity(tangGiamSanLuongSum)} Tấn
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Metric Card 2: Revenue */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors">
                  <div className="space-y-2.5 w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TỔNG DOANH SỐ (VNĐ)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono flex items-center gap-1 shadow-sm ${
                        tiLeTangTruongDoanhSoPct >= 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {tiLeTangTruongDoanhSoPct >= 0 ? '+' : ''}{(tiLeTangTruongDoanhSoPct * 100).toFixed(2)}% TĂNG TRƯỞNG
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">NĂM 2025</div>
                        <div className="text-base font-extrabold text-slate-600 font-mono tracking-tight mt-0.5">{formatRevenue(doanhSo2025Sum)}</div>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">NĂM 2026</div>
                        <div className="text-lg font-black text-slate-800 font-mono tracking-tight mt-0.5">{formatRevenue(doanhSo2026Sum)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium bg-slate-50 rounded-lg p-2 border border-slate-200">
                      <span className="text-slate-500 font-medium">Thay đổi ròng:</span>
                      <strong className={`font-mono ${isDsPositive ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                        {isDsPositive ? '+' : ''}{formatRevenue(tangGiamDoanhSoSum)} VNĐ
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified Compact Control Toolbar: Metric Filter + Search + Expand/Collapse */}
              <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2">
                {/* Row 1: Segmented Metric Pills always on 1 row */}
                <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setGrowthMetric('sanLuong')}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      growthMetric === 'sanLuong'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60 font-black'
                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="sm:hidden">SL (Tấn)</span>
                    <span className="hidden sm:inline">Sản Lượng (Tấn)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrowthMetric('doanhSo')}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      growthMetric === 'doanhSo'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60 font-black'
                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="sm:hidden">DS (VNĐ)</span>
                    <span className="hidden sm:inline">Doanh Số (VNĐ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrowthMetric('all')}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      growthMetric === 'all'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60 font-black'
                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Cả hai</span>
                  </button>
                </div>

                {/* Row 2: Search + Expand/Collapse on same horizontal row */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                      <Search className="h-3.5 w-3.5 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      value={growthSearchTerm}
                      onChange={(e) => setGrowthSearchTerm(e.target.value)}
                      placeholder="Tìm nhóm sản phẩm..."
                      className="w-full h-9 bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 pl-8 pr-7 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                    {growthSearchTerm && (
                      <button
                        onClick={() => setGrowthSearchTerm('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCollapsedGroups([])}
                      className="h-9 px-2.5 rounded-xl bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span className="sm:hidden">Mở hết</span>
                      <span className="hidden sm:inline">Mở rộng tất cả</span>
                    </button>
                    <button
                      onClick={() => setCollapsedGroups(['cao cấp', 'ngách', 'trung cấp', 'thấp cấp', 'total mcc', 'total ndfc'])}
                      className="h-9 px-2.5 rounded-xl bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span className="sm:hidden">Thu gọn</span>
                      <span className="hidden sm:inline">Thu gọn tất cả</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RENDER TABLE CONTENT */}
              <GrowthTableView
                visibleRows={visibleRows}
                totalRow={totalRow}
                growthMetric={growthMetric}
                collapsedGroups={collapsedGroups}
                onToggleCollapse={(normParentKey) =>
                  setCollapsedGroups(prev =>
                    prev.includes(normParentKey)
                      ? prev.filter(k => k !== normParentKey)
                      : [...prev, normParentKey]
                  )
                }
                growthSearchTerm={growthSearchTerm}
                formatQuantity={formatQuantity}
                formatRevenue={formatRevenue}
                formatGrowthPct={formatGrowthPct}
                toProperCase={toProperCase}
                getParentGroup={getParentGroup}
                isParentRow={isParentRow}
                normalizeGroupNameForCollapse={normalizeGroupNameForCollapse}
              />
            </div>
          );
        })()
      ) : (
        /* Render TIẾN ĐỘ THƯỞNG NĂM view */
        (() => {
          // Standard employee ordering
          const standardEmpOrder = [
            'Lê Thị Hương',
            'Nguyễn Thành Thực',
            'Bùi Mạnh Cường',
            'Nguyễn Sỹ Vũ',
            'Dương Thị Thanh',
            'Vũ Anh Tùng',
            'Nguyễn Đức Tuấn',
            'Nguyễn Thị Hưng Nguyên'
          ];

          const normEmp = (str: string) => {
            if (!str) return '';
            let cleaned = cleanEmployeeName(str).replace(/^\d+[\.\s\-\:\_]+/, '').trim();
            cleaned = cleaned
              .replace(/[àáảãạâầấẩẫậăằắẳẵặ]/gi, 'a')
              .replace(/[èéẻẽẹêềếểễệ]/gi, 'e')
              .replace(/[ìíỉĩị]/gi, 'i')
              .replace(/[òóỏõọôồốổỗộơờớởỡợ]/gi, 'o')
              .replace(/[ùúủũụưừứửữự]/gi, 'u')
              .replace(/[ỳýỷỹỵ]/gi, 'y')
              .replace(/đ/gi, 'd');
            return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
          };

          const getEmpSortRank = (empName: string) => {
            const n = normEmp(empName);
            const idx = standardEmpOrder.findIndex(s => {
              const ns = normEmp(s);
              return n === ns || n.includes(ns) || ns.includes(n);
            });
            return idx !== -1 ? idx : 999;
          };

          // Filter list based on employeeNameFilter for permission / selection
          const rawFilteredList = (() => {
            if (!annualBonusData || annualBonusData.length === 0) return [];
            if (employeeNameFilter && employeeNameFilter !== 'Tất cả') {
              const cleanFilter = cleanEmployeeName(employeeNameFilter).toLowerCase().trim();
              const matched = annualBonusData.filter(emp => {
                const cleanEmp = cleanEmployeeName(emp.employeeName).toLowerCase().trim();
                return cleanEmp.includes(cleanFilter) || cleanFilter.includes(cleanEmp);
              });
              return matched;
            }
            return [...annualBonusData];
          })();

          // Keep original order from Google Sheets
          const filteredList = [...rawFilteredList];

          const viewMode = annualBonusViewMode;
          const setViewMode = setAnnualBonusViewMode;

          // Helper to get total points display value
          const getEmpTotalPointsDisplay = (emp: AnnualBonusEmployeeRow): string => {
            const candidates = ['AH', 'AM', 'AN', 'AO', 'AI'];
            for (const col of candidates) {
              const val = emp.cells?.[col]?.displayValue;
              if (val && val !== 'Trống' && val.trim() !== '') {
                const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
                if (!isNaN(num) && !/^[a-d][\+]?$/i.test(val.trim()) && !['xuất sắc', 'giỏi', 'khá', 'trung bình', 'yếu', 'loại a', 'loại b+', 'b+', 'loại b', 'loại c', 'loại d'].some(r => val.toLowerCase().includes(r))) {
                  return val;
                }
              }
            }
            return emp.totalPoints !== undefined ? emp.totalPoints.toLocaleString('vi-VN') : '0';
          };

          // Helper to get rating display value
          const getEmpRatingDisplay = (emp: AnnualBonusEmployeeRow): string => {
            const candidates = ['AI', 'AN', 'AO', 'AM', 'AH'];
            for (const col of candidates) {
              const val = emp.cells?.[col]?.displayValue;
              if (val && val !== 'Trống' && val.trim() !== '') {
                const cleanVal = val.trim();
                if (/^[a-d][\+]?$/i.test(cleanVal) || ['xuất sắc', 'giỏi', 'loại a', 'loại b+', 'b+', 'loại b', 'khá', 'trung bình', 'loại c', 'yếu', 'loại d', 'đạt', 'không đạt'].some(r => cleanVal.toLowerCase().includes(r))) {
                  return cleanVal;
                }
              }
            }
            // Thang điểm chuẩn thưởng năm:
            // - Từ 180 điểm trở lên: Xếp loại A
            // - Từ 160 đến dưới 180 điểm: Xếp loại B+
            // - Từ 120 đến dưới 160 điểm: Xếp loại B
            // - Từ 80 đến dưới 120 điểm: Xếp loại C
            // - Dưới 80 điểm: Xếp loại D
            const pts = getEmpNumericTotalPoints(emp) || emp.totalPoints || 0;
            if (pts >= 180) return 'Loại A';
            if (pts >= 160) return 'Loại B+';
            if (pts >= 120) return 'Loại B';
            if (pts >= 80) return 'Loại C';
            if (pts > 0) return 'Loại D';
            return 'Chưa xếp loại';
          };

          // Generate list of 43 column letters A through AQ (Col 0 to 42)
          const colLetters: string[] = [];
          for (let c = 0; c <= 42; c++) {
            let letter = '';
            let temp = c;
            while (temp >= 0) {
              letter = String.fromCharCode((temp % 26) + 65) + letter;
              temp = Math.floor(temp / 26) - 1;
            }
            colLetters.push(letter);
          }

          // Get exact header title from first employee row's cells if available
          const firstEmpCells = filteredList[0]?.cells || {};

          if (filteredList.length === 0) {
            return (
              <div className="mt-6 p-8 text-center bg-white rounded-2xl border-2 border-emerald-600 shadow-lg text-emerald-950">
                <Info className="w-8 h-8 mx-auto mb-3 text-emerald-600" />
                <h4 className="text-base font-bold text-emerald-950">Không tìm thấy dữ liệu thưởng năm</h4>
                <p className="text-xs text-emerald-800 mt-1">
                  {employeeNameFilter && employeeNameFilter !== 'Tất cả' 
                    ? `Không tìm thấy kết quả thưởng năm cho nhân viên "${employeeNameFilter}".` 
                    : 'Dữ liệu từ Sheet Thưởng Năm (cột A đến AM) chưa được tải hoặc không có hàng dữ liệu nhân sự.'}
                </p>
              </div>
            );
          }

          // Rank ordering for product bonus groups as requested:
          // 1: Cao Cấp, 2: Trung Cấp, 3: Total CLF, 4: Total VFM, 5: Total MCC, 6: Total NDFC, 7: Total HPC, 8: Total VP, 9: Total Non Wilmar
          const getGroupOrderRank = (groupName: string): number => {
            const lower = (groupName || '').toLowerCase();
            if (lower.includes('cao cấp') || lower.includes('cao cap')) return 1;
            if (lower.includes('trung cấp') || lower.includes('trung cap')) return 2;
            if (lower.includes('clf')) return 3;
            if (lower.includes('vfm')) return 4;
            if (lower.includes('mcc')) return 5;
            if (lower.includes('ndfc')) return 6;
            if (lower.includes('hpc')) return 7;
            if (lower.includes('vp')) return 8;
            if (lower.includes('non wilmar') || lower.includes('non-wilmar') || lower.includes('nonwilmar')) return 9;
            return 99;
          };

          const getGroupDisplayName = (groupName: string): string => {
            const lower = (groupName || '').toLowerCase();
            if (lower.includes('cao cấp') || lower.includes('cao cap')) return 'Cao Cấp';
            if (lower.includes('trung cấp') || lower.includes('trung cap')) return 'Trung Cấp';
            if (lower.includes('clf')) return 'Total CLF';
            if (lower.includes('vfm')) return 'Total VFM';
            if (lower.includes('mcc')) return 'Total MCC';
            if (lower.includes('ndfc')) return 'Total NDFC';
            if (lower.includes('hpc')) return 'Total HPC';
            if (lower.includes('vp')) return 'Total VP';
            if (lower.includes('non wilmar') || lower.includes('non-wilmar') || lower.includes('nonwilmar')) return 'Total Non Wilmar';
            return cleanGroupNameLabel(groupName);
          };

          const sortBonusGroups = (groups: AnnualBonusGroup[]): AnnualBonusGroup[] => {
            return [...groups].sort((a, b) => getGroupOrderRank(a.groupName) - getGroupOrderRank(b.groupName));
          };

          const formatRatingLetter = (rating: string): string => {
            if (!rating) return 'D';
            const clean = rating.trim();
            if (/^[a-d][\+]?$/i.test(clean)) return clean.toUpperCase();
            const lower = clean.toLowerCase();
            if (lower.includes('xuất sắc') || lower.includes('giỏi') || lower.includes('loại a')) return 'A';
            if (lower.includes('loại b+') || lower.includes('b+')) return 'B+';
            if (lower.includes('khá') || lower.includes('loại b')) return 'B';
            if (lower.includes('trung bình') || lower.includes('loại c')) return 'C';
            if (lower.includes('yếu') || lower.includes('loại d')) return 'D';
            return clean;
          };

          const getRatingBadgeStyle = (letter: string): string => {
            const upper = letter.toUpperCase();
            if (upper === 'A' || upper.startsWith('A')) {
              return 'bg-emerald-50 text-emerald-700 border-emerald-300';
            }
            if (upper === 'B+' || upper.includes('B+')) {
              return 'bg-teal-50 text-teal-700 border-teal-300';
            }
            if (upper === 'B' || upper.includes('B')) {
              return 'bg-blue-50 text-blue-700 border-blue-300';
            }
            if (upper === 'C' || upper.includes('C')) {
              return 'bg-amber-50 text-amber-700 border-amber-300';
            }
            if (upper === 'D' || upper.includes('D')) {
              return 'bg-rose-50 text-rose-700 border-rose-300';
            }
            return 'bg-slate-100 text-slate-700 border-slate-300';
          };

          // Helper to get total numeric points for calculations & sorting
          const getEmpNumericTotalPoints = (emp: AnnualBonusEmployeeRow): number => {
            const displayStr = getEmpTotalPointsDisplay(emp);
            const num = parseFloat(displayStr.replace(/[^0-9.-]/g, ''));
            if (!isNaN(num)) return num;
            return emp.totalPoints || 0;
          };

          // Helper to get employee average completion rate across 9 groups
          const getEmpAvgCompletionRate = (emp: AnnualBonusEmployeeRow): number => {
            const pGroups = (emp.groups || []).filter(g => !g.groupName.toLowerCase().includes('tổng điểm'));
            if (pGroups.length === 0) return 0;
            const sumRate = pGroups.reduce((acc, g) => acc + (g.completionRate || 0), 0);
            return (sumRate / pGroups.length) * 100;
          };

          // Calculate Team-Level Stats for Manager Dashboard
          const totalEmp = filteredList.length;
          const teamAvgPointsNum = totalEmp > 0
            ? filteredList.reduce((sum, e) => sum + getEmpNumericTotalPoints(e), 0) / totalEmp
            : 0;
          const teamAvgPointsDisplay = (Math.round(teamAvgPointsNum * 10) / 10).toFixed(1);

          // Rating Distribution counts & percentages
          const ratingStats = {
            A: { count: 0, pct: 0 },
            'B+': { count: 0, pct: 0 },
            B: { count: 0, pct: 0 },
            C: { count: 0, pct: 0 },
            D: { count: 0, pct: 0 },
          };

          filteredList.forEach(emp => {
            const letter = formatRatingLetter(getEmpRatingDisplay(emp));
            if (letter === 'A' || letter.startsWith('A')) ratingStats.A.count++;
            else if (letter === 'B+' || letter.includes('B+')) ratingStats['B+'].count++;
            else if (letter === 'B' || letter.includes('B')) ratingStats.B.count++;
            else if (letter === 'C' || letter.includes('C')) ratingStats.C.count++;
            else ratingStats.D.count++;
          });

          if (totalEmp > 0) {
            ratingStats.A.pct = Math.round((ratingStats.A.count / totalEmp) * 100);
            ratingStats['B+'].pct = Math.round((ratingStats['B+'].count / totalEmp) * 100);
            ratingStats.B.pct = Math.round((ratingStats.B.count / totalEmp) * 100);
            ratingStats.C.pct = Math.round((ratingStats.C.count / totalEmp) * 100);
            ratingStats.D.pct = Math.round((ratingStats.D.count / totalEmp) * 100);
          }

          // 9 standard groups stats for team overview
          const standardGroupList = [
            'Cao Cấp',
            'Trung Cấp',
            'Total CLF',
            'Total VFM',
            'Total MCC',
            'Total NDFC',
            'Total HPC',
            'Total VP',
            'Total Non Wilmar'
          ];

          const teamGroupStats = standardGroupList.map((gName, idx) => {
            let totalRate = 0;
            let totalPoints = 0;
            let count = 0;

            filteredList.forEach(emp => {
              const matched = (emp.groups || []).find(g => getGroupOrderRank(g.groupName) === (idx + 1));
              if (matched) {
                totalRate += (matched.completionRate || 0);
                totalPoints += (matched.groupPoints || 0);
                count++;
              }
            });

            const avgRatePct = count > 0 ? (totalRate / count) * 100 : 0;
            const avgPoints = count > 0 ? (totalPoints / count) : 0;

            return {
              name: gName,
              avgRatePct,
              avgPoints,
              displayPoints: (Math.round(avgPoints * 10) / 10).toFixed(1),
              displayRate: (Math.round(avgRatePct * 10) / 10).toFixed(1) + '%'
            };
          });

          // Top 3-5 Attention list (lowest total points)
          const attentionList = [...filteredList]
            .sort((a, b) => getEmpNumericTotalPoints(a) - getEmpNumericTotalPoints(b))
            .slice(0, Math.min(4, filteredList.length));

          // Filtered staff list for search and rating filter
          const displayedEmployeeList = filteredList.filter(emp => {
            if (bonusSearchKeyword.trim()) {
              const kw = bonusSearchKeyword.toLowerCase().trim();
              if (!emp.employeeName.toLowerCase().includes(kw)) return false;
            }
            if (bonusRatingFilter !== 'all') {
              const letter = formatRatingLetter(getEmpRatingDisplay(emp));
              if (bonusRatingFilter === 'A' && !(letter === 'A' || letter.startsWith('A'))) return false;
              if (bonusRatingFilter === 'B+' && !(letter === 'B+' || letter.includes('B+'))) return false;
              if (bonusRatingFilter === 'B' && !(letter === 'B' && !letter.includes('+'))) return false;
              if (bonusRatingFilter === 'C' && !(letter === 'C' || letter.includes('C'))) return false;
              if (bonusRatingFilter === 'D' && !(letter === 'D' || letter.includes('D'))) return false;
            }
            return true;
          });

          // 9 Group Columns for Web Table & Grid
          const BONUS_GROUP_COLUMNS = [
            { key: 'cao cap', label: 'Cao Cấp' },
            { key: 'trung cap', label: 'Trung Cấp' },
            { key: 'clf', label: 'CLF' },
            { key: 'vfm', label: 'VFM' },
            { key: 'mcc', label: 'MCC' },
            { key: 'ndfc', label: 'NDFC' },
            { key: 'hpc', label: 'HPC' },
            { key: 'vp', label: 'VP' },
            { key: 'non wilmar', label: 'Non Wilmar' }
          ];

          const getEmpGroupPointsVal = (emp: AnnualBonusEmployeeRow, key: string): { pts: string; rate: string; pct: number } => {
            if (!emp.groups || !Array.isArray(emp.groups)) return { pts: '-', rate: '0%', pct: 0 };
            const lower = key.toLowerCase();
            const found = emp.groups.find(g => {
              const gName = (g.groupName || '').toLowerCase();
              if (lower === 'cao cap') return gName.includes('cao cấp') || gName.includes('cao cap');
              if (lower === 'trung cap') return gName.includes('trung cấp') || gName.includes('trung cap');
              if (lower === 'clf') return gName.includes('clf');
              if (lower === 'vfm') return gName.includes('vfm');
              if (lower === 'mcc') return gName.includes('mcc');
              if (lower === 'ndfc') return gName.includes('ndfc');
              if (lower === 'hpc') return gName.includes('hpc');
              if (lower === 'vp') return gName.includes('vp');
              if (lower === 'non wilmar') return gName.includes('non wilmar') || gName.includes('non-wilmar') || gName.includes('nonwilmar');
              return gName.includes(lower);
            });
            if (!found) return { pts: '-', rate: '0%', pct: 0 };
            const pts = found.groupPoints !== undefined ? String(found.groupPoints) : '0';
            const pct = Math.round((found.completionRate || 0) * 100);
            return { pts, rate: `${pct}%`, pct };
          };

          return (
            <div className="mt-3 sm:mt-5 space-y-4">
              {/* Top Toolbar: 1 Single Horizontal Row */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-4 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-base font-black text-slate-900 leading-tight truncate">
                      TIẾN ĐỘ THƯỞNG NĂM
                    </h3>
                    <p className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                      {isEmployeeView 
                        ? `Cá nhân • 9 nhóm chỉ tiêu` 
                        : `${totalEmp} nhân sự • 9 nhóm chỉ tiêu`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBonusScoringModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 min-h-[36px] sm:min-h-0 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                >
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden">Cơ Cấu Điểm</span>
                  <span className="hidden sm:inline">Cơ Cấu Tính Điểm & Xếp Loại</span>
                </button>
              </div>

              {isEmployeeView ? (
                /* GIAO DIỆN NHÂN VIÊN: CHỈ HIỂN THỊ ĐÁNH GIÁ CÁ NHÂN, KHÔNG HIỂN THỊ KẾT QUẢ ĐỘI NGŨ */
                <>
                  {/* MOBILE VIEW: GIỮ NGUYÊN 100% GIAO DIỆN HIỆN TẠI */}
                  <div className="block md:hidden space-y-4">
                    {filteredList.map((emp, idx) => {
                      const totalPointsVal = getEmpTotalPointsDisplay(emp);
                      const ratingRaw = getEmpRatingDisplay(emp);
                      const ratingLetter = formatRatingLetter(ratingRaw);
                      const ratingBadgeClass = getRatingBadgeStyle(ratingLetter);

                      const empProductGroups = sortBonusGroups(
                        (emp.groups || []).filter(g => !g.groupName.toLowerCase().includes('tổng điểm'))
                      );

                      return (
                        <div 
                          key={`emp-card-${emp.employeeName}-${idx}`}
                          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 w-full space-y-4"
                        >
                          {/* Employee Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight">
                                  {emp.employeeName || 'Nhân viên'}
                                </h4>
                                <span className="text-[11px] font-bold text-slate-400">
                                  Nhân viên bán hàng
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* KẾT QUẢ ĐÁNH GIÁ */}
                          <div className="bg-slate-50/90 rounded-xl p-3.5 sm:p-4 border border-slate-200/90">
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                              KẾT QUẢ ĐÁNH GIÁ
                            </div>
                            <div className="flex items-end justify-between">
                              <div>
                                <div className="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none">
                                  {totalPointsVal}
                                </div>
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mt-1.5">
                                  TỔNG ĐIỂM
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`inline-flex items-center justify-center min-w-[42px] px-3 py-1 rounded-lg text-base font-black border shadow-2xs ${ratingBadgeClass}`}>
                                  {ratingLetter}
                                </span>
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mt-1.5">
                                  XẾP LOẠI
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-100" />

                          {/* 9 NHÓM ĐÁNH GIÁ CHI TIẾT */}
                          <div className="space-y-3.5">
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                              9 NHÓM CHỈ TIÊU CHI TIẾT
                            </div>
                            {empProductGroups.map((g, gIdx) => {
                              const displayName = getGroupDisplayName(g.groupName);
                              const targetFormatted = g.target ? formatValue(g.target) : '0';
                              const actualFormatted = g.actual ? formatValue(g.actual) : '0';
                              const pctVal = g.completionRate * 100;
                              const rateDisplay = pctVal.toFixed(1) + '%';
                              const pointsDisplay = g.groupPoints !== undefined ? g.groupPoints.toLocaleString('vi-VN') : '0';
                              const progressWidth = Math.min(100, Math.max(0, pctVal));
                              const isFinished = pctVal >= 100;

                              return (
                                <div key={`emp-single-grp-${gIdx}`} className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/70">
                                  {/* Row 1: [TÊN NHÓM] [ĐIỂM] */}
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 text-xs sm:text-[13px] tracking-tight">
                                      {displayName}
                                    </span>
                                    <span className="font-black text-slate-900 text-xs sm:text-[13px] font-mono">
                                      {pointsDisplay}
                                    </span>
                                  </div>

                                  {/* Row 2: Chỉ tiêu [giá trị] • Thực hiện [giá trị] */}
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    Chỉ tiêu <span className="text-slate-700 font-semibold">{targetFormatted}</span> • Thực hiện <span className="text-slate-800 font-bold">{actualFormatted}</span>
                                  </div>

                                  {/* Row 3: [PROGRESS BAR] [%] */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-slate-200/80 h-2 sm:h-2.5 rounded-full overflow-hidden border border-slate-200/80">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          isFinished 
                                            ? 'bg-emerald-500' 
                                            : pctVal >= 80 
                                            ? 'bg-teal-500' 
                                            : pctVal >= 50 
                                            ? 'bg-amber-500' 
                                            : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${progressWidth}%` }}
                                      />
                                    </div>
                                    <span className={`text-[11px] sm:text-xs font-black font-mono shrink-0 min-w-[44px] text-right ${
                                      isFinished ? 'text-emerald-700' : 'text-slate-700'
                                    }`}>
                                      {rateDisplay}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* WEB APP VIEW: TỐI ƯU GIAO DIỆN BẢNG & LƯỚI CHO DESKTOP */}
                  <div className="hidden md:block space-y-6">
                    {filteredList.map((emp, idx) => {
                      const totalPointsVal = getEmpTotalPointsDisplay(emp);
                      const ratingRaw = getEmpRatingDisplay(emp);
                      const ratingLetter = formatRatingLetter(ratingRaw);
                      const ratingBadgeClass = getRatingBadgeStyle(ratingLetter);
                      const avgComp = getEmpAvgCompletionRate(emp);
                      const empProductGroups = sortBonusGroups(
                        (emp.groups || []).filter(g => !g.groupName.toLowerCase().includes('tổng điểm'))
                      );
                      const completedCount = empProductGroups.filter(g => (g.completionRate || 0) >= 1).length;

                      return (
                        <div key={`emp-web-${emp.employeeName}-${idx}`} className="space-y-5">
                          {/* Desktop Executive Cards */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Card 1: Nhân sự */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
                              <div className="w-13 h-13 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl shadow-2xs shrink-0">
                                <User className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="font-black text-slate-900 text-xl md:text-2xl leading-tight">
                                  {emp.employeeName || 'Nhân viên'}
                                </h3>
                                <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">
                                  Nhân viên bán hàng • Đánh giá thưởng năm
                                </p>
                              </div>
                            </div>

                            {/* Card 2: Kết quả đánh giá */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                              <div>
                                <div className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-500">
                                  TỔNG ĐIỂM
                                </div>
                                <div className="text-4xl lg:text-5xl font-black text-slate-900 font-mono tracking-tight mt-1">
                                  {totalPointsVal}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-500 mb-1">
                                  XẾP LOẠI
                                </div>
                                <span className={`inline-flex items-center justify-center min-w-[58px] px-4 py-1.5 rounded-xl text-xl font-black border shadow-2xs ${ratingBadgeClass}`}>
                                  {ratingLetter}
                                </span>
                              </div>
                            </div>

                            {/* Card 3: Thống kê hiệu suất */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                              <div className="flex items-center justify-between text-xs md:text-sm font-bold">
                                <span className="text-slate-500">Hoàn thành TB:</span>
                                <span className="text-slate-900 font-mono text-base font-black">{avgComp.toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center justify-between text-xs md:text-sm font-bold">
                                <span className="text-slate-500">Số nhóm đạt chỉ tiêu:</span>
                                <span className="text-emerald-700 font-black text-sm md:text-base">{completedCount} / {empProductGroups.length} nhóm</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/80">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    avgComp >= 100 ? 'bg-emerald-500' : avgComp >= 80 ? 'bg-teal-500' : avgComp >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, avgComp))}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* 9 Nhóm Chỉ Tiêu Chi Tiết - Grid 3 Cột Desktop */}
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                            <div className="border-b border-slate-100 pb-3">
                              <h4 className="font-black text-slate-900 text-lg md:text-xl uppercase tracking-tight">
                                9 NHÓM CHỈ TIÊU CHI TIẾT
                              </h4>
                              <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
                                Chi tiết chỉ tiêu, số thực hiện, tỷ lệ hoàn thành và điểm số từng nhóm
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {empProductGroups.map((g, gIdx) => {
                                const displayName = getGroupDisplayName(g.groupName);
                                const targetFormatted = g.target ? formatValue(g.target) : '0';
                                const actualFormatted = g.actual ? formatValue(g.actual) : '0';
                                const pctVal = g.completionRate * 100;
                                const rateDisplay = pctVal.toFixed(1) + '%';
                                const pointsDisplay = g.groupPoints !== undefined ? g.groupPoints.toLocaleString('vi-VN') : '0';
                                const progressWidth = Math.min(100, Math.max(0, pctVal));
                                const isFinished = pctVal >= 100;

                                return (
                                  <div key={`web-emp-grp-${gIdx}`} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-black text-slate-900 text-sm md:text-base tracking-tight truncate mr-2" title={displayName}>
                                        {displayName}
                                      </span>
                                      <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs md:text-sm font-mono shrink-0">
                                        {pointsDisplay} điểm
                                      </span>
                                    </div>

                                    <div className="text-xs md:text-sm text-slate-600 font-medium">
                                      Chỉ tiêu: <span className="text-slate-800 font-bold">{targetFormatted}</span> • Thực hiện: <span className="text-slate-900 font-black">{actualFormatted}</span>
                                    </div>

                                    <div className="flex items-center gap-2.5 pt-0.5">
                                      <div className="flex-1 bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            isFinished ? 'bg-emerald-500' : pctVal >= 80 ? 'bg-teal-500' : pctVal >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${progressWidth}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs md:text-sm font-black font-mono shrink-0 ${isFinished ? 'text-emerald-700' : 'text-slate-800'}`}>
                                        {rateDisplay}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* GIAO DIỆN QUẢN LÝ / GIÁM SÁT: HIỂN THỊ ĐẦY ĐỦ TỔNG QUAN ĐỘI NGŨ */
                <>
                  {/* MOBILE VIEW (GIỮ NGUYÊN 100% GIAO DIỆN HIỆN TẠI) */}
                  <div className="block md:hidden space-y-4">
                    {/* 1. CARD TỔNG QUAN ĐỘI NGŨ */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          KẾT QUẢ ĐỘI NGŨ
                        </div>
                        <div className="text-sm font-bold text-emerald-800 mt-0.5">
                          {totalEmp} nhân sự
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight leading-none">
                          {teamAvgPointsDisplay}
                        </div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mt-1">
                          Tổng điểm trung bình
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    {/* Phân bố xếp loại A / B+ / B / C / D */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-600 mb-2">
                        Phân bố xếp loại nhân sự:
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
                        {/* A */}
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-700 text-white text-xs font-black mb-1 shadow-2xs">
                            A
                          </div>
                          <div className="text-base sm:text-lg font-black text-emerald-950 font-mono leading-tight">
                            {ratingStats.A.count}
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] font-bold text-emerald-700 mt-0.5">
                            {ratingStats.A.pct}%
                          </div>
                        </div>

                        {/* B+ */}
                        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-teal-700 text-white text-xs font-black mb-1 shadow-2xs">
                            B+
                          </div>
                          <div className="text-base sm:text-lg font-black text-teal-950 font-mono leading-tight">
                            {ratingStats['B+'].count}
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] font-bold text-teal-700 mt-0.5">
                            {ratingStats['B+'].pct}%
                          </div>
                        </div>

                        {/* B */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-700 text-white text-xs font-black mb-1 shadow-2xs">
                            B
                          </div>
                          <div className="text-base sm:text-lg font-black text-blue-950 font-mono leading-tight">
                            {ratingStats.B.count}
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] font-bold text-blue-700 mt-0.5">
                            {ratingStats.B.pct}%
                          </div>
                        </div>

                        {/* C */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-600 text-white text-xs font-black mb-1 shadow-2xs">
                            C
                          </div>
                          <div className="text-base sm:text-lg font-black text-amber-950 font-mono leading-tight">
                            {ratingStats.C.count}
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] font-bold text-amber-700 mt-0.5">
                            {ratingStats.C.pct}%
                          </div>
                        </div>

                        {/* D */}
                        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-600 text-white text-xs font-black mb-1 shadow-2xs">
                            D
                          </div>
                          <div className="text-base sm:text-lg font-black text-rose-950 font-mono leading-tight">
                            {ratingStats.D.count}
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] font-bold text-rose-700 mt-0.5">
                            {ratingStats.D.pct}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. HIỆU SUẤT THEO 9 NHÓM (BIỂU ĐỒ / PROGRESS LIST MOBILE) */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                          HIỆU SUẤT THEO 9 NHÓM
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Điểm & tỷ lệ hoàn thành trung bình toàn đội
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3.5 pt-1">
                      {teamGroupStats.map((grp, gIdx) => {
                        const pctVal = grp.avgRatePct;
                        const progressWidth = Math.min(100, Math.max(0, pctVal));
                        const isFinished = pctVal >= 100;

                        return (
                          <div key={`team-grp-${gIdx}`} className="space-y-1.5">
                            {/* Dòng 1: [Tên nhóm] [Điểm TB] */}
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs sm:text-[13px] tracking-tight">
                                {grp.name}
                              </span>
                              <span className="font-black text-slate-900 text-xs sm:text-[13px] font-mono">
                                {grp.displayPoints}
                              </span>
                            </div>

                            {/* Dòng 2: [Progress Bar] [% Hoàn thành TB] */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-slate-100 h-2 sm:h-2.5 rounded-full overflow-hidden border border-slate-200/80">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isFinished 
                                      ? 'bg-emerald-500' 
                                      : pctVal >= 80 
                                      ? 'bg-teal-500' 
                                      : pctVal >= 50 
                                      ? 'bg-amber-500' 
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${progressWidth}%` }}
                                />
                              </div>
                              <span className={`text-[11px] sm:text-xs font-black font-mono shrink-0 min-w-[44px] text-right ${
                                isFinished ? 'text-emerald-700' : 'text-slate-700'
                              }`}>
                                {grp.displayRate}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. KHU VỰC CẦN QUAN TÂM */}
                  {attentionList.length > 0 && (
                    <div className="bg-white rounded-2xl border border-rose-200/90 shadow-xs p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                            CẦN QUAN TÂM
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Top nhân sự có tổng điểm thấp nhất cần hỗ trợ
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        {attentionList.map((emp, idx) => {
                          const totalPts = getEmpTotalPointsDisplay(emp);
                          const ratingLetter = formatRatingLetter(getEmpRatingDisplay(emp));
                          const avgComp = getEmpAvgCompletionRate(emp).toFixed(0) + '%';
                          const isD = ratingLetter.includes('D');

                          return (
                            <div
                              key={`attn-${emp.employeeName}-${idx}`}
                              onClick={() => setSelectedBonusEmployee(emp)}
                              className="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-rose-50/40 hover:border-rose-300 transition-all cursor-pointer active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isD ? 'bg-rose-500 ring-2 ring-rose-200' : 'bg-amber-500 ring-2 ring-amber-200'}`} />
                                <div className="min-w-0">
                                  <div className="font-black text-slate-900 text-xs sm:text-sm truncate">
                                    {emp.employeeName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    Xếp loại <span className={`font-black ${isD ? 'text-rose-600' : ratingLetter === 'B+' ? 'text-teal-600' : ratingLetter === 'B' ? 'text-blue-600' : ratingLetter === 'A' ? 'text-emerald-600' : 'text-amber-600'}`}>{ratingLetter}</span> • Hoàn thành TB: <span className="font-bold text-slate-700">{avgComp}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className="font-black text-slate-900 text-sm font-mono">
                                  {totalPts}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. DANH SÁCH NHÂN VIÊN */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-black text-slate-900 text-xs sm:text-base uppercase tracking-tight">
                        DANH SÁCH NHÂN VIÊN
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold font-tabular">
                        {displayedEmployeeList.length} / {totalEmp} nhân sự
                      </span>
                    </div>

                    {/* Search & Single-Row Rating Filter Toolbar */}
                    <div className="space-y-2">
                      {/* Ô tìm kiếm */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bonusSearchKeyword}
                          onChange={(e) => setBonusSearchKeyword(e.target.value)}
                          placeholder="Tìm nhân viên..."
                          className="w-full h-9 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                        {bonusSearchKeyword && (
                          <button
                            type="button"
                            onClick={() => setBonusSearchKeyword('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Bộ lọc Xếp loại Pills (1 hàng ngang) */}
                      <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        <button
                          type="button"
                          onClick={() => setBonusRatingFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            bonusRatingFilter === 'all'
                              ? 'bg-slate-800 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Tất cả ({totalEmp})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonusRatingFilter('A')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            bonusRatingFilter === 'A'
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          A ({ratingStats.A.count})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonusRatingFilter('B+')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            bonusRatingFilter === 'B+'
                              ? 'bg-teal-700 text-white shadow-2xs'
                              : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                          }`}
                        >
                          B+ ({ratingStats['B+'].count})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonusRatingFilter('B')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            bonusRatingFilter === 'B'
                              ? 'bg-blue-700 text-white shadow-2xs'
                              : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          B ({ratingStats.B.count})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonusRatingFilter('C')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            bonusRatingFilter === 'C'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          C ({ratingStats.C.count})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonusRatingFilter('D')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            bonusRatingFilter === 'D'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          D ({ratingStats.D.count})
                        </button>
                      </div>
                    </div>

                    {/* Danh sách Employee Cards */}
                    {displayedEmployeeList.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs font-medium">
                        Không tìm thấy nhân viên phù hợp với bộ lọc.
                      </div>
                    ) : (
                      <div className="space-y-2.5 pt-1">
                        {displayedEmployeeList.map((emp, idx) => {
                          const totalPointsVal = getEmpTotalPointsDisplay(emp);
                          const ratingLetter = formatRatingLetter(getEmpRatingDisplay(emp));
                          const ratingBadgeClass = getRatingBadgeStyle(ratingLetter);
                          const avgComp = getEmpAvgCompletionRate(emp).toFixed(0) + '%';

                          return (
                            <div
                              key={`emp-row-${emp.employeeName}-${idx}`}
                              onClick={() => setSelectedBonusEmployee(emp)}
                              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 bg-white shadow-2xs transition-all cursor-pointer active:scale-[0.99] space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <h5 className="font-black text-slate-900 text-sm leading-tight">
                                      {emp.employeeName || 'Nhân viên'}
                                    </h5>
                                    <span className="text-[10.5px] font-bold text-slate-400">
                                      Nhân viên bán hàng
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
                                    {totalPointsVal}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100/80">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-black border ${ratingBadgeClass}`}>
                                    {ratingLetter}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    Hoàn thành TB: <span className="font-bold text-slate-700">{avgComp}</span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold">
                                  <span>Xem chi tiết</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* WEB APP VIEW (TỐI ƯU HÓA HOÀN TOÀN CHO GIAO DIỆN DESKTOP / TRÌNH CHIẾU / HỌP) */}
                {/* ========================================================================= */}
                <div className="hidden md:block space-y-6">
                  {/* HÀNG 1: TỔNG QUAN ĐỘI NGŨ & HIỆU SUẤT 9 NHÓM (2 CỘT CÂN ĐỐI) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Cột Trái (lg:col-span-5): Kết Quả Đội Ngũ + Cần Quan Tâm */}
                    <div className="lg:col-span-5 space-y-5">
                      {/* Card Kết Quả Đội Ngũ */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm md:text-base font-black uppercase tracking-wider text-slate-600">
                              KẾT QUẢ ĐỘI NGŨ
                            </div>
                            <div className="text-base md:text-lg font-bold text-emerald-800 mt-1">
                              Quy mô: <span className="text-slate-900 font-black">{totalEmp}</span> nhân sự
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-4xl lg:text-5xl font-black text-slate-900 font-mono tracking-tight leading-none">
                              {teamAvgPointsDisplay}
                            </div>
                            <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500 mt-1.5">
                              Điểm trung bình đội ngũ
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Phân bố xếp loại */}
                        <div>
                          <div className="text-sm md:text-base font-black text-slate-700 mb-3">
                            Phân bố xếp loại nhân sự:
                          </div>
                          <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                            {/* A */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 sm:p-3 text-center transition-all hover:bg-emerald-50">
                              <div className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-emerald-700 text-white text-sm md:text-base font-black mb-1.5 shadow-2xs">
                                A
                              </div>
                              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-950 font-mono leading-tight">
                                {ratingStats.A.count}
                              </div>
                              <div className="text-xs md:text-sm font-bold text-emerald-700 mt-0.5">
                                {ratingStats.A.pct}%
                              </div>
                            </div>

                            {/* B+ */}
                            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-2.5 sm:p-3 text-center transition-all hover:bg-teal-50">
                              <div className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-teal-700 text-white text-sm md:text-base font-black mb-1.5 shadow-2xs">
                                B+
                              </div>
                              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-teal-950 font-mono leading-tight">
                                {ratingStats['B+'].count}
                              </div>
                              <div className="text-xs md:text-sm font-bold text-teal-700 mt-0.5">
                                {ratingStats['B+'].pct}%
                              </div>
                            </div>

                            {/* B */}
                            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 sm:p-3 text-center transition-all hover:bg-blue-50">
                              <div className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-700 text-white text-sm md:text-base font-black mb-1.5 shadow-2xs">
                                B
                              </div>
                              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-blue-950 font-mono leading-tight">
                                {ratingStats.B.count}
                              </div>
                              <div className="text-xs md:text-sm font-bold text-blue-700 mt-0.5">
                                {ratingStats.B.pct}%
                              </div>
                            </div>

                            {/* C */}
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 sm:p-3 text-center transition-all hover:bg-amber-50">
                              <div className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-amber-600 text-white text-sm md:text-base font-black mb-1.5 shadow-2xs">
                                C
                              </div>
                              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-950 font-mono leading-tight">
                                {ratingStats.C.count}
                              </div>
                              <div className="text-xs md:text-sm font-bold text-amber-700 mt-0.5">
                                {ratingStats.C.pct}%
                              </div>
                            </div>

                            {/* D */}
                            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-2.5 sm:p-3 text-center transition-all hover:bg-rose-50">
                              <div className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-rose-600 text-white text-sm md:text-base font-black mb-1.5 shadow-2xs">
                                D
                              </div>
                              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-rose-950 font-mono leading-tight">
                                {ratingStats.D.count}
                              </div>
                              <div className="text-xs md:text-sm font-bold text-rose-700 mt-0.5">
                                {ratingStats.D.pct}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Cần Quan Tâm */}
                      {attentionList.length > 0 && (
                        <div className="bg-white rounded-2xl border border-rose-200 shadow-xs p-5 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 text-base md:text-lg uppercase tracking-tight">
                                  CẦN QUAN TÂM
                                </h4>
                                <p className="text-xs md:text-sm text-slate-500 font-semibold">
                                  Top nhân sự điểm thấp cần hỗ trợ thúc đẩy
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs md:text-sm font-black">
                              {attentionList.length} nhân sự
                            </span>
                          </div>

                          <div className="space-y-2">
                            {attentionList.map((emp, idx) => {
                              const totalPts = getEmpTotalPointsDisplay(emp);
                              const ratingLetter = formatRatingLetter(getEmpRatingDisplay(emp));
                              const avgComp = getEmpAvgCompletionRate(emp).toFixed(0) + '%';
                              const isD = ratingLetter.includes('D');

                              return (
                                <div
                                  key={`attn-web-${emp.employeeName}-${idx}`}
                                  onClick={() => setSelectedBonusEmployee(emp)}
                                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-rose-50/40 hover:border-rose-300 transition-all cursor-pointer group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className={`w-3 h-3 rounded-full shrink-0 ${isD ? 'bg-rose-500 ring-2 ring-rose-200' : 'bg-amber-500 ring-2 ring-amber-200'}`} />
                                    <div className="min-w-0">
                                      <div className="font-black text-slate-900 text-sm md:text-base truncate group-hover:text-rose-700 transition-colors">
                                        {emp.employeeName}
                                      </div>
                                      <div className="text-xs md:text-sm text-slate-600 font-medium">
                                        Xếp loại <span className={`font-black ${isD ? 'text-rose-600' : ratingLetter === 'B+' ? 'text-teal-600' : ratingLetter === 'B' ? 'text-blue-600' : ratingLetter === 'A' ? 'text-emerald-600' : 'text-amber-600'}`}>{ratingLetter}</span> • Hoàn thành TB: <span className="font-bold text-slate-800">{avgComp}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                                    <span className="font-black text-slate-900 text-base md:text-lg font-mono">
                                      {totalPts}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cột Phải (lg:col-span-7): Hiệu Suất Theo 9 Nhóm Toàn Đội */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
                          <div>
                            <h4 className="font-black text-slate-900 text-lg md:text-xl uppercase tracking-tight">
                              HIỆU SUẤT THEO 9 NHÓM SẢN PHẨM
                            </h4>
                            <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
                              Tỷ lệ hoàn thành và điểm số trung bình toàn đội
                            </p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs md:text-sm font-mono">
                            9 NHÓM
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                          {teamGroupStats.map((grp, gIdx) => {
                            const pctVal = grp.avgRatePct;
                            const progressWidth = Math.min(100, Math.max(0, pctVal));
                            const isFinished = pctVal >= 100;

                            return (
                              <div key={`team-grp-web-${gIdx}`} className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/60 border border-slate-200">
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-slate-800 text-xs md:text-sm lg:text-base tracking-tight truncate pr-2" title={grp.name}>
                                    {grp.name}
                                  </span>
                                  <span className="font-black text-slate-900 text-xs md:text-sm lg:text-base font-mono shrink-0">
                                    {grp.displayPoints} điểm
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <div className="flex-1 bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isFinished 
                                          ? 'bg-emerald-500' 
                                          : pctVal >= 80 
                                          ? 'bg-teal-500' 
                                          : pctVal >= 50 
                                          ? 'bg-amber-500' 
                                          : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${progressWidth}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs md:text-sm lg:text-base font-black font-mono shrink-0 min-w-[48px] text-right ${
                                    isFinished ? 'text-emerald-700' : 'text-slate-800'
                                  }`}>
                                    {grp.displayRate}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs md:text-sm text-slate-600 font-semibold">
                        <span>Màu sắc tiến độ:</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Đạt ≥100%</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> 80-99%</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 50-79%</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> &lt;50%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* HÀNG 2: BẢNG TỔNG HỢP TOÀN BỘ NHÂN SỰ VÀ 9 NHÓM SẢN PHẨM (DESKTOP DATA TABLE - OUTLINE RÕ RÀNG CHO TRÌNH CHIẾU / HỌP) */}
                  <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden">
                    {/* Bảng Toolbar & Filter Header */}
                    <div className="p-5 border-b border-slate-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/70">
                      <div>
                        <h4 className="font-black text-slate-900 text-lg md:text-xl uppercase tracking-tight">
                          BẢNG ĐÁNH GIÁ THƯỞNG NĂM CHI TIẾT
                        </h4>
                        <p className="text-xs md:text-sm text-slate-600 font-semibold mt-1">
                          Hiển thị {displayedEmployeeList.length} / {totalEmp} nhân sự • Xem nhanh điểm số 9 nhóm và tổng điểm
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Search bar desktop */}
                        <div className="relative min-w-[260px]">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={bonusSearchKeyword}
                            onChange={(e) => setBonusSearchKeyword(e.target.value)}
                            placeholder="Tìm kiếm nhân viên..."
                            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                          />
                          {bonusSearchKeyword && (
                            <button
                              type="button"
                              onClick={() => setBonusSearchKeyword('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Filter rating pills desktop */}
                        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setBonusRatingFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                              bonusRatingFilter === 'all'
                                ? 'bg-slate-800 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Tất cả ({totalEmp})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBonusRatingFilter('A')}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
                              bonusRatingFilter === 'A'
                                ? 'bg-emerald-700 text-white shadow-2xs'
                                : 'text-emerald-800 hover:bg-emerald-50'
                            }`}
                          >
                            A ({ratingStats.A.count})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBonusRatingFilter('B+')}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
                              bonusRatingFilter === 'B+'
                                ? 'bg-teal-700 text-white shadow-2xs'
                                : 'text-teal-800 hover:bg-teal-50'
                            }`}
                          >
                            B+ ({ratingStats['B+'].count})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBonusRatingFilter('B')}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
                              bonusRatingFilter === 'B'
                                ? 'bg-blue-700 text-white shadow-2xs'
                                : 'text-blue-800 hover:bg-blue-50'
                            }`}
                          >
                            B ({ratingStats.B.count})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBonusRatingFilter('C')}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
                              bonusRatingFilter === 'C'
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'text-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            C ({ratingStats.C.count})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBonusRatingFilter('D')}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
                              bonusRatingFilter === 'D'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-rose-800 hover:bg-rose-50'
                            }`}
                          >
                            D ({ratingStats.D.count})
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Table Content - BẢNG OUTLINE HÀNG CỘT RÕ RÀNG & CHỮ TO CHO TRÌNH CHIẾU / HỌP */}
                    <div className="overflow-x-auto p-3 sm:p-4 bg-slate-50/20">
                      <table className="w-full text-left border-collapse border border-slate-300 min-w-[1150px] bg-white">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 text-xs md:text-sm lg:text-base font-black uppercase tracking-wider">
                            <th className="py-3.5 px-4 border border-slate-300 whitespace-nowrap min-w-[180px]">Nhân viên</th>
                            {BONUS_GROUP_COLUMNS.map((col, idx) => (
                              <th key={`th-col-${idx}`} className="py-3.5 px-2.5 text-center font-black text-slate-800 whitespace-nowrap border border-slate-300">
                                {col.label}
                              </th>
                            ))}
                            <th className="py-3.5 px-3.5 text-center whitespace-nowrap border border-slate-300 bg-emerald-100/70 text-emerald-950">
                              Tổng Điểm
                            </th>
                            <th className="py-3.5 px-3.5 text-center whitespace-nowrap border border-slate-300 bg-amber-100/60 text-amber-950">
                              Xếp Loại
                            </th>
                            <th className="py-3.5 px-3.5 text-center w-28 border border-slate-300">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs md:text-sm">
                          {displayedEmployeeList.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="py-12 text-center text-slate-400 font-bold border border-slate-300 text-sm md:text-base">
                                Không tìm thấy nhân viên phù hợp với bộ lọc.
                              </td>
                            </tr>
                          ) : (
                            displayedEmployeeList.map((emp, empIdx) => {
                              const totalPointsVal = getEmpTotalPointsDisplay(emp);
                              const ratingRaw = getEmpRatingDisplay(emp);
                              const ratingLetter = formatRatingLetter(ratingRaw);
                              const ratingBadgeClass = getRatingBadgeStyle(ratingLetter);

                              return (
                                <tr
                                  key={`tr-emp-${emp.employeeName}-${empIdx}`}
                                  onClick={() => setSelectedBonusEmployee(emp)}
                                  className="border border-slate-300 transition-colors cursor-pointer group even:bg-slate-50/70 odd:bg-white hover:bg-emerald-50/70"
                                >
                                  <td className="py-3 px-4 border border-slate-300 whitespace-nowrap">
                                    <div className="font-black text-slate-900 text-sm md:text-base group-hover:text-emerald-800 transition-colors whitespace-nowrap">
                                      {emp.employeeName}
                                    </div>
                                  </td>
                                  {BONUS_GROUP_COLUMNS.map((col, cIdx) => {
                                    const groupVal = getEmpGroupPointsVal(emp, col.key);
                                    const isGood = groupVal.pct >= 100;
                                    return (
                                      <td key={`td-${empIdx}-${cIdx}`} className="py-2.5 px-2 text-center border border-slate-300">
                                        <div className="font-black text-slate-900 font-mono text-sm md:text-base leading-tight">
                                          {groupVal.pts}
                                        </div>
                                        <div className={`text-xs md:text-sm font-bold font-mono mt-0.5 ${isGood ? 'text-emerald-700 font-black' : groupVal.pct >= 80 ? 'text-teal-700' : groupVal.pct >= 50 ? 'text-amber-700' : 'text-rose-600'}`}>
                                          {groupVal.rate}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="py-3 px-3.5 text-center font-mono font-black text-emerald-950 text-base md:text-lg lg:text-xl whitespace-nowrap border border-slate-300 bg-emerald-50/50">
                                    {totalPointsVal}
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap border border-slate-300 bg-amber-50/40">
                                    <span className={`inline-flex items-center justify-center min-w-[38px] px-3 py-1 rounded-lg text-xs md:text-sm lg:text-base font-black border shadow-2xs ${ratingBadgeClass}`}>
                                      {ratingLetter}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-center border border-slate-300">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBonusEmployee(emp);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all text-xs md:text-sm font-bold border border-emerald-300 shadow-2xs"
                                    >
                                      <span>Xem</span>
                                      <ChevronRight className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                  {/* 5. MODAL / CHI TIẾT NHÂN VIÊN KHI CHẠM VÀO */}
                  <AnimatePresence>
                    {selectedBonusEmployee && (
                      <div className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
                        <motion.div
                          ref={bonusEmpModalRef}
                          tabIndex={-1}
                          role="dialog"
                          aria-modal="true"
                          aria-label={selectedBonusEmployee.employeeName}
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 15 }}
                          className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden my-auto outline-none"
                        >
                          {/* Modal Top Header */}
                          <div className="p-4 sm:p-5 bg-emerald-700 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                              <Award className="w-6 h-6 text-emerald-200" />
                              <div>
                                <h3 className="text-lg md:text-xl font-black text-white leading-tight">
                                  {selectedBonusEmployee.employeeName}
                                </h3>
                                <span className="text-xs text-emerald-100 font-medium">
                                  Chi tiết đánh giá thưởng năm
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedBonusEmployee(null)}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Modal Body */}
                          <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                            {/* KẾT QUẢ ĐÁNH GIÁ */}
                            {(() => {
                              const totalPointsVal = getEmpTotalPointsDisplay(selectedBonusEmployee);
                              const ratingRaw = getEmpRatingDisplay(selectedBonusEmployee);
                              const ratingLetter = formatRatingLetter(ratingRaw);
                              const ratingBadgeClass = getRatingBadgeStyle(ratingLetter);

                              const empProductGroups = sortBonusGroups(
                                (selectedBonusEmployee.groups || []).filter(g => !g.groupName.toLowerCase().includes('tổng điểm'))
                              );

                              return (
                                <div className="space-y-4">
                                  <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
                                    <div className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                      KẾT QUẢ ĐÁNH GIÁ
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <div>
                                        <div className="text-4xl font-black text-slate-900 font-mono tracking-tight leading-none">
                                          {totalPointsVal}
                                        </div>
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-500 mt-1.5">
                                          TỔNG ĐIỂM
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className={`inline-flex items-center justify-center min-w-[50px] px-3.5 py-1.5 rounded-xl text-lg md:text-xl font-black border shadow-2xs ${ratingBadgeClass}`}>
                                          {ratingLetter}
                                        </span>
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-500 mt-1.5">
                                          XẾP LOẠI
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-100" />

                                  {/* 9 NHÓM ĐÁNH GIÁ */}
                                  <div className="space-y-3.5">
                                    <div className="text-xs font-black uppercase tracking-wider text-slate-600">
                                      9 NHÓM CHỈ TIÊU CHI TIẾT
                                    </div>
                                    {empProductGroups.map((g, gIdx) => {
                                      const displayName = getGroupDisplayName(g.groupName);
                                      const targetFormatted = g.target ? formatValue(g.target) : '0';
                                      const actualFormatted = g.actual ? formatValue(g.actual) : '0';
                                      const pctVal = g.completionRate * 100;
                                      const rateDisplay = pctVal.toFixed(1) + '%';
                                      const pointsDisplay = g.groupPoints !== undefined ? g.groupPoints.toLocaleString('vi-VN') : '0';
                                      const progressWidth = Math.min(100, Math.max(0, pctVal));
                                      const isFinished = pctVal >= 100;

                                      return (
                                        <div key={`modal-grp-${gIdx}`} className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                          {/* Row 1: [TÊN NHÓM] [ĐIỂM] */}
                                          <div className="flex items-center justify-between">
                                            <span className="font-black text-slate-900 text-sm md:text-base tracking-tight">
                                              {displayName}
                                            </span>
                                            <span className="font-black text-slate-900 text-sm md:text-base font-mono">
                                              {pointsDisplay} điểm
                                            </span>
                                          </div>

                                          {/* Row 2: Chỉ tiêu [giá trị] • Thực hiện [giá trị] */}
                                          <div className="text-xs md:text-sm text-slate-600 font-medium">
                                            Chỉ tiêu <span className="text-slate-800 font-bold">{targetFormatted}</span> • Thực hiện <span className="text-slate-900 font-black">{actualFormatted}</span>
                                          </div>

                                          {/* Row 3: [PROGRESS BAR] [%] */}
                                          <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/80">
                                              <div 
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                  isFinished 
                                                    ? 'bg-emerald-500' 
                                                    : pctVal >= 80 
                                                    ? 'bg-teal-500' 
                                                    : pctVal >= 50 
                                                    ? 'bg-amber-500' 
                                                    : 'bg-rose-500'
                                                }`}
                                                style={{ width: `${progressWidth}%` }}
                                              />
                                            </div>
                                            <span className={`text-xs md:text-sm font-black font-mono shrink-0 min-w-[48px] text-right ${
                                              isFinished ? 'text-emerald-700' : 'text-slate-800'
                                            }`}>
                                              {rateDisplay}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Modal Footer */}
                          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedBonusEmployee(null)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Đóng
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          );
        })()
      )}
      {/* MODAL: Cơ Cấu Tính Điểm & Xếp Loại */}
      <AnimatePresence>
        {showBonusScoringModal && (
          <div className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              ref={bonusScoringModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Cơ Cấu Tính Điểm & Xếp Loại"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 bg-emerald-700 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-emerald-200" />
                  <div>
                    <h3 className="font-black text-base sm:text-lg leading-tight uppercase tracking-wide">
                      Cơ Cấu Tính Điểm & Xếp Loại
                    </h3>
                    <p className="text-emerald-100 text-[11px] font-medium mt-0.5">
                      Hướng dẫn đánh giá & xét thưởng năm 2026
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBonusScoringModal(false)}
                  className="p-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-emerald-950 text-xs">
                {/* General Rule Notice */}
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-2.5 shadow-2xs">
                  <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="font-extrabold text-emerald-950 text-xs sm:text-sm leading-snug">
                    Tính điểm dựa trên lũy kế thực hiện / lũy kế chỉ tiêu bán hàng của năm 2026
                  </div>
                </div>

                {/* 5 Rules Categories */}
                <div className="space-y-3">
                  {/* Rule 1: Cao Cấp */}
                  <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                    <div className="font-black text-sm text-emerald-900 border-b border-emerald-100 pb-1">
                      1. Cao Cấp
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-semibold">
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Lớn hơn 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">20 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 100% - 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">15 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 90% - dưới 100%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">10 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 80% - dưới 90%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">5 điểm</div>
                      </div>
                    </div>
                    <div className="text-[11px] italic font-semibold text-amber-700 pt-0.5">
                      *** HRC không áp dụng tính điểm nhóm SP này.
                    </div>
                  </div>

                  {/* Rule 2: Trung Cấp */}
                  <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                    <div className="font-black text-sm text-emerald-900 border-b border-emerald-100 pb-1">
                      2. Trung Cấp
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-semibold">
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Lớn hơn 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">15 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 100% - 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">10 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 90% - dưới 100%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">5 điểm</div>
                      </div>
                    </div>
                    <div className="text-[11px] italic font-semibold text-amber-700 pt-0.5">
                      *** HRC không áp dụng tính điểm nhóm SP này.
                    </div>
                  </div>

                  {/* Rule 3: Tổng Dầu Đóng Gói Nhỏ */}
                  <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                    <div className="font-black text-sm text-emerald-900 border-b border-emerald-100 pb-1">
                      3. Tổng Dầu Đóng Gói Nhỏ <span className="font-semibold text-xs text-slate-600">(Đối với HRC là Tổng Dầu Đóng Gói)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-semibold">
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Lớn hơn 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">20 điểm <span className="text-[10px] text-amber-700 block sm:inline">(HRC - 55 điểm)</span></div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 100% - 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">15 điểm <span className="text-[10px] text-amber-700 block sm:inline">(HRC - 40 điểm)</span></div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 90% - dưới 100%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">10 điểm <span className="text-[10px] text-amber-700 block sm:inline">(HRC - 25 điểm)</span></div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 80% - dưới 90%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">5 điểm <span className="text-[10px] text-amber-700 block sm:inline">(HRC - 10 điểm)</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Rule 4: Ngành Hàng VFM / NDFC / HPC / GẠO / NON - WM */}
                  <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                    <div className="font-black text-sm text-emerald-900 border-b border-emerald-100 pb-1">
                      4. Ngành Hàng VFM / NDFC / HPC / GẠO / NON - WM
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-semibold">
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Lớn hơn 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">25 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 100% - 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">20 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 90% - dưới 100%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">15 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 80% - dưới 90%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">10 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center col-span-2 sm:col-span-1">
                        <div className="text-[11px] text-slate-600">Dưới 80%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">5 điểm</div>
                      </div>
                    </div>
                  </div>

                  {/* Rule 5: Ngành Hàng MCC */}
                  <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                    <div className="font-black text-sm text-emerald-900 border-b border-emerald-100 pb-1">
                      5. Ngành Hàng MCC
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-semibold">
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Lớn hơn 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">20 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 100% - 110%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">15 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 90% - dưới 100%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">10 điểm</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                        <div className="text-[11px] text-slate-600">Từ 80% - dưới 90%</div>
                        <div className="text-emerald-700 font-black text-xs mt-0.5">5 điểm</div>
                      </div>
                    </div>
                  </div>

                  {/* Classification Section: Phân Loại Kết Quả Đánh Giá */}
                  <div className="bg-white border border-emerald-300 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                    <div className="font-black text-sm text-emerald-950 flex items-center gap-1.5 border-b border-emerald-200 pb-1.5">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span>Phân Loại Kết Quả Đánh Giá</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-semibold">
                      <div className="bg-emerald-100/70 border border-emerald-300 p-2 rounded-lg text-center">
                        <div className="font-black text-emerald-950 text-sm">Xếp loại A</div>
                        <div className="text-[11px] font-bold text-emerald-800 mt-0.5">Từ 180 điểm trở lên</div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center">
                        <div className="font-black text-emerald-900 text-sm">Xếp loại B+</div>
                        <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Từ 160 đến dưới 180</div>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-200 p-2 rounded-lg text-center">
                        <div className="font-black text-emerald-900 text-sm">Xếp loại B</div>
                        <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Từ 120 đến dưới 160</div>
                      </div>
                      <div className="bg-amber-50/80 border border-amber-200 p-2 rounded-lg text-center">
                        <div className="font-black text-amber-900 text-sm">Xếp loại C</div>
                        <div className="text-[11px] font-bold text-amber-800 mt-0.5">Từ 80 đến dưới 120</div>
                      </div>
                      <div className="bg-rose-50/80 border border-rose-200 p-2 rounded-lg text-center col-span-2 sm:col-span-1">
                        <div className="font-black text-rose-900 text-sm">Xếp loại D</div>
                        <div className="text-[11px] font-bold text-rose-800 mt-0.5">Dưới 80 điểm</div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Discipline Section: Lưu Ý */}
                  <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-3.5 shadow-2xs space-y-2">
                    <div className="font-black text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-200 pb-1">
                      <Info className="w-4 h-4 text-amber-700" />
                      <span>Lưu Ý Về Kỷ Luật & Hạ Bậc Thưởng</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-amber-950 font-medium leading-relaxed list-disc list-inside">
                      <li>
                        Với những trường hợp vi phạm kỉ luật ở mức nhắc nhở, cảnh cáo bằng văn bản, Nhà phân phối / GSTT sẽ <strong className="font-black text-amber-900">hạ 01 bậc đánh giá</strong> nhưng tối đa không quá 02 bậc thưởng Tết của Nhân viên đó.
                      </li>
                      <li>
                        Với những trường hợp Nhân viên vi phạm kỉ luật nghiêm trọng, nhận <strong className="font-black text-rose-700">từ 03 văn bản nhắc nhở/ cảnh cáo trở lên</strong>, Nhà phân phối / GSTT sẽ <strong className="font-black text-rose-800">không áp dụng đánh giá thưởng Tết</strong> đối với Nhân viên đó.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-emerald-200 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBonusScoringModal(false)}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Đóng Hướng Dẫn
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zalo Share Modal for Product Detail / Category Targets */}
      {targetZaloModalState && (
        <ZaloShareImageModal
          isOpen={targetZaloModalState.isOpen}
          onClose={() => setTargetZaloModalState(null)}
          title={targetZaloModalState.title}
          subTitle={targetZaloModalState.subTitle}
          dataUrl={targetZaloModalState.dataUrl}
          blob={targetZaloModalState.blob}
          fileName={targetZaloModalState.fileName}
          copied={targetZaloModalState.copied}
        />
      )}
      {/* Sector Icon Picker Modal */}
      <SectorIconPickerModal
        isOpen={!!editingIconCategory}
        category={editingIconCategory || ''}
        customMap={customSectorIcons}
        onClose={() => setEditingIconCategory(null)}
        onSave={handleSaveCustomIcon}
        isSupervisor={isSupervisor}
      />
    </div>
  );
}
