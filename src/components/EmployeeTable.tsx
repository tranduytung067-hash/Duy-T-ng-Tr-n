import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, TrendingUp, ArrowLeft, List, ChevronDown, ChevronUp, Download, AlertTriangle, Maximize2, Minimize2, User, Info, ShoppingBag, Package, Check, MapPin, Calendar, Award, MessageSquare, Send, BadgeCheck, Target, ShieldAlert, RotateCcw, Share2, ExternalLink, Copy, CheckCircle2, X, DollarSign, Percent, BarChart3, Users, RefreshCw, Gift, Settings } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { EmployeeTargetRow, CustomerSurveyRecord, SurveyConfig } from '../types';
import { cleanEmployeeName, sortAndFormatEmployeeNames } from '../utils/sheetParser';
import { EmployeeSelect } from './EmployeeSelect';
import { mockTrungBayListData } from '../mockData';
import ZaloShareImageModal, { ZaloIcon } from './ZaloShareImageModal';
import { CustomerSurveyModal, SurveySettingsModal } from './CustomerSurveyModal';
import {
  subscribeSurveyConfig,
  subscribeCustomerSurveys,
  fetchKhaoSatSheetRecords,
  normalizeSurveyCode,
  normalizeSurveyName,
} from '../utils/surveyService';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

const clampedRate = (actual: number, target: number): number => {
  if (target <= 0) return 0;
  const rawRate = (actual / target) * 100;
  if (target - actual > 0) {
    return Math.min(rawRate, 99);
  }
  return rawRate;
};

const getMonthToDateElapsedPercentage = (): number => {
  const now = new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  return Math.round((currentDay / (totalDays - 1)) * 100);
};

interface EmployeeTableProps {
  employees: EmployeeTargetRow[];
  selectedEmployeeName: string;
  onSelectEmployee: (name: string) => void;
  isEmployeeView: boolean;
  activationListData?: any[];
  trungBayListData?: any[];
  viewingEmpName?: string | null;
  setViewingEmpName?: (name: string | null) => void;
  isSupervisor?: boolean;
  onOpenZaloShare?: () => void;
  sheetId?: string;
  currentUserName?: string;
  userRole?: string;
}

