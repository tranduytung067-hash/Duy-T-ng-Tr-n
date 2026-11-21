import React, { useMemo, useEffect, useState } from 'react';
import { 
  TrendingUp, 
  FileSpreadsheet, 
  Calendar, 
  Clock, 
  Award, 
  CheckCircle, 
  AlertCircle, 
  Target,
  ShieldAlert,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { db, collection, onSnapshot } from '../firebase';
import { cleanEmployeeName, sortAndFormatEmployeeNames, matchCttbEmployee, matchCttbProgram, ALLOWED_EMPLOYEES_UP_TO_TUAN } from '../utils/sheetParser';
import { formatDateToVN } from '../utils/cycleHelper';
import { mockCttbEmployeeDetails, matchProgramName, DEFAULT_MEIZAN_RECORDS } from './CttbProgress';

interface LeaveRequest {
  id: string;
  creatorName: string;
  offDate: string;
  toDate?: string;
  status: string;
}

export interface MonthlyReportCardProps {
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
  cardRef?: React.RefObject<HTMLDivElement>;
  id?: string;
  isMobileFormat?: boolean;
}

export default function MonthlyReportCard({
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
  cardRef,
  id = 'monthly-report-card',
  isMobileFormat = false
}: MonthlyReportCardProps) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [marketEvaluations, setMarketEvaluations] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('gs_evaluations');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'market_evaluations'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setMarketEvaluations(list);
      try {
        localStorage.setItem('gs_evaluations', JSON.stringify(list));
      } catch {}
    }, (error) => {
      console.error('Firestore market_evaluations subscription failed:', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'leave_requests'), (snapshot) => {
      const list: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LeaveRequest);
      });
      setLeaveRequests(list);
    }, (error) => {
      console.error('Firestore LeaveRequest subscription failed:', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'attendance_history'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setHistoryList(list);
    }, (error) => {
      console.error('Firestore attendance_history subscription failed:', error);
    });
    return () => unsubscribe();
  }, []);

  const selectedCycle = useMemo(() => {
    if (attendanceSelectedCycle) return attendanceSelectedCycle;
    if (!endDate) return '';
    const parts = endDate.split('-');
    if (parts.length < 2) return '';
    const eY = parseInt(parts[0], 10);
    const eM = parseInt(parts[1], 10);
    const year = eY;
    const monthIndex = eM - 1;
    return `${year}-${monthIndex}`;
  }, [endDate, attendanceSelectedCycle]);

  const isCurrentCycle = useMemo(() => {
    if (!selectedCycle) return true;
    const now = new Date();
    const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
    const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const currentActiveCycle = `${currentActiveYear}-${currentActiveMonth}`;
    return selectedCycle === currentActiveCycle;
  }, [selectedCycle]);

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

  const targetEmployee = isEmployeeView ? (currentUser?.name || '') : selectedEmployeeName;
  const isAllSelected = targetEmployee === 'Tất cả';

  // --- REVENUE ---
  const activeEmployeesList = useMemo(() => {
    return employees.filter(emp => {
      if (isEmployeeView) {
        return emp.name?.toLowerCase().trim() === (currentUser?.name || '').toLowerCase().trim();
      }
      if (selectedEmployeeName !== 'Tất cả') {
        return emp.name?.toLowerCase().trim() === selectedEmployeeName.toLowerCase().trim();
      }
      return true;
    });
  }, [employees, selectedEmployeeName, isEmployeeView, currentUser]);

  const totalRevenueTarget = useMemo(() => {
    return activeEmployeesList.reduce((sum, emp) => sum + (emp.targetVal || 0), 0);
  }, [activeEmployeesList]);

  const totalRevenueActual = useMemo(() => {
    return activeEmployeesList.reduce((sum, emp) => sum + (emp.actualVal || 0), 0);
  }, [activeEmployeesList]);

  const revenueCompletionRate = totalRevenueTarget > 0 ? (totalRevenueActual / totalRevenueTarget) * 100 : 0;

  // Helper to check if employee is Nguyễn Đức Tuấn
  const isNguyenDucTuan = (name?: string) => {
    if (!name) return false;
    const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    return clean.includes('tuan');
  };

  // --- ACTIVATION (KÍCH HOẠT) ---
  const activationPerformanceRows = useMemo(() => {
    let k3T = 0, k3A = 0;
    let k4T = 0, k4A = 0;
    let khT = 0, khA = 0;
    let hrcT = 0, hrcA = 0;

    activeEmployeesList.forEach((emp) => {
      k3T += emp.k3Target || 0;
      k3A += emp.k3Actual || 0;
      k4T += emp.k4Target || 0;
      k4A += emp.k4Actual || 0;
      khT += emp.khTarget || 0;
      khA += emp.khActual || 0;
      
      // KH HRC chỉ áp dụng cho NVBH Nguyễn Đức Tuấn
      if (isNguyenDucTuan(emp.name)) {
        hrcT += emp.khmhThangTarget || 0;
        hrcA += emp.khmhThangActual || 0;
      }
    });

    const getRate = (actual: number, target: number) => {
      if (target <= 0) return 0;
      let rate = (actual / target) * 100;
      if (target > 0 && actual < target) {
        rate = Math.min(99.9, Math.floor(rate * 10) / 10);
      }
      return rate;
    };

    const rows = [
      { name: 'Kích Hoạt 3 Ngành Hàng', target: k3T, actual: k3A, rate: getRate(k3A, k3T) },
      { name: 'Kích Hoạt 4 Ngành Hàng', target: k4T, actual: k4A, rate: getRate(k4A, k4T) },
      { name: 'KH Đạt Chuẩn', target: khT, actual: khA, rate: getRate(khA, khT) },
    ];

    if (hrcT > 0 || hrcA > 0) {
      rows.push({ name: 'KH HRC', target: hrcT, actual: hrcA, rate: getRate(hrcA, hrcT) });
    }

    return rows;
  }, [activeEmployeesList, isEmployeeView, selectedEmployeeName]);

  // --- SECTORS ---
  const FMCG_SECTORS = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', 'VNT', 'DHF', '584NT', 'NON - WM'];

  const getEmployeeSectorPerformance = (empName: string, sector: string): { target: number, actual: number } => {
    if (sectorData) {
      const isNonWm = sector === 'NON - WM' || sector === 'NOM - WM';
      const findSectorKey = (perfObj: any) => {
        if (!perfObj) return null;
        if (perfObj[sector]) return sector;
        if (isNonWm) {
          if (perfObj['NON - WM']) return 'NON - WM';
          if (perfObj['NOM - WM']) return 'NOM - WM';
          if (perfObj['NON-WM']) return 'NON-WM';
          if (perfObj['NOM-WM']) return 'NOM-WM';
        }
        return null;
      };

      if (empName === 'Tất cả') {
        let totalTarget = 0;
        let totalActual = 0;
        Object.values(sectorData).forEach((empPerf: any) => {
          const sKey = findSectorKey(empPerf);
          if (sKey && empPerf[sKey]) {
            totalTarget += empPerf[sKey].target || 0;
            totalActual += empPerf[sKey].actual || 0;
          }
        });
        return { target: totalTarget, actual: totalActual };
      }

      const cleanEmpName = empName.trim().toLowerCase().replace(/\s+/g, '');
      const empKey = Object.keys(sectorData).find(
        (name) => name.trim().toLowerCase().replace(/\s+/g, '') === cleanEmpName
      );
      if (empKey) {
        const sKey = findSectorKey(sectorData[empKey]);
        if (sKey && sectorData[empKey][sKey]) {
          return {
            target: sectorData[empKey][sKey].target || 0,
            actual: sectorData[empKey][sKey].actual || 0
          };
        }
      }
    }
    return { target: 0, actual: 0 };
  };

  const sectorPerformanceRows = useMemo(() => {
    return FMCG_SECTORS.map((sector) => {
      const isNonWm = sector === 'NON - WM' || sector === 'NOM - WM';
      const filteredTx = transactions.filter((tx) => {
        const cat = tx.NganhHang?.toUpperCase() || '';
        const matchCategory = isNonWm 
          ? (cat.includes('NON - WM') || cat.includes('NOM - WM') || cat.includes('NON-WM') || cat.includes('NOM-WM') || cat.includes('WM'))
          : cat.includes(sector);
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

  // --- SUB-PRODUCT GROUPS ---
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

  const clfSubGroupData = useMemo(() => {
    const neptune = sumDetailedColumns(clfDetailedRows, 'I', 'J', 'CLF_I_J');
    const simply = sumDetailedColumns(clfDetailedRows, 'O', 'P', 'CLF_O_P');
    const tongCaoCap = {
      target: parseFloat((neptune.target + simply.target).toFixed(3)),
      actual: parseFloat((neptune.actual + simply.actual).toFixed(3)),
    };
    const simplyGaoLut = sumDetailedColumns(clfDetailedRows, 'T', 'U', 'CLF_T_U');
    const meizanGold = sumDetailedColumns(clfDetailedRows, 'Y', 'Z', 'CLF_Y_Z');
    const meizanSbo = sumDetailedColumns(clfDetailedRows, 'AD', 'AE', 'CLF_AD_AE');
    const tongTrungCap = {
      target: parseFloat((meizanGold.target + meizanSbo.target).toFixed(3)),
      actual: parseFloat((meizanGold.actual + meizanSbo.actual).toFixed(3)),
    };
    const bo = sumDetailedColumns(clfDetailedRows, 'AI', 'AJ', 'CLF_AI_AJ');
    const dauMe = sumDetailedColumns(clfDetailedRows, 'AX', 'AY', 'CLF_AX_AY');
    const kiddyOlive = sumDetailedColumns(clfDetailedRows, 'AS', 'AT', 'CLF_AS_AT');
    const olivoila = sumDetailedColumns(clfDetailedRows, 'AN', 'AO', 'CLF_AN_AO');
    const tongSanPhamNgach = {
      target: parseFloat((bo.target + dauMe.target + kiddyOlive.target + olivoila.target).toFixed(3)),
      actual: parseFloat((bo.actual + dauMe.actual + kiddyOlive.actual + olivoila.actual).toFixed(3)),
    };
    const caiLanOrchid = sumDetailedColumns(clfDetailedRows, 'BH', 'BI', 'CLF_BH_BI');
    const dauDongGoiLon = sumDetailedColumns(clfDetailedRows, 'BR', 'BS', 'CLF_BR_BS');

    return [
      { label: 'Dầu Neptune', ...neptune, isTotal: false },
      { label: 'Dầu Simply', ...simply, isTotal: false },
      { label: 'Tổng Cao Cấp', ...tongCaoCap, isTotal: true },
      { label: 'Dầu Simply Gạo Lứt', ...simplyGaoLut, isTotal: false },
      { label: 'Meizan Gold', ...meizanGold, isTotal: false },
      { label: 'Meizan SBO', ...meizanSbo, isTotal: false },
      { label: 'Tổng Trung Cấp', ...tongTrungCap, isTotal: true },
      { label: 'Bơ Meizan', ...bo, isTotal: false },
      { label: 'Dầu Mè', ...dauMe, isTotal: false },
      { label: 'Dầu Kiddy', ...kiddyOlive, isTotal: false },
      { label: 'Dầu Olivoila', ...olivoila, isTotal: false },
      { label: 'Tổng Sản Phẩm Ngách', ...tongSanPhamNgach, isTotal: true },
      { label: 'Cái Lân / Orchid', ...caiLanOrchid, isTotal: false },
      { label: 'Đóng gói lớn (BP)', ...dauDongGoiLon, isTotal: false },
    ];
  }, [clfDetailedRows, targetEmployee, isAllSelected, employees]);

  const mccSubGroupData = useMemo(() => [
    { label: 'Bột các loại', ...sumDetailedColumns(mccDetailedRows, 'I', 'J', 'MCC_I_J') },
    { label: 'SP MCC Khác', ...sumDetailedColumns(mccDetailedRows, 'O', 'P', 'MCC_O_P') },
  ], [mccDetailedRows, targetEmployee, isAllSelected]);

  const ndfcSubGroupData = useMemo(() => [
    { label: 'Nước tương', ...sumDetailedColumns(ndfcDetailedRows, 'I', 'J', 'NDFC_I_J') },
    { label: 'Tương xốt', ...sumDetailedColumns(ndfcDetailedRows, 'O', 'P', 'NDFC_O_P') },
    { label: 'Hạt nêm', ...sumDetailedColumns(ndfcDetailedRows, 'T', 'U', 'NDFC_T_U') },
    { label: 'Bột ngọt', ...sumDetailedColumns(ndfcDetailedRows, 'Y', 'Z', 'NDFC_Y_Z') },
  ], [ndfcDetailedRows, targetEmployee, isAllSelected]);

  // --- CTTB ---
  const baseProgramsList = [
    'Thuê Kệ',
    'CTTB MEIZAN',
    'Nam Dương',
    'Nước Rửa Chén',
    'Giặt Xả',
    'Gạo',
    'Mắm 584NT',
    'TRÀ VINATEA',
    'Trưng Bày Tự Nhiên',
  ];

  const cttbReportData = useMemo(() => {
    const cleanStr = (s: string) =>
      String(s || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, '');

    const cleanCompare = (aStr: string, bStr: string) => cleanStr(aStr) === cleanStr(bStr);

    const getRowVal = (row: any, searchKeys: string[]) => {
      if (!row) return '';
      const rowKeys = Object.keys(row);
      for (const key of searchKeys) {
        const found = rowKeys.find((k) => k.toLowerCase().trim() === key.toLowerCase().trim());
        if (found !== undefined && row[found] !== undefined && row[found] !== null) {
          const val = String(row[found]).trim();
          if (val !== '') return val;
        }
      }
      return '';
    };

    const empKeys = ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff', 'b', 'saleman', 'tên nhân viên', 'ten nhan vien'];
    const codeKeys = ['ma cttb', 'mã cttb', 'code', 'e'];
    const progKeys = ['ten cttb', 'tên cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'tên chương trình', 'chuong trinh trung bay', 'chương trình trưng bày', 'f', 'program'];
    const photoKeys = ['so bo anh', 'số bộ ảnh', 'so luong bo anh', 'số lượng bộ ảnh', 'bo anh', 'bộ ảnh', 'h', 'photos'];
    const stdKeys = ['trang thai dat', 'trạng thái đạt', 'dat tieu chuan', 'đạt tiêu chuẩn', 'xet dat ds / sl', 'xét đạt ds / sl', 'dat chuan', 'đạt chuẩn', 'l', 'status', 'xet dat'];

    // Discover any extra programs present in trungBayListData
    const programsList = [...baseProgramsList];
    if (trungBayListData && trungBayListData.length > 0) {
      trungBayListData.forEach((row) => {
        const rawCode = (row['Mã CTTB'] || getRowVal(row, codeKeys) || row['E'] || '').toString().trim();
        const rawProg = (row['Tên CTTB'] || getRowVal(row, progKeys) || row['F'] || '').toString().trim();
        const lowerF = rawProg.toLowerCase();
        if (!rawProg || lowerF === 'tên cttb' || lowerF === 'tên chương trình' || lowerF === 'cttb' || lowerF === 'f') return;
        const canonicalProg = matchCttbProgram(rawCode, rawProg) || rawProg;
        const exists = programsList.some(
          (p) => cleanCompare(p, canonicalProg) || cleanCompare(p, rawProg) || matchProgramName(canonicalProg, p) || matchProgramName(rawProg, p)
        );
        if (!exists) {
          programsList.push(canonicalProg);
        }
      });
    }

    const activeMeizanList = meizanRecords && meizanRecords.length > 0 ? meizanRecords : DEFAULT_MEIZAN_RECORDS;

    const getEmpProgStats = (emp: string, prog: string): { thamGia: number; dat: number; khongBoAnh: number } => {
      const isTuNhien = cleanCompare(prog, 'Trưng Bày Tự Nhiên');
      const isMeizan = cleanCompare(prog, 'CTTB MEIZAN');

      // 1. Trưng Bày Tự Nhiên -> tuNhienRecords -> cttbData -> 0
      if (isTuNhien) {
        if (tuNhienRecords && tuNhienRecords.length > 0) {
          const rec = tuNhienRecords.find((r) => cleanCompare(r.employeeName, emp));
          if (rec) {
            return {
              thamGia: Math.max(0, rec.khThamGia || 0),
              dat: Math.max(0, rec.khDat || 0),
              khongBoAnh: Math.max(0, rec.khKhongBoAnh || 0),
            };
          }
        }
        if (cttbData && Object.keys(cttbData).length > 0) {
          const empKey = Object.keys(cttbData).find((k) => cleanCompare(k, emp));
          if (empKey && cttbData[empKey]) {
            const progKey = Object.keys(cttbData[empKey]).find((p) => cleanCompare(p, 'Trưng Bày Tự Nhiên'));
            if (progKey && cttbData[empKey][progKey]) {
              const entry = cttbData[empKey][progKey];
              return {
                thamGia: Math.max(0, entry.khThamGia || 0),
                dat: Math.max(0, entry.khDat || 0),
                khongBoAnh: Math.max(0, entry.khKhongBoAnh || 0),
              };
            }
          }
        }
        const mockEmpKey = mockCttbEmployeeDetails['Trưng Bày Tự Nhiên']
          ? Object.keys(mockCttbEmployeeDetails['Trưng Bày Tự Nhiên']).find((e) => cleanCompare(e, emp))
          : undefined;
        if ((!tuNhienRecords || tuNhienRecords.length === 0) && mockEmpKey) {
          const m = mockCttbEmployeeDetails['Trưng Bày Tự Nhiên'][mockEmpKey];
          return { thamGia: m.khThamGia || 0, dat: m.khDat || 0, khongBoAnh: m.khKhongBoAnh || 0 };
        }
        return { thamGia: 0, dat: 0, khongBoAnh: 0 };
      }

      // 2. CTTB MEIZAN -> activeMeizanList -> cttbData
      if (isMeizan) {
        if (activeMeizanList && activeMeizanList.length > 0) {
          const rec = activeMeizanList.find((r) => cleanCompare(r.employeeName, emp));
          if (rec) {
            const tg = Math.max(0, rec.khThamGia || 0);
            const dt = Math.max(0, rec.khDat || 0);
            const kba = rec.khKhongBoAnh !== undefined && rec.khKhongBoAnh !== null ? Math.max(0, rec.khKhongBoAnh) : Math.max(0, tg - dt);
            return { thamGia: tg, dat: dt, khongBoAnh: kba };
          }
        }
        if (cttbData && Object.keys(cttbData).length > 0) {
          const empKey = Object.keys(cttbData).find((k) => cleanCompare(k, emp));
          if (empKey && cttbData[empKey]) {
            const progKey = Object.keys(cttbData[empKey]).find((p) => cleanCompare(p, 'CTTB MEIZAN'));
            if (progKey && cttbData[empKey][progKey]) {
              const entry = cttbData[empKey][progKey];
              return {
                thamGia: Math.max(0, entry.khThamGia || 0),
                dat: Math.max(0, entry.khDat || 0),
                khongBoAnh: Math.max(0, entry.khKhongBoAnh || 0),
              };
            }
          }
        }
        return { thamGia: 0, dat: 0, khongBoAnh: 0 };
      }

      // 3. All other CTTB programs -> trungBayListData -> cttbData -> mockCttbEmployeeDetails
      if (trungBayListData && trungBayListData.length > 0) {
        let rawKhDat = 0;
        let rawKhThamGia = 0;
        let rawKhongBoAnh = 0;
        let empHasAnyRow = false;

        trungBayListData.forEach((row) => {
          const empInRow = (
            row['Nhân Viên'] ||
            row['Tên Nhân Viên'] ||
            getRowVal(row, empKeys) ||
            row['B'] ||
            (row._rawCells?.[1]?.f || row._rawCells?.[1]?.v) ||
            ''
          ).toString().trim();
          const canonicalEmp = matchCttbEmployee(empInRow) || empInRow;
          if (!cleanCompare(canonicalEmp, emp) && !cleanCompare(empInRow, emp)) return;
          empHasAnyRow = true;

          const progCode = (
            row['Mã CTTB'] ||
            getRowVal(row, codeKeys) ||
            row['E'] ||
            (row._rawCells?.[4]?.f || row._rawCells?.[4]?.v) ||
            ''
          ).toString().trim();
          const progName = (
            row['Tên CTTB'] ||
            getRowVal(row, progKeys) ||
            row['F'] ||
            (row._rawCells?.[5]?.f || row._rawCells?.[5]?.v) ||
            ''
          ).toString().trim();
          const lowerF = progName.toLowerCase();
          if (!progName || lowerF === 'tên cttb' || lowerF === 'tên chương trình' || lowerF === 'cttb' || lowerF === 'f') return;

          const canonicalProg = matchCttbProgram(progCode, progName) || progName;
          const progMatches =
            cleanCompare(canonicalProg, prog) ||
            cleanCompare(progName, prog) ||
            matchProgramName(canonicalProg, prog) ||
            matchProgramName(progName, prog);
          if (!progMatches) return;

          rawKhThamGia++;

          const rawH = (
            row['Số Bộ Ảnh'] ||
            getRowVal(row, photoKeys) ||
            row['H'] ||
            (row._rawCells?.[7]?.f || row._rawCells?.[7]?.v) ||
            ''
          ).toString().trim();
          const lowerH = rawH.toLowerCase();
          if (lowerH !== 'số bộ ảnh' && lowerH !== 'h') {
            const numH = parseFloat(rawH.replace(/[^0-9.]/g, ''));
            if (rawH === '' || isNaN(numH) || numH < 1) {
              rawKhongBoAnh++;
            }
          }

          const rawL = (
            row['Đạt Tiêu Chuẩn'] ||
            row['L'] ||
            row['l'] ||
            (row._rawCells?.[11]?.f || row._rawCells?.[11]?.v) ||
            getRowVal(row, stdKeys) ||
            ''
          )
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd');
          if ((rawL.includes('dat') || rawL === 'd') && !rawL.includes('khong') && !rawL.includes('kh') && !rawL.includes('chua')) {
            rawKhDat++;
          }
        });

        if (rawKhThamGia > 0 || empHasAnyRow) {
          return {
            thamGia: rawKhThamGia,
            dat: Math.min(rawKhThamGia, rawKhDat),
            khongBoAnh: Math.min(rawKhThamGia, rawKhongBoAnh),
          };
        }
      }

      if (cttbData && Object.keys(cttbData).length > 0) {
        const empKey = Object.keys(cttbData).find((k) => cleanCompare(k, emp));
        if (empKey && cttbData[empKey]) {
          const progKey = Object.keys(cttbData[empKey]).find((p) => cleanCompare(p, prog) || matchProgramName(p, prog));
          if (progKey && cttbData[empKey][progKey]) {
            const item = cttbData[empKey][progKey];
            const tg = Math.max(0, item.khThamGia || 0);
            return {
              thamGia: tg,
              dat: Math.min(tg, Math.max(0, item.khDat || 0)),
              khongBoAnh: Math.min(tg, Math.max(0, item.khKhongBoAnh || 0)),
            };
          }
        }
      }

      const mockProgKey = Object.keys(mockCttbEmployeeDetails).find((p) => cleanCompare(p, prog) || matchProgramName(p, prog)) || prog;
      const mockEmpKey = mockCttbEmployeeDetails[mockProgKey]
        ? Object.keys(mockCttbEmployeeDetails[mockProgKey]).find((e) => cleanCompare(e, emp))
        : undefined;
      const mockProgDetails = mockEmpKey ? mockCttbEmployeeDetails[mockProgKey][mockEmpKey] : undefined;
      if (mockProgDetails) {
        const tg = Math.max(0, mockProgDetails.khThamGia || 0);
        return {
          thamGia: tg,
          dat: Math.min(tg, Math.max(0, mockProgDetails.khDat || 0)),
          khongBoAnh: Math.min(tg, Math.max(0, mockProgDetails.khKhongBoAnh || 0)),
        };
      }

      return { thamGia: 0, dat: 0, khongBoAnh: 0 };
    };

    const rawEmpNames = employees && employees.length > 0 ? employees.map((e) => e.name).filter(Boolean) : ALLOWED_EMPLOYEES_UP_TO_TUAN;
    const targetEmployees = isAllSelected ? sortAndFormatEmployeeNames(rawEmpNames) : [targetEmployee];

    // Build per-employee breakdown across all CTTB programs
    const employeeRows = targetEmployees.map((empName) => {
      let empTotalThamGia = 0;
      let empTotalDat = 0;
      let empTotalKhongBoAnh = 0;
      const byProgram: Record<string, { thamGia: number; dat: number; khongBoAnh: number; rate: number }> = {};

      programsList.forEach((prog) => {
        const st = getEmpProgStats(empName, prog);
        const rate = st.thamGia > 0 ? (st.dat / st.thamGia) * 100 : 0;
        byProgram[prog] = { ...st, rate };

        if (!cleanCompare(prog, 'Trưng Bày Tự Nhiên')) {
          empTotalThamGia += st.thamGia;
          empTotalDat += st.dat;
          empTotalKhongBoAnh += st.khongBoAnh;
        }
      });

      return {
        empName,
        byProgram,
        totalThamGia: empTotalThamGia,
        totalDat: empTotalDat,
        totalKhongBoAnh: empTotalKhongBoAnh,
        rate: empTotalThamGia > 0 ? (empTotalDat / empTotalThamGia) * 100 : 0,
      };
    });

    // Aggregate program summaries over targetEmployees
    let totalThamGia = 0;
    let totalDat = 0;
    let totalKhongBoAnh = 0;

    const programs = programsList.map((prog) => {
      let thamGia = 0;
      let dat = 0;
      let khongBoAnh = 0;
      employeeRows.forEach((er) => {
        const st = er.byProgram[prog];
        if (st) {
          thamGia += st.thamGia;
          dat += st.dat;
          khongBoAnh += st.khongBoAnh;
        }
      });
      if (!cleanCompare(prog, 'Trưng Bày Tự Nhiên')) {
        totalThamGia += thamGia;
        totalDat += dat;
        totalKhongBoAnh += khongBoAnh;
      }
      return {
        name: prog,
        thamGia,
        dat,
        khongBoAnh,
        rate: thamGia > 0 ? (dat / thamGia) * 100 : 0,
      };
    });

    return {
      programsList,
      employeeRows,
      summary: {
        totalThamGia,
        totalDat,
        totalKhongBoAnh,
        rate: totalThamGia > 0 ? (totalDat / totalThamGia) * 100 : 0,
        programs,
      },
    };
  }, [cttbData, targetEmployee, isAllSelected, employees, trungBayListData, tuNhienRecords, meizanRecords]);

  const cttbSummary = cttbReportData.summary;

  // --- ATTENDANCE ---
  const attendanceCycleDates = useMemo(() => {
    let year: number;
    let monthIndex: number;

    if (selectedCycle) {
      const parts = selectedCycle.split('-');
      year = parseInt(parts[0], 10);
      monthIndex = parseInt(parts[1], 10);
    } else {
      const now = new Date();
      const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
      const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      year = currentActiveYear;
      monthIndex = currentActiveMonth;
    }

    const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;

    const cycleStartDate = new Date(prevYear, prevMonthIndex, 21);
    const cycleEndDate = new Date(year, monthIndex, 20);

    const dates: Date[] = [];
    const tempDateForCycle = new Date(cycleStartDate);
    while (tempDateForCycle <= cycleEndDate) {
      dates.push(new Date(tempDateForCycle));
      tempDateForCycle.setDate(tempDateForCycle.getDate() + 1);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${cycleStartDate.getFullYear()}-${pad(cycleStartDate.getMonth() + 1)}-${pad(cycleStartDate.getDate())}`;
    const endStr = `${cycleEndDate.getFullYear()}-${pad(cycleEndDate.getMonth() + 1)}-${pad(cycleEndDate.getDate())}`;

    return { startDate: cycleStartDate, endDate: cycleEndDate, startStr, endStr, year, monthIndex, dates };
  }, [selectedCycle]);

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
      if (cleanEmployeeName(req.creatorName).toLowerCase().trim() !== cleanEmployeeName(employeeName).toLowerCase().trim()) return false;
      const start = req.offDate;
      const end = req.toDate || req.offDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  const parseStatusCell = (rawStatus: string, dayNum: number, employeeName: string, dateObjInput: Date) => {
    // 1. Prioritize approved leave requests (skip on Sunday)
    const isSunday = dateObjInput.getDay() === 0;
    if (!isSunday && employeeName) {
      const approvedLeave = getApprovedLeaveForDay(employeeName, dateObjInput);
      if (approvedLeave) {
        return { text: 'Nghỉ', type: 'off' as const, isLeaveApproved: true, hasSkip: false, skipCount: 0 };
      }
    }

    if (isSunday) {
      return { text: 'CN', type: 'sunday' as const, hasSkip: false, skipCount: 0 };
    }

    if (!rawStatus) return { text: '', type: 'empty' as const, hasSkip: false, skipCount: 0 };
    const status = rawStatus.toUpperCase().trim();
    const rawClean = rawStatus.trim();

    if (status === '#N/A' || status.includes('#N/A')) {
      return { text: '', type: 'empty' as const, hasSkip: false, skipCount: 0 };
    }

    // Parse skip info from cell string if present
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
      status.includes('LOI BO DIEM') ||
      status.includes('LỖI BỎ ĐIỂM')
    ) {
      hasSkip = true;
      skipCount = 1;
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

    let type: 'ontime' | 'late' | 'off' | 'skip' | 'other' = 'ontime';
    let text = 'Đúng giờ';

    if (isOnTime) {
      type = 'ontime';
      text = 'Đúng giờ';
    } else if (isLate) {
      type = 'late';
      text = 'Trễ';
    } else if (isOff) {
      type = 'off';
      text = 'Nghỉ';
    } else if (hasSkip) {
      type = 'skip';
      text = 'Bỏ ĐPB';
    } else {
      type = 'other';
      text = rawClean;
    }

    return { text, type, hasSkip, skipCount };
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

    const getDayStatusValueFromRow = (row: any, d: number): string => {
      if (!row) return '';
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

    let targetEmpNames: string[] = [];
    if (isAllSelected) {
      const namesFromEmployees = (employees || []).map(e => e.name);
      const namesFromSheet = (chamCongListData || []).map(getEmployeeNameFromSheetRow).filter(Boolean);
      const namesFromHistory = (historyList || [])
        .filter(h => h.cycleId === selectedCycle)
        .map(h => cleanEmployeeName(h.employeeName || h.name || ''))
        .filter(Boolean);

      const combined = Array.from(new Set([...namesFromEmployees, ...namesFromSheet, ...namesFromHistory]));
      targetEmpNames = sortAndFormatEmployeeNames(combined);
    } else {
      targetEmpNames = [targetEmployee];
    }

    if (targetEmpNames.length === 0) return [];

    return targetEmpNames.map(empName => {
      let ontime = 0;
      let late = 0;
      let offCount = 0;
      let skipDaysCount = 0;
      let totalSkipPoints = 0;

      // Extract attendance map { [day]: statusString }
      let attendanceMap: { [day: number]: string } = {};

      if (isCurrentCycle) {
        // Current cycle: sheet data (chamCongListData) is primary
        const chamCongRow = (chamCongListData || []).find(r => {
          const nameInRow = getEmployeeNameFromSheetRow(r);
          return cleanEmployeeName(nameInRow).toLowerCase() === cleanEmployeeName(empName).toLowerCase();
        });

        if (chamCongRow) {
          for (let d = 1; d <= 31; d++) {
            attendanceMap[d] = getDayStatusValueFromRow(chamCongRow, d);
          }
        } else {
          // Fallback to history if employee not found in current sheet
          const histRecord = (historyList || [])
            .filter(h => h.cycleId === selectedCycle)
            .find(h => cleanEmployeeName(h.employeeName || h.name || '').toLowerCase() === cleanEmployeeName(empName).toLowerCase());
          if (histRecord?.attendance) {
            attendanceMap = histRecord.attendance;
          }
        }
      } else {
        // Historical cycle: historyList is primary
        const histRecord = (historyList || [])
          .filter(h => h.cycleId === selectedCycle)
          .find(h => cleanEmployeeName(h.employeeName || h.name || '').toLowerCase() === cleanEmployeeName(empName).toLowerCase());
        
        if (histRecord?.attendance) {
          attendanceMap = histRecord.attendance;
        } else if (chamCongListData && chamCongListData.length > 0) {
          // Fallback if no history snapshot saved yet
          const chamCongRow = chamCongListData.find(r => {
            const nameInRow = getEmployeeNameFromSheetRow(r);
            return cleanEmployeeName(nameInRow).toLowerCase() === cleanEmployeeName(empName).toLowerCase();
          });
          if (chamCongRow) {
            for (let d = 1; d <= 31; d++) {
              attendanceMap[d] = getDayStatusValueFromRow(chamCongRow, d);
            }
          }
        }
      }

      // Calculate statistics over cycle dates (excluding Sundays)
      parsedDates.forEach(dateObj => {
        const isSunday = dateObj.getDay() === 0;
        if (isSunday) return;

        const d = dateObj.getDate();
        const rawCell = attendanceMap[d] || '';
        const parsed = parseStatusCell(rawCell, d, empName, dateObj);

        if (parsed.type === 'ontime') ontime++;
        else if (parsed.type === 'late') late++;
        else if (parsed.type === 'off') offCount++;

        if (parsed.hasSkip || parsed.type === 'skip') {
          const pts = typeof parsed.skipCount === 'number' ? parsed.skipCount : 0;
          totalSkipPoints += pts;
          if (pts > 0) {
            skipDaysCount++;
          }
        }
      });

      const totalWorkDays = ontime + (late * 0.5);

      return {
        name: empName,
        ontime,
        late,
        offCount,
        skipDaysCount,
        skipCount: Math.max(0, totalSkipPoints),
        totalWorkDays: Number(totalWorkDays.toFixed(1))
      };
    });
  }, [chamCongListData, leaveRequests, parsedDates, targetEmployee, isAllSelected, isEmployeeView, currentUser, selectedCycle, isCurrentCycle, historyList, employees]);

  // Market Service Evaluation (Dịch vụ thị trường) data filtering
  // CHỈ HIỂN THỊ CÁC LỖI DỊCH VỤ THỊ TRƯỜNG KHÔNG ĐẠT TRONG CHU KỲ
  const employeeMarketEvaluation = useMemo(() => {
    if (isAllSelected) return null;
    
    // Criteria breakdown
    const CRITERIA_MAP = [
      { key: 'hangCanHetDate', label: 'Hàng Cận/Hết Date' },
      { key: 'trungBayKhongDat', label: 'Trưng Bày Không Đạt Yêu Cầu' },
      { key: 'khieuNaiBoDiemBan', label: 'Giải Quyết Khiếu Nại/Bỏ Tuyến' },
      { key: 'capNhatThongTinSai', label: 'Cập Nhật Thông Tin Sai' },
      { key: 'khongDamBaoWPP', label: 'Vận Hành CT Tích Điểm Kém' },
      { key: 'viPhamLiemChinh', label: 'Vi Phạm Liêm Chính' }
    ];

    const parseDateStr = (raw: any): string => {
      if (!raw) return '';
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const parts = s.split('/');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      return '';
    };

    // Lọc phiếu đánh giá của nhân viên trong chu kỳ hiện hành
    const inCycleEvals = marketEvaluations.filter(item => {
      const matchEmp = cleanEmployeeName(item.nhanVien) === cleanEmployeeName(targetEmployee);
      if (!matchEmp) return false;
      
      // Bắt buộc ngày đánh giá phải nằm trong chu kỳ đang chọn
      if (!item.ngay) return false;
      const itemDateStr = parseDateStr(item.ngay);
      if (!itemDateStr) return false;
      if (attendanceCycleDates.startStr && itemDateStr < attendanceCycleDates.startStr) return false;
      if (attendanceCycleDates.endStr && itemDateStr > attendanceCycleDates.endStr) return false;
      return true;
    });

    // CHỈ lấy các phiếu đánh giá có LỖI VI PHẠM hoặc KHÔNG ĐẠT trong chu kỳ (loại trừ hoàn toàn các phiếu Đạt)
    const failedEvals = inCycleEvals.filter(ev => {
      if (ev.trangThai === 'Đạt') return false;
      const isFailedStatus = ev.trangThai === 'Không Đạt' || ev.trangThai === 'Chưa Đạt' || Number(ev.soLuotKhongDat || 0) > 0;
      const hasFailedCrit = CRITERIA_MAP.some(crit => !!ev[crit.key]);
      return isFailedStatus || hasFailedCrit;
    });

    // Nếu không có lỗi không đạt nào trong chu kỳ -> Ẩn hoàn toàn mục Dịch vụ thị trường
    if (failedEvals.length === 0) return null;

    // Sắp xếp ngày mới nhất lên đầu
    failedEvals.sort((a, b) => new Date(b.ngay).getTime() - new Date(a.ngay).getTime());

    const failedCriteriaSet = new Set<string>();
    let totalFailedVisits = 0;
    let totalVisits = 0;

    const evaluationRecords = failedEvals.map(ev => {
      const itemFailedVisits = Number(ev.soLuotKhongDat || 0);
      const itemVisits = Number(ev.tongLuotViengTham || 0);
      totalFailedVisits += itemFailedVisits;
      totalVisits += itemVisits;

      const itemFailedCriteria: string[] = [];
      CRITERIA_MAP.forEach(crit => {
        if (ev[crit.key]) {
          itemFailedCriteria.push(crit.label);
          failedCriteriaSet.add(crit.label);
        }
      });

      return {
        id: ev.id,
        ngay: ev.ngay,
        nguoiDanhGia: ev.nguoiDanhGia || '',
        soLuotKhongDat: itemFailedVisits,
        tongLuotViengTham: itemVisits,
        tiLeKhongDat: ev.tiLeKhongDat || (itemVisits > 0 ? Math.round((itemFailedVisits / itemVisits) * 100) : 0),
        failedCriteria: itemFailedCriteria,
        ghiChu: ev.ghiChu || ''
      };
    });

    const failedCriteriaList = Array.from(failedCriteriaSet);
    const latestEval = failedEvals[0];

    return {
      evalCount: failedEvals.length,
      latestDate: latestEval.ngay,
      evaluator: latestEval.nguoiDanhGia || '',
      status: 'Không Đạt' as const,
      totalFailedVisits,
      totalVisits,
      rate: totalVisits > 0 ? Math.round((totalFailedVisits / totalVisits) * 100) : (latestEval.tiLeKhongDat || 0),
      failedCriteriaList,
      evaluationRecords,
      notes: failedEvals.map(e => e.ghiChu).filter(Boolean).join('; ')
    };
  }, [marketEvaluations, targetEmployee, isAllSelected, attendanceCycleDates]);

  // Lỗi Dịch vụ thị trường toàn đội ngũ (khi chọn Tất cả - CHỈ hiển thị nhân viên có lỗi không đạt trong chu kỳ)
  const allEmployeesMarketViolations = useMemo(() => {
    if (!isAllSelected) return null;

    const CRITERIA_MAP = [
      { key: 'hangCanHetDate', label: 'Hàng Cận/Hết Date' },
      { key: 'trungBayKhongDat', label: 'Trưng Bày Không Đạt Yêu Cầu' },
      { key: 'khieuNaiBoDiemBan', label: 'Giải Quyết Khiếu Nại/Bỏ Tuyến' },
      { key: 'capNhatThongTinSai', label: 'Cập Nhật Thông Tin Sai' },
      { key: 'khongDamBaoWPP', label: 'Vận Hành CT Tích Điểm Kém' },
      { key: 'viPhamLiemChinh', label: 'Vi Phạm Liêm Chính' }
    ];

    const parseDateStr = (raw: any): string => {
      if (!raw) return '';
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const parts = s.split('/');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      return '';
    };

    const inCycleViolations = marketEvaluations.filter(item => {
      if (!item.ngay) return false;
      const itemDateStr = parseDateStr(item.ngay);
      if (!itemDateStr) return false;
      if (attendanceCycleDates.startStr && itemDateStr < attendanceCycleDates.startStr) return false;
      if (attendanceCycleDates.endStr && itemDateStr > attendanceCycleDates.endStr) return false;

      // Loại trừ các phiếu Đạt
      if (item.trangThai === 'Đạt') return false;

      const isFailedStatus = item.trangThai === 'Không Đạt' || item.trangThai === 'Chưa Đạt' || Number(item.soLuotKhongDat || 0) > 0;
      const hasFailedCrit = CRITERIA_MAP.some(crit => !!item[crit.key]);
      return isFailedStatus || hasFailedCrit;
    });

    if (inCycleViolations.length === 0) return null;

    return inCycleViolations.map(ev => {
      const failedCrits: string[] = [];
      CRITERIA_MAP.forEach(crit => {
        if (ev[crit.key]) failedCrits.push(crit.label);
      });
      return {
        id: ev.id,
        nhanVien: ev.nhanVien,
        ngay: ev.ngay,
        soLuotKhongDat: Number(ev.soLuotKhongDat || 0),
        tongLuotViengTham: Number(ev.tongLuotViengTham || 0),
        tiLeKhongDat: ev.tiLeKhongDat || 0,
        failedCriteria: failedCrits,
        ghiChu: ev.ghiChu || ''
      };
    });
  }, [marketEvaluations, isAllSelected, attendanceCycleDates]);

  return (
    <div 
      ref={cardRef}
      id={id}
      className={isMobileFormat
        ? "w-full max-w-[540px] bg-slate-50 p-4 rounded-2xl flex flex-col gap-4 text-slate-800 font-sans border border-slate-200 shadow-sm mx-auto overflow-hidden"
        : "w-full max-w-[860px] bg-slate-50 p-6 rounded-2xl flex flex-col gap-5 text-slate-800 font-sans border border-slate-200 shadow-sm my-2 mx-auto overflow-hidden"
      }
    >
      {/* Report Header */}
      <div className={isMobileFormat ? "border-b-2 border-emerald-600 pb-2" : "border-b-3 border-emerald-600 pb-3"}>
        <div className="flex items-center justify-between">
          <h1 className={isMobileFormat ? "text-lg font-black tracking-tight text-emerald-700 uppercase leading-snug" : "text-2xl font-black tracking-tight text-emerald-700 uppercase leading-none"}>
            {isAllSelected ? 'BÁO CÁO KẾT QUẢ HOẠT ĐỘNG THÁNG' : `BÁO CÁO THÁNG: ${targetEmployee}`}
          </h1>
          {startDate && endDate && (
            <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              Kỳ: {startDate} - {endDate}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 1: CHẤM CÔNG */}
      {attendanceSummaries.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs sm:text-sm uppercase tracking-wider">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>1. CHẤM CÔNG & ĐIỂM BÁN</span>
            </div>
            <span className="text-[10.5px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Chu kỳ: {attendanceCycleDates.dates[0] ? `${attendanceCycleDates.dates[0].getDate()}/${attendanceCycleDates.dates[0].getMonth() + 1} - ${attendanceCycleDates.dates[attendanceCycleDates.dates.length - 1].getDate()}/${attendanceCycleDates.dates[attendanceCycleDates.dates.length - 1].getMonth() + 1}/${attendanceCycleDates.year}` : ''} ({totalWorkdaysInCycle} ngày)
            </span>
          </div>

          {!isAllSelected && attendanceSummaries[0] ? (
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Đúng giờ</span>
                <span className="text-base sm:text-lg font-black font-mono text-emerald-600 mt-0.5 block">
                  {attendanceSummaries[0].ontime}
                </span>
                <span className="text-[9px] text-slate-400">ngày</span>
              </div>
              <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-800 uppercase block">Đi muộn</span>
                <span className="text-base sm:text-lg font-black font-mono text-amber-600 mt-0.5 block">
                  {attendanceSummaries[0].late}
                </span>
                <span className="text-[9px] text-slate-400">ngày</span>
              </div>
              <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-200 text-center">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">Nghỉ phép</span>
                <span className="text-base sm:text-lg font-black font-mono text-rose-600 mt-0.5 block">
                  {attendanceSummaries[0].offCount}
                </span>
                <span className="text-[9px] text-slate-400">ngày</span>
              </div>
              <div className="bg-red-50/60 p-2.5 rounded-xl border border-red-200 text-center">
                <span className="text-[10px] font-bold text-red-800 uppercase block leading-tight">Lượt bỏ điểm</span>
                <span className="text-base sm:text-lg font-black font-mono text-red-700 mt-0.5 block">
                  {attendanceSummaries[0].skipCount || 0}
                </span>
                <span className="text-[9px] text-slate-400">lượt</span>
              </div>
              <div className="bg-red-50/60 p-2.5 rounded-xl border border-red-200 text-center">
                <span className="text-[10px] font-bold text-red-800 uppercase block leading-tight">Ngày bỏ điểm</span>
                <span className="text-base sm:text-lg font-black font-mono text-red-700 mt-0.5 block">
                  {attendanceSummaries[0].skipDaysCount || 0}
                </span>
                <span className="text-[9px] text-slate-400">ngày</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200 text-[10px] sm:text-[11px]">
                    <th className="py-2 px-1 text-center w-[7%]">STT</th>
                    <th className="py-2 px-2 text-left w-[27%]">Tên Nhân Viên</th>
                    <th className="py-2 px-1 text-center w-[12%]">Đúng giờ</th>
                    <th className="py-2 px-1 text-center w-[12%]">Đi muộn</th>
                    <th className="py-2 px-1 text-center w-[12%]">Nghỉ phép</th>
                    <th className="py-2 px-1 text-center w-[15%]">Lượt bỏ điểm</th>
                    <th className="py-2 px-1 text-center w-[15%]">Ngày bỏ điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {attendanceSummaries.map((emp, idx) => (
                    <tr key={emp.name} className="hover:bg-slate-50/50">
                      <td className="py-2 px-1 text-center font-bold font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                      <td className="py-2 px-2 font-bold text-slate-900 truncate">{emp.name}</td>
                      <td className="py-2 px-1 text-center font-mono font-black text-emerald-600">{emp.ontime}</td>
                      <td className="py-2 px-1 text-center font-mono font-black text-amber-600">{emp.late}</td>
                      <td className="py-2 px-1 text-center font-mono font-black text-rose-600">{emp.offCount}</td>
                      <td className={`py-2 px-1 text-center font-mono font-black ${emp.skipCount > 0 ? 'text-red-700 font-bold' : 'text-slate-500'}`}>
                        {emp.skipCount || 0}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono font-black ${emp.skipDaysCount > 0 ? 'text-red-700 font-bold' : 'text-slate-500'}`}>
                        {emp.skipDaysCount || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DỊCH VỤ THỊ TRƯỜNG (KHI XUẤT CHO NHÂN VIÊN - CHỈ HIỂN THỊ CÁC LỖI KHÔNG ĐẠT TRONG CHU KỲ) */}
      {!isAllSelected && employeeMarketEvaluation && (
        <div className="bg-white p-4 rounded-xl border border-rose-300 shadow-xs">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs sm:text-sm uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>DỊCH VỤ THỊ TRƯỜNG - LỖI VI PHẠM TRONG CHU KỲ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                CHƯA ĐẠT CHUẨN
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Số lượt viếng thăm</span>
              <span className="text-base sm:text-lg font-black font-mono text-slate-800 mt-0.5 block">
                {employeeMarketEvaluation.totalVisits}
              </span>
              <span className="text-[9px] text-slate-400">điểm bán</span>
            </div>
            <div className="bg-rose-50/80 p-2.5 rounded-xl border border-rose-200 text-center">
              <span className="text-[10px] font-bold text-rose-700 uppercase block">Lượt không đạt</span>
              <span className="text-base sm:text-lg font-black font-mono text-rose-600 mt-0.5 block">
                {employeeMarketEvaluation.totalFailedVisits}
              </span>
              <span className="text-[9px] text-rose-500">lượt vi phạm</span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 text-center flex flex-col justify-center">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Tỉ lệ vi phạm</span>
              <span className="text-base sm:text-lg font-black font-mono text-amber-700 mt-0.5 block">
                {employeeMarketEvaluation.rate}%
              </span>
              {employeeMarketEvaluation.evaluator && (
                <span className="text-[9px] text-amber-700/80 truncate">Người ĐG: {employeeMarketEvaluation.evaluator}</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-black text-rose-900 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Danh sách các dịch vụ thị trường KHÔNG ĐẠT:</span>
              <span className="text-[10px] text-rose-600 normal-case font-bold">
                {employeeMarketEvaluation.failedCriteriaList.length} tiêu chí vi phạm
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2.5">
              {employeeMarketEvaluation.failedCriteriaList.map((crit, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="truncate">{crit}</span>
                </div>
              ))}
            </div>

            {employeeMarketEvaluation.evaluationRecords && employeeMarketEvaluation.evaluationRecords.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-rose-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Chi tiết theo từng đợt đánh giá trong chu kỳ:</span>
                {employeeMarketEvaluation.evaluationRecords.map((rec: any, rIdx: number) => (
                  <div key={rec.id || rIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>Đợt {rIdx + 1}: Ngày {rec.ngay ? (rec.ngay.includes('-') ? rec.ngay.split('-').reverse().join('/') : rec.ngay) : '---'}</span>
                      <span className="text-rose-600 font-mono">{rec.soLuotKhongDat}/{rec.tongLuotViengTham} lượt lỗi ({rec.tiLeKhongDat}%)</span>
                    </div>
                    {rec.failedCriteria.length > 0 && (
                      <div className="text-rose-700 text-[10.5px]">
                        Lỗi: {rec.failedCriteria.join(', ')}
                      </div>
                    )}
                    {rec.ghiChu && (
                      <div className="text-slate-600 italic text-[10.5px]">
                        Ghi chú: "{rec.ghiChu}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DỊCH VỤ THỊ TRƯỜNG TOÀN ĐỘI NGŨ (KHI CHỌN TẤT CẢ - CHỈ HIỂN THỊ CÁC NHÂN VIÊN CÓ LỖI TRONG CHU KỲ) */}
      {isAllSelected && allEmployeesMarketViolations && allEmployeesMarketViolations.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-rose-300 shadow-xs">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs sm:text-sm uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>DỊCH VỤ THỊ TRƯỜNG - CÁC LỖI KHÔNG ĐẠT TRONG CHU KỲ</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              {allEmployeesMarketViolations.length} LƯỢT VI PHẠM
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-rose-50 text-rose-900 font-bold border-b border-rose-200">
                  <th className="py-2 px-2.5">Nhân viên</th>
                  <th className="py-2 px-2 text-center">Ngày</th>
                  <th className="py-2 px-2 text-center">Lỗi / Tổng lượt</th>
                  <th className="py-2 px-2.5">Lỗi tiêu chí</th>
                  <th className="py-2 px-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allEmployeesMarketViolations.map((v: any, vIdx: number) => (
                  <tr key={v.id || vIdx} className="hover:bg-rose-50/40">
                    <td className="py-2 px-2.5 font-bold text-slate-900">{v.nhanVien}</td>
                    <td className="py-2 px-2 text-center font-mono text-slate-600 whitespace-nowrap">
                      {v.ngay ? (v.ngay.includes('-') ? v.ngay.split('-').reverse().join('/') : v.ngay) : '---'}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-rose-600 whitespace-nowrap">
                      {v.soLuotKhongDat}/{v.tongLuotViengTham} ({v.tiLeKhongDat}%)
                    </td>
                    <td className="py-2 px-2.5 text-rose-700 font-medium">
                      {v.failedCriteria.length > 0 ? v.failedCriteria.join(', ') : 'Chưa đạt chuẩn'}
                    </td>
                    <td className="py-2 px-2 text-slate-600 italic max-w-xs truncate">{v.ghiChu || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: DOANH SỐ */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>2. THỰC HIỆN CHỈ TIÊU DOANH SỐ</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block truncate">Chỉ tiêu</span>
            <span className="text-sm sm:text-base font-black text-slate-800 font-mono mt-0.5 tracking-tight truncate">{formatMoney(Math.round(totalRevenueTarget))}</span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block truncate">Thực hiện</span>
            <span className="text-sm sm:text-base font-black text-emerald-700 font-mono mt-0.5 tracking-tight truncate">{formatMoney(Math.round(totalRevenueActual))}</span>
          </div>
          <div className="bg-sky-50/60 p-2.5 rounded-xl border border-sky-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block truncate">% Hoàn thành</span>
            <span className={`text-sm sm:text-base font-black font-mono mt-0.5 truncate ${revenueCompletionRate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {Math.round(revenueCompletionRate)}%
            </span>
          </div>
          {(() => {
            const revenueShortage = Math.round(totalRevenueTarget - totalRevenueActual);
            return (
              <div className={`${revenueShortage < 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'} p-2.5 rounded-xl border flex flex-col justify-between`}>
                <span className={`text-[10px] font-black uppercase tracking-wider ${revenueShortage < 0 ? 'text-emerald-800' : 'text-rose-800'} block truncate`}>Còn thiếu</span>
                <span className={`text-sm sm:text-base font-black ${revenueShortage < 0 ? 'text-emerald-600' : 'text-rose-600'} font-mono mt-0.5 tracking-tight truncate`}>
                  {revenueShortage < 0 ? `-${formatMoney(Math.abs(revenueShortage))}` : formatMoney(revenueShortage)}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* SECTION 3: SỐ BÁN */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <h3 className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>3. SỐ BÁN: CHỈ TIÊU NGÀNH HÀNG & CÁC NHÓM SẢN PHẨM</span>
        </h3>

        {/* 3.1 Chỉ tiêu ngành hàng */}
        <div>
          <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
            3.1 TIẾN ĐỘ THEO TỪNG NGÀNH HÀNG
          </h4>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200 text-[10px] sm:text-[11px]">
                  <th className="py-2 px-1.5 w-[38%]">Ngành Hàng</th>
                  <th className="py-2 px-1 text-right w-[20%]">Chỉ Tiêu</th>
                  <th className="py-2 px-1 text-right text-emerald-700 w-[20%]">Số Bán</th>
                  <th className="py-2 px-1 text-center w-[22%]">% Đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {sectorPerformanceRows.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50/50">
                    <td className="py-2 px-1.5 font-black text-emerald-900 whitespace-nowrap overflow-visible">
                      <span className="inline-block tracking-tight text-[11px] sm:text-xs">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2 px-1 text-right font-mono font-bold text-slate-700 text-[11px] sm:text-xs">
                      {formatNumber(row.target)}
                    </td>
                    <td className="py-2 px-1 text-right font-mono font-black text-emerald-600 text-[11px] sm:text-xs">
                      {formatNumber(row.actual)}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`font-mono font-black px-1.5 py-0.5 rounded text-[10px] sm:text-[10.5px] inline-block ${row.completionRate >= 100 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        {formatPercentage(row.completionRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3.2 Chi tiết các nhóm sản phẩm */}
        <div>
          <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
            3.2 CHI TIẾT CÁC NHÓM SẢN PHẨM
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
            {/* CLF Column */}
            <div className="bg-emerald-50/20 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-start">
              <h5 className="text-[11px] font-black text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100 mb-2">
                NGÀNH HÀNG CLF
              </h5>
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-emerald-100/60 text-emerald-900 font-black text-[9.5px] uppercase tracking-wider border-b border-emerald-200/80">
                    <th className="py-1 px-1 w-[40%] truncate">Sản Phẩm</th>
                    <th className="py-1 px-1 text-right w-[20%]">Chỉ Tiêu</th>
                    <th className="py-1 px-1 text-right text-emerald-800 w-[20%]">Số Bán</th>
                    <th className="py-1 px-1 text-center w-[20%]">% Đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {clfSubGroupData.map((item) => {
                    const rate = item.target > 0 ? (item.actual / item.target) * 100 : 0;
                    const isMet = rate >= 100;
                    return (
                      <tr
                        key={item.label}
                        className={item.isTotal
                          ? 'bg-emerald-100/75 border-y border-emerald-200/80 font-black'
                          : 'hover:bg-emerald-50/40'}
                      >
                        <td
                          className={`py-1 px-1 truncate text-[10.5px] ${item.isTotal ? 'font-black text-emerald-950' : 'font-bold text-slate-800'}`}
                          title={item.label}
                        >
                          {item.label}
                        </td>
                        <td className={`py-1 px-1 text-right font-mono text-[10px] ${item.isTotal ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                          {formatNumber(item.target)}
                        </td>
                        <td className={`py-1 px-1 text-right font-mono font-black text-[10px] ${item.isTotal ? 'text-emerald-800' : 'text-emerald-700'}`}>
                          {formatNumber(item.actual)}
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-black text-[9.5px]">
                          <span className={isMet ? 'text-emerald-700' : 'text-amber-700'}>
                            {formatPercentage(rate)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MCC Column */}
            <div className="bg-sky-50/20 p-2.5 rounded-xl border border-sky-100 flex flex-col justify-start">
              <h5 className="text-[11px] font-black text-sky-800 uppercase tracking-wider pb-1 border-b border-sky-100 mb-2">
                NGÀNH HÀNG MCC
              </h5>
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-sky-100/60 text-sky-900 font-black text-[9.5px] uppercase tracking-wider border-b border-sky-200/80">
                    <th className="py-1 px-1 w-[40%] truncate">Sản Phẩm</th>
                    <th className="py-1 px-1 text-right w-[20%]">Chỉ Tiêu</th>
                    <th className="py-1 px-1 text-right text-sky-800 w-[20%]">Số Bán</th>
                    <th className="py-1 px-1 text-center w-[20%]">% Đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {mccSubGroupData.map((item) => {
                    const rate = item.target > 0 ? (item.actual / item.target) * 100 : 0;
                    const isMet = rate >= 100;
                    return (
                      <tr key={item.label} className="hover:bg-sky-50/40">
                        <td className="py-1 px-1 font-bold text-slate-800 truncate text-[10.5px]" title={item.label}>
                          {item.label}
                        </td>
                        <td className="py-1 px-1 text-right font-mono font-bold text-slate-700 text-[10px]">
                          {formatNumber(item.target)}
                        </td>
                        <td className="py-1 px-1 text-right font-mono font-black text-sky-700 text-[10px]">
                          {formatNumber(item.actual)}
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-black text-[9.5px]">
                          <span className={isMet ? 'text-sky-700' : 'text-amber-700'}>
                            {formatPercentage(rate)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* NDFC Column */}
            <div className="bg-amber-50/20 p-2.5 rounded-xl border border-amber-100 flex flex-col justify-start">
              <h5 className="text-[11px] font-black text-amber-800 uppercase tracking-wider pb-1 border-b border-amber-100 mb-2">
                NGÀNH HÀNG NDFC
              </h5>
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-amber-100/60 text-amber-900 font-black text-[9.5px] uppercase tracking-wider border-b border-amber-200/80">
                    <th className="py-1 px-1 w-[40%] truncate">Sản Phẩm</th>
                    <th className="py-1 px-1 text-right w-[20%]">Chỉ Tiêu</th>
                    <th className="py-1 px-1 text-right text-amber-800 w-[20%]">Số Bán</th>
                    <th className="py-1 px-1 text-center w-[20%]">% Đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {ndfcSubGroupData.map((item) => {
                    const rate = item.target > 0 ? (item.actual / item.target) * 100 : 0;
                    const isMet = rate >= 100;
                    return (
                      <tr key={item.label} className="hover:bg-amber-50/40">
                        <td className="py-1 px-1 font-bold text-slate-800 truncate text-[10.5px]" title={item.label}>
                          {item.label}
                        </td>
                        <td className="py-1 px-1 text-right font-mono font-bold text-slate-700 text-[10px]">
                          {formatNumber(item.target)}
                        </td>
                        <td className="py-1 px-1 text-right font-mono font-black text-amber-700 text-[10px]">
                          {formatNumber(item.actual)}
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-black text-[9.5px]">
                          <span className={isMet ? 'text-amber-700' : 'text-rose-700'}>
                            {formatPercentage(rate)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: KÍCH HOẠT */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
          <Target className="w-4 h-4 text-emerald-600" />
          <span>4. TIẾN ĐỘ KÍCH HOẠT KHÁCH HÀNG</span>
        </h3>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200 text-[10px] sm:text-[11px]">
                <th className="py-2 px-2.5 w-[37%]">Hạng Mục Kích Hoạt</th>
                <th className="py-2 px-2 text-right w-[21%]">Chỉ Tiêu (KH)</th>
                <th className="py-2 px-2 text-right text-emerald-700 w-[21%]">Số Đạt (KH)</th>
                <th className="py-2 px-2 text-center w-[21%]">% Hoàn Thành</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {activationPerformanceRows.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/50">
                  <td className="py-2 px-2.5 font-black text-emerald-900 truncate">{row.name}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">
                    {formatNumber(row.target)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-emerald-600">
                    {formatNumber(row.actual)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`font-mono font-black px-2 py-0.5 rounded text-[10.5px] ${row.rate >= 100 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                      {formatPercentage(row.rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5: KẾT QUẢ THỰC HIỆN CÁC CTTB */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>
              {isAllSelected
                ? '5. KẾT QUẢ THỰC HIỆN CÁC CTTB THEO NHÂN VIÊN'
                : '5. KẾT QUẢ THỰC HIỆN CÁC CTTB'}
            </span>
          </h3>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            Tổng hợp CTTB (không gồm TBTN)
          </span>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block truncate">KH Tham Gia</span>
            <span className="text-sm sm:text-base font-black text-slate-800 font-mono mt-0.5 tracking-tight">
              {formatNumber(cttbSummary.totalThamGia)}
            </span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block truncate">KH Đạt Chuẩn</span>
            <span className="text-sm sm:text-base font-black text-emerald-700 font-mono mt-0.5 tracking-tight">
              {formatNumber(cttbSummary.totalDat)}
            </span>
          </div>
          <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block truncate">Thiếu Bộ Ảnh</span>
            <span className={`text-sm sm:text-base font-black font-mono mt-0.5 tracking-tight ${cttbSummary.totalKhongBoAnh > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
              {formatNumber(cttbSummary.totalKhongBoAnh)}
            </span>
          </div>
          <div className="bg-sky-50/60 p-2.5 rounded-xl border border-sky-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block truncate">% Đạt CTTB</span>
            <span className={`text-sm sm:text-base font-black font-mono mt-0.5 ${cttbSummary.rate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {formatPercentage(cttbSummary.rate)}
            </span>
          </div>
        </div>

        {/* Individual Employee View: Detailed table per CTTB program */}
        {!isAllSelected ? (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200 text-[10px] sm:text-[11px]">
                  <th className="py-2 px-2.5 w-[38%]">Chương Trình Trưng Bày</th>
                  <th className="py-2 px-1.5 text-right w-[15%]">Tham Gia</th>
                  <th className="py-2 px-1.5 text-right text-emerald-700 w-[15%]">KH Đạt</th>
                  <th className="py-2 px-1.5 text-right text-rose-700 w-[15%]">Thiếu Ảnh</th>
                  <th className="py-2 px-1.5 text-center w-[17%]">% Đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {cttbSummary.programs.map((prog) => {
                  const isTuNhien = prog.name.toLowerCase().includes('tự nhiên');
                  return (
                    <tr
                      key={prog.name}
                      className={isTuNhien ? 'bg-slate-50/70 hover:bg-slate-100/70' : 'hover:bg-slate-50/50'}
                    >
                      <td className="py-2 px-2.5 font-bold text-slate-900 truncate" title={prog.name}>
                        <span>{prog.name}</span>
                        {isTuNhien && (
                          <span className="ml-1.5 text-[9.5px] font-semibold text-slate-500">(Riêng)</span>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono font-bold text-slate-700">
                        {formatNumber(prog.thamGia)}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono font-black text-emerald-600">
                        {formatNumber(prog.dat)}
                      </td>
                      <td className={`py-2 px-1.5 text-right font-mono font-bold ${prog.khongBoAnh > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {formatNumber(prog.khongBoAnh)}
                      </td>
                      <td className="py-2 px-1.5 text-center">
                        <span
                          className={`font-mono font-black px-1.5 py-0.5 rounded text-[10px] inline-block ${
                            prog.thamGia === 0
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : prog.rate >= 100
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}
                        >
                          {prog.thamGia > 0 ? formatPercentage(prog.rate) : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/80 text-slate-900 font-black border-t border-emerald-200">
                  <td className="py-2 px-2.5 uppercase text-[10.5px] text-emerald-950">Tổng CTTB (trừ TBTN)</td>
                  <td className="py-2 px-1.5 text-right font-mono text-slate-800">{formatNumber(cttbSummary.totalThamGia)}</td>
                  <td className="py-2 px-1.5 text-right font-mono text-emerald-700">{formatNumber(cttbSummary.totalDat)}</td>
                  <td className="py-2 px-1.5 text-right font-mono text-rose-700">{formatNumber(cttbSummary.totalKhongBoAnh)}</td>
                  <td className="py-2 px-1.5 text-center font-mono text-emerald-800">{formatPercentage(cttbSummary.rate)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* Team View ("Tất cả"): Matrix of CTTB performance by each employee */
          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10.5px] table-fixed">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-black uppercase tracking-tight border-b border-slate-200 text-[9px]">
                  <th className="py-2 px-1.5 w-[138px]">Nhân Viên (Đạt/TG)</th>
                  {cttbReportData.programsList.map((prog) => {
                    const shortLabel =
                      prog === 'CTTB MEIZAN'
                        ? 'Meizan'
                        : prog === 'Nước Rửa Chén'
                        ? 'NRC'
                        : prog === 'Nam Dương'
                        ? 'N.Dương'
                        : prog === 'TRÀ VINATEA'
                        ? 'Trà'
                        : prog === 'Mắm 584NT'
                        ? '584NT'
                        : prog === 'Trưng Bày Tự Nhiên'
                        ? 'TBTN'
                        : prog;
                    return (
                      <th key={prog} className="py-2 px-0.5 text-center truncate" title={prog}>
                        {shortLabel}
                      </th>
                    );
                  })}
                  <th className="py-2 px-1 text-center w-[62px] text-emerald-800 bg-emerald-50/70">Tổng CTTB</th>
                  <th className="py-2 px-1 text-center w-[48px] text-emerald-800 bg-emerald-50/70">% Đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {cttbReportData.employeeRows.map((empRow) => (
                  <tr key={empRow.empName} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-1.5 font-bold text-slate-900 truncate" title={empRow.empName}>
                      {empRow.empName}
                    </td>
                    {cttbReportData.programsList.map((prog) => {
                      const st = empRow.byProgram[prog];
                      const hasData = st && st.thamGia > 0;
                      const isFull = hasData && st.dat >= st.thamGia;
                      return (
                        <td
                          key={prog}
                          className={`py-1.5 px-0.5 text-center font-mono whitespace-nowrap ${
                            !hasData
                              ? 'text-slate-300 font-normal'
                              : isFull
                              ? 'text-emerald-700 font-black'
                              : st.dat > 0
                              ? 'text-slate-900 font-bold'
                              : 'text-amber-700 font-semibold'
                          }`}
                          title={`${prog}: ${st?.dat || 0}/${st?.thamGia || 0} đạt`}
                        >
                          {hasData ? `${st.dat}/${st.thamGia}` : '-'}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-1 text-center font-mono font-black text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                      {empRow.totalDat}/{empRow.totalThamGia}
                    </td>
                    <td className="py-1.5 px-1 text-center font-mono font-black bg-emerald-50/30 whitespace-nowrap">
                      <span className={empRow.rate >= 100 ? 'text-emerald-700' : 'text-amber-700'}>
                        {empRow.totalThamGia > 0 ? formatPercentage(empRow.rate) : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/80 text-slate-900 font-black border-t border-emerald-200 text-[10px]">
                  <td className="py-2 px-1.5 uppercase text-emerald-950">Tổng Cộng</td>
                  {cttbSummary.programs.map((prog) => (
                    <td key={prog.name} className="py-2 px-0.5 text-center font-mono text-slate-900 whitespace-nowrap">
                      {prog.thamGia > 0 ? `${prog.dat}/${prog.thamGia}` : '-'}
                    </td>
                  ))}
                  <td className="py-2 px-1 text-center font-mono text-emerald-800 whitespace-nowrap">
                    {cttbSummary.totalDat}/{cttbSummary.totalThamGia}
                  </td>
                  <td className="py-2 px-1 text-center font-mono text-emerald-800 whitespace-nowrap">
                    {formatPercentage(cttbSummary.rate)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
