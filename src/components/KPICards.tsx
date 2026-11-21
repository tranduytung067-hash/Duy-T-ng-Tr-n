import React from 'react';
import { ChevronRight } from 'lucide-react';

interface KPICardsProps {
  totalTarget: number;
  totalActual: number;
  onOpenDetail?: () => void;
}

/**
 * Biểu đồ dạng tròn (Circular Progress Gauge) hiển thị tỷ lệ hoàn thành
 */
const CircularGauge = ({ rate, isOverachieved }: { rate: number; isOverachieved: boolean }) => {
  const radius = 42;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const strokeDashoffset = circumference - (circumference * clampedRate) / 100;

  const strokeColor =
    rate >= 100
      ? 'var(--accent-brand)'
      : rate >= 90
        ? 'var(--accent-teal)'
        : 'var(--accent-danger)';

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg className="w-24 h-24 sm:w-28 sm:h-28 transform -rotate-90" viewBox="0 0 100 100">
        {/* Track circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--bg-surface-muted)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none px-1">
        <span className="text-base sm:text-lg font-bold font-tabular tabular-nums leading-none text-slate-900">
          {rate.toFixed(1)}%
        </span>
        <span
          className={`text-[11px] font-semibold mt-1 leading-none ${
            isOverachieved
              ? 'text-emerald-700'
              : rate >= 90
                ? 'text-teal-700'
                : 'text-rose-600'
          }`}
        >
          {isOverachieved ? 'Vượt' : rate >= 90 ? 'Đạt' : 'Chưa đạt'}
        </span>
      </div>
    </div>
  );
};

export default function KPICards({
  totalTarget,
  totalActual,
  onOpenDetail
}: KPICardsProps) {
  const formatVND = (value: number) => {
    const formatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    return formatted.replace(/\s+/g, '\u00a0');
  };

  let completionRate = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  if (totalTarget > 0 && totalActual < totalTarget) {
    completionRate = Math.min(99.9, Math.floor(completionRate * 10) / 10);
  }
  const deficit = Math.max(0, totalTarget - totalActual);
  const isOverachieved = totalActual >= totalTarget;
  const difference = totalActual - totalTarget;

  return (
    <div id="kpi-cards-section" className="w-full mb-3 sm:mb-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        {/* Header section with Title and Detail Action */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 border-b border-slate-200 pb-3">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
              Tiến độ doanh số
            </h3>
          </div>

          {/* Action Button: Chi Tiết Doanh Số */}
          {onOpenDetail && (
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={onOpenDetail}
                className="min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1 px-3 py-2 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors cursor-pointer shrink-0"
              >
                <span className="sm:hidden">Chi tiết</span>
                <span className="hidden sm:inline">Chi tiết doanh số</span>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
              </button>
            </div>
          )}
        </div>

        {/* Main KPI Summary Strip + Completion Gauge */}
        <div
          id="main-kpi-card"
          className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-6 items-center"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            {/* 1. Mục tiêu */}
            <div className="py-2.5 sm:py-1 sm:pr-4 first:pt-0 sm:first:pt-1 min-w-0">
              <div className="text-slate-500 text-xs font-medium select-none mb-1">
                Mục tiêu
              </div>
              <div
                className="text-base lg:text-lg font-bold text-slate-900 font-tabular tabular-nums leading-snug break-words"
                title={formatVND(totalTarget)}
              >
                {formatVND(totalTarget)}
              </div>
            </div>

            {/* 2. Thực hiện */}
            <div className="py-2.5 sm:py-1 sm:px-4 min-w-0">
              <div className="text-slate-600 text-xs font-medium select-none mb-1">
                Thực hiện
              </div>
              <div
                className="text-base lg:text-lg font-bold text-teal-700 font-tabular tabular-nums leading-snug break-words"
                title={formatVND(totalActual)}
              >
                {formatVND(totalActual)}
              </div>
            </div>

            {/* 3. Vượt / Còn thiếu */}
            <div className="py-2.5 sm:py-1 sm:pl-4 last:pb-0 sm:last:pb-1 min-w-0">
              <div
                className={`text-xs font-medium select-none mb-1 ${
                  isOverachieved ? 'text-emerald-800' : 'text-rose-700'
                }`}
              >
                {isOverachieved ? 'Vượt' : 'Còn thiếu'}
              </div>
              <div
                className={`text-base lg:text-lg font-bold font-tabular tabular-nums leading-snug break-words ${
                  isOverachieved ? 'text-emerald-700' : 'text-rose-600'
                }`}
                title={isOverachieved ? `+${formatVND(difference)}` : `-${formatVND(deficit)}`}
              >
                {isOverachieved ? `+${formatVND(difference)}` : `-${formatVND(deficit)}`}
              </div>
            </div>
          </div>

          {/* Tỷ lệ đạt */}
          <div className="flex flex-col items-center justify-center pt-3 sm:pt-0 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-200">
            <div className="text-xs font-medium text-slate-500 select-none mb-1.5 text-center">
              Tỷ lệ đạt
            </div>
            <CircularGauge rate={completionRate} isOverachieved={isOverachieved} />
          </div>
        </div>
      </div>
    </div>
  );
}
