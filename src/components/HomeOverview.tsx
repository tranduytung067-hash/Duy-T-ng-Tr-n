import React, { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp,
  Zap,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Camera,
  PackageCheck,
  Store,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Award,
  Trophy,
  Calendar,
  Clock
} from 'lucide-react';
import { EmployeeTargetRow, SoBanRaw, SheetDataState, TuNhienRecord, CompetitionProgramConfig, ThiDuaBlock } from '../types';
import KPICards from './KPICards';
import {
  sortAndFormatEmployeeNames,
  cleanEmployeeName,
  fetchRawThiDuaRows,
  fetchThiDuaSheetData,
  parseThiDuaBlocks,
  generateMockThiDuaData,
} from '../utils/sheetParser';
import { matchProgramName, mockCttbEmployeeDetails, DEFAULT_TU_NHIEN_RECORDS, normalizeNameCompare } from './CttbProgress';
import {
  subscribeCompetitionPrograms,
  getLocalCompetitionProgramsSnapshot,
} from '../utils/competitionService';
import { buildProgramSpecs, computeThiDuaEmployeeSummary } from '../utils/thiDuaSummary';

const FMCG_SECTORS = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'VP', '584NT', 'VNT', 'DHF'];

const cleanStr = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const cleanNameCompare = (aStr: string, bStr: string) => {
  const clean = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, '');
  return clean(aStr) === clean(bStr);
};

const getRowKeyValue = (row: any, keys: string[]): string => {
  if (!row) return '';
  for (const k of keys) {
    const directVal = row[k];
    if (directVal !== undefined && directVal !== null && directVal !== '') {
      return String(directVal).trim();
    }
  }
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const cleanK = cleanStr(k);
    const foundKey = rowKeys.find(rk => cleanStr(rk) === cleanK || cleanStr(rk).includes(cleanK));
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return String(row[foundKey]).trim();
    }
  }
  return '';
};

const parseValueFromString = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  let normalized = str.replace(/\s+/g, '');
  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

