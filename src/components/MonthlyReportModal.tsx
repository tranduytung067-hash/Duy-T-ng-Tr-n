import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import { 
  X, 
  Download, 
  Image as ImageIcon,
  RefreshCw,
  BadgeCheck,
  User,
  Calendar
} from 'lucide-react';
import MonthlyReportCard from './MonthlyReportCard';
import { db, collection, onSnapshot } from '../firebase';
import { cleanEmployeeName, sortAndFormatEmployeeNames, ALLOWED_EMPLOYEES_UP_TO_TUAN } from '../utils/sheetParser';
import { formatDateToVN } from '../utils/cycleHelper';
import { mockCttbEmployeeDetails, matchProgramName } from './CttbProgress';
import { ZaloIcon } from './ZaloShareImageModal';
import { useDialogFocus } from '../utils/useDialogFocus';

interface LeaveRequest {
  id: string;
  creatorName: string;
  offDate: string;
  toDate?: string;
  status: string;
}

interface NormalizedEmployeeAttendance {
  name: string;
  attendance: { [day: number]: string };
}

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployeeName: string;
  isEmployeeView: boolean;
  employees: any[];
  transactions: any[];
  clfDetailedRows: any[];
  mccDetailedRows: any[];
  ndfcDetailedRows: any[];
  cttbData: any;
  chamCongListData: any[];
  startDate: string;
  endDate: string;
  currentUser: any;
  sectorData: any;
  trungBayListData?: any[];
  tuNhienRecords?: any[];
  meizanRecords?: any[];
  attendanceSelectedCycle?: string;
  onOpenZaloShare?: (empName: string) => void;
}

