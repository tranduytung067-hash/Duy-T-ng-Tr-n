import React from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { SectorIconCircle, SectorIconConfig } from './SectorIconPickerModal';
import { formatValue } from '../utils/formatters';

export interface MobileSectorRowItem {
  category: string;
  actual: number;
  target: number;
  completionRate: number;
  conThieu: number;
  soThungCanBan: number;
  khmhCount?: number;
  totalCustomers?: number;
  isExpandable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onDetailClick?: () => void;
  isHighlighted?: boolean;
  isHeader?: boolean;
  isSmall?: boolean;
  columnTitle?: string;
  renderExpandedContent?: () => React.ReactNode;
}

export interface MobileSectorTableProps {
  rows: MobileSectorRowItem[];
  customIconMap: Record<string, SectorIconConfig>;
  onEditIcon?: (category: string) => void;
  titleColName?: string;
  cyclePercentage?: number;
  isNested?: boolean;
}

export const MobileSectorTable: React.FC<MobileSectorTableProps> = ({
  rows,
  customIconMap,
  onEditIcon,
  titleColName = 'NGÀNH HÀNG',
  cyclePercentage = 0,
  isNested = false,
}) => {
  const showKhmhCol = !isNested && rows.some((r) => r.khmhCount !== undefined || r.totalCustomers !== undefined);

  return (
    <div className={`overflow-x-auto ${isNested ? 'border-indigo-100 shadow-2xs' : 'border-slate-200 shadow-md'} rounded-xl border bg-white relative font-sans`}>
      <table className="w-full text-left border-collapse table-fixed">
        <colgroup>
          {showKhmhCol ? (
            <>
              <col className="w-[33%]" />
              <col className="w-[28%]" />
              <col className="w-[22%]" />
              <col className="w-[17%]" />
            </>
          ) : (
            <>
              <col className="w-[42%]" />
              <col className="w-[30%]" />
              <col className="w-[28%]" />
            </>
          )}
        </colgroup>
        <thead className={`${!isNested ? 'sticky top-0 z-10' : ''} bg-white shadow-2xs`}>
          <tr className="bg-white text-emerald-800 font-extrabold uppercase tracking-wider text-[10px] sm:text-xs border-b border-slate-200 shadow-2xs">
            <th className={`${!isNested ? 'sticky top-0 z-10' : ''} py-2.5 px-1.5 sm:px-3 text-center border-r border-slate-200/80 bg-white shadow-2xs leading-tight`}>
              {titleColName}
            </th>
            <th className={`${!isNested ? 'sticky top-0 z-10' : ''} py-2.5 px-1.5 text-center border-r border-slate-200/80 bg-white shadow-2xs leading-tight`}>
              TIẾN ĐỘ
            </th>
            <th className={`${!isNested ? 'sticky top-0 z-10' : ''} py-2.5 px-1 text-center ${showKhmhCol ? 'border-r border-slate-200/80' : ''} bg-white shadow-2xs leading-tight`}>
              CẦN THỰC HIỆN
            </th>
            {showKhmhCol && (
              <th className={`${!isNested ? 'sticky top-0 z-10' : ''} py-2.5 px-1 text-center bg-white shadow-2xs leading-tight`}>
                <span>KÍCH HOẠT</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, idx) => {
            const isSmall = row.isSmall ?? (row.target > 0 && row.target < 0.5);
            const conThieu = row.conThieu;
            const isAchieved = conThieu <= 0 || row.completionRate >= 100;
            const rate = row.completionRate;

            // Color coding for progress bar and percentage
            const barColor = rate >= 100 || (cyclePercentage > 0 && rate >= cyclePercentage)
              ? 'bg-emerald-500'
              : rate >= 50
                ? 'bg-blue-500'
                : 'bg-rose-500';

            const rateColor = rate >= 100 || (cyclePercentage > 0 && rate >= cyclePercentage)
              ? 'text-emerald-600'
              : rate >= 50
                ? 'text-blue-600'
                : 'text-rose-600';

            // Vietnamese number formatting with comma for decimals and dot for thousands
            const tanFormatted = conThieu < -0.0001
              ? `-${Math.abs(conThieu).toLocaleString('vi-VN', {
                  minimumFractionDigits: isSmall ? 4 : 2,
                  maximumFractionDigits: isSmall ? 4 : 2,
                })}`
              : conThieu > 0.0001
                ? conThieu.toLocaleString('vi-VN', {
                    minimumFractionDigits: isSmall ? 4 : 2,
                    maximumFractionDigits: isSmall ? 4 : 2,
                  })
                : (isSmall ? '0,0000' : '0,00');

            const thungFormatted = row.soThungCanBan !== 0
              ? (row.soThungCanBan < 0 ? `-${Math.abs(row.soThungCanBan).toLocaleString('vi-VN')}` : row.soThungCanBan.toLocaleString('vi-VN'))
              : '0';

            const actualStr = formatValue(row.actual, isSmall);
            const targetStr = formatValue(row.target, isSmall);

            return (
              <React.Fragment key={`mob-row-frag-${row.category}-${idx}`}>
                <tr
                  key={`mob-row-${row.category}-${idx}`}
                  className={`transition-colors ${
                    row.isHighlighted 
                      ? 'bg-amber-50/70' 
                      : row.isHeader 
                        ? 'bg-indigo-50/60' 
                        : idx % 2 === 0 
                          ? 'bg-white' 
                          : 'bg-slate-50/40'
                  } hover:bg-slate-50`}
                >
                  {/* CỘT 1: NGÀNH HÀNG */}
                  <td className="py-2.5 px-1.5 sm:px-3 align-middle border-r border-slate-100">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {/* Icon trong vòng tròn pastel có nút ✏️ */}
                        <div
                          onClick={row.isExpandable && row.onToggleExpand ? (e) => {
                            e.stopPropagation();
                            row.onToggleExpand?.();
                          } : undefined}
                          className={`shrink-0 ${row.isExpandable ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
                        >
                          <SectorIconCircle
                            category={row.category}
                            customMap={customIconMap}
                            size={showKhmhCol ? 'sm' : 'md'}
                            showEditBtn={!!onEditIcon}
                            onEditClick={onEditIcon}
                          />
                        </div>

                        {/* Tên ngành hàng */}
                        <div
                          onClick={row.isExpandable && row.onToggleExpand ? (e) => {
                            e.stopPropagation();
                            row.onToggleExpand?.();
                          } : undefined}
                          className={`flex items-center min-w-0 flex-1 ${row.isExpandable ? 'cursor-pointer select-none active:opacity-75' : ''}`}
                        >
                          <span className="font-black text-slate-900 text-[11.5px] sm:text-[13.5px] uppercase tracking-tight break-words leading-tight">
                            {row.category}
                          </span>
                        </div>
                      </div>

                      {/* Các nút điều hướng biểu tượng (Kích thước bằng nhau tuyệt đối) */}
                      {(row.onDetailClick || (row.isExpandable && row.onToggleExpand)) && (
                        <div className="grid grid-cols-2 gap-1 w-full max-w-[92px]">
                          {row.onDetailClick && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                row.onDetailClick?.();
                              }}
                              className="w-full h-[30px] px-1 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center cursor-pointer transition-colors shadow-2xs active:scale-95 touch-manipulation"
                              title="Xem chi tiết thực hiện chỉ tiêu"
                              aria-label={`Xem chi tiết ${row.category}`}
                            >
                              <Eye className="w-4 h-4 shrink-0 text-emerald-700" />
                            </button>
                          )}

                          {row.isExpandable && row.onToggleExpand && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                row.onToggleExpand?.();
                              }}
                              className={`w-full h-[30px] px-1 rounded-lg border flex items-center justify-center cursor-pointer transition-all shadow-2xs active:scale-95 touch-manipulation select-none ${
                                row.isExpanded
                                  ? 'bg-indigo-700 text-white border-indigo-800 shadow-xs ring-2 ring-indigo-300/60'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                              }`}
                              title={row.isExpanded ? 'Thu gọn danh sách sản phẩm' : 'Mở rộng danh sách sản phẩm'}
                              aria-label={row.isExpanded ? `Thu gọn sản phẩm ${row.category}` : `Mở rộng sản phẩm ${row.category}`}
                            >
                              {row.isExpanded ? (
                                <ChevronUp className="w-4 h-4 shrink-0 text-white" />
                              ) : (
                                <ChevronDown className="w-4 h-4 shrink-0 text-indigo-700" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* CỘT 2: TIẾN ĐỘ */}
                  <td className="py-2.5 px-1.5 text-center align-middle border-r border-slate-100">
                    <div className="flex flex-col items-center justify-center">
                      {/* Thực hiện / Chỉ tiêu */}
                      <div className="text-[10.5px] sm:text-xs font-sans tabular-nums leading-tight">
                        <span className="font-bold text-[#0f2d59]">{actualStr}</span>
                        <span className="text-slate-400 text-[9.5px] mx-0.5">/</span>
                        <span className="font-medium text-slate-500">{targetStr}</span>
                      </div>

                      {/* Progress Bar nhỏ gọn */}
                      <div className="w-full bg-slate-100 h-2 sm:h-2.5 rounded-full overflow-hidden my-1.5 border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                        />
                      </div>

                      {/* % Hoàn thành nổi bật */}
                      <span className={`font-sans tabular-nums font-black text-xs sm:text-sm leading-none ${rateColor}`}>
                        {rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  {/* CỘT 3: CẦN THỰC HIỆN */}
                  <td className={`py-2.5 px-1 text-center align-middle ${showKhmhCol ? 'border-r border-slate-100' : ''}`}>
                    <div className="flex flex-col items-center justify-center">
                      {isAchieved ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-sans tabular-nums font-bold text-[11px] sm:text-[13px] text-emerald-600 leading-tight">
                            {tanFormatted} Tấn
                          </span>
                          <span className="font-sans tabular-nums font-semibold text-[10px] sm:text-[11px] text-emerald-600 mt-0.5 leading-tight">
                            {thungFormatted} Thùng
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          {/* Dòng 1: Số lượng Tấn chữ lớn hơn, màu đỏ/hồng */}
                          <span className="font-sans tabular-nums font-bold text-[11px] sm:text-[13px] text-rose-600 leading-tight">
                            {tanFormatted} Tấn
                          </span>

                          {/* Dòng 2: Số thùng chữ nhỏ hơn */}
                          <span className="font-sans tabular-nums font-semibold text-[10px] sm:text-[11px] text-slate-600 mt-0.5 leading-tight">
                            {thungFormatted} Thùng
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* CỘT 4: KHMH / TỔNG SỐ KH QUẢN LÝ */}
                  {showKhmhCol && (
                    <td className="py-2.5 px-1 text-center align-middle">
                      {row.khmhCount !== undefined && row.totalCustomers !== undefined ? (
                        <div className="flex flex-col items-center justify-center font-sans tabular-nums">
                          <div className="flex items-baseline justify-center leading-none whitespace-nowrap">
                            <span className="font-extrabold text-sky-700 text-xs sm:text-[13px]">
                              {row.khmhCount.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-slate-400 text-[10px] mx-0.5">/</span>
                            <span className="font-semibold text-slate-600 text-[10.5px] sm:text-xs">
                              {row.totalCustomers.toLocaleString('vi-VN')}
                            </span>
                          </div>
                          {row.totalCustomers > 0 && (
                            <span className="text-[9.5px] font-bold text-slate-500 mt-1 leading-none">
                              {Math.round((row.khmhCount / row.totalCustomers) * 100)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-sans">-</span>
                      )}
                    </td>
                  )}
                </tr>

                {/* INLINE EXPANDED SUB-PRODUCTS SECTION */}
                {row.isExpanded && row.renderExpandedContent && (
                  <tr key={`mob-row-exp-${row.category}-${idx}`} className="bg-slate-50/90 border-b border-indigo-200">
                    <td colSpan={showKhmhCol ? 4 : 3} className="p-2 sm:p-2.5">
                      {row.renderExpandedContent()}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