const resolveSectorKeys = (
  rawRow: any,
  sector: string,
  isTransactionRow = false
): { targetKey: string | null; actualKey: string | null } => {
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
    targetKey = clearTargets.reduce((max, curr) => (curr.targetScore > max.targetScore ? curr : max), clearTargets[0]).key;
  }

  if (clearActuals.length > 0) {
    actualKey = clearActuals.reduce((max, curr) => (curr.actualScore > max.actualScore ? curr : max), clearActuals[0]).key;
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

interface HomeOverviewProps {
  totalTarget: number;
  totalActual: number;
  selectedEmployeeName: string;
  onSelectEmployee?: (name: string) => void;
  availableEmployees: string[];
  isEmployeeView: boolean;
  employees: EmployeeTargetRow[];
  transactions: SoBanRaw[];
  sectorData?: SheetDataState['sectorData'];
  cttbData?: SheetDataState['cttbData'];
  activationListData?: any[];
  trungBayListData?: any[];
  tuNhienRecords?: SheetDataState['tuNhienRecords'] | TuNhienRecord[];
  profileName?: string;
  profileRole?: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
  sheetId?: string;
  syncKey?: string | number;
  onNavigateToTab: (
    tab: 'doanhso' | 'kichhoat' | 'trungbay' | 'thidua' | 'chamcong',
    subTab?: 'tiendo' | 'doanhso' | 'tangtruong' | 'thuongnam',
    attendanceSubTab?: 'chamcong' | 'dichvuthitruong' | 'thoigianviengtham'
  ) => void;
}

export default function HomeOverview({
  totalTarget,
  totalActual,
  selectedEmployeeName,
  onSelectEmployee,
  availableEmployees,
  isEmployeeView,
  employees,
  transactions,
  sectorData,
  cttbData,
  activationListData = [],
  trungBayListData = [],
  tuNhienRecords = [],
  profileName,
  profileRole,
  cycleStartDate,
  cycleEndDate,
  sheetId,
  syncKey,
  onNavigateToTab,
}: HomeOverviewProps) {
  // Helper for matching employee names
  const isEmployeeMatch = (recordName: string | null | undefined, filterName: string): boolean => {
    if (filterName === 'Tất cả') return true;
    const cleanFilter = cleanStr(filterName);
    const cleanRecord = cleanStr(recordName);

    if (
      cleanFilter === 'nachuagankhbh' ||
      cleanFilter === 'na' ||
      cleanFilter === 'chuagankhbh'
    ) {
      return (
        cleanRecord === '' ||
        cleanRecord === 'na' ||
        cleanRecord === 'nan' ||
        cleanRecord === 'chuagankhbh'
      );
    }

    return cleanRecord === cleanFilter || cleanRecord.includes(cleanFilter) || cleanFilter.includes(cleanRecord);
  };

  // -------------------------------------------------------------
  // 1. SECTOR METRICS (NGÀNH HÀNG)
  // -------------------------------------------------------------
  const getEmployeeSectorPerformance = (empName: string, sector: string): { target: number; actual: number } => {
    if (sectorData) {
      if (empName === 'Tất cả') {
        let totalT = 0;
        let totalA = 0;
        Object.values(sectorData).forEach(empPerf => {
          if (empPerf[sector]) {
            totalT += empPerf[sector].target || 0;
            totalA += empPerf[sector].actual || 0;
          }
        });
        return { target: totalT, actual: totalA };
      }

      const cleanEmpName = cleanStr(empName);
      const empKey = Object.keys(sectorData).find(name => cleanStr(name) === cleanEmpName);
      if (empKey && sectorData[empKey] && sectorData[empKey][sector]) {
        return {
          target: sectorData[empKey][sector].target || 0,
          actual: sectorData[empKey][sector].actual || 0
        };
      }
      return { target: 0, actual: 0 };
    }

    const emp = employees.find(e => e.name && cleanStr(e.name) === cleanStr(empName));
    let target = 0;
    let actual = 0;
    let hasSectorTarget = false;
    let hasSectorActual = false;

    if (emp && emp.rawRow) {
      const { targetKey, actualKey } = resolveSectorKeys(emp.rawRow, sector, false);
      if (targetKey) {
        target = parseValueFromString(emp.rawRow[targetKey]);
        if (target > 0) hasSectorTarget = true;
      }
      if (actualKey) {
        actual = parseValueFromString(emp.rawRow[actualKey]);
        if (actual > 0) hasSectorActual = true;
      }
    }

    const empTxs = transactions.filter(t => t.NhanVien && cleanStr(t.NhanVien) === cleanStr(empName));

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
      const multiplier = empName === 'Tất cả' ? Math.max(1, employees.length) : 1;
      target = (mockBaselineTargets[sector] || 0) * multiplier;

      const sectorTxs = empTxs.filter(t => t.NganhHang.toUpperCase().includes(sector.toUpperCase()));
      let sum = 0;
      sectorTxs.forEach(t => {
        let val = t.ThucHien !== undefined ? t.ThucHien : t.SoLuong;
        if (val > 10000) {
          val = val / 1000000;
        }
        sum += val;
      });
      actual = sum;
    }

    return { target, actual };
  };

  const sectorRows = useMemo(() => {
    return FMCG_SECTORS.map((sector) => {
      let targetVal = 0;
      let actualVal = 0;

      if (selectedEmployeeName !== 'Tất cả') {
        const perf = getEmployeeSectorPerformance(selectedEmployeeName, sector);
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
      };
    });
  }, [FMCG_SECTORS, selectedEmployeeName, employees, transactions, sectorData]);

  // Number of sectors reaching 100%
  const sectorsAchieved100 = useMemo(() => {
    return sectorRows.filter(s => s.completionRate >= 100).length;
  }, [sectorRows]);

  const totalSectorsCount = sectorRows.length;

  // Top 3 slowest sectors (completion rate lowest)
  const top3SlowSectors = useMemo(() => {
    return [...sectorRows]
      .filter(s => s.category !== 'NON - WM' || s.target > 0)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 3);
  }, [sectorRows]);

  // -------------------------------------------------------------
  // 2. ACTIVATION METRICS (KÍCH HOẠT)
  // -------------------------------------------------------------
  const filteredEmployeesForChart = useMemo(() => {
    return employees.filter(emp => isEmployeeMatch(emp.name, selectedEmployeeName || 'Tất cả'));
  }, [employees, selectedEmployeeName]);

  const activationSummary = useMemo(() => {
    return filteredEmployeesForChart.reduce(
      (acc, next) => {
        acc.t3TargetTotal += next.k3Target || 0;
        acc.t3ActualTotal += next.k3Actual || 0;
        acc.t4TargetTotal += next.k4Target || 0;
        acc.t4ActualTotal += next.k4Actual || 0;

        // HRC (Lựa Chọn 1): Chỉ tiêu và Thực hiện chỉ lấy từ chuyên trách Horeca Nguyễn Đức Tuấn
        const isEmpTuan = cleanStr(next.name).includes('tuan');
        if (isEmpTuan) {
          const hrcTarget = (next.khmhThangTarget !== undefined && next.khmhThangTarget !== null && Number(next.khmhThangTarget) > 0)
            ? Number(next.khmhThangTarget)
            : 110;
          const hrcActual = (next.khmhThangActual !== undefined && next.khmhThangActual !== null && Number(next.khmhThangActual) > 0)
            ? Number(next.khmhThangActual)
            : 85;

          acc.khmTargetTotal += hrcTarget;
          acc.khmActualTotal += hrcActual;
        }

        acc.khTargetTotal += next.khTarget || 0;
        acc.khActualTotal += next.khActual || 0;
        return acc;
      },
      { t3TargetTotal: 0, t3ActualTotal: 0, t4TargetTotal: 0, t4ActualTotal: 0, khmTargetTotal: 0, khmActualTotal: 0, khTargetTotal: 0, khActualTotal: 0 }
    );
  }, [filteredEmployeesForChart]);

  const getDisplayPercentage = (actual: number, target: number): number => {
    if (target <= 0) return 0;
    const rawPct = (actual / target) * 100;
    if (target - actual > 0) {
      return Math.min(rawPct, 99);
    }
    return rawPct;
  };

  const t3Percentage = getDisplayPercentage(activationSummary.t3ActualTotal, activationSummary.t3TargetTotal);
  const t4Percentage = getDisplayPercentage(activationSummary.t4ActualTotal, activationSummary.t4TargetTotal);
  const khmPercentage = getDisplayPercentage(activationSummary.khmActualTotal, activationSummary.khmTargetTotal);
  const khPercentage = getDisplayPercentage(activationSummary.khActualTotal, activationSummary.khTargetTotal);

  const isTuan = (selectedEmployeeName && cleanStr(selectedEmployeeName).includes('tuan')) ||
                 (profileName && cleanStr(profileName).includes('tuan'));
  const showHRC = !!isTuan || activationSummary.khmTargetTotal > 0;
  const showKHChuan = activationSummary.khTargetTotal > 0;

  // -------------------------------------------------------------
  // 3. DISPLAY / CTTB METRICS (TRƯNG BÀY)
  // -------------------------------------------------------------
  const rawTrungBayList = (trungBayListData && trungBayListData.length > 0) ? trungBayListData : [];

  const cttbSummary = useMemo(() => {
    if (rawTrungBayList && rawTrungBayList.length > 0) {
      let countTotal = 0;
      let countDat = 0;
      let countThieuAnh = 0;

      rawTrungBayList.forEach((row) => {
        if (!row) return;

        if (selectedEmployeeName !== 'Tất cả') {
          const empVal = (
            getRowKeyValue(row, ['nhan vien', 'nhân viên', 'nv', 'employee', 'staff']) || row['B'] || row['b'] || ''
          ).toString().trim();
          if (!cleanNameCompare(empVal, selectedEmployeeName)) {
            return;
          }
        }

        const valF = (
          getRowKeyValue(row, ['ten cttb', 'cttb', 'chuong trinh', 'ten chuong trinh', 'program']) || row['F'] || row['f'] || ''
        ).toString().trim();
        const lowerF = valF.toLowerCase();
        if (!valF || lowerF === 'tên cttb' || lowerF === 'tên chương trình' || lowerF === 'cttb' || lowerF === 'f') {
          return;
        }

        if (cleanNameCompare(valF, 'Trưng Bày Tự Nhiên') || lowerF.includes('tự nhiên') || lowerF.includes('tu nhien')) {
          return;
        }

        countTotal++;

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

      const rate = countTotal > 0 ? (countDat / countTotal) * 100 : 0;
      return {
        totalParticipants: countTotal,
        totalAchieved: countDat,
        totalNoPhotos: countThieuAnh,
        rate
      };
    }

    // Fallback based on mockCttbEmployeeDetails or cttbData
    const basePrograms = ['Thuê Kệ', 'Nước Rửa Chén', 'Giặt Xả', 'TRÀ VINATEA', 'Gạo', 'Nam Dương', 'Mắm 584NT'];
    let fallbackTotal = 0;
    let fallbackAchieved = 0;
    let fallbackNoPhoto = 0;

    basePrograms.forEach(prog => {
      const progDetail = mockCttbEmployeeDetails[prog];
      if (progDetail) {
        if (selectedEmployeeName !== 'Tất cả') {
          const empDetail = progDetail[selectedEmployeeName];
          if (empDetail) {
            fallbackTotal += empDetail.khThamGia;
            fallbackAchieved += empDetail.khDat;
            fallbackNoPhoto += empDetail.khKhongBoAnh;
          }
        } else {
          Object.values(progDetail).forEach(empDetail => {
            fallbackTotal += empDetail.khThamGia;
            fallbackAchieved += empDetail.khDat;
            fallbackNoPhoto += empDetail.khKhongBoAnh;
          });
        }
      }
    });

    const rate = fallbackTotal > 0 ? (fallbackAchieved / fallbackTotal) * 100 : 0;
    return {
      totalParticipants: fallbackTotal,
      totalAchieved: fallbackAchieved,
      totalNoPhotos: fallbackNoPhoto,
      rate
    };
  }, [rawTrungBayList, selectedEmployeeName]);

  // -------------------------------------------------------------
  // 3.2 NATURAL DISPLAY / TRƯNG BÀY TỰ NHIÊN METRICS
  // -------------------------------------------------------------
  const tuNhienSummary = useMemo(() => {
    const activeTuNhienList = (tuNhienRecords && tuNhienRecords.length > 0) ? tuNhienRecords : DEFAULT_TU_NHIEN_RECORDS;

    // 1. Primary: From Sheet Tổng Hợp TB (Cột V đến Cột AA) via activeTuNhienList
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
          khThamGia: finalKhThamGia,
          khDat: finalKhDat,
          khKhongBoAnh: finalKhKhongBoAnh,
          rate
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
            khThamGia: finalKhThamGia,
            khDat: finalKhDat,
            khKhongBoAnh: finalKhKhongBoAnh,
            rate
          };
        } else {
          return {
            khThamGia: 0,
            khDat: 0,
            khKhongBoAnh: 0,
            rate: 0
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
          khThamGia: finalKhThamGia,
          khDat: finalKhDat,
          khKhongBoAnh: finalKhKhongBoAnh,
          rate
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
            khThamGia: finalKhThamGia,
            khDat: finalKhDat,
            khKhongBoAnh: finalKhKhongBoAnh,
            rate
          };
        }
      }
    }

    return {
      khThamGia: 0,
      khDat: 0,
      khKhongBoAnh: 0,
      rate: 0
    };
  }, [tuNhienRecords, cttbData, selectedEmployeeName]);

  // Trạng thái mở rộng danh sách chi tiết các ngành hàng FMCG (mặc định ở trạng thái thu gọn theo yêu cầu)
  const [showAllSectors, setShowAllSectors] = useState<boolean>(false);
  // Trạng thái mở rộng danh sách tên các CT Thi Đua đang chạy (mặc định thu gọn, mở khi bấm CT Đang Chạy)
  const [showCompetitionList, setShowCompetitionList] = useState<boolean>(false);

  // Danh sách các chương trình thi đua đang kích hoạt + dữ liệu thưởng thực tế (đồng bộ 100% với phân hệ Thi Đua)
  const [customPrograms, setCustomPrograms] = useState<CompetitionProgramConfig[]>(() => {
    return getLocalCompetitionProgramsSnapshot();
  });
  const [thiDuaRawRows, setThiDuaRawRows] = useState<any[]>([]);
  const [thiDuaBlocks, setThiDuaBlocks] = useState<ThiDuaBlock[]>([]);

  useEffect(() => {
    const unsub = subscribeCompetitionPrograms((progs) => {
      if (progs && progs.length > 0) {
        setCustomPrograms(progs);
      } else {
        setCustomPrograms([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const activeSheetId = sheetId || (typeof window !== 'undefined' ? localStorage.getItem('gs_sheet_id') || '' : '');
    const loadThiDua = async () => {
      try {
        if (!activeSheetId) {
          if (!cancelled) setThiDuaBlocks(generateMockThiDuaData());
          return;
        }
        const rawRows = await fetchRawThiDuaRows(activeSheetId, false);
        if (cancelled) return;
        if (rawRows && rawRows.length > 0) {
          setThiDuaRawRows(rawRows);
          setThiDuaBlocks(parseThiDuaBlocks(rawRows, activeSheetId, customPrograms));
        } else {
          const parsed = await fetchThiDuaSheetData(activeSheetId, false, customPrograms);
          if (!cancelled) {
            setThiDuaBlocks(parsed && parsed.length > 0 ? parsed : generateMockThiDuaData());
          }
        }
      } catch {
        if (!cancelled) setThiDuaBlocks(generateMockThiDuaData());
      }
    };
    loadThiDua();
    return () => {
      cancelled = true;
    };
  }, [sheetId, syncKey]);

  useEffect(() => {
    const activeSheetId = sheetId || (typeof window !== 'undefined' ? localStorage.getItem('gs_sheet_id') || '' : '');
    if (thiDuaRawRows && thiDuaRawRows.length > 0 && activeSheetId) {
      setThiDuaBlocks(parseThiDuaBlocks(thiDuaRawRows, activeSheetId, customPrograms));
    }
  }, [customPrograms, thiDuaRawRows, sheetId]);

  const activeCompetitions = useMemo(() => {
    return buildProgramSpecs(customPrograms).filter((s) => s.isActive === true && (s as any).isArchived !== true);
  }, [customPrograms]);

  const thiDuaSummary = useMemo(() => {
    return computeThiDuaEmployeeSummary(thiDuaBlocks, activeCompetitions, customPrograms);
  }, [thiDuaBlocks, activeCompetitions, customPrograms]);

  const selectedEmpThiDua = useMemo(() => {
    if (!selectedEmployeeName || selectedEmployeeName === 'Tất cả') return null;
    const cleanSel = cleanEmployeeName(selectedEmployeeName).toLowerCase();
    return (
      thiDuaSummary.employeeSummaryList.find(
        (e) =>
          cleanEmployeeName(e.empName).toLowerCase() === cleanSel ||
          e.empName.toLowerCase().includes(cleanSel)
      ) || null
    );
  }, [thiDuaSummary.employeeSummaryList, selectedEmployeeName]);

  return (
    <div id="trangchu-overview-container" className="space-y-4 sm:space-y-5 animate-fadeIn pb-6 font-sans">

      {/* -------------------------------------------------------------
          LỐI TẮT PHÂN HỆ NHANH TRÊN TRANG CHỦ
      ------------------------------------------------------------- */}
      <section
        id="home-quick-shortcuts"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-4"
      >
        <div className="grid grid-cols-4 items-stretch gap-2 sm:gap-3">
          {/* 1. Chấm Công */}
          <button
            type="button"
            onClick={() => onNavigateToTab('chamcong', undefined, 'chamcong')}
            className="h-full flex flex-col items-center justify-start gap-1.5 pt-2.5 pb-2 px-1.5 sm:p-3 rounded-xl bg-slate-50/80 hover:bg-sky-50/70 border border-slate-200/80 hover:border-sky-200 transition-[colors,transform] cursor-pointer text-center active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="w-full min-h-[26px] sm:min-h-[32px] flex items-center justify-center">
              <span className="font-bold text-[10px] xs:text-[10.5px] sm:text-xs text-slate-800 leading-tight line-clamp-2">
                Chấm Công
              </span>
            </div>
          </button>

          {/* 2. Thi Đua */}
          <button
            type="button"
            onClick={() => onNavigateToTab('thidua')}
            className="h-full flex flex-col items-center justify-start gap-1.5 pt-2.5 pb-2 px-1.5 sm:p-3 rounded-xl bg-slate-50/80 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-200 transition-[colors,transform] cursor-pointer text-center active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="w-full min-h-[26px] sm:min-h-[32px] flex items-center justify-center">
              <span className="font-bold text-[10px] xs:text-[10.5px] sm:text-xs text-slate-800 leading-tight line-clamp-2">
                Thi Đua
              </span>
            </div>
          </button>

          {/* 3. Dịch Vụ */}
          <button
            type="button"
            onClick={() => onNavigateToTab('chamcong', undefined, 'dichvuthitruong')}
            className="h-full flex flex-col items-center justify-start gap-1.5 pt-2.5 pb-2 px-1.5 sm:p-3 rounded-xl bg-slate-50/80 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-200 transition-[colors,transform] cursor-pointer text-center active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="w-full min-h-[26px] sm:min-h-[32px] flex items-center justify-center">
              <span className="font-bold text-[10px] xs:text-[10.5px] sm:text-xs text-slate-800 leading-tight line-clamp-2">
                Dịch Vụ
              </span>
            </div>
          </button>

          {/* 4. Thời Gian Viếng Thăm */}
          <button
            type="button"
            onClick={() => onNavigateToTab('chamcong', undefined, 'thoigianviengtham')}
            className="h-full flex flex-col items-center justify-start gap-1.5 pt-2.5 pb-2 px-1.5 sm:p-3 rounded-xl bg-slate-50/80 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-200 transition-[colors,transform] cursor-pointer text-center active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="w-full min-h-[26px] sm:min-h-[32px] flex items-center justify-center">
              <span className="font-bold text-[10px] xs:text-[10.5px] sm:text-xs text-slate-800 leading-tight line-clamp-2">
                Thời Gian Viếng Thăm
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* -------------------------------------------------------------
          KHỐI 1: SỐ BÁN (TIẾN ĐỘ SỐ BÁN & DOANH SỐ)
      ------------------------------------------------------------- */}
      <section id="home-section-so-ban">
        <KPICards
          totalTarget={totalTarget}
          totalActual={totalActual}
          onOpenDetail={() => onNavigateToTab('doanhso', 'doanhso')}
        />
      </section>

      {/* -------------------------------------------------------------
          KHỐI 2: TIẾN ĐỘ NGÀNH HÀNG (HIỂN THỊ ĐẦY ĐỦ 9 NGÀNH HÀNG)
      ------------------------------------------------------------- */}
      <section id="home-section-nganh-hang" className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shrink-0">
              <Layers className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-base font-extrabold uppercase tracking-wider text-slate-900 leading-tight truncate">
                TIẾN ĐỘ NGÀNH HÀNG
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">9 Ngành Hàng FMCG</span>
            <button
              type="button"
              onClick={() => setShowAllSectors(!showAllSectors)}
              className="min-h-[40px] sm:min-h-0 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-[colors,transform] active:scale-95"
            >
              <span>{showAllSectors ? 'Thu Gọn' : 'Mở Rộng'}</span>
              {showAllSectors ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 2.1: Thẻ tổng kết tỷ lệ đạt 100% (1 hàng ngang gọn trên Mobile) & Top 3 chậm nhất */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="sm:col-span-1 bg-emerald-50/40 border border-emerald-200/80 rounded-xl px-4 py-3 sm:p-4 flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2 min-w-0">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Ngành Đạt 100%
              </span>
              <span className="text-[10.5px] sm:hidden text-slate-500 font-medium truncate">
                {sectorsAchieved100 === totalSectorsCount
                  ? 'Toàn bộ ngành đạt chỉ tiêu'
                  : `${totalSectorsCount - sectorsAchieved100} ngành cần bám sát`}
              </span>
              <span className="hidden sm:inline text-xs font-extrabold font-tabular text-emerald-700">
                {((sectorsAchieved100 / totalSectorsCount) * 100).toFixed(0)}%
              </span>
            </div>

            {/* Số 3/9 to rõ */}
            <div className="sm:my-auto sm:py-3 flex items-baseline justify-end sm:justify-center text-center shrink-0">
              <div className="flex items-baseline justify-center font-mono leading-none tracking-tight">
                <span className="text-2xl sm:text-5xl lg:text-6xl font-black text-emerald-700">
                  {sectorsAchieved100}
                </span>
                <span className="text-base sm:text-3xl lg:text-4xl font-extrabold text-slate-400 mx-0.5 sm:mx-1">
                  /
                </span>
                <span className="text-base sm:text-3xl lg:text-4xl font-bold text-slate-500">
                  {totalSectorsCount}
                </span>
              </div>
              <span className="sm:hidden ml-1.5 text-[11px] font-extrabold font-tabular text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md">
                {((sectorsAchieved100 / totalSectorsCount) * 100).toFixed(0)}%
              </span>
            </div>

            <div className="hidden sm:block text-center pt-1 border-t border-emerald-100/70">
              <p className="text-[10.5px] text-slate-500 font-medium">
                {sectorsAchieved100 === totalSectorsCount
                  ? 'Toàn bộ ngành hàng đã đạt chỉ tiêu'
                  : `${totalSectorsCount - sectorsAchieved100} ngành hàng cần tiếp tục bám sát`}
              </p>
            </div>
          </div>

          {/* 2.2: Top 3 Slowest Sectors */}
          <div className="sm:col-span-2 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Top 3 Ngành Hàng Đang Chậm Nhất
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Tỷ lệ hoàn thành</span>
            </div>

            <div className="space-y-2">
              {top3SlowSectors.map((sector, index) => {
                const isVeryLow = sector.completionRate < 50;
                const isMedium = sector.completionRate >= 50 && sector.completionRate < 90;
                const barColor = isVeryLow
                  ? 'bg-rose-500'
                  : isMedium
                  ? 'bg-amber-500'
                  : 'bg-emerald-500';

                return (
                  <div
                    key={sector.category}
                    className="bg-white border border-slate-200 rounded-lg p-2 sm:p-2.5 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-extrabold text-slate-800 font-mono truncate text-[12.5px]">
                          {sector.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11.5px] shrink-0">
                        <span className="text-slate-500">Đạt:</span>
                        <span className={`font-black ${isVeryLow ? 'text-rose-600' : isMedium ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {sector.completionRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(2, sector.completionRate))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2.3: Danh Sách Hiển Thị Chi Tiết Đầy Đủ Các Ngành Hàng */}
        {showAllSectors && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                CHI TIẾT CÁC NGÀNH HÀNG
              </span>
              <span className="text-[10.5px] text-slate-500 font-medium">
                (Thực hiện / Chỉ tiêu)
              </span>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-2.5">
              {sectorRows.map((sector) => {
                const isOver = sector.completionRate >= 100;
                const isMedium = sector.completionRate >= 80 && sector.completionRate < 100;
                const barColor = isOver ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500';

                return (
                  <div
                    key={sector.category}
                    className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-xs sm:text-sm font-mono text-slate-900 truncate">
                        {sector.category}
                      </span>
                      <span className={`text-[11px] font-extrabold font-tabular ${
                        isOver
                          ? 'text-emerald-700'
                          : isMedium
                          ? 'text-amber-700'
                          : 'text-rose-600'
                      }`}>
                        {sector.completionRate.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-tabular font-medium">
                      <span>Đạt: <strong className="text-slate-800 font-extrabold">{sector.actual.toFixed(2)}</strong></span>
                      <span>CT: {sector.target.toFixed(2)}</span>
                    </div>

                    <div className="w-full bg-slate-200/90 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(2, sector.completionRate))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------
          KHỐI 3: TỔNG QUAN KÍCH HOẠT (ACTIVATION - LƯỚI 2x2 TRÊN MOBILE)
      ------------------------------------------------------------- */}
      <section id="home-section-kich-hoat" className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
              <Zap className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-base font-extrabold uppercase tracking-wider text-slate-900 leading-tight truncate">
                TỔNG QUAN KÍCH HOẠT
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('kichhoat')}
            className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200/80 transition-[colors,transform] cursor-pointer active:scale-95 shrink-0"
          >
            <span className="sm:hidden">Chi tiết</span>
            <span className="hidden sm:inline">Chi tiết kích hoạt</span>
            <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
          </button>
        </div>

        {/* 4 Metric Cards for Activation: Lưới 2x2 hiển thị đầy đủ không bị tràn màn hình */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card 1: 3 Ngành Hàng */}
          <div className="bg-slate-50/70 border border-indigo-200/70 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 truncate">
                3 Ngành Hàng
              </span>
              <span className="text-[11px] font-extrabold text-indigo-700 font-tabular shrink-0">
                {t3Percentage.toFixed(0)}%
              </span>
            </div>
            <div>
              <div className="text-base xs:text-lg sm:text-2xl font-black text-indigo-950 font-tabular leading-tight">
                {activationSummary.t3ActualTotal} <span className="text-xs font-semibold text-slate-500 font-sans">/ {activationSummary.t3TargetTotal}</span>
              </div>
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, t3Percentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: 4 Ngành Hàng */}
          <div className="bg-slate-50/70 border border-teal-200/70 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-teal-900 truncate">
                4 Ngành Hàng
              </span>
              <span className="text-[11px] font-extrabold text-teal-700 font-tabular shrink-0">
                {t4Percentage.toFixed(0)}%
              </span>
            </div>
            <div>
              <div className="text-base xs:text-lg sm:text-2xl font-black text-teal-950 font-tabular leading-tight">
                {activationSummary.t4ActualTotal} <span className="text-xs font-semibold text-slate-500 font-sans">/ {activationSummary.t4TargetTotal}</span>
              </div>
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, t4Percentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: KH Đạt Chuẩn */}
          <div className="bg-slate-50/70 border border-emerald-200/70 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 truncate">
                KH Đạt Chuẩn
              </span>
              <span className="text-[11px] font-extrabold text-emerald-700 font-tabular shrink-0">
                {khPercentage.toFixed(0)}%
              </span>
            </div>
            <div>
              <div className="text-base xs:text-lg sm:text-2xl font-black text-emerald-950 font-tabular leading-tight">
                {activationSummary.khActualTotal} <span className="text-xs font-semibold text-slate-500 font-sans">/ {activationSummary.khTargetTotal}</span>
              </div>
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, khPercentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Kích Hoạt KH HRC */}
          <div className="bg-slate-50/70 border border-amber-200/70 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-900 truncate">
                KH Horeca
              </span>
              <span className="text-[11px] font-extrabold text-amber-700 font-tabular shrink-0">
                {activationSummary.khmTargetTotal > 0 ? `${khmPercentage.toFixed(0)}%` : '—'}
              </span>
            </div>
            <div>
              <div className="text-base xs:text-lg sm:text-2xl font-black text-amber-950 font-tabular leading-tight">
                {activationSummary.khmTargetTotal > 0 ? (
                  <>
                    {activationSummary.khmActualTotal} <span className="text-xs font-semibold text-slate-500 font-sans">/ {activationSummary.khmTargetTotal}</span>
                  </>
                ) : (
                  <span className="text-xs sm:text-sm font-semibold text-slate-400">Không áp dụng</span>
                )}
              </div>
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-amber-600 rounded-full transition-all duration-500"
                  style={{ width: `${activationSummary.khmTargetTotal > 0 ? Math.min(100, Math.max(0, khmPercentage)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          KHỐI 4: TIẾN ĐỘ TRƯNG BÀY (TÁCH 2 PHẦN: TRẢ PHÍ & TỰ NHIÊN - LƯỚI 2x2)
      ------------------------------------------------------------- */}
      <section id="home-section-trung-bay" className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Header khối */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
              <Camera className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-base font-extrabold uppercase tracking-wider text-slate-900 leading-tight truncate">
                TIẾN ĐỘ TRƯNG BÀY
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('trungbay')}
            className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200/80 transition-[colors,transform] cursor-pointer active:scale-95 shrink-0"
          >
            <span className="sm:hidden">Chi tiết</span>
            <span className="hidden sm:inline">Chi tiết trưng bày</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-700" />
          </button>
        </div>

        {/* PHẦN 1: TRƯNG BÀY TRẢ PHÍ */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              1. Trưng Bày Trả Phí
            </h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Metric 1: Tổng Điểm Bán */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                Tổng Điểm Bán
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-slate-800 font-tabular leading-tight">
                  {cttbSummary.totalParticipants.toLocaleString('vi-VN')}
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Điểm tham gia</span>
              </div>
            </div>

            {/* Metric 2: Điểm Bán Đạt */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Điểm Bán Đạt
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-emerald-700 font-tabular leading-tight">
                  {cttbSummary.totalAchieved.toLocaleString('vi-VN')}
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Đạt tiêu chuẩn</span>
              </div>
            </div>

            {/* Metric 3: Tỉ Lệ Đạt */}
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                Tỉ Lệ Đạt
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-teal-700 font-tabular leading-tight">
                  {cttbSummary.rate.toFixed(1)}%
                </div>
                <span className="text-[10px] text-teal-600 font-bold">Hoàn thành</span>
              </div>
            </div>

            {/* Metric 4: Chưa Có Ảnh */}
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Chưa Có Ảnh
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-rose-600 font-tabular leading-tight">
                  {cttbSummary.totalNoPhotos.toLocaleString('vi-VN')}
                </div>
                <span className="text-[10px] text-rose-600 font-bold">Thiếu ảnh</span>
              </div>
            </div>
          </div>
        </div>

        {/* PHẦN 2: TRƯNG BÀY TỰ NHIÊN */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              2. Trưng Bày Tự Nhiên
            </h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Metric 1: Tổng Điểm Bán */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                Tổng Điểm Bán
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-slate-800 font-tabular leading-tight">
                  {tuNhienSummary.khThamGia.toLocaleString('vi-VN')}
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Điểm tham gia</span>
              </div>
            </div>

            {/* Metric 2: Điểm Bán Đạt */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Điểm Bán Đạt
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-emerald-700 font-tabular leading-tight">
                  {tuNhienSummary.khDat.toLocaleString('vi-VN')}
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Đạt tiêu chuẩn</span>
              </div>
            </div>

            {/* Metric 3: Tỉ Lệ Đạt */}
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                Tỉ Lệ Đạt
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-teal-700 font-tabular leading-tight">
                  {tuNhienSummary.rate.toFixed(1)}%
                </div>
                <span className="text-[10px] text-teal-600 font-bold">Hoàn thành</span>
              </div>
            </div>

            {/* Metric 4: Chưa Có Ảnh */}
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Chưa Có Ảnh
              </span>
              <div>
                <div className="text-lg sm:text-2xl font-black text-rose-600 font-tabular leading-tight">
                  {tuNhienSummary.khKhongBoAnh.toLocaleString('vi-VN')}
                </div>
                <span className="text-[10px] text-rose-600 font-bold">Thiếu ảnh</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          KHỐI 5: TỔNG QUAN THI ĐUA (COMPETITION)
      ------------------------------------------------------------- */}
      <section id="home-section-thi-dua" className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-base font-extrabold uppercase tracking-wider text-slate-900 leading-tight truncate">
                TỔNG QUAN THI ĐUA
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('thidua')}
            className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200/80 transition-[colors,transform] cursor-pointer active:scale-95 shrink-0"
          >
            <span className="sm:hidden">Chi tiết</span>
            <span className="hidden sm:inline">Chi tiết thi đua</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-700" />
          </button>
        </div>

        {activeCompetitions.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 font-medium">
            Hiện không có chương trình thi đua nào đang bật.
          </div>
        ) : (
          <div className="space-y-3">
            {/* 3 Thống kê tổng quan Thi Đua: Số CT đang chạy (bấm để mở danh sách), Tổng Tiền Thưởng, Số NV Đạt Thưởng */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-amber-50/45 p-3 rounded-xl border border-amber-200/80">
              {/* 1. Số CT Thi Đua đang chạy (Interactive toggle button) */}
              <button
                type="button"
                onClick={() => setShowCompetitionList((prev) => !prev)}
                aria-expanded={showCompetitionList}
                className={`flex flex-col items-center justify-center text-center px-1.5 py-1 rounded-lg transition-[colors,transform] cursor-pointer active:scale-[0.97] ${
                  showCompetitionList
                    ? 'bg-amber-100/80 ring-1 ring-amber-300/90'
                    : 'hover:bg-amber-100/50'
                }`}
                title="Bấm để xem hoặc thu gọn danh sách chương trình thi đua"
              >
                <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider line-clamp-1">
                  CT Đang Chạy
                </span>
                <span className="text-sm sm:text-xl font-black text-amber-700 font-tabular leading-tight mt-0.5">
                  {thiDuaSummary.activeCount}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 inline-flex items-center gap-0.5 max-w-full">
                  <span className="truncate">
                    {selectedEmpThiDua ? `${selectedEmpThiDua.completedCount} CT đạt` : 'Chương trình'}
                  </span>
                  {showCompetitionList ? (
                    <ChevronUp className="w-3 h-3 shrink-0 text-amber-700" />
                  ) : (
                    <ChevronDown className="w-3 h-3 shrink-0 text-amber-700" />
                  )}
                </span>
              </button>

              {/* 2. Tổng Tiền Thưởng */}
              <div className="flex flex-col items-center justify-center text-center px-1 py-0.5 border-x border-amber-200/80">
                <span className="text-[9.5px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider line-clamp-1">
                  {selectedEmpThiDua ? 'Thưởng NV' : 'Tổng Tiền Thưởng'}
                </span>
                <span className="text-xs sm:text-xl font-black text-amber-900 font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                  {(selectedEmpThiDua ? selectedEmpThiDua.totalBonus : thiDuaSummary.grandTotalBonus).toLocaleString('vi-VN')}{' '}
                  <span className="text-[9px] sm:text-xs font-sans font-bold">₫</span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-amber-700/80 truncate max-w-full">
                  {selectedEmpThiDua
                    ? `Đội: ${thiDuaSummary.grandTotalBonus.toLocaleString('vi-VN')}₫`
                    : 'toàn đội ngũ'}
                </span>
              </div>

              {/* 3. Số nhân viên đạt thưởng */}
              <div className="flex flex-col items-center justify-center text-center px-1 py-0.5">
                <span className="text-[9.5px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider line-clamp-1">
                  NV Đạt Thưởng
                </span>
                <span className="text-sm sm:text-xl font-black text-emerald-700 font-tabular leading-tight mt-0.5 whitespace-nowrap">
                  {thiDuaSummary.rewardedEmpCount}{' '}
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500">
                    / {thiDuaSummary.totalEmployees}
                  </span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-700/80 truncate max-w-full">
                  {selectedEmpThiDua
                    ? (selectedEmpThiDua.totalBonus > 0 ? 'Đã có thưởng' : 'Chưa có thưởng')
                    : 'nhân viên đạt'}
                </span>
              </div>
            </div>

            {showCompetitionList && (
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 pt-1 animate-fadeIn">
                {activeCompetitions.map((prog: any, pIdx: number) => (
                  <button
                    type="button"
                    key={prog.id || pIdx}
                    onClick={() => onNavigateToTab('thidua')}
                    className="min-h-[46px] p-3 rounded-xl border border-amber-200/80 bg-amber-50/35 hover:border-amber-400 hover:bg-amber-50/70 transition-[colors,transform] cursor-pointer flex items-center justify-between gap-2 group active:scale-[0.98] text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[10px] font-tabular flex items-center justify-center shrink-0">
                        {pIdx + 1}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900 truncate group-hover:text-amber-800 transition-colors">
                        {prog.shortTitle || prog.title}
                      </h4>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-500/80 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-[colors,transform] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
}
