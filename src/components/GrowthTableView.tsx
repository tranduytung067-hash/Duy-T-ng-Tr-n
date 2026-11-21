import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { GrowthRow } from '../types';

export interface GrowthTableViewProps {
  visibleRows: GrowthRow[];
  totalRow: GrowthRow;
  growthMetric: 'sanLuong' | 'doanhSo' | 'all';
  collapsedGroups: string[];
  onToggleCollapse: (normParentKey: string) => void;
  growthSearchTerm: string;
  formatQuantity: (val: number) => string;
  formatRevenue: (val: number) => string;
  formatGrowthPct: (val: number) => string;
  toProperCase: (val: string) => string;
  getParentGroup: (nhomName: string) => string | null;
  isParentRow: (nhomName: string) => boolean;
  normalizeGroupNameForCollapse: (nhomName: string) => string;
}

/**
 * Formats revenue into a compact, human-readable format for mobile screens.
 * E.g. 1,250,000,000 -> "1.25 Tỷ", 120,000,000 -> "120 Tr", 15,400,000 -> "15.4 Tr".
 * Prevents overflowing 12-digit strings into cell borders on phone displays.
 */
export const formatCompactRevenue = (num: number | string | null | undefined): string => {
  if (num === undefined || num === null || num === '' || num === 'Trống') return '0';
  const val = typeof num === 'number' ? num : parseFloat(String(num).replace(/[^0-9.-]/g, ''));
  if (isNaN(val) || val === 0) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const inTy = abs / 1_000_000_000;
    return `${sign}${inTy >= 100 ? inTy.toFixed(0) : inTy >= 10 ? inTy.toFixed(1) : inTy.toFixed(2)} Tỷ`;
  }
  if (abs >= 1_000_000) {
    const inTr = abs / 1_000_000;
    return `${sign}${inTr >= 100 ? inTr.toFixed(0) : inTr >= 10 ? inTr.toFixed(1) : inTr.toFixed(1)} Tr`;
  }
  return Math.round(val).toLocaleString('en-US');
};