export default function MonthlyReportModal({
  isOpen,
  onClose,
  selectedEmployeeName,
  isEmployeeView,
  employees = [],
  transactions = [],
  clfDetailedRows = [],
  mccDetailedRows = [],
  ndfcDetailedRows = [],
  cttbData = {},
  chamCongListData = [],
  startDate,
  endDate,
  currentUser,
  sectorData,
  trungBayListData = [],
  tuNhienRecords = [],
  meizanRecords = [],
  attendanceSelectedCycle,
  onOpenZaloShare
}: MonthlyReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);
  const [isExporting, setIsExporting] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // 1. Subscribe to approved leave requests for attendance calculation
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = onSnapshot(collection(db, 'leave_requests'), (snapshot) => {
      const list: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LeaveRequest);
      });
      setLeaveRequests(list);
    }, (error) => {
      console.error('Firestore LeaveRequest subscription failed in MonthlyReportModal:', error);
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Subscribe to real-time attendance history from Firestore
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = onSnapshot(collection(db, 'attendance_history'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setHistoryList(list);
    }, (error) => {
      console.error('Firestore attendance_history subscription failed in MonthlyReportModal:', error);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1080);
  const [cardHeight, setCardHeight] = useState(0);

  // Measure the available width inside the modal for scaling
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Measure the unscaled card height so we can scale the height of its wrapper exactly
  useEffect(() => {
    if (!isOpen) return;
    const el = document.getElementById('monthly-report-card');
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCardHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  const scale = useMemo(() => {
    // 24px padding on left/right means 48px total
    const availableWidth = containerWidth - 48;
    if (availableWidth >= 860) return 1;
    return Math.max(0.35, availableWidth / 860);
  }, [containerWidth]);

  // Determine current display employee context
  const [currentEmployeeName, setCurrentEmployeeName] = useState<string>(
    isEmployeeView ? (currentUser?.name || '') : (selectedEmployeeName || 'Tất cả')
  );

  useEffect(() => {
    if (selectedEmployeeName) {
      setCurrentEmployeeName(isEmployeeView ? (currentUser?.name || '') : selectedEmployeeName);
    }
  }, [selectedEmployeeName, isEmployeeView, currentUser]);

  const targetEmployee = isEmployeeView ? (currentUser?.name || '') : currentEmployeeName;
  const isAllSelected = targetEmployee === 'Tất cả' || !targetEmployee;

  const now = new Date();
  const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
  const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultAttendanceCycle = `${currentActiveYear}-${currentActiveMonth}`;

  // 2 cycles matching AttendanceSystem: current active cycle and 1 immediately preceding cycle
  const cycleOptions = useMemo(() => {
    return Array.from({ length: 2 }).map((_, idx) => {
      const d = new Date();
      d.setDate(20);
      d.setFullYear(currentActiveYear);
      d.setMonth(currentActiveMonth - idx);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = `Chu kỳ ${(m + 1) < 10 ? '0' + (m + 1) : (m + 1)}/${y}`;
      const value = `${y}-${m}`;
      return { label, value, month: m, year: y };
    });
  }, [currentActiveYear, currentActiveMonth]);

  // Attendance cycle filter state mapped with AttendanceSystem
  const [selectedCycle, setSelectedCycle] = useState<string>(
    attendanceSelectedCycle || defaultAttendanceCycle
  );

  useEffect(() => {
    if (attendanceSelectedCycle) {
      setSelectedCycle(attendanceSelectedCycle);
    }
  }, [attendanceSelectedCycle]);

  const isCurrentCycle = useMemo(() => {
    if (!selectedCycle) return true;
    const currentActiveCycle = `${currentActiveYear}-${currentActiveMonth}`;
    return selectedCycle === currentActiveCycle;
  }, [selectedCycle, currentActiveYear, currentActiveMonth]);

  // Helpers for formatting
  const formatMoney = (num: number) => {
    return num !== undefined && num !== null ? num.toLocaleString('vi-VN') + ' đ' : '0 đ';
  };

  const formatNumber = (num: number) => {
    return num !== undefined && num !== null ? num.toLocaleString('vi-VN') : '0';
  };

  const formatPercentage = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0%';
    return num.toFixed(1) + '%';
  };

  const formatQty = (num: number) => {
    if (num === undefined || num === null) return '0';
    return (Math.round(num * 10) / 10).toLocaleString('vi-VN');
  };

  // --- CALCULATION 1: REVENUE (DOANH SỐ) ---
  const activeEmployeesList = useMemo(() => {
    return employees.filter(emp => {
      if (isEmployeeView) {
        return emp.name?.toLowerCase().trim() === (currentUser?.name || '').toLowerCase().trim();
      }
      if (currentEmployeeName !== 'Tất cả') {
        return emp.name?.toLowerCase().trim() === currentEmployeeName.toLowerCase().trim();
      }
      return true;
    });
  }, [employees, currentEmployeeName, isEmployeeView, currentUser]);

  const totalRevenueTarget = useMemo(() => {
    return activeEmployeesList.reduce((sum, emp) => sum + (emp.targetVal || 0), 0);
  }, [activeEmployeesList]);

  const totalRevenueActual = useMemo(() => {
    return activeEmployeesList.reduce((sum, emp) => sum + (emp.actualVal || 0), 0);
  }, [activeEmployeesList]);

  const revenueCompletionRate = totalRevenueTarget > 0 ? (totalRevenueActual / totalRevenueTarget) * 100 : 0;

  // --- CALCULATION 2: ACTIVATION (KÍCH HOẠT) ---
  const activationStats = useMemo(() => {
    let k3T = 0, k3A = 0;
    let k4T = 0, k4A = 0;
    let khT = 0, khA = 0;
    let hrcT = 0, hrcA = 0;

    const isNguyenDucTuan = (name?: string) => {
      if (!name) return false;
      const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      return clean.includes('tuan');
    };

    activeEmployeesList.forEach((emp) => {
      k3T += emp.k3Target || 0;
      k3A += emp.k3Actual || 0;
      k4T += emp.k4Target || 0;
      k4A += emp.k4Actual || 0;
      khT += emp.khTarget || 0;
      khA += emp.khActual || 0;
      
      if (isNguyenDucTuan(emp.name)) {
        hrcT += emp.khmhThangTarget || 0;
        hrcA += emp.khmhThangActual || 0;
      }
    });

    return {
      k3Target: k3T,
      k3Actual: k3A,
      k3Completion: k3T > 0 ? (k3A / k3T) * 100 : 0,
      k4Target: k4T,
      k4Actual: k4A,
      k4Completion: k4T > 0 ? (k4A / k4T) * 100 : 0,
      khTarget: khT,
      khActual: khA,
      khCompletion: khT > 0 ? (khA / khT) * 100 : 0,
      hrcTarget: hrcT,
      hrcActual: hrcA,
      hrcCompletion: hrcT > 0 ? (hrcA / hrcT) * 100 : 0,
    };
  }, [activeEmployeesList]);

  // --- CALCULATION 3: CATEGORIES (NGÀNH HÀNG) ---
  const FMCG_SECTORS = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', 'VNT', 'DHF', '584NT', 'NON - WM'];

  const getEmployeeSectorPerformance = (empName: string, sector: string): { target: number, actual: number } => {
    if (sectorData) {
      if (empName === 'Tất cả') {
        let totalTarget = 0;
        let totalActual = 0;
        Object.values(sectorData).forEach((empPerf: any) => {
          if (empPerf[sector]) {
            totalTarget += empPerf[sector].target || 0;
            totalActual += empPerf[sector].actual || 0;
          }
        });
        return { target: totalTarget, actual: totalActual };
      }

      const cleanEmpName = empName.trim().toLowerCase().replace(/\s+/g, '');
      const empKey = Object.keys(sectorData).find(
        (name) => name.trim().toLowerCase().replace(/\s+/g, '') === cleanEmpName
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
    }
    return { target: 0, actual: 0 };
  };

  const sectorPerformanceRows = useMemo(() => {
    return FMCG_SECTORS.map((sector) => {
      const filteredTx = transactions.filter((tx) => {
        const matchCategory = tx.NganhHang?.toUpperCase().includes(sector);
        const matchEmployee = isAllSelected || tx.NhanVien === targetEmployee;
        return matchCategory && matchEmployee;
      });

      const totalQty = filteredTx.reduce((sum, tx) => sum + tx.SoLuong, 0);
      const totalTransactions = filteredTx.length;

      let targetVal = 0;
      let actualVal = 0;

      if (!isAllSelected) {
        const perf = getEmployeeSectorPerformance(targetEmployee, sector);
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
        totalTransactions
      };
    });
  }, [sectorData, targetEmployee, isAllSelected, employees, transactions]);

  // --- CALCULATION 4: SUB-PRODUCTS (SẢN PHẨM CON) ---
  const parseValueFromString = (v: any): number => {
    if (v === undefined || v === null) return 0;
    if (typeof v === 'number') return v;
    const strVal = String(v).trim();
    if (!strVal || strVal.toLowerCase() === 'null' || strVal.toLowerCase() === 'undefined') return 0;
    
    let cleaned = strVal.replace(/\s/g, '');
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes('.') && cleaned.includes(',')) {
      const lastCommaIdx = cleaned.lastIndexOf(',');
      const lastDotIdx = cleaned.lastIndexOf('.');
      if (lastDotIdx < lastCommaIdx) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts[parts.length - 1].length <= 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    const num = parseFloat(cleaned.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const getRowEmployeeName = (row: any): string => {
    if (!row) return '';
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

    if (row['A']) {
      const val = String(row['A']).trim();
      if (val && !val.toLowerCase().includes('tổng') && !val.toLowerCase().includes('chỉ tiêu') && !val.toLowerCase().includes('thực tế') && !val.toLowerCase().includes('nhân viên') && !val.toLowerCase().includes('clf') && !val.toLowerCase().includes('mcc') && !val.toLowerCase().includes('ndfc')) {
        return cleanEmployeeName(val);
      }
    }
    if (row['B']) {
      const val = String(row['B']).trim();
      if (val && !val.toLowerCase().includes('tổng') && !val.toLowerCase().includes('chỉ tiêu') && !val.toLowerCase().includes('thực tế') && !val.toLowerCase().includes('nhân viên') && !val.toLowerCase().includes('clf') && !val.toLowerCase().includes('mcc') && !val.toLowerCase().includes('ndfc') && val.length > 2) {
        return cleanEmployeeName(val);
      }
    }
    return '';
  };

  const matchesEmployeeRow = (row: any, targetEmp: string, isAll: boolean): boolean => {
    if (isAll) return true;
    const empNameInRow = getRowEmployeeName(row);
    if (!empNameInRow) return false;

    const normalize = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
    const c1 = normalize(empNameInRow);
    const c2 = normalize(targetEmp);

    if (c1 === c2) return true;
    if (c1.length >= 4 && c2.length >= 4 && (c1.includes(c2) || c2.includes(c1))) return true;
    return false;
  };

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
      const firstRow = rows[0];
      if (firstRow) {
        const keys = Object.keys(firstRow);
        const hasExactTargetCol = keys.includes(targetCol);
        const hasExactActualCol = keys.includes(actualCol);

        if (!hasExactTargetCol || !hasExactActualCol) {
          const searchKeywords: { [key: string]: { brand: string[], targetKeywords: string[], actualKeywords: string[] } } = {
            'CLF_I_J': { brand: ['neptune'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_O_P': { brand: ['simply'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_T_U': { brand: ['simply gao lut', 'gao lut'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_Y_Z': { brand: ['meizan gold', 'meizan_gold'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AD_AE': { brand: ['meizan sbo', 'meizan bơ', 'meizan bo'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AI_AJ': { brand: ['bơ', 'bo'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AX_AY': { brand: ['dầu mè', 'dau me', 'mè', 'me'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AS_AT': { brand: ['kiddy', 'olive'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_AN_AO': { brand: ['olivoila'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_BH_BI': { brand: ['cái lân', 'cai lan', 'orchid'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'CLF_BR_BS': { brand: ['đóng gói lớn', 'bp'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'MCC_I_J': { brand: ['bột', 'bot'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'MCC_O_P': { brand: ['khác', 'khac'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'NDFC_I_J': { brand: ['nước tương', 'nuoc tuong'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'NDFC_O_P': { brand: ['tương xốt', 'tuong xot', 'xốt', 'xot'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'NDFC_T_U': { brand: ['hạt nêm', 'hat nem'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
            'NDFC_Y_Z': { brand: ['bột ngọt', 'bot ngot'], targetKeywords: ['chi tieu', 'target'], actualKeywords: ['thuc', 'actual', 'dat'] },
          };

          const config = searchKeywords[fallbackKey];
          if (config) {
            const cleanStr = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
            
            const matchedTargetKey = keys.find(k => {
              const kClean = cleanStr(k);
              const hasBrand = config.brand.some(b => kClean.includes(cleanStr(b)));
              const hasTarget = config.targetKeywords.some(tk => kClean.includes(tk));
              const isActual = config.actualKeywords.some(ak => kClean.includes(ak));
              return hasBrand && hasTarget && !isActual;
            });

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

      rows.forEach((row) => {
        if (matchesEmployeeRow(row, targetEmployee, isAllSelected)) {
          const empName = getRowEmployeeName(row);
          if (
            !empName.toLowerCase().includes('tổng cộng') &&
            !empName.toLowerCase().includes('total') &&
            !empName.toLowerCase().includes('tên nhân viên') &&
            !empName.toLowerCase().startsWith('tổng') &&
            !empName.toLowerCase().startsWith('tong')
          ) {
            hasMatchingRow = true;
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
        const mult = isAllSelected ? (employees && employees.length > 0 ? employees.length : 8) : 1;
        const empFactor = targetEmployee === 'Trần Thị Bình' ? 1.08 : (targetEmployee === 'Nguyễn Văn An' ? 0.92 : 1.0);
        return {
          target: parseFloat((base.target * mult).toFixed(2)),
          actual: parseFloat((base.actual * mult * empFactor).toFixed(2))
        };
      }
    }

    return { 
      target: parseFloat(targetSum.toFixed(3)), 
      actual: parseFloat(actualSum.toFixed(3)) 
    };
  };

  const productGroupsList = useMemo(() => {
    // CLF
    const neptune = sumDetailedColumns(clfDetailedRows, 'I', 'J', 'CLF_I_J');
    const simply = sumDetailedColumns(clfDetailedRows, 'O', 'P', 'CLF_O_P');
    const simplyGaoLut = sumDetailedColumns(clfDetailedRows, 'T', 'U', 'CLF_T_U');
    const tongCaoCap = { target: neptune.target + simply.target, actual: neptune.actual + simply.actual };
    
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

    // MCC
    const nhomBot = sumDetailedColumns(mccDetailedRows, 'I', 'J', 'MCC_I_J');
    const sanPhamKhac = sumDetailedColumns(mccDetailedRows, 'O', 'P', 'MCC_O_P');

    // NDFC
    const nuocTuong = sumDetailedColumns(ndfcDetailedRows, 'I', 'J', 'NDFC_I_J');
    const tuongXot = sumDetailedColumns(ndfcDetailedRows, 'O', 'P', 'NDFC_O_P');
    const hatNem = sumDetailedColumns(ndfcDetailedRows, 'T', 'U', 'NDFC_T_U');
    const botNgot = sumDetailedColumns(ndfcDetailedRows, 'Y', 'Z', 'NDFC_Y_Z');

    const rawList = [
      // CLF
      { cat: 'CLF', name: 'Neptune', ...neptune },
      { cat: 'CLF', name: 'Simply', ...simply },
      { cat: 'CLF', name: 'Tổng Cao Cấp', ...tongCaoCap, isComp: true },
      { cat: 'CLF', name: 'Simply Dầu Gạo Lứt', ...simplyGaoLut },
      { cat: 'CLF', name: 'Meizan Gold', ...meizanGold },
      { cat: 'CLF', name: 'Meizan SBO', ...meizanSbo },
      { cat: 'CLF', name: 'Tổng Trung Cấp', ...tongTrungCap, isComp: true },
      { cat: 'CLF', name: 'Tổng Sản Phẩm Ngách', ...tongSanPhamNgach, isComp: true },
      { cat: 'CLF', name: 'Cái Lân & Orchid', ...caiLanOrchid },
      { cat: 'CLF', name: 'Tổng Dầu ĐG Nhỏ', ...tongDauDongGoiNho, isComp: true },
      { cat: 'CLF', name: 'Dầu ĐG Lớn (BP)', ...dauDongGoiLon, isComp: true },

      // MCC
      { cat: 'MCC', name: 'Nhóm Bột', ...nhomBot },
      { cat: 'MCC', name: 'Sản Phẩm Khác', ...sanPhamKhac },

      // NDFC
      { cat: 'NDFC', name: 'Nước Tương', ...nuocTuong },
      { cat: 'NDFC', name: 'Tương Xốt', ...tuongXot },
      { cat: 'NDFC', name: 'Hạt Nêm', ...hatNem },
      { cat: 'NDFC', name: 'Bột Ngọt', ...botNgot }
    ];

    return rawList.map(item => {
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
  }, [clfDetailedRows, mccDetailedRows, ndfcDetailedRows, targetEmployee, isAllSelected]);

  // Split products by category for easy display
  const clfSubProducts = useMemo(() => productGroupsList.filter(p => p.cat === 'CLF'), [productGroupsList]);
  const mccSubProducts = useMemo(() => productGroupsList.filter(p => p.cat === 'MCC'), [productGroupsList]);
  const ndfcSubProducts = useMemo(() => productGroupsList.filter(p => p.cat === 'NDFC'), [productGroupsList]);

  // --- CALCULATION 5: CAMPAIGNS (CTTB) ---
  const programsList = ['Thuê Kệ', 'Nước Rửa Chén', 'Giặt Xả', 'TRÀ VINATEA', 'Gạo', 'Nam Dương', 'Mắm 584NT', 'Trưng Bày Tự Nhiên'];
  
  const cttbSummary = useMemo(() => {
    let totalThamGia = 0;
    let totalDat = 0;
    let totalKhongBoAnh = 0;

    const cleanCompare = (aStr: string, bStr: string) => {
      const clean = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, '');
      return clean(aStr) === clean(bStr);
    };

    const targetEmployees = isAllSelected 
      ? sortAndFormatEmployeeNames(employees.map(e => e.name))
      : [targetEmployee];

    const programs = programsList.map(prog => {
      let thamGia = 0;
      let dat = 0;
      let khongBoAnh = 0;

      targetEmployees.forEach(emp => {
        let foundStats = false;

        const getRowVal = (row: any, searchKeys: string[]) => {
          if (!row) return '';
          const rowKeys = Object.keys(row);
          for (const key of searchKeys) {
            const found = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
            if (found !== undefined && row[found] !== undefined && row[found] !== null) {
              const val = String(row[found]).trim();
              if (val !== '') return val;
            }
          }
          return '';
        };

        // 1. Primary Source of Truth: Direct row-by-row count from trungBayListData (Danh Sách Trưng Bày)
        if (trungBayListData && trungBayListData.length > 0) {
          const empKeys = ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff', 'b', 'saleman', 'tên nhân viên', 'ten nhan vien'];
          const progKeys = ['ten cttb', 'tên cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'tên chương trình', 'chuong trinh trung bay', 'chương trình trưng bày', 'f', 'program'];
          const photoKeys = ['so bo anh', 'số bộ ảnh', 'so luong bo anh', 'số lượng bộ ảnh', 'bo anh', 'bộ ảnh', 'h', 'photos'];
          const stdKeys = ['trang thai dat', 'trạng thái đạt', 'dat tieu chuan', 'đạt tiêu chuẩn', 'xet dat ds / sl', 'xét đạt ds / sl', 'dat chuan', 'đạt chuẩn', 'l', 'status', 'xet dat'];

          let rawKhDat = 0;
          let rawKhThamGia = 0;
          let rawKhongBoAnh = 0;
          let matchCount = 0;

          trungBayListData.forEach((row) => {
            const empInRow = getRowVal(row, empKeys) || row['B'] || '';
            const progInRow = getRowVal(row, progKeys) || row['F'] || '';

            if (matchProgramName(progInRow, prog) && cleanCompare(empInRow, emp)) {
              matchCount++;
              // Col F: Tên CTTB
              const rawF = (getRowVal(row, progKeys) || row['F'] || '').toString().trim();
              const lowerF = rawF.toLowerCase();
              if (rawF && lowerF !== 'tên cttb' && lowerF !== 'tên chương trình' && lowerF !== 'cttb' && lowerF !== 'f') {
                rawKhThamGia++;

                // Col H: Số Bộ Ảnh < 1 (Thiếu bộ ảnh / 0 bộ ảnh)
                const rawH = (getRowVal(row, photoKeys) || row['H'] || '').toString().trim();
                const lowerH = rawH.toLowerCase();
                if (lowerH !== 'số bộ ảnh' && lowerH !== 'h') {
                  const numH = parseFloat(rawH.replace(/[^0-9.]/g, ''));
                  if (rawH === '' || isNaN(numH) || numH < 1) {
                    rawKhongBoAnh++;
                  }
                }

                // Col L: Đạt Tiêu Chuẩn === "Đạt"
                const rawL = (
                  row['Đạt Tiêu Chuẩn'] ||
                  row['L'] ||
                  row['l'] ||
                  (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
                  getRowVal(row, stdKeys) ||
                  ''
                ).toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
                if ((rawL.includes('dat') || rawL === 'd') && !rawL.includes('khong') && !rawL.includes('kh') && !rawL.includes('chua')) {
                  rawKhDat++;
                }
              }
            }
          });

          if (matchCount > 0 || rawKhThamGia > 0) {
            thamGia += rawKhThamGia;
            dat += rawKhDat;
            khongBoAnh += rawKhongBoAnh;
            foundStats = true;
          } else {
            const empInRaw = trungBayListData.some(row => {
              const empInRow = getRowVal(row, empKeys) || row['B'] || '';
              return cleanCompare(empInRow, emp);
            });
            if (empInRaw) {
              foundStats = true;
            }
          }
        }

        // 2. Secondary Source of Truth: Check from cttbData (parsed directly from "Sheet Tổng Hợp TB" tab)
        if (!foundStats && cttbData && Object.keys(cttbData).length > 0) {
          const empKey = Object.keys(cttbData).find(k => cleanCompare(k, emp));
          if (empKey && cttbData[empKey]) {
            const progKey = Object.keys(cttbData[empKey]).find(p => cleanCompare(p, prog));
            if (progKey && cttbData[empKey][progKey]) {
              const entry = cttbData[empKey][progKey];
              thamGia += entry.khThamGia || 0;
              dat += entry.khDat || 0;
              khongBoAnh += entry.khKhongBoAnh || 0;
              foundStats = true;
            }
          }
        }

        // 3. Fallback to mockCttbEmployeeDetails
        if (!foundStats) {
          const mockProgDetails = mockCttbEmployeeDetails[prog]?.[emp];
          if (mockProgDetails) {
            thamGia += mockProgDetails.khThamGia || 0;
            dat += mockProgDetails.khDat || 0;
            khongBoAnh += mockProgDetails.khKhongBoAnh || 0;
          }
        }
      });

      const safeThamGia = Math.max(0, thamGia);
      const safeDat = Math.min(safeThamGia, Math.max(0, dat));
      const safeKhongBoAnh = Math.min(safeThamGia, Math.max(0, khongBoAnh));

      return {
        name: prog,
        thamGia: safeThamGia,
        dat: safeDat,
        khongBoAnh: safeKhongBoAnh,
        rate: safeThamGia > 0 ? (safeDat / safeThamGia) * 100 : 0
      };
    });

    programs.forEach(p => {
      if (p.name === 'Trưng Bày Tự Nhiên' || cleanCompare(p.name, 'Trưng Bày Tự Nhiên')) return;
      totalThamGia += p.thamGia;
      totalDat += p.dat;
      totalKhongBoAnh += p.khongBoAnh;
    });

    return {
      totalThamGia,
      totalDat,
      totalKhongBoAnh,
      rate: totalThamGia > 0 ? (totalDat / totalThamGia) * 100 : 0,
      programs
    };
  }, [cttbData, targetEmployee, isAllSelected, employees, trungBayListData]);

  // --- CALCULATION 6: ATTENDANCE SUMMARY (TỔNG KẾT CHẤM CÔNG) ---
  const attendanceCycleDates = useMemo(() => {
    const cycleToUse = attendanceSelectedCycle || (() => {
      const now = new Date();
      const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
      const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      return `${currentActiveYear}-${currentActiveMonth}`;
    })();

    const parts = cycleToUse.split('-');
    if (parts.length !== 2) return { startStr: '', endStr: '', dates: [] };

    const selectedYear = parseInt(parts[0], 10);
    const selectedMonth = parseInt(parts[1], 10);

    const cycleStartYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const cycleStartMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const cycleStartDate = new Date(cycleStartYear, cycleStartMonth, 21);
    const cycleEndDate = new Date(selectedYear, selectedMonth, 20);

    const dates: Date[] = [];
    const tempDateForCycle = new Date(cycleStartDate);
    while (tempDateForCycle <= cycleEndDate) {
      dates.push(new Date(tempDateForCycle));
      tempDateForCycle.setDate(tempDateForCycle.getDate() + 1);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${cycleStartDate.getFullYear()}-${pad(cycleStartDate.getMonth() + 1)}-${pad(cycleStartDate.getDate())}`;
    const endStr = `${cycleEndDate.getFullYear()}-${pad(cycleEndDate.getMonth() + 1)}-${pad(cycleEndDate.getDate())}`;

    return { startStr, endStr, dates };
  }, [attendanceSelectedCycle]);

  const parsedDates = attendanceCycleDates.dates;

  const totalWorkdaysInCycle = useMemo(() => {
    return parsedDates.filter(d => d.getDay() !== 0).length;
  }, [parsedDates]);

  const getApprovedLeaveForDay = (employeeName: string, dateObj: Date): LeaveRequest | undefined => {
    const paddedDay = dateObj.getDate() < 10 ? `0${dateObj.getDate()}` : `${dateObj.getDate()}`;
    const paddedMonth = (dateObj.getMonth() + 1) < 10 ? `0${dateObj.getMonth() + 1}` : `${dateObj.getMonth() + 1}`;
    const dateStr = `${dateObj.getFullYear()}-${paddedMonth}-${paddedDay}`;
    
    return leaveRequests.find((req) => {
      if (req.status !== 'Đã duyệt') return false;
      if (req.creatorName.toLowerCase().trim() !== employeeName.toLowerCase().trim()) return false;
      const start = req.offDate;
      const end = req.toDate || req.offDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  const getAttendanceDetail = (val: string, dayNum: number, employeeName: string, dateObjInput: Date) => {
    const isSunday = dateObjInput.getDay() === 0;
    if (!isSunday) {
      const approvedLeave = getApprovedLeaveForDay(employeeName, dateObjInput);
      if (approvedLeave) {
        return { text: 'Nghỉ', type: 'off' as const, isLeaveApproved: true, hasSkip: false, skipCount: 0 };
      }
    }

    if (isSunday) {
      return { text: 'CN', type: 'sunday' as const, hasSkip: false, skipCount: 0 };
    }

    const rawClean = (val || '').toString().trim();
    const status = rawClean.toUpperCase();

    if (!rawClean || status === '#N/A' || status.includes('#N/A')) {
      return { text: '', type: 'empty' as const, hasSkip: false, skipCount: 0 };
    }

    let hasSkip = false;
    let skipCount = 0;

    const skipMatch = status.match(/(?:BỎ\s*ĐIỂM(?:\s*BÁN)?|BĐB|BDB|LỖI\s*BỎ\s*ĐIỂM|BỎ\s*ĐPB)[\s:=]*(-?\s*\d+)/i)
      || status.match(/BỎ\s*(-?\s*\d+)\s*ĐIỂM/i);

    if (skipMatch) {
      const parsedVal = parseInt(skipMatch[1].replace(/\s+/g, ''), 10);
      if (!isNaN(parsedVal)) {
        hasSkip = true;
        skipCount = Math.max(0, parsedVal);
      }
    } else if (
      status.includes('BỎ ĐIỂM') ||
      status.includes('BO DIEM') ||
      status.includes('BỎ ĐPB') ||
      status.includes('BO DPB') ||
      status.includes('BĐB') ||
      status.includes('BDB') ||
      status.includes('BỎ ĐIỂM BÁN') ||
      status.includes('BO DIEM BAN') ||
      status.includes('LỖI BỎ ĐIỂM') ||
      status.includes('LOI BO DIEM')
    ) {
      hasSkip = true;
      skipCount = 1;
    }

    if (hasSkip && !status.includes('ĐÚNG GIỜ') && !status.includes('ĐI MUỘN') && !status.includes('NGHỈ')) {
      return { text: 'Bỏ ĐPB', type: 'skip' as const, hasSkip, skipCount };
    }

    const isOnTime =
      status.includes('ĐÚNG GIỜ') ||
      status.includes('DUNG GIO') ||
      status.includes('ĐÚNG CÔNG') ||
      /(?:^|[\s,;:\-\/])(X|ĐG|DG|OK|V|1)(?:$|[\s,;:\-\/])/i.test(status);

    const isLate =
      status.includes('ĐI MUỘN') ||
      status.includes('ĐIMUON') ||
      status.includes('DI MUON') ||
      status.includes('MUỘN') ||
      status.includes('MUON') ||
      status.includes('TRỄ') ||
      status.includes('LATE') ||
      /(?:^|[\s,;:\-\/])(M|LM|T|X\/2|0\.5|1\/2)(?:$|[\s,;:\-\/])/i.test(status);

    const isOff =
      status.includes('NGHỈ') ||
      status.includes('NGHI') ||
      status.includes('PHÉP') ||
      status.includes('PHEP') ||
      status.includes('KP') ||
      status.includes('CP') ||
      /(?:^|[\s,;:\-\/])(P|NP|OFF|N)(?:$|[\s,;:\-\/])/i.test(status);

    if (isOnTime) {
      return { text: 'ĐG', type: 'ontime' as const, hasSkip, skipCount };
    }
    if (isLate) {
      return { text: 'Trễ', type: 'late' as const, hasSkip, skipCount };
    }
    if (isOff) {
      return { text: 'Nghỉ', type: 'off' as const, hasSkip, skipCount };
    }

    return { text: rawClean, type: 'other' as const, hasSkip, skipCount };
  };

  const attendanceSummaries = useMemo(() => {
    const getColKeyForDay = (day: number): string => {
      if (day >= 1 && day <= 25) {
        return String.fromCharCode(65 + day);
      } else if (day >= 26 && day <= 34) {
        return 'A' + String.fromCharCode(65 + (day - 26));
      }
      return '';
    };

    const cleanStr = (val: any): string => {
      if (val === null || val === undefined) return '';
      const s = String(val).trim();
      if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
      return s;
    };

    const getDayStatusValue = (row: any, d: number): string => {
      const letter = getColKeyForDay(d);
      if (letter && row[letter] !== undefined && row[letter] !== null) {
        const v = cleanStr(row[letter]);
        if (v) return v;
      }
      const lowerLetter = letter.toLowerCase();
      if (lowerLetter && row[lowerLetter] !== undefined && row[lowerLetter] !== null) {
        const v = cleanStr(row[lowerLetter]);
        if (v) return v;
      }
      
      const padded = d < 10 ? `0${d}` : `${d}`;
      const keysToTry = [`Ngày ${d}`, `Ngày ${padded}`, `ngay ${d}`, `ngay ${padded}`, `${d}`, padded];
      for (const k of keysToTry) {
        if (row[k] !== undefined && row[k] !== null) {
          const v = cleanStr(row[k]);
          if (v) return v;
        }
      }
      return '';
    };

    const getEmployeeNameFromSheetRow = (row: any): string => {
      if (!row) return '';
      if (row['A'] !== undefined && row['A'] !== null) {
        const val = cleanStr(row['A']);
        const valLower = val.toLowerCase();
        if (
          val && 
          valLower !== 'nhân viên' && 
          valLower !== 'nhan vien' && 
          valLower !== 'tên' && 
          valLower !== 'họ tên' && 
          valLower !== 'stt' && 
          valLower !== 'tên nvbh' &&
          valLower !== 'ten nvbh' &&
          valLower !== 'nvbh' &&
          !valLower.includes('employee') &&
          !valLower.includes('tổng') &&
          !valLower.includes('total')
        ) {
          return cleanEmployeeName(val);
        }
      }

      const keysToTry = [
        'nhân viên', 'nhan vien', 'nhanvien', 'tên nhân viên', 'ten nhan vien', 
        'ho va ten', 'họ và tên', 'họ tên', 'ho ten', 'tên', 'ten', 'nv', 'employee', 'saleman', 'b'
      ];
      
      const rowKeys = Object.keys(row);
      for (const searchKey of keysToTry) {
        const foundKey = rowKeys.find(k => k.toLowerCase().trim() === searchKey.toLowerCase().trim());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          const val = cleanStr(row[foundKey]);
          const valLower = val.toLowerCase();
          if (
            val && 
            valLower !== 'nhân viên' && 
            valLower !== 'nhan vien' && 
            valLower !== 'tên' && 
            valLower !== 'họ tên' && 
            valLower !== 'stt' && 
            valLower !== 'tên nvbh' &&
            valLower !== 'ten nvbh' &&
            valLower !== 'nvbh' &&
            !valLower.includes('tổng') &&
            !valLower.includes('total')
          ) {
            return cleanEmployeeName(val);
          }
        }
      }

      for (const k of rowKeys) {
        const l = k.toLowerCase().trim();
        if (l.includes('nhân') || l.includes('tên') || l.includes('employee')) {
          const val = cleanStr(row[k]);
          const valLower = val.toLowerCase();
          if (
            val && 
            valLower !== 'nhân viên' && 
            valLower !== 'nhan vien' && 
            valLower !== 'tên' && 
            valLower !== 'họ tên' && 
            !valLower.includes('tổng') &&
            !valLower.includes('total')
          ) {
            return cleanEmployeeName(val);
          }
        }
      }

      return '';
    };

    const normalizedList: NormalizedEmployeeAttendance[] = [];

    if (chamCongListData && chamCongListData.length > 0) {
      chamCongListData.forEach((row) => {
        const name = getEmployeeNameFromSheetRow(row);
        if (!name) return;

        const attendanceMap: { [day: number]: string } = {};
        for (let d = 1; d <= 31; d++) {
          attendanceMap[d] = getDayStatusValue(row, d);
        }

        normalizedList.push({
          name,
          attendance: attendanceMap
        });
      });
    }

    if (historyList && historyList.length > 0) {
      historyList
        .filter(item => item.cycleId === selectedCycle)
        .forEach(item => {
          const name = cleanEmployeeName(item.employeeName || item.name || '');
          if (!name) return;
          if (!normalizedList.some(emp => emp.name.toLowerCase() === name.toLowerCase())) {
            normalizedList.push({
              name,
              attendance: item.attendance || {}
            });
          }
        });
    }

    const activeFiltered = normalizedList.filter(emp => {
      if (isEmployeeView) {
        return emp.name.toLowerCase().trim() === (currentUser?.name || '').toLowerCase().trim();
      }
      if (selectedEmployeeName !== 'Tất cả') {
        return emp.name.toLowerCase().trim() === selectedEmployeeName.toLowerCase().trim();
      }
      return true;
    });

    return activeFiltered.map(emp => {
      let ontime = 0;
      let late = 0;
      let offCount = 0;
      let totalSkipPoints = 0;
      let skipDaysCount = 0;

      parsedDates.forEach((dateObj) => {
        const isSunday = dateObj.getDay() === 0;
        if (isSunday) return;

        const d = dateObj.getDate();
        const raw = emp.attendance[d] || '';
        const parsed = getAttendanceDetail(raw, d, emp.name, dateObj);
        if (parsed.type === 'ontime') ontime++;
        else if (parsed.type === 'late') late++;
        else if (parsed.type === 'off') offCount++;
        
        if (parsed.hasSkip || parsed.type === 'skip') {
          const pts = typeof parsed.skipCount === 'number' ? parsed.skipCount : (parsed.type === 'skip' ? 1 : 0);
          totalSkipPoints += pts;
          if (pts > 0) skipDaysCount++;
        }
      });

      const totalWorkDays = ontime + (late * 0.5);

      return {
        name: emp.name,
        ontime,
        late,
        offCount,
        skipCount: Math.max(0, totalSkipPoints),
        skipDaysCount,
        totalWorkDays: Number(totalWorkDays.toFixed(1))
      };
    });
  }, [chamCongListData, leaveRequests, parsedDates, targetEmployee, isAllSelected, isEmployeeView, currentUser, isCurrentCycle, selectedCycle, historyList, selectedEmployeeName]);


  // --- IMAGE GENERATION FUNCTION ---
  const handleExportImage = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      // Small delay to ensure render is completed
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await toPng(reportRef.current, {
        backgroundColor: '#f8fafc',
        cacheBust: true,
        pixelRatio: 2, // ultra crisp 2x resolution
      });

      const link = document.createElement('a');
      const suffixName = (targetEmployee || 'Toan_Doi_Ngu').replace(/\s+/g, '_');
      link.download = `Bao_Cao_Thang_${suffixName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Lỗi khi xuất ảnh báo cáo:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Gửi báo cáo tháng"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden outline-none"
      >
        
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50 gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">GỬI BÁO CÁO THÁNG</h3>
              <p className="text-[11px] text-slate-500">Xem và xuất báo cáo ảnh độ nét cao để gửi Zalo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-auto flex-wrap">
            {/* Bộ lọc chu kỳ chấm công */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Chu kỳ:</span>
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                className="bg-transparent text-slate-800 text-xs font-bold outline-none cursor-pointer pr-1"
              >
                {cycleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {opt.year === currentActiveYear && opt.month === currentActiveMonth ? '(Hiện tại)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Bộ lọc theo tên nhân viên */}
            {!isEmployeeView && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Nhân viên:</span>
                <select
                  value={currentEmployeeName}
                  onChange={(e) => setCurrentEmployeeName(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-bold outline-none cursor-pointer pr-1"
                >
                  <option value="Tất cả">Tất cả nhân viên</option>
                  {ALLOWED_EMPLOYEES_UP_TO_TUAN.map((emp) => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable visual report preview */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
          
          {/* Scroll wrapper with dynamic scaling */}
          <div 
            className="w-full flex justify-center items-start"
            style={{ 
              height: (scale < 1 && cardHeight > 0) ? `${cardHeight * scale + 24}px` : 'auto',
              overflow: 'hidden'
            }}
          >
            
            {/* Scaled wrapper to fit the card perfectly without cutting any corners */}
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                width: '860px',
                flexShrink: 0
              }}
            >
              <MonthlyReportCard
                cardRef={reportRef}
                id="monthly-report-card"
                selectedEmployeeName={currentEmployeeName}
                isEmployeeView={isEmployeeView}
                employees={employees}
                transactions={transactions}
                clfDetailedRows={clfDetailedRows}
                mccDetailedRows={mccDetailedRows}
                ndfcDetailedRows={ndfcDetailedRows}
                cttbData={cttbData}
                chamCongListData={chamCongListData}
                startDate={startDate}
                endDate={endDate}
                currentUser={currentUser}
                sectorData={sectorData}
                trungBayListData={trungBayListData}
                tuNhienRecords={tuNhienRecords}
                meizanRecords={meizanRecords}
                attendanceSelectedCycle={selectedCycle}
              />
            </div>

          </div>

        </div>

        {/* Modal Footer - Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            <strong className="text-slate-700 font-bold">Lưu ý:</strong> Ảnh tải xuống sẽ có chất lượng cao (2x pixel ratio), sắc nét để chia sẻ.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 font-extrabold text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Đóng
            </button>
            
            {onOpenZaloShare && (
              <button
                type="button"
                onClick={() => onOpenZaloShare(currentEmployeeName)}
                className="px-3 py-1.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
                title="Gửi báo cáo qua Zalo"
              >
                <ZaloIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Gửi Zalo</span>
              </button>
            )}

            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-black text-white rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang khởi tạo...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Tải Báo Cáo Ảnh (PNG)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