export default function EmployeeTable({
  employees,
  selectedEmployeeName,
  onSelectEmployee,
  isEmployeeView,
  isSupervisor = false,
  onOpenZaloShare,
}: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileViewMode, setMobileViewMode] = useState<'table' | 'card'>('table');

  const formatVND = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0 ₫';
    return Math.round(value).toLocaleString('vi-VN') + ' ₫';
  };

  const formatVNDCompact = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(2).replace('.', ',') + ' tỷ';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1).replace('.', ',') + ' tr';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(0) + ' k';
    }
    return Math.round(value).toLocaleString('vi-VN');
  };

  const formatProgressCompact = (value: number) => {
    if (value === undefined || value === null || isNaN(value) || value === 0) return '0';
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(2).replace('.', ',') + ' tỷ';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1).replace('.', ',') + 'tr';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(0) + 'k';
    }
    return Math.round(value).toLocaleString('vi-VN');
  };

  const ALLOWED_EMPLOYEES_UP_TO_TUAN = [
    'Lê Thị Hương',
    'Nguyễn Thành Thực',
    'Bùi Mạnh Cường',
    'Nguyễn Sỹ Vũ',
    'Dương Thị Thanh',
    'Vũ Anh Tùng',
    'Nguyễn Thị Hưng Nguyên',
    'Nguyễn Đức Tuấn'
  ];

  const normEmpName = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '') : '';

  const filteredEmployees = employees
    .filter((emp) => {
      if (!emp || !emp.name) return false;
      const cleaned = cleanEmployeeName(emp.name);
      const n = normEmpName(cleaned);
      if (n.includes('tong') || n.includes('total') || n.includes('chitieucocong') || n.includes('stt')) return false;
      const isAllowed = ALLOWED_EMPLOYEES_UP_TO_TUAN.some(a => normEmpName(a) === n || n.includes(normEmpName(a)) || normEmpName(a).includes(n));
      if (!isAllowed) return false;
      return cleaned.toLowerCase().includes(searchTerm.toLowerCase()) || emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const na = normEmpName(cleanEmployeeName(a.name));
      const nb = normEmpName(cleanEmployeeName(b.name));
      const idxA = ALLOWED_EMPLOYEES_UP_TO_TUAN.findIndex(name => normEmpName(name) === na || na.includes(normEmpName(name)));
      const idxB = ALLOWED_EMPLOYEES_UP_TO_TUAN.findIndex(name => normEmpName(name) === nb || nb.includes(normEmpName(name)));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });

  const totalTarget = filteredEmployees.reduce((sum, emp) => sum + (emp.targetVal || 0), 0);
  const totalActual = filteredEmployees.reduce((sum, emp) => sum + (emp.actualVal || 0), 0);
  const totalRemaining = totalTarget - totalActual;
  const totalCompletionRate = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  const isTotalPassingCycle = totalCompletionRate >= getMonthToDateElapsedPercentage();

  const cyclePercentage = getMonthToDateElapsedPercentage();

  return (
    <div id="employee-sales-table-card" className="w-full space-y-4">
      {/* 1. KHỐI CHỈ SỐ TỔNG QUAN DOANH SỐ (4 KPI Cards tạo diện mạo Web App bề thế, tràn khung) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full">
        {/* Card 1: Mục Tiêu Doanh Số */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
              Mục Tiêu Doanh Số
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl lg:text-2xl font-black font-mono text-slate-900 truncate">
            {formatVND(totalTarget)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{filteredEmployees.length} nhân sự tham gia</span>
          </div>
        </div>

        {/* Card 2: Thực Hiện Doanh Số */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-emerald-800">
              Thực Hiện Doanh Số
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl lg:text-2xl font-black font-mono text-emerald-700 truncate">
            {formatVND(totalActual)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium truncate">
            Doanh số ghi nhận hiện tại
          </div>
        </div>

        {/* Card 3: Tỷ Lệ Hoàn Thành */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
              Tỷ Lệ Hoàn Thành
            </span>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border shrink-0 ${
              isTotalPassingCycle ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
            }`}>
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-base sm:text-xl lg:text-2xl font-black font-mono ${
              isTotalPassingCycle ? 'text-emerald-700' : 'text-red-600'
            }`}>
              {totalCompletionRate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Tiến độ ngày:</span>
            <span className="font-mono font-bold text-slate-700">{cyclePercentage}% chu kỳ</span>
          </div>
        </div>

        {/* Card 4: Còn Lại Cần Đạt */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
              Còn Lại Cần Đạt
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-base sm:text-xl lg:text-2xl font-black font-mono truncate ${
            totalRemaining < 0 ? 'text-emerald-700' : totalRemaining > 0 ? 'text-rose-600' : 'text-slate-700'
          }`}>
            {totalRemaining < 0 ? `-${formatVND(Math.abs(totalRemaining))}` : totalRemaining > 0 ? formatVND(totalRemaining) : '0 đ'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium truncate">
            {totalRemaining < 0 ? 'Vượt chỉ tiêu toàn đội ngũ!' : totalRemaining > 0 ? 'Cần tăng tốc để về đích' : 'Đã hoàn thành 100%'}
          </div>
        </div>
      </div>

      {/* 2. CARD CHÍNH CHỨA BẢNG TIẾN ĐỘ DOANH SỐ RỘNG HẾT KHUNG */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-3.5 w-full">
        {/* Header & Controls: Title + Switcher on Row 1, Search + Zalo on Row 2 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5 sm:pb-3">
          <div className="flex items-center justify-between gap-2 min-w-0 w-full md:w-auto">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-black text-slate-900 uppercase tracking-wider truncate">
                  Bảng Tiến Độ Doanh Số
                </h2>
                <p className="text-[10.5px] sm:text-xs text-slate-600 font-medium truncate">
                  {isEmployeeView
                    ? `Cá nhân: ${selectedEmployeeName}`
                    : `${filteredEmployees.length} nhân viên`}
                </p>
              </div>
            </div>

            {/* Mobile View Switcher (Right of Title on Row 1) */}
            <div className="flex md:hidden items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setMobileViewMode('table')}
                className={`min-h-[30px] px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  mobileViewMode === 'table'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bảng
              </button>
              <button
                type="button"
                onClick={() => setMobileViewMode('card')}
                className={`min-h-[30px] px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  mobileViewMode === 'card'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Thẻ
              </button>
            </div>
          </div>

          {/* Controls: Search & Action Buttons on 1 Single Horizontal Row */}
          <div className="flex items-center gap-2 flex-nowrap justify-between md:justify-end w-full md:w-auto">
            {!isEmployeeView && (
              <div className="relative flex-1 min-w-0 md:w-56 lg:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm nhân viên..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-8 pr-7 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400 font-medium"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Nút Xóa Lọc (Desktop only; Mobile resets via bottom thumb pill) */}
            {selectedEmployeeName && (
              <button
                type="button"
                onClick={() => onSelectEmployee('')}
                className="hidden md:flex px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0"
                title="Bỏ chọn nhân viên để xem toàn đội ngũ"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bỏ lọc</span>
              </button>
            )}

            {/* Nút Gửi Zalo */}
            {onOpenZaloShare && (
              <button
                type="button"
                onClick={() => onOpenZaloShare()}
                className="h-9 px-2.5 sm:px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
                title="Gửi hình ảnh toàn bộ bảng qua Zalo"
              >
                <ZaloIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Gửi Zalo</span>
              </button>
            )}
          </div>
        </div>

        {/* BẢNG DESKTOP RỘNG HẾT KHUNG (Full width, thoáng đãng, font chữ rõ ràng, thanh tiến độ trực quan) */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse table-fixed border border-emerald-500 bg-white">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[23%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border border-emerald-500 text-xs sm:text-sm font-black tracking-wider bg-emerald-50 text-emerald-900">
                <th className="py-3.5 px-4 font-black uppercase tracking-wider text-center border border-emerald-500">
                  Nhân Viên
                </th>
                <th className="py-3.5 px-4 text-center font-black uppercase tracking-wider border border-emerald-500">
                  Chỉ Tiêu (VNĐ)
                </th>
                <th className="py-3.5 px-4 text-center font-black uppercase tracking-wider border border-emerald-500">
                  Thực Hiện (VNĐ)
                </th>
                <th className="py-3.5 px-4 text-center font-black uppercase tracking-wider border border-emerald-500">
                  % Hoàn Thành
                </th>
                <th className="py-3.5 px-4 text-center font-black uppercase tracking-wider border border-emerald-500">
                  Còn Thiếu (VNĐ)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500 text-sm text-slate-800 bg-white">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp, idx) => {
                  const isSelectedInFilter = emp.name === selectedEmployeeName;
                  const remaining = emp.targetVal - emp.actualVal;
                  const cleanedName = cleanEmployeeName(emp.name);
                  const isPassingCycle = emp.completionRate >= cyclePercentage;
                  const isFinished = emp.completionRate >= 100;
                  const progressWidth = Math.min(100, Math.max(0, emp.completionRate));

                  return (
                    <tr
                      key={emp.name}
                      className={`hover:bg-emerald-50/40 transition-colors ${
                        isSelectedInFilter ? 'bg-emerald-50/80 font-bold text-slate-900' : ''
                      }`}
                    >
                      {/* Cột 1: STT, Tên Nhân Viên, Nút Lọc đồng bộ */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 border border-emerald-500 bg-white">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-slate-400 font-mono text-xs w-6 text-right shrink-0">
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                              {cleanedName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-sm sm:text-base text-slate-900 truncate">
                              {cleanedName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onSelectEmployee(isSelectedInFilter ? '' : emp.name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all active:scale-95 shadow-2xs ${
                                isSelectedInFilter
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                              }`}
                            >
                              {isSelectedInFilter ? 'Đang chọn' : 'Lọc'}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Chỉ Tiêu (VNĐ) */}
                      <td className="py-3.5 px-4 text-center font-mono text-sm sm:text-base font-bold text-slate-700 border border-emerald-500">
                        {formatVND(emp.targetVal)}
                      </td>

                      {/* Cột 3: Thực Hiện (VNĐ) */}
                      <td className="py-3.5 px-4 text-center font-mono text-sm sm:text-base font-black text-emerald-700 border border-emerald-500">
                        {formatVND(emp.actualVal)}
                      </td>

                      {/* Cột 4: % Hoàn Thành (Tiến độ ko kịp thời gian thì bôi đỏ) */}
                      <td className={`py-3.5 px-4 text-center border border-emerald-500 ${
                        !isPassingCycle && !isFinished ? 'bg-red-50/40' : ''
                      }`}>
                        <div className="space-y-1.5 max-w-[200px] mx-auto">
                          <div className="flex items-center justify-center">
                            <span
                              className={`font-mono text-sm sm:text-base font-black ${
                                isFinished || isPassingCycle
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }`}
                            >
                              {emp.completionRate.toFixed(1)}%
                            </span>
                          </div>

                          {/* Thanh progress bar kèm mốc chu kỳ tháng */}
                          <div className={`w-full h-2.5 rounded-full overflow-hidden border relative ${
                            !isPassingCycle && !isFinished ? 'bg-red-100/60 border-red-200' : 'bg-slate-100 border-slate-200/80'
                          }`}>
                            {/* Mốc chỉ số chu kỳ ngày trong tháng */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
                              style={{ left: `${Math.min(100, Math.max(0, cyclePercentage))}%` }}
                              title={`Tiến độ thời gian: ${cyclePercentage}% chu kỳ`}
                            />
                            {/* Thanh tiến độ đạt được: Ko kịp thời gian bôi đỏ */}
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                isFinished
                                  ? 'bg-emerald-600'
                                  : isPassingCycle
                                  ? 'bg-emerald-500'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${progressWidth}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Cột 5: Còn Thiếu (VNĐ) */}
                      <td className="py-3.5 px-4 text-center border border-emerald-500">
                        {remaining < 0 ? (
                          <span className="font-mono text-sm sm:text-base font-bold text-emerald-600">
                            -{formatVND(Math.abs(remaining))}
                          </span>
                        ) : remaining > 0 ? (
                          <span className="font-mono text-sm sm:text-base font-bold text-rose-600">
                            {formatVND(remaining)}
                          </span>
                        ) : (
                          <span className="font-mono text-sm sm:text-base font-bold text-slate-500">
                            0 đ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-medium font-sans border border-emerald-500">
                    Không tìm thấy dữ liệu nhân viên nào khớp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredEmployees.length > 0 && (
              <tfoot className="border-t-2 border-emerald-600 bg-emerald-50 text-sm font-black text-emerald-950">
                <tr>
                  <td className="py-4 px-4 text-center uppercase tracking-wider border border-emerald-600">
                    TỔNG CỘNG
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-slate-900 border border-emerald-600 text-sm sm:text-base">
                    {formatVND(totalTarget)}
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-black text-emerald-800 border border-emerald-600 text-sm sm:text-base">
                    {formatVND(totalActual)}
                  </td>
                  <td className={`py-4 px-4 text-center border border-emerald-600 ${
                    !isTotalPassingCycle ? 'bg-red-50/40' : ''
                  }`}>
                    <div className="space-y-1.5 max-w-[200px] mx-auto">
                      <div className="flex items-center justify-center text-xs font-bold">
                        <span
                          className={`font-mono text-sm sm:text-base font-black ${
                            isTotalPassingCycle ? 'text-emerald-800' : 'text-red-600'
                          }`}
                        >
                          {totalCompletionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`w-full h-2.5 rounded-full overflow-hidden border relative ${
                        !isTotalPassingCycle ? 'bg-red-100/60 border-red-200' : 'bg-slate-200 border-slate-300/80'
                      }`}>
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
                          style={{ left: `${Math.min(100, Math.max(0, cyclePercentage))}%` }}
                          title={`Tiến độ thời gian: ${cyclePercentage}% chu kỳ`}
                        />
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isTotalPassingCycle ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, totalCompletionRate))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`py-4 px-4 text-center font-mono font-black border border-emerald-600 text-sm sm:text-base ${
                    totalRemaining < 0 ? 'text-emerald-700' : totalRemaining > 0 ? 'text-rose-600' : 'text-slate-600'
                  }`}>
                    {totalRemaining < 0 ? `-${formatVND(Math.abs(totalRemaining))}` : totalRemaining > 0 ? formatVND(totalRemaining) : '0 đ'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      {/* Mobile View: Prioritized Compact Table View ⭐ */}
      <div className="block md:hidden w-full">
        {mobileViewMode === 'table' ? (
          <div className="bg-white rounded-xl border border-emerald-500 overflow-hidden shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-center border-collapse table-fixed text-xs border border-emerald-500 bg-white min-w-[340px]">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[18%]" />
                  <col className="w-[28%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-emerald-500 bg-emerald-50/90 text-emerald-900 text-[10px] font-black uppercase tracking-tight h-[32px]">
                    <th className="sticky left-0 bg-emerald-50 z-20 py-1.5 px-1.5 text-left border border-emerald-500 sticky-col-shadow">
                      <span>Nhân Viên</span>
                    </th>
                    <th className="py-1 px-1 text-center border border-emerald-500">
                      <span>% Đạt</span>
                    </th>
                    <th className="py-1 px-1 text-center border border-emerald-500">
                      <span>Tiến Độ</span>
                    </th>
                    <th className="py-1 px-1 text-center border border-emerald-500">
                      <span>Còn Lại</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500 text-xs text-slate-700 bg-white">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp, idx) => {
                      const isSelectedInFilter = emp.name === selectedEmployeeName;
                      const remaining = emp.targetVal - emp.actualVal;
                      const cleanedName = cleanEmployeeName(emp.name);
                      const isPassingCycle = emp.completionRate >= getMonthToDateElapsedPercentage();

                      return (
                        <tr
                          key={`mobile-row-${emp.name}`}
                          onClick={() => onSelectEmployee(emp.name)}
                          className={`transition-colors cursor-pointer border-b border-emerald-500/70 ${
                            isSelectedInFilter ? 'bg-emerald-50/90 font-medium' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          {/* Col 1: STT & Name (Sticky pinned column on mobile) */}
                          <td className={`sticky left-0 z-10 py-1.5 px-1.5 text-left align-middle border border-emerald-500/70 sticky-col-shadow ${
                            isSelectedInFilter ? 'bg-emerald-50/95 font-medium' : 'bg-white'
                          }`}>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-slate-400 font-tabular text-[9px] w-3 text-right shrink-0">
                                {(idx + 1).toString().padStart(2, '0')}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className={`block font-bold text-[11px] truncate leading-tight ${
                                  isSelectedInFilter ? 'text-emerald-900 font-black' : 'text-slate-800'
                                }`}>
                                  {cleanedName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: % Đạt (Bôi đỏ nếu chậm tiến độ) */}
                          <td className={`py-1.5 px-1 text-center align-middle border border-emerald-500/70 font-tabular text-[11px] ${
                            !isPassingCycle ? 'bg-red-50/50' : ''
                          }`}>
                            <span className={isPassingCycle ? 'text-emerald-700 font-bold' : 'text-red-600 font-black'}>
                              {emp.completionRate.toFixed(1)}%
                            </span>
                          </td>

                          {/* Col 3: Tiến Độ (Thực Hiện / Chỉ Tiêu) */}
                          <td className="py-1.5 px-1 text-center align-middle border border-emerald-500/70 font-tabular text-[10px] sm:text-[10.5px]">
                            <span className="font-bold text-slate-800 whitespace-nowrap">
                              <span className={isPassingCycle ? 'text-emerald-700' : 'text-red-600 font-black'}>
                                {formatProgressCompact(emp.actualVal)}
                              </span>
                              <span className="text-slate-400 mx-0.5 font-normal">/</span>
                              <span className="text-slate-700">{formatProgressCompact(emp.targetVal)}</span>
                            </span>
                          </td>

                          {/* Col 4: Còn Lại */}
                          <td className="py-1.5 px-1 text-center align-middle border border-emerald-500/70 font-tabular text-[10px] sm:text-[10.5px]">
                            {remaining < 0 ? (
                              <span className="text-emerald-700 font-bold whitespace-nowrap">
                                -{formatProgressCompact(Math.abs(remaining))}
                              </span>
                            ) : remaining > 0 ? (
                              <span className="text-rose-600 font-bold whitespace-nowrap">
                                {formatProgressCompact(remaining)}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold">
                                0
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                        Không tìm thấy nhân viên nào khớp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredEmployees.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-emerald-600 bg-emerald-50 font-black text-emerald-950 text-[10.5px]">
                      {/* Col 1: Tổng (Sticky pinned) */}
                      <td className="sticky left-0 z-20 py-2 px-1.5 text-center align-middle border border-emerald-600 uppercase tracking-wider font-black bg-emerald-50 sticky-col-shadow">
                        Tổng
                      </td>

                      {/* Col 2: % Đạt Tổng */}
                      <td className={`py-2 px-1 text-center align-middle border border-emerald-600 font-tabular text-[11px] ${
                        !isTotalPassingCycle ? 'bg-red-50/50' : ''
                      }`}>
                        <span className={isTotalPassingCycle ? 'text-emerald-700 font-bold' : 'text-red-600 font-black'}>
                          {totalCompletionRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* Col 3: Tiến Độ Tổng (Thực Hiện / Chỉ Tiêu) */}
                      <td className="py-2 px-1 text-center align-middle border border-slate-200 font-tabular text-[10px] sm:text-[10.5px]">
                        <span className="font-bold text-slate-800 whitespace-nowrap">
                          <span className={isTotalPassingCycle ? 'text-emerald-700 font-bold' : 'text-red-600 font-black'}>
                            {formatProgressCompact(totalActual)}
                          </span>
                          <span className="text-slate-400 mx-0.5 font-normal">/</span>
                          <span className="text-slate-700">{formatProgressCompact(totalTarget)}</span>
                        </span>
                      </td>

                      {/* Col 4: Còn Lại Tổng */}
                      <td className="py-2 px-1 text-center align-middle border border-emerald-600 font-tabular text-[10px] sm:text-[10.5px]">
                        {totalRemaining < 0 ? (
                          <span className="text-emerald-700 font-bold whitespace-nowrap">
                            -{formatProgressCompact(Math.abs(totalRemaining))}
                          </span>
                        ) : totalRemaining > 0 ? (
                          <span className="text-rose-600 font-bold whitespace-nowrap">
                            {formatProgressCompact(totalRemaining)}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold">
                            0
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="bg-slate-50 px-2 py-1 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
              <span>Chạm vào nhân viên để chọn lọc</span>
              <span className="font-bold text-emerald-800">{filteredEmployees.length} nhân viên</span>
            </div>
          </div>
        ) : (
          /* Mobile Card View (Alternative if toggled) */
          <div className="space-y-2 w-full">
            {filteredEmployees.length > 0 ? (
              <>
                {filteredEmployees.map((emp, idx) => {
                const isSelectedInFilter = emp.name === selectedEmployeeName;
                const remaining = emp.targetVal - emp.actualVal;
                const cleanedName = cleanEmployeeName(emp.name);
                const isOver = emp.completionRate >= 100;
                const isPassingCycle = emp.completionRate >= getMonthToDateElapsedPercentage();

                return (
                  <div
                    key={`card-emp-${emp.name}`}
                    className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                      isSelectedInFilter
                        ? 'bg-emerald-50/50 border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                        : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-400 font-mono text-[10px] w-4 text-right shrink-0">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <h4 className="text-xs font-black text-emerald-950 truncate leading-tight">{cleanedName}</h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectEmployee(emp.name)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isSelectedInFilter
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isSelectedInFilter ? 'Đang chọn' : 'Lọc'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
                      <div className={`rounded p-1 ${
                        isPassingCycle ? 'bg-emerald-50/70' : 'bg-red-50/80 border border-red-200'
                      }`}>
                        <span className={`text-[9px] block ${
                          isPassingCycle ? 'text-emerald-800' : 'text-red-700 font-bold'
                        }`}>Tiến độ</span>
                        <strong className={`font-mono text-[10.5px] whitespace-nowrap ${
                          isPassingCycle ? 'text-emerald-900' : 'text-red-700'
                        }`}>
                          {formatProgressCompact(emp.actualVal)} / {formatProgressCompact(emp.targetVal)}
                        </strong>
                      </div>
                      <div className={`rounded p-1 ${
                        isPassingCycle ? 'bg-slate-50' : 'bg-red-50/80 border border-red-200'
                      }`}>
                        <span className={`text-[9px] block ${
                          isPassingCycle ? 'text-slate-400' : 'text-red-600 font-bold'
                        }`}>% Đạt</span>
                        <strong className={`font-mono text-[11px] ${isPassingCycle ? 'text-emerald-700' : 'text-red-600 font-black'}`}>
                          {emp.completionRate.toFixed(1)}%
                        </strong>
                      </div>
                      <div className="bg-slate-50 rounded p-1">
                        <span className="text-[9px] text-slate-500 block">Còn lại</span>
                        <strong className={`font-mono text-[11px] ${remaining < 0 ? 'text-emerald-700 font-bold' : remaining > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {remaining < 0 ? `-${formatProgressCompact(Math.abs(remaining))}` : remaining > 0 ? formatProgressCompact(remaining) : '0'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Hàng Tổng cộng cho Card View */}
              <div className="p-2.5 rounded-xl border border-emerald-600 bg-emerald-50/80 shadow-xs space-y-1.5 font-black text-emerald-950">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">Tổng</h4>
                  <span className="text-[10px] text-emerald-800 font-bold">{filteredEmployees.length} nhân viên</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
                  <div className={`rounded p-1 border ${
                    isTotalPassingCycle ? 'bg-white border-emerald-200/80' : 'bg-red-50/80 border-red-200'
                  }`}>
                    <span className={`text-[9px] block ${
                      isTotalPassingCycle ? 'text-emerald-800' : 'text-red-700 font-bold'
                    }`}>Tiến độ</span>
                    <strong className={`font-mono text-[10.5px] whitespace-nowrap ${
                      isTotalPassingCycle ? 'text-emerald-900' : 'text-red-700 font-black'
                    }`}>
                      {formatProgressCompact(totalActual)} / {formatProgressCompact(totalTarget)}
                    </strong>
                  </div>
                  <div className={`rounded p-1 border ${
                    isTotalPassingCycle ? 'bg-white border-emerald-200/80' : 'bg-red-50/80 border-red-200'
                  }`}>
                    <span className={`text-[9px] block ${
                      isTotalPassingCycle ? 'text-slate-500' : 'text-red-600 font-bold'
                    }`}>% Đạt</span>
                    <strong className={`font-mono text-[11px] ${isTotalPassingCycle ? 'text-emerald-700' : 'text-red-600 font-black'}`}>
                      {totalCompletionRate.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="bg-white rounded p-1 border border-emerald-200/80">
                    <span className="text-[9px] text-slate-500 block">Còn lại</span>
                    <strong className={`font-mono text-[11px] ${totalRemaining < 0 ? 'text-emerald-700 font-bold' : totalRemaining > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {totalRemaining < 0 ? `-${formatProgressCompact(Math.abs(totalRemaining))}` : totalRemaining > 0 ? formatProgressCompact(totalRemaining) : '0'}
                    </strong>
                  </div>
                </div>
              </div>
            </>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                Không tìm thấy dữ liệu nhân viên nào khớp với bộ lọc.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
  );
}

const cleanNameHelper = (str: any) => {
  if (!str) return '';
  return String(str)
    .normalize('NFD') // decomposes characters with accents
    .replace(/[\u0300-\u036f]/g, '') // removes accent marks
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const findEmpColKeyHelper = (row: any) => {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  const cleanLower = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  // Common headers for employee names in Vietnamese sheets
  const aliases = [
    'nhân viên', 'nhan vien', 'nv', 'tên nv', 'họ tên', 'ho ten', 
    'employee', 'staff', 'tên', 'tên nhân viên', 'ten nhan vien', 'nhan vien thuc hien'
  ];
  const cleanAliases = aliases.map(a => cleanLower(a));
  return rowKeys.find(k => {
    const kNorm = cleanLower(k);
    return cleanAliases.some(alias => kNorm === alias || kNorm.includes(alias));
  }) || '';
};

const findKeyHelper = (row: any, aliases: string[], excludeWords: string[] = []): string => {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  const cleanLower = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const cleanAliases = aliases.map(a => cleanLower(a));
  const cleanExcludes = excludeWords.map(e => cleanLower(e));

  // 1. Try exact matches first
  const exactMatch = rowKeys.find(k => {
    const kNorm = cleanLower(k);
    return cleanAliases.includes(kNorm);
  });
  if (exactMatch) return exactMatch;

  // 2. Try fuzzy match with exclude words check
  const fuzzyMatch = rowKeys.find(k => {
    const kNorm = cleanLower(k);
    if (cleanExcludes.some(ex => kNorm.includes(ex))) return false;
    return cleanAliases.some(alias => kNorm.includes(alias));
  });
  return fuzzyMatch || '';
};

export function EmployeeActivationTable({
  employees,
  selectedEmployeeName,
  onSelectEmployee,
  isEmployeeView,
  activationListData,
  trungBayListData,
  viewingEmpName: externalViewingEmpName,
  setViewingEmpName: externalSetViewingEmpName,
  sheetId,
  currentUserName,
  userRole,
}: EmployeeTableProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalViewingEmpName, setInternalViewingEmpName] = useState<string | null>(null);
  
  const viewingEmpName = externalViewingEmpName !== undefined ? externalViewingEmpName : internalViewingEmpName;
  const setViewingEmpName = externalSetViewingEmpName !== undefined ? externalSetViewingEmpName : setInternalViewingEmpName;

  const [activationSearch, setActivationSearch] = useState('');
  const [selectedLichVT, setSelectedLichVT] = useState('Tất cả');
  const [selectedNumSectors, setSelectedNumSectors] = useState<string[]>(['Tất cả']);
  const [isNumSectorsDropdownOpen, setIsNumSectorsDropdownOpen] = useState(false);
  const numSectorsDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedDatChuandDS, setSelectedDatChuandDS] = useState('Tất cả');
  const [selectedSurveyStatus, setSelectedSurveyStatus] = useState<'Tất cả' | 'Đã khảo sát' | 'Chưa khảo sát'>('Tất cả');

  // Survey state & real-time synchronization
  const [surveyConfig, setSurveyConfig] = useState<SurveyConfig | null>(null);
  const [firestoreSurveys, setFirestoreSurveys] = useState<CustomerSurveyRecord[]>([]);
  const [sheetSurveys, setSheetSurveys] = useState<CustomerSurveyRecord[]>([]);
  const [surveyTargetCustomer, setSurveyTargetCustomer] = useState<{
    code: string;
    name: string;
    employee?: string;
    address?: string;
    avgSales?: string;
  } | null>(null);
  const [isSurveySettingsOpen, setIsSurveySettingsOpen] = useState(false);

  const normalizedRole = (userRole || '').toLowerCase().trim();
  const canManageSurveyConfig =
    !isEmployeeView ||
    normalizedRole.includes('admin') ||
    normalizedRole.includes('mkt') ||
    normalizedRole.includes('sup') ||
    normalizedRole.includes('giám sát') ||
    normalizedRole === 'om' ||
    normalizedRole === 'manager';

  useEffect(() => {
    const unsubConfig = subscribeSurveyConfig((cfg) => setSurveyConfig(cfg));
    const unsubSurveys = subscribeCustomerSurveys((recs) => setFirestoreSurveys(recs));
    return () => {
      unsubConfig();
      unsubSurveys();
    };
  }, []);

  useEffect(() => {
    if (!viewingEmpName) return;
    const activeSheetId =
      sheetId ||
      (typeof window !== 'undefined' ? localStorage.getItem('gs_sheet_id') : null) ||
      '1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c';
    let cancelled = false;
    fetchKhaoSatSheetRecords(activeSheetId).then((recs) => {
      if (!cancelled) {
        setSheetSurveys(recs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewingEmpName, sheetId]);

  const surveyIndex = useMemo(() => {
    const byCode = new Map<string, CustomerSurveyRecord[]>();
    const byName = new Map<string, CustomerSurveyRecord[]>();
    [...firestoreSurveys, ...sheetSurveys].forEach((rec) => {
      const nCode = normalizeSurveyCode(rec.customerCode);
      if (nCode) {
        const arr = byCode.get(nCode) || [];
        arr.push(rec);
        byCode.set(nCode, arr);
      }
      const nName = normalizeSurveyName(rec.customerName);
      if (nName) {
        const arr = byName.get(nName) || [];
        arr.push(rec);
        byName.set(nName, arr);
      }
    });
    return { byCode, byName };
  }, [firestoreSurveys, sheetSurveys]);

  const getCustomerSurveys = useCallback(
    (code: string, name: string): CustomerSurveyRecord[] => {
      const nCode = normalizeSurveyCode(code);
      const nName = normalizeSurveyName(name);
      const fromCode = nCode ? surveyIndex.byCode.get(nCode) || [] : [];
      const fromName = nName ? surveyIndex.byName.get(nName) || [] : [];
      if (fromCode.length === 0 && fromName.length === 0) return [];
      const seen = new Set<string>();
      const combined: CustomerSurveyRecord[] = [];
      [...fromCode, ...fromName].forEach((rec) => {
        const dedupKey = `${rec.id}_${rec.combinedOpinion}`;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          combined.push(rec);
        }
      });
      return combined.sort(
        (a, b) => (new Date(b.submittedAt || 0).getTime() || 0) - (new Date(a.submittedAt || 0).getTime() || 0)
      );
    },
    [surveyIndex]
  );

  // State for showing customer purchasing stats in a modal window
  const [selectedCustDetails, setSelectedCustDetails] = useState<{
    code: string;
    name: string;
    address: string;
    employee: string;
    avgSales: string;
    status: string;
    products: string;
    sectorsCount?: number;
    sectorsList?: string[];
    tichDiem?: string;
  } | null>(null);
  const custModalRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(Boolean(selectedCustDetails), custModalRef, () => setSelectedCustDetails(null));

  // State for expanded sectors in products list
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});

  // State for Zalo activation table image sharing modal
  const [activationZaloModalState, setActivationZaloModalState] = useState<{
    isOpen: boolean;
    title: string;
    subTitle?: string;
    dataUrl: string;
    blob: Blob | null;
    fileName: string;
    copied?: boolean;
  } | null>(null);
  const [isSharingZalo, setIsSharingZalo] = useState(false);

  // Track dynamic bottom offset of app-main-header for sticky table column headers
  useEffect(() => {
    const updateHeaderBottom = () => {
      const header = document.getElementById('app-main-header');
      if (header) {
        const rect = header.getBoundingClientRect();
        const bottom = rect.bottom > 0 ? Math.round(rect.bottom) : Math.round(header.offsetHeight);
        if (bottom > 0) {
          document.documentElement.style.setProperty('--app-header-bottom', `${bottom}px`);
        }
      }
    };

    updateHeaderBottom();
    const rafId = requestAnimationFrame(updateHeaderBottom);

    const header = document.getElementById('app-main-header');
    let observer: ResizeObserver | null = null;
    if (header && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateHeaderBottom());
      observer.observe(header);
    }

    window.addEventListener('scroll', updateHeaderBottom, { passive: true });
    window.addEventListener('resize', updateHeaderBottom, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('scroll', updateHeaderBottom);
      window.removeEventListener('resize', updateHeaderBottom);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (numSectorsDropdownRef.current && !numSectorsDropdownRef.current.contains(event.target as Node)) {
        setIsNumSectorsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Synchronize viewing target with global dropdown / bottom quick-filter or salesman RLS
  useEffect(() => {
    if (isEmployeeView && selectedEmployeeName && selectedEmployeeName !== 'Tất cả') {
      setViewingEmpName(selectedEmployeeName);
    } else if (!isEmployeeView && viewingEmpName !== null && selectedEmployeeName) {
      setViewingEmpName(selectedEmployeeName);
    }
  }, [selectedEmployeeName, isEmployeeView]);

  const listData = activationListData || [];
  const targetCheckboxKeys = useMemo(() => ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'GẠO', 'NON WM'], []);

  // 1. Memoize unique column keys for fast lookups
  const { empColKey, metadataKeysMap, firstRow } = useMemo(() => {
    const firstRow = listData[0] || {};
    const empColKey = findEmpColKeyHelper(firstRow);
    const metadataKeysMap = {
      empColKey,
      vtColKey: findKeyHelper(firstRow, ['lịch vt', 'lich vt', 'lịch', 'lich', 'schedule', 'tuyến', 'tuyen']),
      codeColKey: findKeyHelper(firstRow, ['mã kh', 'ma kh', 'mã khách', 'ma khach', 'mã khách hàng', 'ma khach hang', 'customer id', 'code'], ['tên', 'name', 'địa chỉ', 'address']),
      nameColKey: findKeyHelper(firstRow, ['tên khách hàng', 'ten khach hang', 'tên khách', 'ten khach', 'khách hàng', 'khach hang', 'tên kh', 'ten kh', 'customer name', 'name'], ['mã', 'code', 'địa chỉ', 'address', 'lịch', 'route', 'tuyến']),
      avgSalesColKey: findKeyHelper(firstRow, ['doanh số trung bình 3 tháng', 'doanh số tb 3 tháng', 'doanh so trung binh 3 thang', 'doanh so tb 3 thang', 'tb 3 tháng', 'tb 3 thang', 'doanh số trung bình', 'doanh so trung bình', 'ds trung binh 3 thang', 'ds tb 3 thang', 'avg sales', 'average sales']),
      salesStatusColKey: findKeyHelper(firstRow, ['đạt chuẩn doanh số', 'dat chuẩn doanh số', 'dat chuan doanh so', 'đạt chuẩn ds', 'dat chuan ds', 'đạt chuẩn', 'dat chuan', 'chuẩn doanh số', 'chuan doanh so', 'xét đạt ds', 'xet dat ds', 'trạng thái ds', 'trang thai ds'])
    };
    return { empColKey, metadataKeysMap, firstRow };
  }, [listData]);

  // 2. Cache key discovery for checkbox matching and songanhhang
  const sectorKeysAndSonganhCache = useMemo(() => {
    const firstRowKeys = listData.length > 0 ? Object.keys(listData[0]) : [];
    
    // Songanhhang key
    const songanhhangKey = firstRowKeys.find(k => {
      const norm = k.toLowerCase().replace(/\s+/g, '');
      return norm.includes('songanhhang') || norm.includes('songànhhàng') ||
             norm.includes('songanh') || norm.includes('songành') ||
             norm.includes('songanhdat') || norm.includes('songànhđạt') ||
             norm.includes('songanhkh') || norm.includes('songànhkh');
    }) || null;

    // Sector key mappings
    const sectorKeys: Record<string, string> = {};
    const replaceAccents = (str: string) => {
      return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
    };

    const keysToDiscover = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'GẠO', 'NON WM', 'VNT', 'DHF', '584NT', 'Mắm 584NT', '584 NT'];
    keysToDiscover.forEach(key => {
      const cleanTarget = key.toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
      const cleanTargetAccents = replaceAccents(key);

      const actualKey = firstRowKeys.find(k => {
        const cleanK = k.toLowerCase().trim().replace(/\s+/g, '');
        if (cleanK === cleanTarget) return true;
        return replaceAccents(k) === cleanTargetAccents;
      }) || '';
      
      sectorKeys[key] = actualKey;
    });

    return { songanhhangKey, sectorKeys };
  }, [listData]);

  // 3. Fast helper to check checkbox status with cached keys
  const isRowTrueFast = useCallback((row: any, key: string, ignoreNonWMCollapse = false): boolean => {
    if (!row || !key) return false;

    const upperKey = key.trim().toUpperCase();
    let mappedLetter = '';
    if (upperKey === 'CLF') mappedLetter = 'G';
    else if (upperKey === 'VFM') mappedLetter = 'H';
    else if (upperKey === 'MCC') mappedLetter = 'I';
    else if (upperKey === 'NDFC') mappedLetter = 'J';
    else if (upperKey === 'HPC') mappedLetter = 'K';
    else if (upperKey === 'GẠO' || upperKey === 'GAO') mappedLetter = 'L';
    else if (upperKey === 'NON WM' || upperKey === 'NONWM') mappedLetter = 'M';

    if (mappedLetter && row[mappedLetter] !== undefined && row[mappedLetter] !== null) {
      const val = row[mappedLetter];
      if (typeof val === 'boolean') return val;
      const str = String(val).trim().toUpperCase();
      return str === 'TRUE' || str === 'Y' || str === 'YES' || str === '1' || str === 'X' || str === 'TÍCH' || str === 'ĐẠT' || str === '✓' || str === 'KÍCH HOẠT';
    }

    const cleanTarget = key.toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
    if (cleanTarget === 'nonwm' && !ignoreNonWMCollapse) {
      return isRowTrueFast(row, 'VNT', true) || 
             isRowTrueFast(row, 'DHF', true) || 
             isRowTrueFast(row, '584NT', true) || 
             isRowTrueFast(row, 'Mắm 584NT', true) || 
             isRowTrueFast(row, '584 NT', true);
    }

    const actualKey = sectorKeysAndSonganhCache.sectorKeys[key];
    if (!actualKey) return false;
    
    const val = row[actualKey];
    if (typeof val === 'boolean') return val;
    if (val === null || val === undefined) return false;
    const str = String(val).trim().toUpperCase();
    return str === 'TRUE' || str === 'Y' || str === 'YES' || str === '1' || str === 'X' || str === 'TÍCH' || str === 'ĐẠT' || str === '✓' || str === 'KÍCH HOẠT';
  }, [sectorKeysAndSonganhCache]);

  const parseSectorsCountFast = useCallback((row: any): number => {
    if (row['F'] !== undefined && row['F'] !== null && row['F'] !== '') {
      const valStr = String(row['F']).trim();
      const num = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) return num;
    }

    const matchedKey = sectorKeysAndSonganhCache.songanhhangKey;
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
      const valStr = String(row[matchedKey]).trim();
      const num = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) return num;
    }

    let count = 0;
    targetCheckboxKeys.forEach(brand => {
      if (isRowTrueFast(row, brand)) {
        count++;
      }
    });
    return count;
  }, [sectorKeysAndSonganhCache, isRowTrueFast, targetCheckboxKeys]);

  const countSectorsFast = useCallback((row: any): string => {
    const matchedKey = sectorKeysAndSonganhCache.songanhhangKey;
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
      return String(row[matchedKey]).trim();
    }

    let count = 0;
    targetCheckboxKeys.forEach(brand => {
      if (isRowTrueFast(row, brand)) {
        count++;
      }
    });
    return `${count} ngành`;
  }, [sectorKeysAndSonganhCache, isRowTrueFast, targetCheckboxKeys]);

  const allEmployeeNamesInList = useMemo(() => {
    if (!empColKey) return [];
    const rawNamesInList = listData.map(row => {
      return String(row[empColKey]).trim();
    });
    return sortAndFormatEmployeeNames(rawNamesInList);
  }, [listData, empColKey]);

  const employeeRows = useMemo(() => {
    const isShowAll = !viewingEmpName || viewingEmpName === 'Tất cả' || viewingEmpName === 'Tất cả nhân viên' || cleanNameHelper(viewingEmpName) === 'tatca';
    if (isShowAll) return listData;
    if (!empColKey) return [];
    
    const isEmpMatch = (rowName: string, filterName: string) => {
      const cFilter = filterName.trim().toLowerCase();
      const cRow = rowName.trim().toLowerCase();
      if (
        cFilter === 'n/a => chưa gán khbh' || 
        cFilter === 'n/a' || 
        cFilter === 'na' || 
        cFilter === '-' ||
        cFilter === 'chưa gán khbh'
      ) {
        return (
          cRow === '' ||
          cRow === 'n/a' ||
          cRow === 'na' ||
          cRow === 'nan' ||
          cRow === '-' ||
          cRow === 'chưa gán khbh' ||
          cRow === 'n/a => chưa gán khbh'
        );
      }
      return cleanNameHelper(rowName) === cleanNameHelper(filterName);
    };

    return listData.filter(row => {
      const rowEmpName = cleanEmployeeName(String(row[empColKey]));
      return isEmpMatch(rowEmpName, viewingEmpName || 'Tất cả');
    });
  }, [listData, viewingEmpName, empColKey]);

  const uniqueLichVT = useMemo(() => {
    const weekdayOrder: { [key: string]: number } = {
      't2': 1, 'thu 2': 1, 'thứ 2': 1, 'monday': 1, 'mon': 1,
      't3': 2, 'thu 3': 2, 'thứ 3': 2, 'tuesday': 2, 'tue': 2,
      't4': 3, 'thu 4': 3, 'thứ 4': 3, 'wednesday': 3, 'wed': 3,
      't5': 4, 'thu 5': 4, 'thứ 5': 4, 'thursday': 4, 'thu': 4,
      't6': 5, 'thu 6': 5, 'thứ 6': 5, 'friday': 5, 'fri': 5,
      't7': 6, 'thu 7': 6, 'thứ 7': 6, 'saturday': 6, 'sat': 6,
      'cn': 7, 'chu nhat': 7, 'chủ nhật': 7, 'sunday': 7, 'sun': 7
    };
    return Array.from(new Set(
      employeeRows.map(row => {
        return metadataKeysMap.vtColKey ? String(row[metadataKeysMap.vtColKey]).trim() : '';
      }).filter(Boolean)
    )).sort((a: any, b: any) => {
      const getOrder = (str: string) => {
        const lower = str.toLowerCase().trim();
        if (weekdayOrder[lower] !== undefined) return weekdayOrder[lower];
        for (const [key, val] of Object.entries(weekdayOrder)) {
          if (lower.includes(key)) return val;
        }
        return 99;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [employeeRows, metadataKeysMap.vtColKey]);

  const getSalesStatusFast = useCallback((row: any): string => {
    let val = "";
    if (metadataKeysMap.salesStatusColKey && row[metadataKeysMap.salesStatusColKey] !== undefined && row[metadataKeysMap.salesStatusColKey] !== null) {
      val = String(row[metadataKeysMap.salesStatusColKey]).trim();
    } else if (row["Đạt Chuẩn Doanh Số"] !== undefined && row["Đạt Chuẩn Doanh Số"] !== null) {
      val = String(row["Đạt Chuẩn Doanh Số"]).trim();
    } else {
      return "Chưa đạt";
    }
    if (val.toLowerCase() === 'null' || val.toLowerCase() === 'undefined' || val === '') {
      return "Chưa đạt";
    }
    return val;
  }, [metadataKeysMap.salesStatusColKey]);

  const filteredActivationRows = useMemo(() => {
    return employeeRows.filter(row => {
      if (selectedLichVT !== 'Tất cả' && metadataKeysMap.vtColKey) {
        if (String(row[metadataKeysMap.vtColKey]).trim() !== selectedLichVT) {
          return false;
        }
      }

      if (selectedNumSectors.length > 0 && !selectedNumSectors.includes('Tất cả')) {
        const numSectors = parseSectorsCountFast(row);
        let matchesAny = false;
        if (selectedNumSectors.includes('=<2') && numSectors <= 2) {
          matchesAny = true;
        }
        if (selectedNumSectors.includes('3') && numSectors === 3) {
          matchesAny = true;
        }
        if (selectedNumSectors.includes('>=4') && numSectors >= 4) {
          matchesAny = true;
        }
        if (!matchesAny) {
          return false;
        }
      }

      if (selectedDatChuandDS !== 'Tất cả') {
        const salesStatus = getSalesStatusFast(row);
        const isChuaDat = salesStatus.toLowerCase().includes('chưa') || salesStatus.toLowerCase().includes('chua') || salesStatus.toLowerCase().includes('không') || salesStatus.toLowerCase().includes('khong');
        if (selectedDatChuandDS === 'Đạt' && isChuaDat) {
          return false;
        }
        if (selectedDatChuandDS === 'Chưa Đạt' && !isChuaDat) {
          return false;
        }
      }

      if (selectedSurveyStatus !== 'Tất cả') {
        const cCode = metadataKeysMap.codeColKey
          ? String(row[metadataKeysMap.codeColKey] || '')
          : String(row['D'] || row['Mã KH'] || '');
        const cName = metadataKeysMap.nameColKey
          ? String(row[metadataKeysMap.nameColKey] || '')
          : String(row['E'] || row['Tên Khách Hàng'] || '');
        const isSurveyed = getCustomerSurveys(cCode, cName).length > 0;
        if (selectedSurveyStatus === 'Đã khảo sát' && !isSurveyed) {
          return false;
        }
        if (selectedSurveyStatus === 'Chưa khảo sát' && isSurveyed) {
          return false;
        }
      }

      if (activationSearch.trim() !== '') {
        const q = activationSearch.toLowerCase().trim();
        const codeVal = metadataKeysMap.codeColKey ? String(row[metadataKeysMap.codeColKey]).toLowerCase() : '';
        const nameVal = metadataKeysMap.nameColKey ? String(row[metadataKeysMap.nameColKey]).toLowerCase() : '';
        
        return codeVal.includes(q) || nameVal.includes(q);
      }

      return true;
    });
  }, [
    employeeRows,
    selectedLichVT,
    metadataKeysMap.vtColKey,
    selectedNumSectors,
    parseSectorsCountFast,
    selectedDatChuandDS,
    getSalesStatusFast,
    selectedSurveyStatus,
    getCustomerSurveys,
    activationSearch,
    metadataKeysMap.codeColKey,
    metadataKeysMap.nameColKey
  ]);

  const handleToggleNumSector = (opt: string) => {
    if (opt === 'Tất cả') {
      setSelectedNumSectors(['Tất cả']);
    } else {
      const withoutAll = selectedNumSectors.filter(x => x !== 'Tất cả');
      let updated: string[];
      if (withoutAll.includes(opt)) {
        updated = withoutAll.filter(x => x !== opt);
      } else {
        updated = [...withoutAll, opt];
      }
      if (updated.length === 0) {
        setSelectedNumSectors(['Tất cả']);
      } else {
        setSelectedNumSectors(updated);
      }
    }
  };

  const getNumSectorsButtonText = () => {
    if (selectedNumSectors.includes('Tất cả') || selectedNumSectors.length === 0) {
      return 'Số Ngành: Tất cả';
    }
    const labelMap: Record<string, string> = {
      '=<2': '=<2',
      '3': '3',
      '>=4': '>=4'
    };
    const activeLabels = selectedNumSectors
      .filter(x => x !== 'Tất cả')
      .map(x => labelMap[x] || x);
    return `Số Ngành: ${activeLabels.join(', ')}`;
  };

  const handleExportImage = async () => {
    if (!printRef.current) return;
    setExporting(true);

    const originalNode = printRef.current;
    
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
      link.download = `Danh_Sach_Kich_Hoat_${viewingEmpName || 'NV'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Lỗi xuất ảnh kích hoạt:', err);
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
      
      setExporting(false);
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

  const renderZaloModal = () => {
    if (!activationZaloModalState || !activationZaloModalState.isOpen) return null;

    return (
      <ZaloShareImageModal
        isOpen={activationZaloModalState.isOpen}
        onClose={() => setActivationZaloModalState(null)}
        title={activationZaloModalState.title}
        subTitle={activationZaloModalState.subTitle}
        dataUrl={activationZaloModalState.dataUrl}
        blob={activationZaloModalState.blob}
        fileName={activationZaloModalState.fileName}
        copied={activationZaloModalState.copied}
      />
    );
  };

  const renderCustDetailsModal = () => {
    if (!selectedCustDetails) return null;

    // Fetch customer CTTB programs list
    const getCustomerCttbPrograms = (code: string, name: string) => {
      const list = (trungBayListData && trungBayListData.length > 0) ? trungBayListData : mockTrungBayListData;
      if (!list || list.length === 0) return [];
      
      const cleanStr = (s: any) => String(s || '').trim().toLowerCase();
      const cleanCompare = (a: string, b: string) => {
        const clean = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, '');
        return clean(a) === clean(b);
      };

      return list.filter(row => {
        const rowCode = String(row['Mã KH'] || row['Mã Khách Hàng'] || row['Mã kh'] || row['code'] || row['D'] || row['Ma KH'] || '').trim();
        const rowName = String(row['Tên Khách Hàng'] || row['Tên khách hàng'] || row['Tên KH'] || row['customer name'] || row['name'] || row['E'] || '').trim();
        
        if (rowCode && code && code !== 'N/A') {
          if (cleanStr(rowCode) === cleanStr(code)) return true;
        }
        return cleanCompare(rowName, name);
      }).map(row => {
        const progName = String(row['Tên CTTB'] || row['Tên chương trình'] || row['cttb'] || row['Chương Trình Trưng Bày'] || row['program'] || row['F'] || '').trim();
        const level = String(row['Mức'] || row['Mức Đăng Ký'] || row['level'] || '').trim();
        const status = String(row['Đạt Tiêu Chuẩn'] || row['Xét Đạt'] || row['status'] || row['Xét đạt DS/SL'] || row['K'] || '').trim();
        return {
          name: progName || 'N/A',
          level: level && level !== 'null' && level !== 'undefined' ? level : '',
          status: status && status !== 'null' && status !== 'undefined' ? status : ''
        };
      }).filter(p => p.name && p.name !== 'N/A');
    };

    return (
      <div className="app-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 transition-all duration-300">
        <div
          ref={custModalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Thống kê mua hàng - 3 Tháng Liền Kề"
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden outline-none"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-100" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Thống kê mua hàng - 3 Tháng Liền Kề</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustDetails(null)}
              aria-label="Đóng"
              className="text-white hover:text-emerald-100 transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer leading-none flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Customer Information Grid */}
            <div className="grid grid-cols-1 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700">
              {selectedCustDetails.employee && selectedCustDetails.employee !== 'N/A' && (
                <div className="pb-2 border-b border-slate-200/50 flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Nhân viên phụ trách:</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCustDetails.employee}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/50">
                <span className="font-semibold text-slate-500">Mã khách hàng:</span>
                <span className="font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px]">{selectedCustDetails.code}</span>
              </div>
              
              <div className="pb-2 border-b border-slate-200/50">
                <span className="font-semibold text-slate-500 block mb-0.5">Tên khách hàng:</span>
                <div className="text-[13px] font-extrabold text-slate-900">{selectedCustDetails.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="font-semibold text-slate-500 block mb-0.5">Doanh số TB 3 tháng:</span>
                  <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{selectedCustDetails.avgSales}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block mb-0.5">Trạng thái:</span>
                  <span className={`font-bold px-2 py-0.5 rounded border ${
                    selectedCustDetails.status.toLowerCase().includes('chưa') || selectedCustDetails.status.toLowerCase().includes('chua') || selectedCustDetails.status.toLowerCase().includes('không') || selectedCustDetails.status.toLowerCase().includes('khong')
                      ? 'text-rose-700 bg-rose-50 border-rose-100'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  }`}>
                    {selectedCustDetails.status}
                  </span>
                </div>
              </div>

              <div className="pb-2 border-b border-slate-200/50 pt-1">
                <span className="font-semibold text-slate-500 block mb-1">Số ngành hàng đã mua:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md text-[11px] border border-emerald-200 shrink-0 shadow-2xs">
                    {selectedCustDetails.sectorsCount || 0} Ngành
                  </span>
                  {(selectedCustDetails.sectorsList && selectedCustDetails.sectorsList.length > 0) ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedCustDetails.sectorsList.map((sec, sIdx) => (
                        <span key={sIdx} className="bg-white text-slate-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {sec}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">Chưa kích hoạt ngành hàng nào</span>
                  )}
                </div>
              </div>

              <div className="pb-2 border-b border-slate-200/50 pt-1 flex items-center justify-between">
                <span className="font-semibold text-slate-500">Tích Điểm WPP:</span>
                <span className="font-mono tabular-nums font-extrabold text-indigo-700 text-xs shrink-0">
                  {selectedCustDetails.tichDiem && selectedCustDetails.tichDiem !== 'N/A' && selectedCustDetails.tichDiem !== '' ? selectedCustDetails.tichDiem : '0'} Điểm
                </span>
              </div>

              {/* CTTB Section (Danh Sách Trưng Bày) */}
              <div className="pt-3 border-t border-slate-200/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chương trình trưng bày đang tham gia</span>
                </div>
                {(() => {
                  const programs = getCustomerCttbPrograms(selectedCustDetails.code, selectedCustDetails.name);
                  if (programs.length === 0) {
                    return (
                      <div className="bg-white border border-dashed border-slate-200 rounded-xl p-3 text-center text-slate-400 text-[11px]">
                        Không tìm thấy chương trình trưng bày nào cho khách hàng này.
                      </div>
                    );
                  }
                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100 max-h-[160px] overflow-y-auto shadow-xs">
                      {programs.map((p, idx) => {
                        const isDatVal = p.status.toLowerCase().includes('đạt') || p.status.toLowerCase().includes('dat') || p.status.toLowerCase().includes('true') || p.status.toLowerCase().includes('yes');
                        const isNotDatVal = p.status.toLowerCase().includes('không') || p.status.toLowerCase().includes('khong') || p.status.toLowerCase().includes('chưa') || p.status.toLowerCase().includes('chua') || p.status.toLowerCase().includes('false') || p.status.toLowerCase().includes('no');
                        return (
                          <div key={idx} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-[11.5px] font-medium text-slate-800">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 leading-tight">{p.name}</span>
                              {p.level && (
                                <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                  Mức: {p.level}
                                </span>
                              )}
                            </div>
                            {p.status && (
                              <span className={`font-bold px-2 py-0.5 rounded text-[10px] border shrink-0 ${
                                isDatVal 
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
                                  : isNotDatVal
                                    ? 'text-rose-700 bg-rose-50 border-rose-100'
                                    : 'text-amber-700 bg-amber-50 border-amber-100'
                              }`}>
                                {p.status}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Purchased Products Section */}
            <div className="space-y-3">
              {(() => {
                const productStr = selectedCustDetails.products;
                const isNoProduct = (str: string) => {
                  if (!str) return true;
                  const trimmed = str.trim().toLowerCase();
                  return trimmed === '' || trimmed === 'n/a' || trimmed === '#n/a' || trimmed === 'null' || trimmed === '#ref!';
                };

                if (isNoProduct(productStr)) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                        <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Sản phẩm đã mua trong 3 tháng liền kề</span>
                      </div>
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center text-slate-500 font-bold text-xs">
                        Chưa mua hàng
                      </div>
                    </div>
                  );
                }

                // Parse list of products
                let normalized = productStr;
                // Temporarily protect specific commas in product names
                normalized = normalized.replace(/Trà Hương Sâm Dứa Hiệu Vinatea\s*,\s*Loại 350G\s*\(10\)/gi, "Trà Hương Sâm Dứa Hiệu Vinatea__TEMP_COMMA__ Loại 350G (10)");
                normalized = normalized.replace(/Bột mì La bàn 0\s*,\s*5\s*kg/gi, "Bột mì La bàn 0__TEMP_COMMA__5kg");
                normalized = normalized.replace(/Bột mì La bàn 0\s*,\s*5kg/gi, "Bột mì La bàn 0__TEMP_COMMA__5kg");
                normalized = normalized.replace(/Hạt nêm Orchid Thịt\s*,\s*Xương Ống Và Tủy 5KG\s*\(3\)/gi, "Hạt nêm Orchid Thịt__TEMP_COMMA__ Xương Ống Và Tủy 5KG (3)");
                normalized = normalized.replace(/Hạt nêm Orchid Thịt\s*,\s*Xương Ống Và Tủy 10KG\s*\(2\)/gi, "Hạt nêm Orchid Thịt__TEMP_COMMA__ Xương Ống Và Tủy 10KG (2)");
                normalized = normalized.replace(/Nước rửa chén POWER100\s*-\s*Trà xanh 1\s*,\s*4\s*kg\s*\(8\)/gi, "Nước rửa chén POWER100 - Trà xanh 1__TEMP_COMMA__4kg (8)");
                normalized = normalized.replace(/Nước rửa chén POWER100 Tiết kiệm\s*-\s*Hương chanh 3\s*,\s*5\s*kg\s*\(4\)/gi, "Nước rửa chén POWER100 Tiết kiệm - Hương chanh 3__TEMP_COMMA__5kg (4)");
                normalized = normalized.replace(/Nước rửa chén POWER100 Tiết kiệm\s*-\s*Hương chanh 3\s*,\s*5\s*kg\s*\(4\s*Túi\)/gi, "Nước rửa chén POWER100 Tiết kiệm - Hương chanh 3__TEMP_COMMA__5kg (4 Túi)");

                const productList = normalized
                  .split(/(?<!\d),|,(?!\d)|[;\n]+/)
                  .map(p => p.trim().replace(/__TEMP_COMMA__/g, ","))
                  .filter(p => {
                    const cleanP = p.trim();
                    if (cleanP.length === 0) return false;
                    const lower = cleanP.toLowerCase();
                    return lower !== 'n/a' && lower !== '#n/a' && lower !== 'null' && lower !== '#ref!';
                  });

                if (productList.length === 0) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                        <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Sản phẩm đã mua trong 3 tháng liền kề</span>
                      </div>
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center text-slate-500 font-bold text-xs">
                        Chưa mua hàng
                      </div>
                    </div>
                  );
                }

                // Map products into structured objects with parsed categories and sales
                const parsedProducts = productList.map(item => {
                  const cleanItem = item.trim();
                  let category = 'KHÁC';
                  let remaining = cleanItem;

                  const prefixes = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'GẠO', 'NON WM', 'KHKH HRC'];
                  
                  let foundPrefix = '';
                  for (const p of prefixes) {
                    const regex = new RegExp(`^(${p})\\b\\s*`, 'i');
                    if (regex.test(remaining)) {
                      foundPrefix = p;
                      remaining = remaining.replace(regex, '').trim();
                      break;
                    }
                  }

                  if (!foundPrefix) {
                    const firstWordMatch = remaining.match(/^([A-Z0-9]{2,10})\b\s*/);
                    if (firstWordMatch) {
                      foundPrefix = firstWordMatch[1];
                      remaining = remaining.substring(firstWordMatch[0].length).trim();
                    }
                  }

                  if (foundPrefix) {
                    category = foundPrefix.toUpperCase();
                  }

                  let salesStr = '';
                  let productName = remaining;
                  const salesMatch = remaining.match(/\s+([\d,.]+)\s*$/);
                  if (salesMatch) {
                    const matchedVal = salesMatch[1];
                    const numericValue = parseInt(matchedVal.replace(/[,.]/g, ''), 10);
                    if (!isNaN(numericValue) && (numericValue === 0 || numericValue >= 100 || matchedVal.includes(',') || matchedVal.includes('.'))) {
                      salesStr = matchedVal;
                      productName = remaining.substring(0, remaining.length - matchedVal.length).trim();
                    }
                  }

                  return {
                    category,
                    productName,
                    salesStr,
                    original: cleanItem
                  };
                });

                // Group by category
                const grouped: Record<string, typeof parsedProducts> = {};
                parsedProducts.forEach(p => {
                  if (!grouped[p.category]) {
                    grouped[p.category] = [];
                  }
                  grouped[p.category].push(p);
                });

                const categories = Object.keys(grouped).sort((a, b) => {
                  if (a === 'KHÁC') return 1;
                  if (b === 'KHÁC') return -1;
                  return a.localeCompare(b);
                });

                const getCategoryTotalSales = (items: typeof parsedProducts) => {
                  return items.reduce((sum, item) => {
                    if (!item.salesStr) return sum;
                    const cleanAmount = item.salesStr.replace(/[,.]/g, '');
                    const val = parseInt(cleanAmount, 10);
                    return sum + (isNaN(val) ? 0 : val);
                  }, 0);
                };

                const grandTotal = parsedProducts.reduce((sum, item) => {
                  if (!item.salesStr) return sum;
                  const cleanAmount = item.salesStr.replace(/[,.]/g, '');
                  const val = parseInt(cleanAmount, 10);
                  return sum + (isNaN(val) ? 0 : val);
                }, 0);

                const handleToggleAll = (expand: boolean) => {
                  const newState: Record<string, boolean> = {};
                  categories.forEach(cat => {
                    newState[cat] = expand;
                  });
                  setExpandedSectors(newState);
                };

                return (
                  <div className="space-y-2">
                    {/* Header with quick toggle controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                        <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Sản phẩm đã mua trong 3 tháng liền kề</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAll(true)}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-100 transition-all active:scale-95 cursor-pointer"
                        >
                          Mở tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAll(false)}
                          className="text-[10px] text-slate-500 hover:text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          Thu gọn
                        </button>
                      </div>
                    </div>

                    {/* Total summary badge if any sales are calculated */}
                    {grandTotal > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span>Tổng doanh số các ngành hàng:</span>
                        <span className="text-emerald-600 text-xs font-extrabold">{grandTotal.toLocaleString('vi-VN')} đ</span>
                      </div>
                    )}

                    {/* Categories Group list */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {categories.map(cat => {
                        const items = grouped[cat];
                        const catTotal = getCategoryTotalSales(items);
                        const isExpanded = expandedSectors[cat] === true;

                        return (
                          <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all">
                            {/* Group Header */}
                            <div
                              onClick={() => {
                                setExpandedSectors(prev => ({
                                  ...prev,
                                  [cat]: !isExpanded
                                }));
                              }}
                              className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 flex items-center justify-between cursor-pointer select-none transition-colors border-b border-slate-100"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[12px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md tracking-wider">
                                  {cat}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500">
                                  ({items.length} sp)
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                {catTotal > 0 && (
                                  <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50/70 border border-emerald-100 px-2 py-0.5 rounded">
                                    Tổng: {catTotal.toLocaleString('vi-VN')} đ
                                  </span>
                                )}
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                              </div>
                            </div>

                            {/* Group Items */}
                            {isExpanded && (
                              <div className="p-2 bg-white divide-y divide-slate-100/70">
                                {items.map((item, pIdx) => (
                                  <div key={pIdx} className="px-2 py-1.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-[11px] text-slate-700 font-semibold">
                                    <div className="flex items-start gap-2.5 pr-2">
                                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                      <span className="leading-normal text-slate-800 font-bold">{item.productName}</span>
                                    </div>
                                    {item.salesStr ? (
                                      <span className="font-mono text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                                        {parseInt(item.salesStr.replace(/[,.]/g, ''), 10).toLocaleString('vi-VN')} đ
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px] italic">---</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedCustDetails(null)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ALLOWED_EMPLOYEES_UP_TO_TUAN = [
    'Lê Thị Hương',
    'Nguyễn Thành Thực',
    'Bùi Mạnh Cường',
    'Nguyễn Sỹ Vũ',
    'Dương Thị Thanh',
    'Vũ Anh Tùng',
    'Nguyễn Thị Hưng Nguyên',
    'Nguyễn Đức Tuấn'
  ];

  const normEmpName = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '') : '';

  const filteredEmployees = employees
    .filter((emp) => {
      if (!emp || !emp.name) return false;
      const cleaned = cleanEmployeeName(emp.name);
      const n = normEmpName(cleaned);
      if (n.includes('tong') || n.includes('total') || n.includes('chitieucocong') || n.includes('stt')) return false;
      const isAllowed = ALLOWED_EMPLOYEES_UP_TO_TUAN.some(a => normEmpName(a) === n || n.includes(normEmpName(a)) || normEmpName(a).includes(n));
      if (!isAllowed) return false;

      const matchesSearch = cleaned.toLowerCase().includes(searchTerm.toLowerCase()) || emp.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (isEmployeeView) return true;
      if (!selectedEmployeeName || selectedEmployeeName === 'Tất cả') return true;
      return emp.name === selectedEmployeeName;
    })
    .sort((a, b) => {
      const na = normEmpName(cleanEmployeeName(a.name));
      const nb = normEmpName(cleanEmployeeName(b.name));
      const idxA = ALLOWED_EMPLOYEES_UP_TO_TUAN.findIndex(name => normEmpName(name) === na || na.includes(normEmpName(name)));
      const idxB = ALLOWED_EMPLOYEES_UP_TO_TUAN.findIndex(name => normEmpName(name) === nb || nb.includes(normEmpName(name)));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });

  const handleShareZalo = useCallback(async () => {
    const originalNode = document.getElementById('employee-activation-table-capture');
    if (!originalNode) return;
    setIsSharingZalo(true);

    const tableEl = originalNode.querySelector('table') as HTMLElement | null;
    const requiredWidth = Math.max(1180, originalNode.scrollWidth, tableEl ? tableEl.scrollWidth : 0);

    // Save original styles of the table container
    const originalWidth = originalNode.style.width;
    const originalMinWidth = originalNode.style.minWidth;
    const originalMaxWidth = originalNode.style.maxWidth;
    const originalOverflow = originalNode.style.overflow;
    const originalOverflowX = originalNode.style.overflowX;
    const originalScrollLeft = originalNode.scrollLeft;

    const origTableWidth = tableEl ? tableEl.style.width : '';
    const origTableMinWidth = tableEl ? tableEl.style.minWidth : '';

    // Apply temporary layout expansion styles directly to the table element only
    originalNode.scrollLeft = 0;
    originalNode.style.width = `${requiredWidth}px`;
    originalNode.style.minWidth = `${requiredWidth}px`;
    originalNode.style.maxWidth = 'none';
    originalNode.style.overflow = 'visible';
    originalNode.style.overflowX = 'visible';

    if (tableEl) {
      tableEl.style.width = `${requiredWidth}px`;
      tableEl.style.minWidth = `${requiredWidth}px`;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));

      const dataUrl = await toPng(originalNode, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        width: requiredWidth,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `Bang_Kich_Hoat_Khach_Hang_${new Date().toISOString().slice(0, 10)}.png`;

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
            title: 'Bảng Kích Hoạt Khách Hàng',
            files: [imageFile]
          });
          return;
        } catch (shareErr) {
          console.log('Web share cancelled:', shareErr);
        }
      }

      setActivationZaloModalState({
        isOpen: true,
        title: 'Gửi Bảng Kích Hoạt Qua Zalo',
        subTitle: 'Toàn bộ bảng kích hoạt khách hàng (Hình ảnh PNG)',
        dataUrl,
        blob,
        fileName,
        copied
      });
    } catch (err) {
      console.error('Lỗi chụp ảnh bảng kích hoạt:', err);
      notify.error('Không thể tạo hình ảnh bảng kích hoạt. Vui lòng thử lại!');
    } finally {
      originalNode.style.width = originalWidth;
      originalNode.style.minWidth = originalMinWidth;
      originalNode.style.maxWidth = originalMaxWidth;
      originalNode.style.overflow = originalOverflow;
      originalNode.style.overflowX = originalOverflowX;
      originalNode.scrollLeft = originalScrollLeft;
      if (tableEl) {
        tableEl.style.width = origTableWidth;
        tableEl.style.minWidth = origTableMinWidth;
      }
      setIsSharingZalo(false);
    }
  }, []);

  // Switch to detailed activation list view if a user selects an employee
  if (viewingEmpName) {
    const listData = activationListData || [];
    const targetCheckboxKeys = ['CLF', 'VFM', 'MCC', 'NDFC', 'HPC', 'GẠO', 'NON WM'];
    
    const cleanName = cleanNameHelper;
    const isShowAll = !viewingEmpName || viewingEmpName === 'Tất cả' || viewingEmpName === 'Tất cả nhân viên' || cleanName(viewingEmpName) === 'tatca';

    // Helper kiểm tra khách hàng có thuộc Horeca (Cột Y Sheet Data Kích Hoạt)
    const isHorecaRow = (row: any): boolean => {
      if (!row) return false;
      const raw = row['Y'] !== undefined && row['Y'] !== null ? row['Y'] :
                  row['y'] !== undefined && row['y'] !== null ? row['y'] :
                  row['Kênh KH'] !== undefined && row['Kênh KH'] !== null ? row['Kênh KH'] :
                  row['Kenh KH'] !== undefined && row['Kenh KH'] !== null ? row['Kenh KH'] :
                  row['Kênh Khách Hàng'] !== undefined && row['Kênh Khách Hàng'] !== null ? row['Kênh Khách Hàng'] :
                  row['Phân loại khách hàng'] !== undefined && row['Phân loại khách hàng'] !== null ? row['Phân loại khách hàng'] :
                  row['Phân loại KH'] !== undefined && row['Phân loại KH'] !== null ? row['Phân loại KH'] :
                  row['Phân loại'] !== undefined && row['Phân loại'] !== null ? row['Phân loại'] :
                  row['Loại KH'] !== undefined && row['Loại KH'] !== null ? row['Loại KH'] :
                  (row._rawCells?.[24]?.v ?? row._rawCells?.[24]?.f ?? '');
      const str = String(raw).trim();
      if (!str || str === '' || str.toUpperCase() === '#N/A' || str.toLowerCase() === 'null') return false;
      const norm = str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '')
        .trim();
      return norm === 'horeca' || norm.includes('horeca') || norm === 'hrc';
    };

    // Helper lấy giá trị tại Cột AA (Sheet Data Kích Hoạt)
    const getColAAValue = (row: any): any => {
      if (!row) return '';
      if (row['AA'] !== undefined && row['AA'] !== null) return row['AA'];
      if (row['aa'] !== undefined && row['aa'] !== null) return row['aa'];
      if (row['Kích Hoạt Tháng HRC'] !== undefined && row['Kích Hoạt Tháng HRC'] !== null) return row['Kích Hoạt Tháng HRC'];
      if (row['Kich Hoat Thang HRC'] !== undefined && row['Kich Hoat Thang HRC'] !== null) return row['Kich Hoat Thang HRC'];
      if (row['KHKH HRC'] !== undefined && row['KHKH HRC'] !== null) return row['KHKH HRC'];
      if (row['KHKH_HRC'] !== undefined && row['KHKH_HRC'] !== null) return row['KHKH_HRC'];
      if (row['HRC'] !== undefined && row['HRC'] !== null) return row['HRC'];
      if (row._rawCells && row._rawCells[26]) {
        return row._rawCells[26].v ?? row._rawCells[26].f ?? '';
      }
      return '';
    };

    const isColAAChecked = (row: any): boolean => {
      const val = getColAAValue(row);
      if (typeof val === 'boolean') return val;
      if (val === null || val === undefined) return false;
      const str = String(val).trim().toUpperCase();
      if (!str || str === '0' || str === 'FALSE' || str === 'CHƯA ĐẠT' || str === 'KHÔNG' || str === 'NO') return false;
      return str === 'TRUE' || str === 'Y' || str === 'YES' || str === '1' || str === 'X' || str === 'TÍCH' || str === 'ĐẠT' || str === '✓' || str === 'KÍCH HOẠT' || str === 'CÓ' || str === 'CO' || str === 'OK';
    };

    // Cột KHKH HRC chỉ hiển thị với Nhân viên Nguyễn Đức Tuấn, các nhân viên còn lại không hiển thị cột này
    const isViewingTuan = Boolean(
      viewingEmpName && 
      (cleanName(viewingEmpName).includes('tuan') || cleanName(viewingEmpName).includes('nguyen duc tuan')) &&
      !cleanName(viewingEmpName).includes('tatca')
    );
    const displayKeys = isViewingTuan ? [...targetCheckboxKeys, 'KHKH HRC'] : targetCheckboxKeys;

    const isColumnChecked = (row: any, key: string) => {
      if (key === 'KHMH Tháng') {
        return isRowTrueFast(row, 'J');
      }
      if (key === 'KHKH HRC') {
        // Nếu dữ liệu tại cột Y không phải là Horeca => Bỏ trống ô (không đạt / không áp dụng)
        if (!isHorecaRow(row)) {
          return false;
        }
        // Nếu dữ liệu tại cột Y là Horeca, thì tham chiếu dữ liệu tại cột AA
        return isColAAChecked(row);
      }
      return isRowTrueFast(row, key);
    };

    const isRowTrue = isRowTrueFast;
    const parseSectorsCount = parseSectorsCountFast;
    const countSectors = countSectorsFast;

    const getAvgSales = (row: any): string => {
      let rawVal = "";
      if (metadataKeysMap.avgSalesColKey && row[metadataKeysMap.avgSalesColKey] !== undefined && row[metadataKeysMap.avgSalesColKey] !== null) {
        rawVal = String(row[metadataKeysMap.avgSalesColKey]).trim();
      } else if (row["Doanh Số Trung Bình 3 Tháng"] !== undefined && row["Doanh Số Trung Bình 3 Tháng"] !== null) {
        rawVal = String(row["Doanh Số Trung Bình 3 Tháng"]).trim();
      } else {
        return "0";
      }

      if (rawVal.toLowerCase() === 'null' || rawVal.toLowerCase() === 'undefined' || rawVal === '') {
        return "0";
      }

      let cleaned = rawVal;
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
      const parsedNum = parseInt(digitsOnly, 10);
      if (isNaN(parsedNum)) {
        return rawVal;
      }
      return parsedNum.toLocaleString('vi-VN');
    };

    const getSalesStatus = getSalesStatusFast;

    const getRowVal = (row: any, key: string, fallback: string = '') => {
      if (!key || row[key] === undefined || row[key] === null) return fallback;
      const valStr = String(row[key]).trim();
      if (valStr.toLowerCase() === 'null' || valStr.toLowerCase() === 'undefined') return fallback;
      return valStr;
    };

    const handleShowDetails = (code: string, name: string, row: any) => {
      const cleanStr = (s: any) => String(s || '').trim().toLowerCase();
      
      const matched = (activationListData || []).find(r => {
        const rCode = String(r[metadataKeysMap.codeColKey] || r['D'] || r['Mã KH'] || '');
        const rName = String(r[metadataKeysMap.nameColKey] || r['E'] || r['Tên Khách Hàng'] || '');
        return cleanStr(rCode) === cleanStr(code) && cleanStr(rName) === cleanStr(name);
      });

      const finalRow = matched || row;

      const productsVal = String(finalRow['AB'] || finalRow['Các sản phẩm đã mua'] || finalRow['các sản phẩm đã mua'] || '').trim();
      const addressVal = getRowVal(finalRow, 'Địa Chỉ', finalRow['C'] || finalRow['Địa chỉ'] || 'N/A');
      
      const employeeVal = empColKey ? String(finalRow[empColKey]).trim() : 'N/A';
      
      const avgSalesVal = getAvgSales(finalRow);
      const statusVal = getSalesStatus(finalRow);

      const sectorsList: string[] = [];
      targetCheckboxKeys.forEach(brand => {
        if (isRowTrueFast(finalRow, brand)) {
          sectorsList.push(brand);
        }
      });
      const sectorsCount = sectorsList.length;

      const rawTichDiem = String(
        finalRow['AC'] !== undefined ? finalRow['AC'] :
        finalRow['Tích điểm'] !== undefined ? finalRow['Tích điểm'] :
        finalRow['Tích Điểm'] !== undefined ? finalRow['Tích Điểm'] :
        finalRow['tích điểm'] !== undefined ? finalRow['tích điểm'] :
        ''
      ).trim();

      const formatPoints = (val: string): string => {
        if (!val || val.toLowerCase() === 'n/a' || val.toLowerCase() === 'null') return '0';
        const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
        if (isNaN(num)) return val;
        return num.toLocaleString('vi-VN');
      };

      const tichDiemFormatted = formatPoints(rawTichDiem);

      setSelectedCustDetails({
        code: code || 'N/A',
        name: name || 'N/A',
        address: addressVal,
        employee: employeeVal,
        avgSales: avgSalesVal,
        status: statusVal,
        products: productsVal,
        sectorsCount,
        sectorsList,
        tichDiem: tichDiemFormatted
      });
    };

    const handleOpenSurvey = (row: any) => {
      const nameVal = getRowVal(row, metadataKeysMap.nameColKey) || String(row['E'] || row['Tên Khách Hàng'] || '').trim() || 'N/A';
      const isValidCode = (c: string) => {
        const low = c.trim().toLowerCase();
        return Boolean(low && low !== 'n/a' && low !== '#n/a' && low !== 'na' && low !== 'null' && low !== 'undefined' && low !== '-');
      };

      let codeVal = getRowVal(row, metadataKeysMap.codeColKey) || String(row['D'] || row['Mã Khách Hàng'] || row['Mã KH'] || '').trim();
      if (!isValidCode(codeVal) && nameVal && nameVal !== 'N/A') {
        const targetNorm = normalizeSurveyName(nameVal);
        const fromAct = (activationListData || []).find((r) => {
          const rName = String(r[metadataKeysMap.nameColKey] || r['E'] || r['Tên Khách Hàng'] || r['Tên KH'] || '').trim();
          const rCode = String(r[metadataKeysMap.codeColKey] || r['D'] || r['Mã Khách Hàng'] || r['Mã KH'] || '').trim();
          return isValidCode(rCode) && normalizeSurveyName(rName) === targetNorm;
        });
        if (fromAct) {
          codeVal = String(fromAct[metadataKeysMap.codeColKey] || fromAct['D'] || fromAct['Mã Khách Hàng'] || fromAct['Mã KH'] || '').trim();
        } else {
          const tbList = (trungBayListData && trungBayListData.length > 0) ? trungBayListData : mockTrungBayListData;
          const fromTb = (tbList || []).find((r) => {
            const rName = String(r['Tên Khách Hàng'] || r['Tên khách hàng'] || r['Tên KH'] || r['E'] || '').trim();
            const rCode = String(r['Mã Khách Hàng'] || r['Mã KH'] || r['Mã kh'] || r['D'] || '').trim();
            return isValidCode(rCode) && normalizeSurveyName(rName) === targetNorm;
          });
          if (fromTb) {
            codeVal = String(fromTb['Mã Khách Hàng'] || fromTb['Mã KH'] || fromTb['Mã kh'] || fromTb['D'] || '').trim();
          }
        }
      }
      if (!isValidCode(codeVal)) {
        codeVal = 'N/A';
      }

      const addressVal = getRowVal(row, 'Địa Chỉ', row['C'] || row['Địa chỉ'] || '');
      const employeeVal = empColKey
        ? String(row[empColKey] || '').trim()
        : viewingEmpName && viewingEmpName !== 'Tất cả'
          ? viewingEmpName
          : '';
      const avgSalesVal = getAvgSales(row);

      setSurveyTargetCustomer({
        code: codeVal,
        name: nameVal,
        employee: employeeVal,
        address: addressVal,
        avgSales: avgSalesVal,
      });
    };

    const renderCheckSquare = (checked: boolean, isMobile = false) => {
      if (isMobile) {
        return checked ? (
          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs flex items-center justify-center bg-emerald-50 border border-emerald-500 text-emerald-600 font-black leading-none select-none text-[8.5px] sm:text-[9.5px] font-mono shadow-2xs">
            ✓
          </div>
        ) : (
          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs border border-slate-300 bg-slate-50" />
        );
      }
      return checked ? (
        <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-50 border border-emerald-500 text-emerald-600 font-bold leading-none select-none text-[11px] font-mono shadow-sm">
          ✓
        </div>
      ) : (
        <div className="w-5 h-5 rounded border border-slate-300 bg-slate-50" />
      );
    };

    // Render ô cho từng cột trong danh sách kích hoạt
    const renderColumnCell = (row: any, key: string, isMobile = false) => {
      if (key === 'KHKH HRC') {
        // - Nếu dữ liệu tại cột Y không phải là Horeca => Bỏ trống ô
        if (!isHorecaRow(row)) {
          return null;
        }

        // - Nếu dữ liệu tại cột Y là Horeca, thì tham chiếu dữ liệu tại cột AA
        const rawAA = getColAAValue(row);
        if (typeof rawAA === 'boolean') {
          return renderCheckSquare(rawAA, isMobile);
        }
        const strAA = String(rawAA ?? '').trim();
        if (!strAA || strAA === '0' || strAA.toLowerCase() === 'false' || strAA.toLowerCase() === 'chưa đạt' || strAA.toLowerCase() === 'không' || strAA.toLowerCase() === 'no') {
          return renderCheckSquare(false, isMobile);
        }

        const upperAA = strAA.toUpperCase();
        const isPositive = upperAA === 'TRUE' || 
                           upperAA === 'Y' || 
                           upperAA === 'YES' || 
                           upperAA === '1' || 
                           upperAA === 'X' || 
                           upperAA === 'TÍCH' || 
                           upperAA === 'ĐẠT' || 
                           upperAA === '✓' || 
                           upperAA === 'KÍCH HOẠT' || 
                           upperAA === 'CÓ' || 
                           upperAA === 'CO' || 
                           upperAA === 'OK';

        if (isPositive) {
          return renderCheckSquare(true, isMobile);
        }

        // Nếu cột AA có nội dung khác (chữ hoặc số)
        return (
          <span className={`${isMobile ? 'text-[7.5px] px-0.5 py-0.5 max-w-[28px]' : 'text-[10px] px-1 py-0.5'} font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200 font-mono truncate inline-block`}>
            {strAA}
          </span>
        );
      }

      const checked = isColumnChecked(row, key);
      return renderCheckSquare(checked, isMobile);
    };

    const getActivationChunks = (rows: any[]) => {
      const chunks: any[][] = [];
      let currentChunk: any[] = [];
      let currentHeight = 0;
      const maxBodyHeight = 1190; // max height of table body in pixels to fit on 1340px page
      const maxRowsPerPage = 40;  // hard ceiling to guarantee max 40 customers per page

      rows.forEach((row) => {
        const custName = getRowVal(row, metadataKeysMap.nameColKey, 'N/A');
        const index = custName.indexOf('(');
        const formattedCustName = index !== -1 ? `${custName.substring(0, index).trim()} ${custName.substring(index).trim()}` : custName;
        
        // Character count where text wraps in max-w-[200px] at text-[10px] font: about 26 chars
        const estLines = Math.max(1, Math.ceil(formattedCustName.length / 26));
        
        // Row Height = 11px (py-[5.5px] padding) + (estLines * 13px font) + 1px (border)
        const rowHeight = 11 + (estLines * 13) + 1;

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

    const getActivationPdfPagesData = () => {
      // All rows for the currently selected employee (filters are ignored for PDF export per requirement: "các trường lọc còn lại đều là tất cả")
      const empRows = employeeRows;
      
      // Get unique Lịch VT from the selected employee's rows
      const uniqueLichVTList = Array.from(new Set(
        empRows
          .map(row => {
            if (!metadataKeysMap.vtColKey) return '';
            return String(row[metadataKeysMap.vtColKey]).trim();
          })
          .filter(Boolean)
      )).sort((a: any, b: any) => {
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
      }) as string[];

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
          if (!metadataKeysMap.vtColKey) return false;
          return String(row[metadataKeysMap.vtColKey]).trim().toUpperCase() === lichVT.toUpperCase();
        }).sort((a, b) => {
          const nameA = getRowVal(a, metadataKeysMap.nameColKey, '');
          const nameB = getRowVal(b, metadataKeysMap.nameColKey, '');
          return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
        });

        // Split rows of this Lịch VT to avoid overflowing A4 page (max 35 rows per page for safety)
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

    const handleExportPDF = async () => {
      if (!isEmployeeView && (!viewingEmpName || viewingEmpName === 'Tất cả' || viewingEmpName === 'Tất cả nhân viên')) {
        notify.info('Vui lòng chọn tên nhân viên trước khi xuất PDF!');
        return;
      }

      setIsExportingPDF(true);
      setExporting(true);

      // Give browser time to render offscreen elements
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = getActivationPdfPagesData();
        const totalPages = pages.length || 1;

        for (let i = 0; i < totalPages; i++) {
          const pageEl = document.getElementById(`pdf-page-activation-${i}`);
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

        pdf.save(`Danh_Sach_Kich_Hoat_${viewingEmpName || 'NV'}.pdf`);
      } catch (err) {
        console.error('Lỗi xuất PDF kích hoạt:', err);
      } finally {
        setIsExportingPDF(false);
        setExporting(false);
      }
    };

    return (
      <div 
        id="employee-activation-detail-card" 
        ref={printRef} 
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-5 -mx-1 sm:mx-0 overflow-visible"
      >
        {/* Header Section */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-b-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            {!exporting && !isEmployeeView && (
              <button
                onClick={() => {
                  setViewingEmpName(null);
                  onSelectEmployee?.('Tất cả');
                  setActivationSearch('');
                  setSelectedLichVT('Tất cả');
                  setSelectedNumSectors(['Tất cả']);
                  setSelectedDatChuandDS('Tất cả');
                  setSelectedSurveyStatus('Tất cả');
                }}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all shrink-0 active:scale-95 flex items-center justify-center"
                title="Quay lại"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider leading-tight">DANH SÁCH KÍCH HOẠT CHI TIẾT</h3>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight mt-0.5 truncate">{viewingEmpName === 'Tất cả' ? 'Toàn Bộ Nhân Viên' : viewingEmpName}</h2>
              {/* Dynamic current local timestamp placed right below the title */}
              <div className="text-[10px] text-emerald-700 font-mono tabular-nums mt-1 leading-none select-none">
                <span>Thời điểm chụp: {new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {!exporting && (
            <div className="flex items-center gap-1.5 shrink-0">
              {(() => {
                const surveyedCount = employeeRows.filter((row) => {
                  const cCode = getRowVal(row, metadataKeysMap.codeColKey) || String(row['D'] || row['Mã KH'] || '');
                  const cName = getRowVal(row, metadataKeysMap.nameColKey) || String(row['E'] || row['Tên Khách Hàng'] || '');
                  return getCustomerSurveys(cCode, cName).length > 0;
                }).length;
                return (
                  <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-xl tabular-nums whitespace-nowrap">
                    Đã KS: {surveyedCount}/{employeeRows.length}
                  </span>
                );
              })()}
              {canManageSurveyConfig && (
                <button
                  type="button"
                  onClick={() => setIsSurveySettingsOpen(true)}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  title="Cấu hình Google Apps Script ghi vào Sheet Khảo Sát"
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Cài đặt Khảo Sát</span>
                  <span className="sm:hidden">Cài KS</span>
                </button>
              )}
            </div>
          )}
        </div>

        {exporting && (
          <div className="text-[10px] font-sans text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 max-w-full my-3">
            <strong>Báo cáo kích hoạt chi tiết:</strong> Tuyến {selectedLichVT} • Hoàn thành {selectedNumSectors.includes('Tất cả') ? 'Tất cả' : selectedNumSectors.join(', ')} ngành • Doanh số đạt {selectedDatChuandDS} {activationSearch && `• Tra cứu: "${activationSearch}"`}
          </div>
        )}

        {!exporting && (
          <div className="space-y-2 my-3">
            {/* HÀNG 1 TRÊN MOBILE (4 bộ lọc ngang): Lịch VT | Số Ngành | Chuẩn DS | Khảo Sát (+ NV trên Desktop) */}
            <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2 w-full">
              {/* Bộ lọc Nhân Viên (Desktop only; Mobile dùng nút lọc chân màn hình) */}
              <div className="hidden md:block w-full">
                {!isEmployeeView ? (
                  <EmployeeSelect
                    selectedEmployeeName={viewingEmpName || 'Tất cả'}
                    onSelectEmployee={(val) => {
                      setViewingEmpName(val);
                      onSelectEmployee?.(val);
                    }}
                    availableEmployees={allEmployeeNamesInList}
                    isEmployeeView={isEmployeeView}
                    compact={true}
                    buttonHeightClass="h-9"
                    className="w-full"
                  />
                ) : (
                  <div className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700 truncate block">
                      {viewingEmpName || selectedEmployeeName}
                    </span>
                  </div>
                )}
              </div>

              {/* LỊCH VT */}
              <div className="relative w-full">
                <select
                  value={selectedLichVT}
                  onChange={(e) => setSelectedLichVT(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 text-[11px] sm:text-xs font-semibold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-all truncate"
                >
                  <option value="Tất cả">Lịch: Tất cả</option>
                  {uniqueLichVT.map(sc => (
                    <option key={sc} value={sc}>{sc}</option>
                  ))}
                </select>
              </div>

              {/* SỐ NGÀNH */}
              <div className="relative w-full" ref={numSectorsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsNumSectorsDropdownOpen(!isNumSectorsDropdownOpen)}
                  className="w-full h-9 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 text-[11px] sm:text-xs font-semibold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 flex items-center justify-between cursor-pointer select-none transition-all"
                >
                  <span className="truncate">{getNumSectorsButtonText()}</span>
                  <ChevronDown className="w-3 h-3 ml-1 text-slate-500 shrink-0" />
                </button>

                {isNumSectorsDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 flex flex-col gap-1 text-xs">
                    <label className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedNumSectors.includes('Tất cả')}
                        onChange={() => handleToggleNumSector('Tất cả')}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">Tất cả</span>
                    </label>
                    <div className="h-px bg-slate-100 my-0.5" />
                    <label className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedNumSectors.includes('=<2')}
                        onChange={() => handleToggleNumSector('=<2')}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">=&lt; 2 ngành</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedNumSectors.includes('3')}
                        onChange={() => handleToggleNumSector('3')}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">3 ngành</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedNumSectors.includes('>=4')}
                        onChange={() => handleToggleNumSector('>=4')}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">&gt;= 4 ngành</span>
                    </label>
                  </div>
                )}
              </div>

              {/* CHUẨN DS */}
              <div className="relative w-full">
                <select
                  value={selectedDatChuandDS}
                  onChange={(e) => setSelectedDatChuandDS(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 text-[10.5px] sm:text-xs font-semibold rounded-xl px-1.5 sm:px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-all truncate"
                >
                  <option value="Tất cả">DS: Tất cả</option>
                  <option value="Đạt">DS: Đạt</option>
                  <option value="Chưa Đạt">DS: Chưa Đạt</option>
                </select>
              </div>

              {/* TRẠNG THÁI KHẢO SÁT */}
              <div className="relative w-full">
                <select
                  value={selectedSurveyStatus}
                  onChange={(e) => setSelectedSurveyStatus(e.target.value as 'Tất cả' | 'Đã khảo sát' | 'Chưa khảo sát')}
                  className="w-full h-9 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 text-[10.5px] sm:text-xs font-semibold rounded-xl px-1.5 sm:px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-all truncate"
                >
                  <option value="Tất cả">KS: Tất cả</option>
                  <option value="Đã khảo sát">Đã KS</option>
                  <option value="Chưa khảo sát">Chưa KS</option>
                </select>
              </div>

              {/* TÌM KH + ĐẶT LẠI (trên cùng 1 hàng cho mobile qua col-span-4, hoặc col riêng trên Desktop) */}
              <div className="col-span-4 md:col-span-2 flex items-center gap-1.5 sm:gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Tìm KH..."
                    value={activationSearch}
                    onChange={(e) => setActivationSearch(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-300 hover:border-emerald-500 text-slate-800 text-xs rounded-xl pl-8 pr-2.5 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!isEmployeeView) {
                      setViewingEmpName('Tất cả');
                      onSelectEmployee?.('Tất cả');
                    }
                    setSelectedLichVT('Tất cả');
                    setSelectedNumSectors(['Tất cả']);
                    setSelectedDatChuandDS('Tất cả');
                    setSelectedSurveyStatus('Tất cả');
                    setActivationSearch('');
                  }}
                  className="h-9 bg-white hover:bg-slate-50 border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 text-xs font-semibold rounded-xl px-2.5 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 whitespace-nowrap"
                  title="Đặt lại tất cả bộ lọc"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Đặt Lại</span>
                </button>
              </div>
            </div>

            {/* NHÓM HÀNH ĐỘNG XUẤT DỮ LIỆU: Xuất Hình & Xuất PDF trên cùng 1 hàng */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={handleExportImage}
                disabled={exporting}
                className="h-9 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Xuất Hình</span>
              </button>

              <button
                type="button"
                onClick={handleExportPDF}
                disabled={exporting}
                className="h-9 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Xuất PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto select-none rounded-lg border border-slate-200">
          <table className="w-full text-left border-collapse table-auto text-[11px] sm:text-xs border border-slate-200">
            <thead>
              <tr className="border-b border-emerald-500 text-emerald-800 font-extrabold tracking-wider uppercase bg-slate-100">
                <th className="py-2.5 px-1.5 w-[22%] rounded-l-lg leading-tight text-center border border-slate-200">Tên Khách Hàng</th>
                <th className="py-2.5 px-1 text-center leading-tight border border-slate-200">DS<br/>TRUNG<br/>BÌNH</th>
                <th className="py-2.5 px-1 text-center leading-tight border border-slate-200">ĐẠT<br/>CHUẨN</th>
                <th className="py-2.5 px-1 text-center leading-tight w-[60px] whitespace-nowrap border border-slate-200">SỐ NH</th>
                {displayKeys.map((key) => (
                  <th key={key} className="py-2.5 px-0.5 text-center font-bold font-sans text-emerald-800 leading-tight border border-slate-200" title={key}>
                    {key === 'NON WM' ? <>NON<br/>WM</> : key === 'KHMH Tháng' ? <>KHMH<br/>Tháng</> : key === 'KHKH HRC' ? <>KHKH<br/>HRC</> : key}
                  </th>
                ))}
              </tr>
              {/* Thống kê biến thiên theo bộ lọc */}
              <tr className="bg-slate-50/70 text-[10px] text-slate-600 font-bold border-b border-slate-200">
                <td className="py-1.5 px-1.5 text-slate-700 font-bold uppercase italic font-sans leading-tight border border-slate-200 text-center">
                  Thống kê bộ lọc
                </td>
                <td className="py-1.5 px-1 text-center font-mono font-bold text-slate-600 leading-tight border border-slate-200">
                  -
                </td>
                <td className="py-1.5 px-1 text-center font-mono font-bold text-emerald-600 leading-tight border border-slate-200">
                  {(() => {
                    const total = filteredActivationRows.length;
                    const dat = total > 0 ? filteredActivationRows.filter(row => {
                      const status = getSalesStatus(row);
                      return !(status.toLowerCase().includes('chưa') || status.toLowerCase().includes('chua') || status.toLowerCase().includes('không') || status.toLowerCase().includes('khong'));
                    }).length : 0;
                    return `${dat}/${total}`;
                  })()}
                </td>
                <td className="py-1.5 px-1 text-center font-mono font-bold text-sky-600 leading-tight text-[10px] whitespace-nowrap border border-slate-200">
                  {(() => {
                    const total = filteredActivationRows.length;
                    const count3 = total > 0 ? filteredActivationRows.filter(row => parseSectorsCount(row) >= 3).length : 0;
                    const count4 = total > 0 ? filteredActivationRows.filter(row => parseSectorsCount(row) >= 4).length : 0;
                    return (
                      <div className="flex flex-col items-center">
                        <div>3NH: {count3}/{total}</div>
                        <div>4NH: {count4}/{total}</div>
                      </div>
                    );
                  })()}
                </td>
                {displayKeys.map((key) => {
                  const isHrc = key === 'KHKH HRC';
                  const total = isHrc
                    ? filteredActivationRows.filter(row => isHorecaRow(row)).length
                    : filteredActivationRows.length;
                  const activeCount = total > 0 ? filteredActivationRows.filter(row => isColumnChecked(row, key)).length : 0;
                  return (
                    <td key={key} className="py-1.5 px-0.5 text-center font-mono font-bold text-emerald-600 text-[10px] leading-tight border border-slate-200">
                      {activeCount}/{total}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
              {filteredActivationRows.length > 0 ? (
                filteredActivationRows.map((row, idx) => {
                  const numSectors = parseSectorsCount(row);
                  let sectorsBgStyle = "text-rose-700 bg-rose-50 border border-rose-200";
                  if (numSectors === 3) {
                    sectorsBgStyle = "text-sky-700 bg-sky-50 border border-sky-200";
                  } else if (numSectors >= 4) {
                    sectorsBgStyle = "text-emerald-700 bg-emerald-50 border border-emerald-200";
                  }

                  const salesStatus = getSalesStatus(row);
                  const isChuaDat = salesStatus.toLowerCase().includes('chưa') || salesStatus.toLowerCase().includes('chua') || salesStatus.toLowerCase().includes('không') || salesStatus.toLowerCase().includes('khong');
                  const custCode = getRowVal(row, metadataKeysMap.codeColKey) || String(row['D'] || row['Mã KH'] || '');
                  const custName = getRowVal(row, metadataKeysMap.nameColKey) || String(row['E'] || row['Tên Khách Hàng'] || '');
                  const isSurveyed = getCustomerSurveys(custCode, custName).length > 0;

                  return (
                    <tr key={idx} className="hover:bg-emerald-50/30 transition-colors bg-white">
                      <td className="py-2.5 px-1.5 font-bold text-slate-800 whitespace-normal break-words leading-tight max-w-[180px] border border-slate-200" title={getRowVal(row, metadataKeysMap.nameColKey)}>
                        <div className="flex flex-col gap-1">
                          {formatCustomerName(getRowVal(row, metadataKeysMap.nameColKey, 'N/A'))}
                          {!exporting && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <button
                                type="button"
                                onClick={() => handleShowDetails(custCode, custName, row)}
                                className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200 shadow-2xs cursor-pointer transition-all inline-flex items-center gap-1 active:scale-95"
                              >
                                <Info className="w-3 h-3 shrink-0" />
                                <span>Chi tiết</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSurvey(row)}
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border shadow-2xs cursor-pointer transition-all inline-flex items-center gap-1 active:scale-95 ${
                                  isSurveyed
                                    ? 'text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-300'
                                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                                }`}
                                title={isSurveyed ? 'Đã khảo sát (bấm để xem hoặc khảo sát thêm)' : 'Thực hiện khảo sát tặng quà khách hàng'}
                              >
                                {isSurveyed ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 shrink-0 text-teal-600" />
                                    <span>Đã khảo sát</span>
                                  </>
                                ) : (
                                  <>
                                    <Gift className="w-3 h-3 shrink-0 text-amber-600" />
                                    <span>Khảo Sát</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-1 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {getAvgSales(row)}
                      </td>
                      <td className="py-2.5 px-1 text-center border border-slate-200">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${isChuaDat ? 'text-rose-700 bg-rose-50 border border-rose-200 text-[10px]' : 'text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px]'}`}>
                          {salesStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-center border border-slate-200">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-extrabold ${sectorsBgStyle} text-[10px]`}>
                          {numSectors}
                        </span>
                      </td>
                      {displayKeys.map((key) => {
                        return (
                          <td key={key} className="py-2.5 px-0.5 text-center border border-slate-200">
                            <div className="flex items-center justify-center">
                              {renderColumnCell(row, key)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4 + displayKeys.length} className="py-12 text-center text-slate-500 font-medium font-sans border border-slate-200">
                    Không tìm thấy khách hàng nào khớp với bộ lọc hoạt động.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Statistics Panel */}
        <div className="block md:hidden mb-4 p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs shadow-sm">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1 font-mono">Thống kê hoạt động (theo bộ lọc)</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Đạt Chuẩn DS</span>
              <span className="font-mono font-bold text-emerald-600">
                {(() => {
                  const total = filteredActivationRows.length;
                  const dat = total > 0 ? filteredActivationRows.filter(row => {
                    const status = getSalesStatus(row);
                    return !(status.toLowerCase().includes('chưa') || status.toLowerCase().includes('chua') || status.toLowerCase().includes('không') || status.toLowerCase().includes('khong'));
                  }).length : 0;
                  return `${dat}/${total}`;
                })()}
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Ngành Hàng Đạt</span>
              <span className="font-mono text-slate-700 leading-tight block text-[10px]">
                {(() => {
                  const total = filteredActivationRows.length;
                  const count3 = total > 0 ? filteredActivationRows.filter(row => parseSectorsCount(row) >= 3).length : 0;
                  const count4 = total > 0 ? filteredActivationRows.filter(row => parseSectorsCount(row) >= 4).length : 0;
                  return `3NH: ${count3}/${total} | 4NH: ${count4}/${total}`;
                })()}
              </span>
            </div>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono">
            <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1 font-sans">Tỉ lệ Kích Hoạt theo ngành</span>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {displayKeys.map(key => {
                const total = filteredActivationRows.length;
                const activeCount = total > 0 ? filteredActivationRows.filter(row => isColumnChecked(row, key)).length : 0;
                return (
                  <div key={key} className="text-slate-600">
                    <span className="text-emerald-700 font-bold">{key}</span>: {activeCount}/{total}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile View (Bảng vừa vặn 100% màn hình, cố định 2 hàng: tiêu đề và thống kê số liệu liền kề khi vuốt lên) */}
        <div className="block md:hidden w-full select-none rounded-xl border border-slate-200 bg-white shadow-xs overflow-visible">
          <table className="w-full table-fixed text-left border-separate border-spacing-0 text-[10px] border border-slate-200">
            <colgroup>
              <col style={{ width: displayKeys.length > 7 ? '34%' : '37%' }} />
              {displayKeys.map((key) => (
                <col 
                  key={key} 
                  style={{ width: `${(100 - (displayKeys.length > 7 ? 34 : 37)) / displayKeys.length}%` }} 
                />
              ))}
            </colgroup>
            {/* 2 hàng cố định lần lượt ngay bên dưới thanh thông báo khi vuốt lên: Hàng 1 (Tiêu đề cột) + Hàng 2 (Thống kê số liệu) */}
            <thead 
              className="sticky z-20 shadow-xs bg-slate-100" 
              style={{ top: 'var(--app-header-bottom, 54px)' }}
            >
              {/* Hàng 1: Hàng tên đề các cột: Khách Hàng, CLF, VFM, MCC... Cố định sát mép dưới thanh thông báo */}
              <tr className="border-b border-emerald-500 text-emerald-800 font-extrabold tracking-wider uppercase bg-slate-100">
                <th 
                  className="py-1.5 px-1 text-left border border-slate-200 bg-slate-100 font-extrabold text-[9.5px] sm:text-[10px] text-emerald-800 uppercase tracking-tight"
                >
                  Khách Hàng
                </th>
                {displayKeys.map((key) => (
                  <th
                    key={key}
                    className="py-1.5 px-0 text-center font-bold font-sans text-emerald-800 leading-tight border border-slate-200 text-[7.5px] sm:text-[8.5px] bg-slate-100"
                    title={key}
                  >
                    {key === 'NON WM' ? <>NON<br/>WM</> : key === 'KHMH Tháng' ? <>KHMH<br/>Tháng</> : key === 'KHKH HRC' ? <>HRC</> : key}
                  </th>
                ))}
              </tr>
              {/* Hàng 2: Hàng thống kê số liệu bộ lọc - cố định liền kề ngay bên dưới hàng tiêu đề cột, không có khoảng trống */}
              <tr className="bg-slate-50 text-[9px] text-slate-600 font-bold border-b border-slate-200">
                <td className="py-1 px-1 text-slate-700 font-bold uppercase italic font-sans leading-tight border border-slate-200 bg-slate-50">
                  {(() => {
                    const total = filteredActivationRows.length;
                    const dat = total > 0 ? filteredActivationRows.filter(row => {
                      const status = getSalesStatus(row);
                      return !(status.toLowerCase().includes('chưa') || status.toLowerCase().includes('chua') || status.toLowerCase().includes('không') || status.toLowerCase().includes('khong'));
                    }).length : 0;
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-emerald-700 font-extrabold not-italic text-[8.5px] sm:text-[9px]">Tổng: {total} KH</span>
                        <span className="text-slate-500 text-[8px] sm:text-[8.5px]">Đạt: {dat}/{total}</span>
                      </div>
                    );
                  })()}
                </td>
                {displayKeys.map((key) => {
                  const isHrc = key === 'KHKH HRC';
                  const total = isHrc
                    ? filteredActivationRows.filter(row => isHorecaRow(row)).length
                    : filteredActivationRows.length;
                  const activeCount = total > 0 ? filteredActivationRows.filter(row => isColumnChecked(row, key)).length : 0;
                  return (
                    <td key={key} className="py-1 px-0 text-center font-mono font-bold text-emerald-600 text-[7.5px] sm:text-[8px] leading-tight border border-slate-200 truncate bg-slate-50">
                      {activeCount}/{total}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[10px] text-slate-800">
              {filteredActivationRows.length > 0 ? (
                filteredActivationRows.map((row, idx) => {
                  const numSectors = parseSectorsCount(row);
                  let sectorsBgStyle = "text-rose-700 bg-rose-50 border border-rose-200";
                  if (numSectors === 3) {
                    sectorsBgStyle = "text-sky-700 bg-sky-50 border border-sky-200";
                  } else if (numSectors >= 4) {
                    sectorsBgStyle = "text-emerald-700 bg-emerald-50 border border-emerald-200";
                  }

                  const salesStatus = getSalesStatus(row);
                  const isChuaDat = salesStatus.toLowerCase().includes('chưa') || salesStatus.toLowerCase().includes('chua') || salesStatus.toLowerCase().includes('không') || salesStatus.toLowerCase().includes('khong');
                  const custCode = getRowVal(row, metadataKeysMap.codeColKey) || String(row['D'] || row['Mã KH'] || '');
                  const custName = getRowVal(row, metadataKeysMap.nameColKey) || String(row['E'] || row['Tên Khách Hàng'] || '');
                  const isSurveyed = getCustomerSurveys(custCode, custName).length > 0;

                  return (
                    <tr key={idx} className="hover:bg-emerald-50/30 transition-colors bg-white">
                      {/* Ô Khách Hàng: Tên + Chi tiết + Khảo Sát + Doanh số TB 3T + Số ngành + Trạng thái */}
                      <td className="py-1.5 px-1 font-bold text-slate-800 bg-white border border-slate-200 align-top">
                        <div className="flex flex-col gap-1">
                          {/* Tên Khách Hàng */}
                          <div className="text-[10px] sm:text-[10.5px] font-extrabold text-slate-900 leading-snug break-words line-clamp-2">
                            {formatCustomerName(getRowVal(row, metadataKeysMap.nameColKey, 'N/A'))}
                          </div>

                          {/* Nút Chi tiết & Khảo Sát cùng 1 hàng */}
                          {!exporting && (
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleShowDetails(custCode, custName, row)}
                                className="text-[8px] sm:text-[8.5px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer inline-flex items-center gap-0.5 active:scale-95 transition-all min-h-[24px]"
                              >
                                <Info className="w-2.5 h-2.5 shrink-0" />
                                <span>Chi tiết</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSurvey(row)}
                                className={`text-[8px] sm:text-[8.5px] font-bold px-1.5 py-0.5 rounded border cursor-pointer inline-flex items-center gap-0.5 active:scale-95 transition-all min-h-[24px] ${
                                  isSurveyed
                                    ? 'text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-300'
                                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                                }`}
                              >
                                {isSurveyed ? (
                                  <>
                                    <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-teal-600" />
                                    <span>Đã khảo sát</span>
                                  </>
                                ) : (
                                  <>
                                    <Gift className="w-2.5 h-2.5 shrink-0 text-amber-600" />
                                    <span>Khảo Sát</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* Nhóm thông tin: DS TB 3T & Số Ngành & Đạt Chuẩn */}
                          <div className="flex flex-wrap items-center gap-0.5 mt-0.5">
                            {/* Doanh Số TB 3T */}
                            <span className="text-[7.5px] sm:text-[8px] text-slate-600 bg-slate-100 px-0.5 py-0.5 rounded border border-slate-200 font-medium">
                              DS: <strong className="text-slate-800 font-mono font-bold">{getAvgSales(row)}</strong>
                            </span>

                            {/* Số ngành hàng */}
                            <span className={`text-[7.5px] sm:text-[8px] font-mono font-bold px-0.5 py-0.5 rounded whitespace-nowrap ${sectorsBgStyle}`}>
                              {numSectors}NH
                            </span>

                            {/* Trạng thái Đạt Chuẩn */}
                            <span className={`text-[7.5px] sm:text-[8px] px-0.5 py-0.5 rounded font-bold border whitespace-nowrap ${isChuaDat ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                              {salesStatus}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Các cột kích hoạt ngành hàng + KHKH HRC (nếu là Tuấn) */}
                      {displayKeys.map((key) => {
                        return (
                          <td key={key} className="py-1.5 px-0 text-center border border-slate-200 align-middle">
                            <div className="flex items-center justify-center">
                              {renderColumnCell(row, key, true)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={1 + displayKeys.length} className="py-8 text-center text-slate-500 font-medium font-sans border border-slate-200 text-xs">
                    Không tìm thấy khách hàng nào khớp với bộ lọc hoạt động.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PDF Offscreen Paginated Container */}
        {isExportingPDF && (
          <div className="fixed top-0 left-[-9999px] z-[-1000] bg-white text-black" style={{ width: '950px' }}>
             {(() => {
              const pages = getActivationPdfPagesData();
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
                  id={`pdf-page-activation-${pageIndex}`}
                  className="bg-white text-black px-8 py-5 border border-black flex flex-col w-[950px] h-[1340px] font-sans justify-between"
                  style={{ color: '#000000', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                >
                  <div className="flex flex-col flex-grow">
                    {/* Header block */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                      <div>
                        <h1 className="text-xl font-bold text-black uppercase tracking-wide">
                          BÁO CÁO KÍCH HOẠT CHI TIẾT - TUYẾN {page.lichVT.toUpperCase()}
                        </h1>
                        <p className="text-xs text-neutral-700 font-medium mt-1">
                          Nhân viên: {viewingEmpName || 'Tất cả'} • Số ngành hàng đạt: Tất cả • Chuẩn DS: Tất cả
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-neutral-500 mt-0.5">{page.pageLabel}</p>
                      </div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-left border-collapse table-auto text-xs border border-black">
                      <thead>
                        <tr className="border-b border-black text-black font-extrabold uppercase bg-neutral-100 text-[10px]">
                          <th className="py-2 px-2 text-center border border-black leading-tight">Tên Khách Hàng</th>
                          <th className="py-2 px-1.5 text-center border border-black leading-tight">DS TRUNG BÌNH</th>
                          <th className="py-2 px-1.5 text-center border border-black leading-tight">ĐẠT CHUẨN</th>
                          <th className="py-2 px-1.5 text-center border border-black leading-tight w-[60px] whitespace-nowrap">SỐ NH</th>
                          {displayKeys.map((key) => (
                            <th key={key} className="py-2 px-1 text-center font-bold border border-black leading-tight text-[9px]">
                              {key === 'NON WM' ? 'NON WM' : key === 'KHMH Tháng' ? 'KHMH Tháng' : key === 'KHKH HRC' ? 'KHKH HRC' : key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-300 text-[10px]">
                        {page.rows.map((row, idx) => {
                          const numSectors = parseSectorsCount(row);
                          const salesStatus = getSalesStatus(row);
                          const isChuaDat = salesStatus.toLowerCase().includes('chưa') || salesStatus.toLowerCase().includes('chua') || salesStatus.toLowerCase().includes('không') || salesStatus.toLowerCase().includes('khong');
                          const custName = getRowVal(row, metadataKeysMap.nameColKey, 'N/A');
                          
                          // Format customer name plain text for black-and-white output
                          const index = custName.indexOf('(');
                          const formattedCustName = index !== -1 ? `${custName.substring(0, index).trim()} ${custName.substring(index).trim()}` : custName;

                          return (
                            <tr key={idx} className="border-b border-neutral-300">
                              <td className="py-[8.5px] px-2 border border-black font-bold text-black text-[12px] whitespace-normal break-words leading-tight max-w-[200px]">
                                {formattedCustName}
                              </td>
                              <td className="py-[8.5px] px-1.5 text-right font-mono border border-black font-semibold text-black">
                                {getAvgSales(row)}
                              </td>
                              <td className="py-[8.5px] px-1.5 text-center border border-black">
                                <span className="font-bold text-black text-[10px] tracking-wide">
                                  {salesStatus.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-[8.5px] px-1.5 text-center border border-black font-mono font-bold text-black">
                                {numSectors}
                              </td>
                              {displayKeys.map((key) => {
                                if (key === 'KHKH HRC') {
                                  if (!isHorecaRow(row)) {
                                    return (
                                      <td key={key} className="py-[8.5px] px-1 text-center border border-black">
                                        {/* Bỏ trống ô */}
                                      </td>
                                    );
                                  }
                                  const checked = isColAAChecked(row);
                                  return (
                                    <td key={key} className="py-[8.5px] px-1 text-center border border-black">
                                      <span className="font-bold text-xs text-black">
                                        {checked ? '✓' : ''}
                                      </span>
                                    </td>
                                  );
                                }
                                const checked = isColumnChecked(row, key);
                                return (
                                  <td key={key} className="py-[8.5px] px-1 text-center border border-black">
                                    <span className="font-bold text-xs text-black">
                                      {checked ? '✓' : ''}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
        {renderCustDetailsModal()}
        <CustomerSurveyModal
          isOpen={Boolean(surveyTargetCustomer)}
          onClose={() => setSurveyTargetCustomer(null)}
          customer={surveyTargetCustomer}
          currentUserName={currentUserName || (viewingEmpName && viewingEmpName !== 'Tất cả' ? viewingEmpName : 'Nhân viên')}
          canManageConfig={canManageSurveyConfig}
          surveyConfig={surveyConfig}
          existingSurveys={
            surveyTargetCustomer
              ? getCustomerSurveys(surveyTargetCustomer.code, surveyTargetCustomer.name)
              : []
          }
          onOpenSettings={() => setIsSurveySettingsOpen(true)}
        />
        <SurveySettingsModal
          isOpen={isSurveySettingsOpen}
          onClose={() => setIsSurveySettingsOpen(false)}
          surveyConfig={surveyConfig}
          currentUserName={currentUserName || 'Admin'}
        />
      </div>
    );
  }

  return (
    <div 
      id="employee-activation-card" 
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-4 md:p-5 -mx-1 sm:mx-0 overflow-hidden"
    >
        {/* Row 1: Title + Action Buttons compact, Search below */}
        <div className="flex flex-col gap-2.5 mb-3 sm:mb-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 uppercase tracking-wider truncate">
              KÍCH HOẠT KHÁCH HÀNG
            </h3>

            {!isEmployeeView && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Search on Desktop stays inline */}
                <div className="hidden md:block relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Tìm tên nhân viên..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl pl-9 pr-3 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedEmployeeName && selectedEmployeeName !== 'Tất cả') {
                      setViewingEmpName(selectedEmployeeName);
                    } else {
                      setViewingEmpName('Tất cả');
                    }
                  }}
                  className="h-9 px-2.5 sm:px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                  title="Mở danh sách khách hàng kích hoạt"
                >
                  <List className="w-3.5 h-3.5 shrink-0" />
                  <span>DS KH</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareZalo()}
                  disabled={isSharingZalo}
                  className="h-9 px-2.5 sm:px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                  title="Gửi nhanh toàn bộ bảng kích hoạt qua Zalo"
                >
                  {isSharingZalo ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                  ) : (
                    <ZaloIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span>{isSharingZalo ? 'Đang tạo...' : 'Gửi Zalo'}</span>
                </button>
              </div>
            )}
          </div>

          {!isEmployeeView && (
            <div className="md:hidden relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm tên nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-8 pr-4 outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white placeholder-slate-400"
              />
            </div>
          )}
        </div>

        {/* BẢNG TIẾN ĐỘ KÍCH HOẠT TỪNG NHÂN VIÊN (Chỉ chụp phần Bảng khi gửi Zalo) */}
        {(() => {
          const nameColWidth = '21.4%';
          const progressColWidth = '12%';
          const rateColWidth = '7.1%';
          const remainingColWidth = '7.1%';

          return (
            <div 
              id="employee-activation-table-capture"
              className="w-full overflow-x-auto border border-slate-200 rounded-xl shadow-xs bg-white"
            >
              <table className="w-full table-fixed text-left border-collapse border border-slate-200">
                <colgroup>
                  <col style={{ width: nameColWidth }} />
                  {/* 3 Ngành Hàng: Tiến Độ (12%), % Đạt (7.1%), Thiếu (7.1%) */}
                  <col style={{ width: progressColWidth }} />
                  <col style={{ width: rateColWidth }} />
                  <col style={{ width: remainingColWidth }} />
                  {/* 4 Ngành Hàng: Tiến Độ (12%), % Đạt (7.1%), Thiếu (7.1%) */}
                  <col style={{ width: progressColWidth }} />
                  <col style={{ width: rateColWidth }} />
                  <col style={{ width: remainingColWidth }} />
                  {/* KH Đạt Chuẩn: Tiến Độ (12%), % Đạt (7.1%), Thiếu (7.1%) */}
                  <col style={{ width: progressColWidth }} />
                  <col style={{ width: rateColWidth }} />
                  <col style={{ width: remainingColWidth }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 text-emerald-800 text-[10px] sm:text-xs md:text-sm font-black tracking-wider border-b border-slate-200">
                    <th rowSpan={2} className="py-2 sm:py-2.5 px-1 sm:px-2 font-black uppercase tracking-tight border border-slate-200 text-center align-middle bg-slate-100">
                      Nhân Viên
                    </th>
                    <th colSpan={3} className="py-1.5 sm:py-2 px-0.5 text-center font-black uppercase tracking-tight leading-tight border border-slate-200">
                      <span className="hidden sm:inline">Kích Hoạt </span>3 Ngành Hàng
                    </th>
                    <th colSpan={3} className="py-1.5 sm:py-2 px-0.5 text-center font-black uppercase tracking-tight leading-tight border border-slate-200">
                      <span className="hidden sm:inline">Kích Hoạt </span>4 Ngành Hàng
                    </th>
                    <th colSpan={3} className="py-1.5 sm:py-2 px-0.5 text-center font-black uppercase tracking-tight leading-tight border border-slate-200">
                      KH Đạt Chuẩn
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-emerald-700 text-[8px] sm:text-[11px] md:text-xs font-bold tracking-tight border-b border-slate-200">
                    {/* 3 Ngành Hàng */}
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">Tiến Độ</th>
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">% Đạt</th>
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">
                      <span className="hidden sm:inline">Còn </span>Thiếu
                    </th>

                    {/* 4 Ngành Hàng */}
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">Tiến Độ</th>
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">% Đạt</th>
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">
                      <span className="hidden sm:inline">Còn </span>Thiếu
                    </th>

                    {/* KH Đạt Chuẩn */}
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">Tiến Độ</th>
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">% Đạt</th>
                    <th className="py-1.5 px-0.5 text-center border border-slate-200 leading-tight">
                      <span className="hidden sm:inline">Còn </span>Thiếu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs md:text-base text-slate-700 bg-white">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => {
                      const k3Rate = clampedRate(emp.k3Actual, emp.k3Target);
                      const k3Remaining = emp.k3Target - emp.k3Actual;

                      const k4Rate = clampedRate(emp.k4Actual, emp.k4Target);
                      const k4Remaining = emp.k4Target - emp.k4Actual;

                      const khTarget = emp.khTarget || 0;
                      const khActual = emp.khActual || 0;
                      const khRate = clampedRate(khActual, khTarget);
                      const khRemaining = khTarget - khActual;

                      const isSelectedInFilter = emp.name === selectedEmployeeName;

                      return (
                        <tr
                          key={emp.name}
                          onClick={() => onSelectEmployee(isSelectedInFilter ? 'Tất cả' : emp.name)}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isSelectedInFilter ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <td className={`py-1.5 sm:py-2.5 px-1 sm:px-2 font-bold text-slate-800 border border-slate-200 overflow-hidden ${
                            isSelectedInFilter ? 'bg-emerald-100' : 'bg-white'
                          }`}>
                            <div className="truncate text-[9.5px] sm:text-xs md:text-sm font-bold text-slate-800" title={cleanEmployeeName(emp.name)}>
                              {cleanEmployeeName(emp.name)}
                            </div>
                          </td>

                          {/* 3 Ngành Hàng */}
                          <td className="py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8.5px] sm:text-[11.5px] md:text-xs text-slate-800 bg-slate-50/50">
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{emp.k3Actual}/{emp.k3Target}</span>
                          </td>
                          <td className={`py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-50/50 ${k3Rate >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{k3Rate.toFixed(0)}%</span>
                          </td>
                          <td className={`py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-50/50 ${k3Remaining < 0 ? 'text-emerald-600' : k3Remaining === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{k3Remaining}</span>
                          </td>

                          {/* 4 Ngành Hàng */}
                          <td className="py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8.5px] sm:text-[11.5px] md:text-xs text-slate-800">
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{emp.k4Actual}/{emp.k4Target}</span>
                          </td>
                          <td className={`py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs ${k4Rate >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{k4Rate.toFixed(0)}%</span>
                          </td>
                          <td className={`py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs ${k4Remaining < 0 ? 'text-emerald-600' : k4Remaining === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{k4Remaining}</span>
                          </td>

                          {/* KH Đạt Chuẩn */}
                          <td className="py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8.5px] sm:text-[11.5px] md:text-xs text-slate-800 bg-slate-50/50">
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{khActual}/{khTarget}</span>
                          </td>
                          <td className={`py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-50/50 ${khRate >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{khRate.toFixed(0)}%</span>
                          </td>
                          <td className={`py-1.5 sm:py-2.5 px-0.5 text-center border border-slate-200 font-bold font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-50/50 ${khRemaining < 0 ? 'text-emerald-600' : khRemaining === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                            <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{khRemaining}</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 text-xs md:text-sm bg-slate-50 border border-slate-200">
                        Không tìm thấy dữ liệu nhân viên nào khớp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredEmployees.length > 0 && (
                  <tfoot className="bg-slate-100 border-t border-slate-200 sticky bottom-0 text-xs md:text-base">
                    <tr className="font-extrabold text-slate-800 bg-slate-100">
                      <td className="py-2 sm:py-2.5 px-1 sm:px-2 font-black text-emerald-700 text-[10px] sm:text-xs md:text-sm border border-slate-200 uppercase text-center bg-slate-100 overflow-hidden">
                        Tổng
                      </td>
                      
                      {/* 3 Ngành Hàng Total */}
                      {(() => {
                        const totalK3Target = filteredEmployees.reduce((sum, e) => sum + (e.k3Target || 0), 0);
                        const totalK3Actual = filteredEmployees.reduce((sum, e) => sum + (e.k3Actual || 0), 0);
                        const totalK3Rate = clampedRate(totalK3Actual, totalK3Target);
                        const remainingK3 = filteredEmployees.reduce((sum, e) => sum + ((e.k3Target || 0) - (e.k3Actual || 0)), 0);
                        return (
                          <>
                            <td className="py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8.5px] sm:text-[11.5px] md:text-xs text-slate-800 bg-slate-100/50">
                              <span className="tracking-tighter sm:tracking-tight md:tracking-normal whitespace-nowrap inline-block">{totalK3Actual}/{totalK3Target}</span>
                            </td>
                            <td className={`py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-100/50 ${totalK3Rate >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{totalK3Rate.toFixed(0)}%</span>
                            </td>
                            <td className={`py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-100/50 ${remainingK3 < 0 ? 'text-emerald-600' : remainingK3 === 0 ? 'text-slate-600' : 'text-rose-600'}`}>
                              <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{remainingK3}</span>
                            </td>
                          </>
                        );
                      })()}

                      {/* 4 Ngành Hàng Total */}
                      {(() => {
                        const totalK4Target = filteredEmployees.reduce((sum, e) => sum + (e.k4Target || 0), 0);
                        const totalK4Actual = filteredEmployees.reduce((sum, e) => sum + (e.k4Actual || 0), 0);
                        const totalK4Rate = clampedRate(totalK4Actual, totalK4Target);
                        const remainingK4 = filteredEmployees.reduce((sum, e) => sum + ((e.k4Target || 0) - (e.k4Actual || 0)), 0);
                        return (
                          <>
                            <td className="py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8.5px] sm:text-[11.5px] md:text-xs text-slate-800">
                              <span className="tracking-tighter sm:tracking-tight md:tracking-normal whitespace-nowrap inline-block">{totalK4Actual}/{totalK4Target}</span>
                            </td>
                            <td className={`py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs ${totalK4Rate >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{totalK4Rate.toFixed(0)}%</span>
                            </td>
                            <td className={`py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs ${remainingK4 < 0 ? 'text-emerald-600' : remainingK4 === 0 ? 'text-slate-600' : 'text-rose-600'}`}>
                              <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{remainingK4}</span>
                            </td>
                          </>
                        );
                      })()}

                      {/* KH Đạt Chuẩn Total */}
                      {(() => {
                        const totalKHTarget = filteredEmployees.reduce((sum, e) => sum + (e.khTarget || 0), 0);
                        const totalKHActual = filteredEmployees.reduce((sum, e) => sum + (e.khActual || 0), 0);
                        const totalKHRate = clampedRate(totalKHActual, totalKHTarget);
                        const remainingKH = filteredEmployees.reduce((sum, e) => sum + ((e.khTarget || 0) - (e.khActual || 0)), 0);
                        return (
                          <>
                            <td className="py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8.5px] sm:text-[11.5px] md:text-xs text-slate-800 bg-slate-100/50">
                              <span className="tracking-tighter sm:tracking-tight md:tracking-normal whitespace-nowrap inline-block">{totalKHActual}/{totalKHTarget}</span>
                            </td>
                            <td className={`py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-100/50 ${totalKHRate >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{totalKHRate.toFixed(0)}%</span>
                            </td>
                            <td className={`py-2 sm:py-2.5 px-0.5 text-center border border-slate-200 font-black font-sans tabular-nums text-[8px] sm:text-[11.5px] md:text-xs bg-slate-100/50 ${remainingKH < 0 ? 'text-emerald-600' : remainingKH === 0 ? 'text-slate-600' : 'text-rose-600'}`}>
                              <span className="tracking-tighter sm:tracking-normal whitespace-nowrap">{remainingKH}</span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          );
        })()}

        {renderCustDetailsModal()}
        {renderZaloModal()}
      </div>
  );
}
