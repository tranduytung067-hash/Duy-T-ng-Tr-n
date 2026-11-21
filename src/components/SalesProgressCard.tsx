import React from 'react';
import { ChevronRight, ChevronDown, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatValue } from '../utils/formatters';
import { SectorIconCircle, SectorIconConfig } from './SectorIconPickerModal';

export interface SalesProgressCardProps {
  key?: React.Key;
  id?: string;
  title: string;
  subTitle?: string;
  icon?: React.ReactNode;
  actual: number;
  target: number;
  completionRate: number;
  conThieu: number;
  isOver?: boolean;
  soThungCanBan?: number;
  khmhCount?: number | string;
  isClickable?: boolean;
  isExpanded?: boolean;
  onCardClick?: () => void;
  onDetailClick?: (e: React.MouseEvent) => void;
  isHighlighted?: boolean;
  isHeader?: boolean;
  isSmall?: boolean;
  formatVal?: (val: number, isSmallVal?: boolean) => string;
  badgeExtra?: React.ReactNode;
  extraInfo?: React.ReactNode;
  cardIndex?: number;
  customIconMap?: Record<string, SectorIconConfig>;
  onEditIcon?: (category: string) => void;
}

export const SalesProgressCard: React.FC<SalesProgressCardProps> = ({
  id,
  title,
  subTitle,
  icon,
  actual,
  target,
  completionRate,
  conThieu,
  isOver,
  soThungCanBan = 0,
  khmhCount,
  isClickable = false,
  isExpanded = false,
  onCardClick,
  onDetailClick,
  isHighlighted = false,
  isHeader = false,
  isSmall = false,
  formatVal = (v: number, isSmallVal?: boolean) => formatValue(v, isSmallVal),
  badgeExtra,
  extraInfo,
  cardIndex,
  customIconMap,
  onEditIcon,
}) => {
  const achieved = completionRate >= 100;
  const vuot = Math.max(0, actual - target);
  const thieu = Math.max(0, conThieu > 0 ? conThieu : target - actual);

  // 3-tier color rules:
  // >=100% -> màu xanh teal
  // 90–99.9% -> màu cam
  // <90% -> màu đỏ/cam đậm
  const barColor = completionRate >= 100
    ? 'bg-teal-500'
    : completionRate >= 90
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const rateColor = completionRate >= 100
    ? 'text-teal-600'
    : completionRate >= 90
      ? 'text-amber-600'
      : 'text-rose-600';

  return (
    <div
      id={id}
      onClick={onCardClick}
      className={`bg-white rounded-xl border transition-all duration-200 p-3 sm:p-4 space-y-2.5 select-none ${
        isClickable ? 'cursor-pointer hover:border-emerald-400 hover:shadow-md active:scale-[0.99]' : ''
      } ${
        isExpanded
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/15'
          : 'border-slate-200 shadow-2xs'
      } ${
        isHighlighted ? 'bg-yellow-50/50 border-yellow-300' : isHeader ? 'bg-indigo-50/40 border-indigo-200' : ''
      }`}
    >
      {/* HÀNG 1: Bên trái (Icon + Tên + Badge) | Bên phải (% Hoàn thành + Chevron) */}
      <div className="flex items-start justify-between gap-2.5">
        {/* Bên trái: Icon ngành hàng + tên ngành hàng + Badge */}
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {cardIndex !== undefined && (
            <span className="text-slate-400 font-mono text-[10px] sm:text-xs w-4 shrink-0 text-right pt-0.5">
              {cardIndex.toString().padStart(2, '0')}
            </span>
          )}
          {customIconMap ? (
            <SectorIconCircle
              category={title}
              customMap={customIconMap}
              size="sm"
              showEditBtn={!!onEditIcon}
              onEditClick={onEditIcon}
            />
          ) : icon ? (
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 mt-0.5">
              {icon}
            </div>
          ) : null}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-black uppercase tracking-tight text-[13px] sm:text-[14.5px] leading-snug break-words whitespace-normal ${
                  isHighlighted ? 'text-yellow-900' : isHeader ? 'text-indigo-900' : 'text-slate-900'
                }`}
              >
                {title}
              </span>

              {/* Badge Đạt / Chưa đạt */}
              {achieved ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs whitespace-nowrap shrink-0">
                  Đạt
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap shrink-0">
                  Chưa đạt
                </span>
              )}

              {badgeExtra}
            </div>

            {subTitle && (
              <div className="text-[11px] text-slate-500 font-medium break-words leading-tight">
                {subTitle}
              </div>
            )}
          </div>
        </div>

        {/* Bên phải: % Hoàn thành + icon chevron */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span className={`font-mono font-black text-sm sm:text-base ${rateColor}`}>
            {completionRate.toFixed(1)}%
          </span>

          {isClickable && (
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-emerald-700 transition-colors">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          )}

          {onDetailClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDetailClick(e);
              }}
              className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 flex items-center justify-center cursor-pointer shadow-2xs ml-0.5 active:scale-90"
              title="Xem chi tiết"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          )}
        </div>
      </div>

      {/* HÀNG 2: 218,19 / 225,18 (Label nhỏ bên dưới: Số bán / Chỉ tiêu) */}
      <div className="pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[16px] sm:text-lg font-black font-arial tracking-tight">
            <span className="text-slate-950 font-bold">{formatVal(actual, isSmall)}</span>
            <span className="text-slate-400 mx-1.5 font-normal">/</span>
            <span className="text-slate-500 font-semibold">{formatVal(target, isSmall)}</span>
          </div>

          {khmhCount !== undefined && khmhCount !== null && (
            <div className="text-[11px] font-bold text-slate-500 font-mono flex items-center gap-1 shrink-0">
              <span className="text-slate-400">KHMH:</span>
              <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/80">
                {khmhCount}
              </span>
            </div>
          )}
        </div>
        <div className="text-[10.5px] sm:text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
          Số bán / Chỉ tiêu
        </div>
      </div>

      {/* HÀNG 3: Progress Bar ngang */}
      <div className="w-full bg-slate-100 h-2.5 sm:h-3 rounded-full overflow-hidden border border-slate-200/90 p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
        />
      </div>

      {/* HÀNG 4: Hiển thị trạng thái (Còn thiếu / Vượt) */}
      <div className="pt-0.5">
        {achieved ? (
          <div className="flex items-center justify-between bg-teal-50/90 border border-teal-200/90 rounded-lg px-2.5 py-1.5 text-teal-900 shadow-2xs">
            <div className="flex items-center gap-1.5 font-black text-[12.5px] sm:text-[13.5px] text-teal-800">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Vượt {formatVal(vuot, isSmall)}</span>
            </div>
            <span className="text-[11px] font-bold text-teal-700 bg-teal-100/80 border border-teal-200/70 px-2 py-0.5 rounded font-mono">
              +{(completionRate - 100).toFixed(1)}%
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-rose-50/90 border border-rose-200/90 rounded-lg px-2.5 py-1.5 text-rose-900 shadow-2xs">
            <div className="flex items-center gap-1.5 font-black text-[12.5px] sm:text-[13.5px] text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Còn thiếu {formatVal(thieu, isSmall || thieu < 0.1)}</span>
            </div>
            {soThungCanBan > 0 ? (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 border border-amber-200/70 px-2 py-0.5 rounded font-mono">
                Cần {soThungCanBan.toLocaleString('vi-VN')} thùng
              </span>
            ) : (
              <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 border border-rose-200/70 px-2 py-0.5 rounded font-mono">
                -{(100 - completionRate).toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>

      {extraInfo}
    </div>
  );
}