export const GrowthTableView: React.FC<GrowthTableViewProps> = ({
  visibleRows,
  growthMetric,
  collapsedGroups,
  onToggleCollapse,
  formatQuantity,
  formatRevenue,
  formatGrowthPct,
  toProperCase,
  getParentGroup,
  isParentRow,
  normalizeGroupNameForCollapse,
}) => {
  // Mobile revenue display toggle: compact ('Tr / Tỷ') vs full raw digits
  const [revenueDisplayMode, setRevenueDisplayMode] = useState<'compact' | 'full'>('compact');

  const getRevenueString = (val: number, isMobile: boolean) => {
    if (isMobile && revenueDisplayMode === 'compact') {
      return formatCompactRevenue(val);
    }
    return formatRevenue(val);
  };

  return (
    <div className="space-y-3">
      {/* Quick Option Bar for Mobile Table */}
      {(growthMetric === 'doanhSo' || growthMetric === 'all') && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
          <span className="text-slate-600 font-medium hidden sm:inline">
            Số liệu được tự động căn chỉnh vừa vặn màn hình
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-slate-700 font-semibold text-xs">Hiển thị doanh số:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setRevenueDisplayMode('compact')}
                className={`min-h-[44px] sm:min-h-[32px] px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  revenueDisplayMode === 'compact'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
                title="Rút gọn Tr / Tỷ để không tràn màn hình"
              >
                Tr / Tỷ
              </button>
              <button
                type="button"
                onClick={() => setRevenueDisplayMode('full')}
                className={`min-h-[44px] sm:min-h-[32px] px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  revenueDisplayMode === 'full'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
                title="Hiển thị đầy đủ số VNĐ"
              >
                Số đầy đủ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE-OPTIMIZED TABLE (Purposeful horizontal scroll + sticky identity) */}
      {/* ========================================================================= */}
      <div className="block md:hidden bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {growthMetric === 'all' ? (
            /* Mobile 4-Column Layout for Both Sản Lượng & Doanh Số */
            <table className="w-full min-w-[500px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold text-xs border-b border-slate-200 select-none">
                  <th className="sticky left-0 z-20 bg-slate-50 py-2.5 px-3 text-left align-middle min-w-[155px] sticky-col-shadow">
                    Nhóm sản phẩm
                  </th>
                  <th className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap">
                    Năm 2025
                  </th>
                  <th className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap">
                    Năm 2026
                  </th>
                  <th className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                    Tăng trưởng
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {visibleRows && visibleRows.length > 0 ? (
                  visibleRows.map((row, idx) => {
                    const isTotalRow = row.nhomSanPham === 'TỔNG CÁC NGÀNH HÀNG';
                    const parent = getParentGroup(row.nhomSanPham);
                    const isChild = !!parent;
                    const isParent = isParentRow(row.nhomSanPham);
                    const normParentKey = normalizeGroupNameForCollapse(row.nhomSanPham);
                    const isCollapsed = collapsedGroups.includes(normParentKey);

                    let rowBg = 'bg-white hover:bg-slate-50';
                    let stickyBg = 'bg-white';
                    let nameStyle = 'text-slate-800 font-semibold text-xs leading-snug';

                    if (isTotalRow) {
                      rowBg = 'bg-emerald-50 font-bold';
                      stickyBg = 'bg-emerald-50';
                      nameStyle = 'text-emerald-950 font-bold text-xs leading-snug';
                    } else if (isParent || (!isChild && !isTotalRow)) {
                      rowBg = 'bg-slate-50 font-semibold';
                      stickyBg = 'bg-slate-50';
                      nameStyle = 'text-slate-900 font-bold text-xs leading-snug';
                    } else if (isChild) {
                      rowBg = 'bg-white hover:bg-slate-50';
                      stickyBg = 'bg-white';
                      nameStyle = 'text-slate-700 font-medium text-xs leading-snug';
                    }

                    const isSlPos = row.tiLeTangTruongSanLuong > 0;
                    const isSlNeg = row.tiLeTangTruongSanLuong < 0;
                    const slColor = isSlPos ? 'text-emerald-700' : isSlNeg ? 'text-rose-600' : 'text-slate-600';

                    const isDsPos = row.tiLeTangTruongDoanhSo > 0;
                    const isDsNeg = row.tiLeTangTruongDoanhSo < 0;
                    const dsColor = isDsPos ? 'text-emerald-700' : isDsNeg ? 'text-rose-600' : 'text-slate-600';

                    return (
                      <tr key={`mob-all-${idx}`} className={`${rowBg} transition-colors`}>
                        {/* Col 1: Nhóm sản phẩm (sticky so identity remains visible) */}
                        <td className={`sticky left-0 z-10 ${stickyBg} py-2.5 px-3 align-middle min-w-[155px] sticky-col-shadow`}>
                          <div className="flex items-center justify-between gap-1 w-full">
                            {isChild ? (
                              <div className="pl-3 min-w-0">
                                <span className={nameStyle} title={row.nhomSanPham}>
                                  {toProperCase(row.nhomSanPham)}
                                </span>
                              </div>
                            ) : (
                              <span className={nameStyle} title={row.nhomSanPham}>
                                {toProperCase(row.nhomSanPham)}
                              </span>
                            )}

                            {isParent && (
                              <button
                                type="button"
                                onClick={() => onToggleCollapse(normParentKey)}
                                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center cursor-pointer shrink-0"
                                aria-label={isCollapsed ? `Mở rộng ${toProperCase(row.nhomSanPham)}` : `Thu gọn ${toProperCase(row.nhomSanPham)}`}
                                title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                              >
                                <span className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-600 flex items-center justify-center">
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                                  )}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Col 2: Năm 2025 (SL & DS) */}
                        <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap font-tabular tabular-nums">
                          <div className="text-xs font-semibold text-slate-800" title={`Sản lượng 2025: ${formatQuantity(row.sanLuong2025)} Tấn`}>
                            {formatQuantity(row.sanLuong2025)} <span className="text-[11px] text-slate-500 font-normal">T</span>
                          </div>
                          <div className="text-[11px] font-medium text-teal-700" title={`Doanh số 2025: ${formatRevenue(row.doanhSo2025)} VNĐ`}>
                            {getRevenueString(row.doanhSo2025, true)}
                          </div>
                        </td>

                        {/* Col 3: Năm 2026 (SL & DS) */}
                        <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap font-tabular tabular-nums">
                          <div className="text-xs font-bold text-slate-950" title={`Sản lượng 2026: ${formatQuantity(row.sanLuong2026)} Tấn`}>
                            {formatQuantity(row.sanLuong2026)} <span className="text-[11px] text-slate-500 font-normal">T</span>
                          </div>
                          <div className="text-[11px] font-semibold text-emerald-800" title={`Doanh số 2026: ${formatRevenue(row.doanhSo2026)} VNĐ`}>
                            {getRevenueString(row.doanhSo2026, true)}
                          </div>
                        </td>

                        {/* Col 4: Tăng Trưởng (SL % & DS %) */}
                        <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap font-tabular tabular-nums">
                          <div className={`text-[11px] font-bold ${slColor}`} title={`Tăng trưởng Sản lượng: ${formatGrowthPct(row.tiLeTangTruongSanLuong)} (${row.tangGiamSanLuong > 0 ? '+' : ''}${formatQuantity(row.tangGiamSanLuong)} Tấn)`}>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-500 font-medium">SL:</span>
                              <span>{formatGrowthPct(row.tiLeTangTruongSanLuong)}</span>
                            </div>
                            <div className="text-[10.5px] font-medium">
                              {row.tangGiamSanLuong > 0 ? '+' : ''}{formatQuantity(row.tangGiamSanLuong)} Tấn
                            </div>
                          </div>
                          <div className={`text-[11px] font-bold ${dsColor} mt-1`} title={`Tăng trưởng Doanh số: ${formatGrowthPct(row.tiLeTangTruongDoanhSo)} (${row.tangGiamDoanhSo > 0 ? '+' : ''}${formatRevenue(row.tangGiamDoanhSo)} VNĐ)`}>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-500 font-medium">DS:</span>
                              <span>{formatGrowthPct(row.tiLeTangTruongDoanhSo)}</span>
                            </div>
                            <div className="text-[10.5px] font-medium">
                              {row.tangGiamDoanhSo > 0 ? '+' : ''}{getRevenueString(row.tangGiamDoanhSo, true)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-medium text-xs">
                      <Info className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
                      Không tìm thấy nhóm sản phẩm trùng khớp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* Mobile 4-Column Layout for Single Metric (Sản Lượng OR Doanh Số) */
            <table className="w-full min-w-[460px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold text-xs border-b border-slate-200 select-none">
                  <th className="sticky left-0 z-20 bg-slate-50 py-2.5 px-3 text-left align-middle min-w-[155px] sticky-col-shadow">
                    Nhóm sản phẩm
                  </th>
                  <th className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap">
                    Năm 2025
                  </th>
                  <th className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap">
                    Năm 2026
                  </th>
                  <th className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                    {growthMetric === 'sanLuong' ? 'Tăng trưởng (Tấn)' : growthMetric === 'doanhSo' ? 'Tăng trưởng (VNĐ)' : 'Tăng trưởng'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {visibleRows && visibleRows.length > 0 ? (
                  visibleRows.map((row, idx) => {
                    const isTotalRow = row.nhomSanPham === 'TỔNG CÁC NGÀNH HÀNG';
                    const parent = getParentGroup(row.nhomSanPham);
                    const isChild = !!parent;
                    const isParent = isParentRow(row.nhomSanPham);
                    const normParentKey = normalizeGroupNameForCollapse(row.nhomSanPham);
                    const isCollapsed = collapsedGroups.includes(normParentKey);

                    let rowBg = 'bg-white hover:bg-slate-50';
                    let stickyBg = 'bg-white';
                    let nameStyle = 'text-slate-800 font-semibold text-xs leading-snug';

                    if (isTotalRow) {
                      rowBg = 'bg-emerald-50 font-bold';
                      stickyBg = 'bg-emerald-50';
                      nameStyle = 'text-emerald-950 font-bold text-xs leading-snug';
                    } else if (isParent || (!isChild && !isTotalRow)) {
                      rowBg = 'bg-slate-50 font-semibold';
                      stickyBg = 'bg-slate-50';
                      nameStyle = 'text-slate-900 font-bold text-xs leading-snug';
                    } else if (isChild) {
                      rowBg = 'bg-white hover:bg-slate-50';
                      stickyBg = 'bg-white';
                      nameStyle = 'text-slate-700 font-medium text-xs leading-snug';
                    }

                    const isDoanhSo = growthMetric === 'doanhSo';
                    const val2025 = isDoanhSo ? row.doanhSo2025 : row.sanLuong2025;
                    const val2026 = isDoanhSo ? row.doanhSo2026 : row.sanLuong2026;
                    const changeVal = isDoanhSo ? row.tangGiamDoanhSo : row.tangGiamSanLuong;
                    const pctVal = isDoanhSo ? row.tiLeTangTruongDoanhSo : row.tiLeTangTruongSanLuong;

                    const isPositive = pctVal > 0;
                    const isNegative = pctVal < 0;
                    const pctColor = isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-600' : 'text-slate-600';
                    const changeColor = changeVal > 0 ? 'text-emerald-700' : changeVal < 0 ? 'text-rose-600' : 'text-slate-500';

                    const str2025 = isDoanhSo ? getRevenueString(val2025, true) : formatQuantity(val2025);
                    const str2026 = isDoanhSo ? getRevenueString(val2026, true) : formatQuantity(val2026);
                    const strChange = isDoanhSo ? getRevenueString(changeVal, true) : formatQuantity(changeVal);

                    return (
                      <tr key={`mob-single-${idx}`} className={`${rowBg} transition-colors`}>
                        {/* Col 1: Nhóm sản phẩm */}
                        <td className={`sticky left-0 z-10 ${stickyBg} py-2.5 px-3 align-middle min-w-[155px] sticky-col-shadow`}>
                          <div className="flex items-center justify-between gap-1 w-full">
                            {isChild ? (
                              <div className="pl-3 min-w-0">
                                <span className={nameStyle} title={row.nhomSanPham}>
                                  {toProperCase(row.nhomSanPham)}
                                </span>
                              </div>
                            ) : (
                              <span className={nameStyle} title={row.nhomSanPham}>
                                {toProperCase(row.nhomSanPham)}
                              </span>
                            )}

                            {isParent && (
                              <button
                                type="button"
                                onClick={() => onToggleCollapse(normParentKey)}
                                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center cursor-pointer shrink-0"
                                aria-label={isCollapsed ? `Mở rộng ${toProperCase(row.nhomSanPham)}` : `Thu gọn ${toProperCase(row.nhomSanPham)}`}
                                title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                              >
                                <span className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-600 flex items-center justify-center">
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                                  )}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Col 2: Năm 2025 */}
                        <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap font-tabular tabular-nums">
                          <div
                            className="text-xs font-medium text-slate-700"
                            title={isDoanhSo ? `${formatRevenue(val2025)} VNĐ` : `${formatQuantity(val2025)} Tấn`}
                          >
                            {str2025}
                          </div>
                        </td>

                        {/* Col 3: Năm 2026 */}
                        <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap font-tabular tabular-nums">
                          <div
                            className="text-xs font-bold text-slate-950"
                            title={isDoanhSo ? `${formatRevenue(val2026)} VNĐ` : `${formatQuantity(val2026)} Tấn`}
                          >
                            {str2026}
                          </div>
                        </td>

                        {/* Col 4: Tăng Trưởng (% on top, +/- below) */}
                        <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap font-tabular tabular-nums">
                          <div
                            className={`text-xs font-bold ${pctColor}`}
                            title={`Tỷ lệ: ${formatGrowthPct(pctVal)}`}
                          >
                            {formatGrowthPct(pctVal)}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${changeColor}`}
                            title={`Thay đổi: ${changeVal > 0 ? '+' : ''}${isDoanhSo ? formatRevenue(changeVal) : formatQuantity(changeVal)}${!isDoanhSo ? ' Tấn' : ''}`}
                          >
                            {changeVal > 0 ? '+' : ''}{strChange}{!isDoanhSo ? ' Tấn' : ''}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-medium text-xs">
                      <Info className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
                      Không tìm thấy nhóm sản phẩm trùng khớp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP TABLE (Spacious 5 or 9 column layout, horizontal hairlines only) */}
      {/* ========================================================================= */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        {growthMetric === 'all' ? (
          /* Desktop 9-Column Comparative Table */
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
              <col className="w-[9.5%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold select-none bg-slate-50">
                <th
                  className="py-3 px-3 text-left align-middle text-slate-800 font-bold text-[13px]"
                  rowSpan={2}
                >
                  Nhóm sản phẩm
                </th>
                <th
                  className="py-2 px-3 text-right text-teal-800 font-semibold text-xs border-b border-slate-200"
                  colSpan={4}
                >
                  Sản lượng (Tấn)
                </th>
                <th
                  className="py-2 px-3 text-right text-emerald-800 font-semibold text-xs border-b border-slate-200"
                  colSpan={4}
                >
                  Doanh số (VNĐ)
                </th>
              </tr>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-600 select-none bg-slate-50">
                <th className="py-2 px-2 text-right">Năm 2025</th>
                <th className="py-2 px-2 text-right">Năm 2026</th>
                <th className="py-2 px-2 text-right">Tăng / giảm (Tấn)</th>
                <th className="py-2 px-2 text-right">% Tăng trưởng</th>
                <th className="py-2 px-2 text-right">Năm 2025</th>
                <th className="py-2 px-2 text-right">Năm 2026</th>
                <th className="py-2 px-2 text-right">Tăng / giảm (VNĐ)</th>
                <th className="py-2 px-3 text-right">% Tăng trưởng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {visibleRows && visibleRows.length > 0 ? (
                visibleRows.map((row, idx) => {
                  const isTotalRow = row.nhomSanPham === 'TỔNG CÁC NGÀNH HÀNG';
                  const parent = getParentGroup(row.nhomSanPham);
                  const isChild = !!parent;
                  const isParent = isParentRow(row.nhomSanPham);
                  const normParentKey = normalizeGroupNameForCollapse(row.nhomSanPham);
                  const isCollapsed = collapsedGroups.includes(normParentKey);

                  let rowClass = 'bg-white hover:bg-slate-50 transition-colors';
                  let groupNameColorClass = 'text-slate-800 font-medium text-xs';
                  let numberColorClass = 'text-slate-700 font-tabular tabular-nums text-xs';

                  if (isTotalRow) {
                    rowClass = 'bg-emerald-50 hover:bg-emerald-100/70 transition-colors';
                    groupNameColorClass = 'text-emerald-950 font-bold text-[12.5px]';
                    numberColorClass = 'text-emerald-950 font-bold font-tabular tabular-nums text-xs';
                  } else if (isParent || (!isChild && !isTotalRow)) {
                    rowClass = 'bg-slate-50/70 hover:bg-slate-100/70 transition-colors';
                    groupNameColorClass = 'text-slate-900 font-bold text-xs';
                    numberColorClass = 'text-slate-900 font-semibold font-tabular tabular-nums text-xs';
                  } else if (isChild) {
                    rowClass = 'bg-white hover:bg-slate-50 transition-colors';
                    groupNameColorClass = 'text-slate-700 font-medium text-xs';
                    numberColorClass = 'text-slate-700 font-medium font-tabular tabular-nums text-[11.5px]';
                  }

                  const slChangeVal = row.tangGiamSanLuong;
                  const isSlPositive = slChangeVal > 0;
                  const isSlNegative = slChangeVal < 0;
                  const slChangeColor = isSlPositive
                    ? 'text-emerald-700 font-semibold'
                    : isSlNegative
                      ? 'text-rose-600 font-semibold'
                      : 'text-slate-600';

                  const slPctVal = row.tiLeTangTruongSanLuong;
                  const slPctColor =
                    slPctVal > 0
                      ? 'text-emerald-700'
                      : slPctVal < 0
                        ? 'text-rose-600'
                        : 'text-slate-600';

                  const dsChangeVal = row.tangGiamDoanhSo;
                  const isDsPositive = dsChangeVal > 0;
                  const isDsNegative = dsChangeVal < 0;
                  const dsChangeColor = isDsPositive
                    ? 'text-emerald-700 font-semibold'
                    : isDsNegative
                      ? 'text-rose-600 font-semibold'
                      : 'text-slate-600';

                  const dsPctVal = row.tiLeTangTruongDoanhSo;
                  const dsPctColor =
                    dsPctVal > 0
                      ? 'text-emerald-700'
                      : dsPctVal < 0
                        ? 'text-rose-600'
                        : 'text-slate-600';

                  return (
                    <tr key={`dt-all-${idx}`} className={rowClass}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-between w-full gap-1.5">
                          {isChild ? (
                            <div className="pl-4 min-w-0">
                              <span className={`${groupNameColorClass} truncate block`} title={row.nhomSanPham}>
                                {toProperCase(row.nhomSanPham)}
                              </span>
                            </div>
                          ) : (
                            <span className={`${groupNameColorClass} truncate`} title={row.nhomSanPham}>
                              {toProperCase(row.nhomSanPham)}
                            </span>
                          )}
                          {isParent && (
                            <button
                              type="button"
                              onClick={() => onToggleCollapse(normParentKey)}
                              className="w-6 h-6 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer select-none shrink-0 flex items-center justify-center"
                              aria-label={isCollapsed ? `Mở rộng ${toProperCase(row.nhomSanPham)}` : `Thu gọn ${toProperCase(row.nhomSanPham)}`}
                              title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={numberColorClass}>{formatQuantity(row.sanLuong2025)}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={numberColorClass}>{formatQuantity(row.sanLuong2026)}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-tabular tabular-nums text-[11.5px]">
                        <span className={slChangeColor}>
                          {isSlPositive ? '+' : ''}
                          {formatQuantity(row.tangGiamSanLuong)} Tấn
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-tabular tabular-nums">
                        <span className={`text-xs font-bold ${slPctColor}`}>
                          {formatGrowthPct(row.tiLeTangTruongSanLuong)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={numberColorClass}>{formatRevenue(row.doanhSo2025)}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={numberColorClass}>{formatRevenue(row.doanhSo2026)}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-tabular tabular-nums text-[11.5px]">
                        <span className={dsChangeColor}>
                          {isDsPositive ? '+' : ''}
                          {formatRevenue(row.tangGiamDoanhSo)} VNĐ
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular tabular-nums">
                        <span className={`text-xs font-bold ${dsPctColor}`}>
                          {formatGrowthPct(row.tiLeTangTruongDoanhSo)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium text-xs">
                    <Info className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    Không tìm thấy nhóm sản phẩm trùng khớp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* Desktop 5-Column Table for Single Metric */
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[17%]" />
              <col className="w-[17%]" />
              <col className="w-[17%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 select-none bg-slate-50">
                <th className="py-3 px-3 text-left align-middle text-slate-800 font-bold text-[13px]">
                  Nhóm sản phẩm
                </th>
                <th className="py-3 px-2 text-right">Năm 2025</th>
                <th className="py-3 px-2 text-right">Năm 2026</th>
                <th className="py-3 px-2 text-right">
                  {growthMetric === 'sanLuong' ? 'Tăng / giảm (Tấn)' : growthMetric === 'doanhSo' ? 'Tăng / giảm (VNĐ)' : 'Tăng / giảm'}
                </th>
                <th className="py-3 px-3 text-right">% Tăng trưởng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {visibleRows && visibleRows.length > 0 ? (
                visibleRows.map((row, idx) => {
                  const isTotalRow = row.nhomSanPham === 'TỔNG CÁC NGÀNH HÀNG';
                  const parent = getParentGroup(row.nhomSanPham);
                  const isChild = !!parent;
                  const isParent = isParentRow(row.nhomSanPham);
                  const normParentKey = normalizeGroupNameForCollapse(row.nhomSanPham);
                  const isCollapsed = collapsedGroups.includes(normParentKey);

                  let rowClass = 'bg-white hover:bg-slate-50 transition-colors';
                  let groupNameColorClass = 'text-slate-800 font-medium text-xs';
                  let numberColorClass = 'text-slate-700 font-tabular tabular-nums text-xs';

                  if (isTotalRow) {
                    rowClass = 'bg-emerald-50 hover:bg-emerald-100/70 transition-colors';
                    groupNameColorClass = 'text-emerald-950 font-bold text-[12.5px]';
                    numberColorClass = 'text-emerald-950 font-bold font-tabular tabular-nums text-xs';
                  } else if (isParent || (!isChild && !isTotalRow)) {
                    rowClass = 'bg-slate-50/70 hover:bg-slate-100/70 transition-colors';
                    groupNameColorClass = 'text-slate-900 font-bold text-xs';
                    numberColorClass = 'text-slate-900 font-semibold font-tabular tabular-nums text-xs';
                  } else if (isChild) {
                    rowClass = 'bg-white hover:bg-slate-50 transition-colors';
                    groupNameColorClass = 'text-slate-700 font-medium text-xs';
                    numberColorClass = 'text-slate-700 font-medium font-tabular tabular-nums text-[11.5px]';
                  }

                  const isDoanhSo = growthMetric === 'doanhSo';
                  const val2025 = isDoanhSo ? row.doanhSo2025 : row.sanLuong2025;
                  const val2026 = isDoanhSo ? row.doanhSo2026 : row.sanLuong2026;
                  const changeVal = isDoanhSo ? row.tangGiamDoanhSo : row.tangGiamSanLuong;
                  const pctVal = isDoanhSo ? row.tiLeTangTruongDoanhSo : row.tiLeTangTruongSanLuong;

                  const pctColor =
                    pctVal > 0
                      ? 'text-emerald-700'
                      : pctVal < 0
                        ? 'text-rose-600'
                        : 'text-slate-600';

                  const changeColor =
                    changeVal > 0
                      ? 'text-emerald-700 font-semibold'
                      : changeVal < 0
                        ? 'text-rose-600 font-semibold'
                        : 'text-slate-600';

                  const formatted2025 = isDoanhSo ? formatRevenue(val2025) : formatQuantity(val2025);
                  const formatted2026 = isDoanhSo ? formatRevenue(val2026) : formatQuantity(val2026);
                  const formattedChange = isDoanhSo ? formatRevenue(changeVal) : formatQuantity(changeVal);

                  return (
                    <tr key={`dt-single-${idx}`} className={rowClass}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-between w-full gap-1.5">
                          {isChild ? (
                            <div className="pl-4 min-w-0">
                              <span className={`${groupNameColorClass} truncate block`} title={row.nhomSanPham}>
                                {toProperCase(row.nhomSanPham)}
                              </span>
                            </div>
                          ) : (
                            <span className={`${groupNameColorClass} truncate`} title={row.nhomSanPham}>
                              {toProperCase(row.nhomSanPham)}
                            </span>
                          )}
                          {isParent && (
                            <button
                              type="button"
                              onClick={() => onToggleCollapse(normParentKey)}
                              className="w-6 h-6 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer select-none shrink-0 flex items-center justify-center"
                              aria-label={isCollapsed ? `Mở rộng ${toProperCase(row.nhomSanPham)}` : `Thu gọn ${toProperCase(row.nhomSanPham)}`}
                              title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={numberColorClass}>{formatted2025}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={numberColorClass}>{formatted2026}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-tabular tabular-nums text-[11.5px]">
                        <span className={changeColor}>
                          {changeVal > 0 ? '+' : ''}
                          {formattedChange}{!isDoanhSo ? ' Tấn' : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular tabular-nums">
                        <span className={`text-xs font-bold ${pctColor}`}>
                          {formatGrowthPct(pctVal)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-medium text-xs">
                    <Info className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    Không tìm thấy nhóm sản phẩm trùng khớp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
