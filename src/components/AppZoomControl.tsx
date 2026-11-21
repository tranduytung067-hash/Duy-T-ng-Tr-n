import React, { useState, useEffect } from 'react';
import { 
  ZoomIn, ZoomOut, RotateCcw,
  Check, SlidersHorizontal
} from 'lucide-react';

export const APP_ZOOM_STORAGE_KEY = 'app_ui_zoom_level';
export const DEFAULT_ZOOM = 1.0;
export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 1.30;
export const ZOOM_STEP = 0.05;

export const ZOOM_PRESETS = [
  { value: 0.85, label: '85%', desc: 'Thu nhỏ', tag: 'Màn hình nhỏ' },
  { value: 0.90, label: '90%', desc: 'Gọn nhẹ', tag: 'Vừa vặn' },
  { value: 1.00, label: '100%', desc: 'Chuẩn', tag: 'Mặc định' },
  { value: 1.10, label: '110%', desc: 'Phóng to', tag: 'Dễ nhìn' },
  { value: 1.20, label: '120%', desc: 'Cực lớn', tag: 'Chữ to' },
];

export const getStoredZoomLevel = (): number => {
  try {
    const saved = localStorage.getItem(APP_ZOOM_STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
        return Math.round(parsed * 100) / 100;
      }
    }
  } catch (e) {
    console.error('Error reading zoom level from localStorage', e);
  }
  return DEFAULT_ZOOM;
};

export const applyZoomToDocument = (zoomVal: number) => {
  const clamped = Math.round(Math.min(Math.max(zoomVal, MIN_ZOOM), MAX_ZOOM) * 100) / 100;
  if (typeof document !== 'undefined') {
    try {
      (document.documentElement.style as any).zoom = String(clamped);
      document.documentElement.style.setProperty('--app-zoom', String(clamped));
    } catch (e) {
      console.warn('Cannot set document zoom', e);
    }
  }
  try {
    localStorage.setItem(APP_ZOOM_STORAGE_KEY, String(clamped));
  } catch (e) {
    console.error('Error storing zoom level', e);
  }
  return clamped;
};

interface AppZoomControlProps {
  variant?: 'card' | 'compact' | 'sheet';
  onZoomChange?: (newZoom: number) => void;
}

export const AppZoomControl: React.FC<AppZoomControlProps> = ({ 
  variant = 'card',
  onZoomChange 
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(() => getStoredZoomLevel());
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  useEffect(() => {
    const current = getStoredZoomLevel();
    setZoomLevel(current);
    applyZoomToDocument(current);
  }, []);

  const handleSetZoom = (newVal: number) => {
    const applied = applyZoomToDocument(newVal);
    setZoomLevel(applied);
    if (onZoomChange) onZoomChange(applied);
    
    // Quick flash saved feedback
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 1200);
  };

  const handleZoomIn = () => {
    const target = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
    handleSetZoom(target);
  };

  const handleZoomOut = () => {
    const target = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
    handleSetZoom(target);
  };

  const handleReset = () => {
    handleSetZoom(DEFAULT_ZOOM);
  };

  const currentPercent = Math.round(zoomLevel * 100);

  const getZoomDescription = () => {
    if (zoomLevel <= 0.85) return 'Thu nhỏ nhiều - Hiển thị nhiều nội dung hơn trên màn hình';
    if (zoomLevel < 1.00) return 'Thu nhỏ vừa - Không gian thoáng, bố cục vừa vặn';
    if (zoomLevel === 1.00) return 'Tỷ lệ tiêu chuẩn 100% của hệ thống';
    if (zoomLevel <= 1.15) return 'Phóng to nhẹ - Chữ và số to rõ, dễ đọc hơn';
    return 'Phóng to tối đa - Tối ưu cho người thích cỡ chữ lớn';
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <span>Thu Phóng Giao Diện</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                Zoom {currentPercent}%
              </span>
            </h4>
          </div>
        </div>

        {/* Reset button if not 100% */}
        {zoomLevel !== DEFAULT_ZOOM && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Đặt lại về mặc định 100%"
          >
            <RotateCcw className="w-3 h-3 text-emerald-600" />
            <span>100%</span>
          </button>
        )}
      </div>

      {/* Main Stepper Control */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          className="flex-1 py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="Thu nhỏ giao diện (-5%)"
        >
          <ZoomOut className="w-4 h-4 text-emerald-700" />
          <span>Thu nhỏ</span>
        </button>

        {/* Current Zoom Indicator */}
        <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-center min-w-[76px] shrink-0">
          <div className="text-sm font-black text-emerald-800 leading-none tabular-nums">
            {currentPercent}%
          </div>
        </div>

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          className="flex-1 py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          title="Phóng to giao diện (+5%)"
        >
          <ZoomIn className="w-4 h-4 text-white" />
          <span>Phóng to</span>
        </button>
      </div>

      {/* Quick Preset Pills */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase px-0.5">
          <span>Mức gợi ý</span>
          {isSavedFeedback && (
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Đã lưu
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {ZOOM_PRESETS.map((preset) => {
            const isSelected = Math.abs(zoomLevel - preset.value) < 0.01;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleSetZoom(preset.value)}
                className={`py-2 px-1 rounded-xl border text-center transition-colors cursor-pointer flex items-center justify-center ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                }`}
              >
                <span className="text-xs font-bold tabular-nums">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
