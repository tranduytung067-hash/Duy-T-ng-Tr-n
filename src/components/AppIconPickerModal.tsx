import React, { useState, useRef } from 'react';
import {
  X,
  Check,
  Sparkles,
  BarChart3,
  TrendingUp,
  Zap,
  Trophy,
  Crown,
  ShieldCheck,
  Flame,
  ShoppingBag,
  Store,
  Building2,
  Globe,
  Wheat,
  Upload,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

export interface AppIconOption {
  id: string;
  name: string;
  category: string;
  gradient: string;
}

export const APP_ICON_OPTIONS: AppIconOption[] = [
  { id: 'layers', name: 'Tầng Lớp (Mặc định)', category: 'Hệ Thống', gradient: 'from-emerald-600 to-teal-700' },
  { id: 'chart', name: 'Biểu Đồ Doanh Số', category: 'Kinh Doanh', gradient: 'from-blue-600 to-indigo-700' },
  { id: 'sparkles', name: 'Marketing & Sáng Tạo', category: 'Marketing', gradient: 'from-amber-500 to-orange-600' },
  { id: 'trending', name: 'Tăng Trưởng Đột Phá', category: 'Kinh Doanh', gradient: 'from-teal-600 to-emerald-700' },
  { id: 'zap', name: 'Tốc Độ & Kích Hoạt', category: 'Kích Hoạt', gradient: 'from-yellow-500 to-amber-600' },
  { id: 'trophy', name: 'Thành Tích & Thi Đua', category: 'Thành Tích', gradient: 'from-amber-600 to-yellow-600' },
  { id: 'crown', name: 'Vị Thế Số 1', category: 'Thương Hiệu', gradient: 'from-yellow-500 to-amber-700' },
  { id: 'shield', name: 'Kỷ Luật & Uy Tín', category: 'Quản Trị', gradient: 'from-emerald-700 to-teal-900' },
  { id: 'flame', name: 'Nhiệt Huyết Wilmar', category: 'Văn Hóa', gradient: 'from-rose-500 to-red-700' },
  { id: 'shopping', name: 'Thương Mại & Tiêu Dùng', category: 'Thương Mại', gradient: 'from-sky-600 to-blue-700' },
  { id: 'store', name: 'Hệ Thống Điểm Bán', category: 'Kênh Bán', gradient: 'from-emerald-600 to-green-700' },
  { id: 'building', name: 'Tập Đoàn Wilmar', category: 'Tổ Chức', gradient: 'from-slate-700 to-slate-900' },
  { id: 'globe', name: 'Thị Trường Toàn Cầu', category: 'Mở Rộng', gradient: 'from-cyan-600 to-blue-700' },
  { id: 'wheat', name: 'Nông Sản & Dầu Thực Vật', category: 'Ngành Hàng', gradient: 'from-amber-500 to-yellow-700' },
];

export const renderAppIconElement = (iconId: string, customUrl?: string, className = 'w-5 h-5 text-white') => {
  if (customUrl && customUrl.trim()) {
    return <img src={customUrl} alt="App Logo" className="w-full h-full object-cover rounded-xl" />;
  }
  switch (iconId) {
    case 'chart':
      return <BarChart3 className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'trending':
      return <TrendingUp className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'trophy':
      return <Trophy className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'shield':
      return <ShieldCheck className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'shopping':
      return <ShoppingBag className={className} />;
    case 'store':
      return <Store className={className} />;
    case 'building':
      return <Building2 className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'wheat':
      return <Wheat className={className} />;
    case 'layers':
    default:
      return <Layers className={className} />;
  }
};

interface AppIconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIconId: string;
  currentCustomUrl?: string;
  onSave: (iconId: string, customUrl?: string) => void;
}

export const AppIconPickerModal: React.FC<AppIconPickerModalProps> = ({
  isOpen,
  onClose,
  currentIconId,
  currentCustomUrl = '',
  onSave,
}) => {
  const [selectedIconId, setSelectedIconId] = useState<string>(currentIconId || 'layers');
  const [customUrl, setCustomUrl] = useState<string>(currentCustomUrl || '');
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const currentOption = APP_ICON_OPTIONS.find((o) => o.id === selectedIconId) || APP_ICON_OPTIONS[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify.warning('Kích thước ảnh tối đa 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCustomUrl(result);
      setActiveTab('custom');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave(selectedIconId, activeTab === 'custom' ? customUrl : '');
    onClose();
  };

  const handleReset = () => {
    setSelectedIconId('layers');
    setCustomUrl('');
    setActiveTab('presets');
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt biểu tượng ứng dụng"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 outline-none"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                Cài Đặt Biểu Tượng Ứng Dụng
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Chọn biểu tượng đại diện cạnh tên WILMAR MARKETING CLV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
          {/* Live Preview Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 text-slate-900 flex items-center justify-between gap-3 border border-slate-200">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${
                  activeTab === 'custom' && customUrl ? 'bg-transparent' : currentOption.gradient
                } flex items-center justify-center shrink-0 shadow-xs border border-slate-200/60`}
              >
                {renderAppIconElement(
                  selectedIconId,
                  activeTab === 'custom' ? customUrl : undefined,
                  'w-5 h-5 text-white'
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black tracking-wider text-slate-900 uppercase truncate">
                    WILMAR MARKETING CLV
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {activeTab === 'custom' && customUrl
                    ? 'Ảnh Logo Tùy Chỉnh'
                    : `${currentOption.name} (${currentOption.category})`}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider shrink-0">
              Xem trước
            </span>
          </div>

          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'presets'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bộ biểu tượng mẫu ({APP_ICON_OPTIONS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tải ảnh / Logo riêng</span>
            </button>
          </div>

          {/* Tab 1: Preset Icons */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {APP_ICON_OPTIONS.map((opt) => {
                const isSelected = selectedIconId === opt.id && (!customUrl || activeTab === 'presets');
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedIconId(opt.id);
                      setCustomUrl('');
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${opt.gradient} flex items-center justify-center shrink-0 shadow-xs`}
                    >
                      {renderAppIconElement(opt.id, undefined, 'w-4 h-4 text-white')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate">{opt.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate">{opt.category}</div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: Custom URL / Image Upload */}
          {activeTab === 'custom' && (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Tải ảnh từ thiết bị
                </label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-emerald-50/30 hover:border-emerald-400 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-2 pb-2 text-center px-4">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <p className="text-xs text-slate-600 font-semibold">Bấm để chọn ảnh logo vuông (PNG, JPG, SVG)</p>
                    <p className="text-[10px] text-slate-400">Tối đa 2MB, tỷ lệ 1:1 tốt nhất</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Hoặc dán đường link ảnh trực tuyến (URL)
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/wilmar-logo.png"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {customUrl && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-emerald-700 font-semibold">Đã tải ảnh thành công</span>
                  <button
                    type="button"
                    onClick={() => setCustomUrl('')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    Xóa ảnh này
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
