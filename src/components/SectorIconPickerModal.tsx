import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, Sparkles, Box, Package, Tag, Droplets, Flame, 
  ShoppingBag, Trophy, Award, Coffee, Milk, Utensils, Wheat, 
  Apple, Fish, Heart, Star, Zap, Shield, CircleDot, Pencil, 
  Check, X, Image as ImageIcon, Upload, Link, Trash2, RefreshCw 
} from 'lucide-react';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

export interface SectorIconConfig {
  iconName?: string;
  colorId?: string;
  imageUrl?: string;
  mode?: 'icon' | 'image';
}

export const AVAILABLE_ICONS: Record<string, { label: string; component: React.ComponentType<{ className?: string }> }> = {
  Layers: { label: 'Các lớp', component: Layers },
  Sparkles: { label: 'Lấp lánh', component: Sparkles },
  Box: { label: 'Thùng hộp', component: Box },
  Package: { label: 'Gói hàng', component: Package },
  Tag: { label: 'Thẻ nhãn', component: Tag },
  Droplets: { label: 'Chất lỏng', component: Droplets },
  Flame: { label: 'Ngọn lửa', component: Flame },
  ShoppingBag: { label: 'Túi hàng', component: ShoppingBag },
  Trophy: { label: 'Cúp vàng', component: Trophy },
  Award: { label: 'Huy chương', component: Award },
  Coffee: { label: 'Cà phê', component: Coffee },
  Milk: { label: 'Sữa bơ', component: Milk },
  Utensils: { label: 'Ẩm thực', component: Utensils },
  Wheat: { label: 'Bột mì / Lúa', component: Wheat },
  Apple: { label: 'Thực phẩm', component: Apple },
  Fish: { label: 'Hải sản', component: Fish },
  Heart: { label: 'Sức khỏe', component: Heart },
  Star: { label: 'Ngôi sao', component: Star },
  Zap: { label: 'Năng lượng', component: Zap },
  Shield: { label: 'Bảo vệ', component: Shield },
  CircleDot: { label: 'Mục tiêu', component: CircleDot },
};

export const COLOR_THEMES: Record<string, { label: string; bgClass: string; textClass: string; dotClass: string; borderClass: string }> = {
  indigo: { label: 'Tím Indigo', bgClass: 'bg-indigo-50', textClass: 'text-indigo-600', dotClass: 'bg-indigo-500', borderClass: 'border-indigo-200' },
  rose: { label: 'Hồng Rose', bgClass: 'bg-rose-50', textClass: 'text-rose-600', dotClass: 'bg-rose-500', borderClass: 'border-rose-200' },
  blue: { label: 'Xanh Blue', bgClass: 'bg-blue-50', textClass: 'text-blue-600', dotClass: 'bg-blue-500', borderClass: 'border-blue-200' },
  emerald: { label: 'Xanh Lá', bgClass: 'bg-emerald-50', textClass: 'text-emerald-600', dotClass: 'bg-emerald-500', borderClass: 'border-emerald-200' },
  amber: { label: 'Vàng Amber', bgClass: 'bg-amber-50', textClass: 'text-amber-600', dotClass: 'bg-amber-500', borderClass: 'border-amber-200' },
  cyan: { label: 'Xanh Cyan', bgClass: 'bg-cyan-50', textClass: 'text-cyan-600', dotClass: 'bg-cyan-500', borderClass: 'border-cyan-200' },
  orange: { label: 'Cam Orange', bgClass: 'bg-orange-50', textClass: 'text-orange-600', dotClass: 'bg-orange-500', borderClass: 'border-orange-200' },
  purple: { label: 'Tím Đậm', bgClass: 'bg-purple-50', textClass: 'text-purple-600', dotClass: 'bg-purple-500', borderClass: 'border-purple-200' },
};

export const SECTOR_ICON_STORAGE_KEY = 'custom_sector_icons_v1';

export const getStoredSectorIcons = (): Record<string, SectorIconConfig> => {
  try {
    const raw = localStorage.getItem(SECTOR_ICON_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading custom sector icons from localStorage', e);
  }
  return {};
};

export const saveStoredSectorIcon = (categoryKey: string, config: SectorIconConfig) => {
  try {
    const current = getStoredSectorIcons();
    current[categoryKey.trim()] = config;
    localStorage.setItem(SECTOR_ICON_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Error saving custom sector icon to localStorage', e);
  }
};

export const getDefaultSectorIconConfig = (category: string): SectorIconConfig => {
  const cat = (category || '').toUpperCase().trim();
  if (cat.includes('CLF')) return { iconName: 'Layers', colorId: 'indigo', mode: 'icon' };
  if (cat.includes('MCC')) return { iconName: 'Sparkles', colorId: 'rose', mode: 'icon' };
  if (cat.includes('NDFC')) return { iconName: 'Box', colorId: 'blue', mode: 'icon' };
  if (cat.includes('GẠO') || cat.includes('GAO')) return { iconName: 'Package', colorId: 'amber', mode: 'icon' };
  if (cat.includes('GIA VỊ') || cat.includes('GIA VI')) return { iconName: 'Tag', colorId: 'emerald', mode: 'icon' };
  if (cat.includes('NƯỚC MẮM') || cat.includes('NUOC MAM')) return { iconName: 'Droplets', colorId: 'cyan', mode: 'icon' };
  if (cat.includes('CÀ PHÊ') || cat.includes('CA PHE')) return { iconName: 'Flame', colorId: 'orange', mode: 'icon' };
  if (cat.includes('BỘT MÌ') || cat.includes('BOT MI') || cat.includes('VFM')) return { iconName: 'Wheat', colorId: 'amber', mode: 'icon' };
  if (cat.includes('BƠ') || cat.includes('BO')) return { iconName: 'Milk', colorId: 'amber', mode: 'icon' };
  if (cat.includes('SIMPLY') || cat.includes('NEPTUNE')) return { iconName: 'Award', colorId: 'emerald', mode: 'icon' };
  return { iconName: 'Package', colorId: 'emerald', mode: 'icon' };
};

export const getSectorIconConfig = (category: string, customMap: Record<string, SectorIconConfig>): SectorIconConfig => {
  const cleanKey = (category || '').trim();
  if (customMap[cleanKey]) {
    return customMap[cleanKey];
  }
  return getDefaultSectorIconConfig(cleanKey);
};

// Image Compression Helper: resizes to max 256x256 and converts to lightweight Base64 string
export const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Try WebP first for optimal compression, fallback to JPEG
        try {
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          resolve(dataUrl);
        } catch {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        }
      };
      img.onerror = () => reject(new Error('Không thể tải hình ảnh'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file'));
    reader.readAsDataURL(file);
  });
};

export interface SectorIconCircleProps {
  category: string;
  customMap?: Record<string, SectorIconConfig>;
  size?: 'sm' | 'md' | 'lg';
  showEditBtn?: boolean;
  onEditClick?: (category: string) => void;
}

export const SectorIconCircle: React.FC<SectorIconCircleProps> = ({
  category,
  customMap = {},
  size = 'md',
  showEditBtn = true,
  onEditClick,
}) => {
  const config = getSectorIconConfig(category, customMap);
  const isImageMode = config.mode === 'image' && !!config.imageUrl;
  const theme = COLOR_THEMES[config.colorId || 'emerald'] || COLOR_THEMES.emerald;
  const IconDef = AVAILABLE_ICONS[config.iconName || 'Package']?.component || Package;

  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11 sm:w-12 sm:h-12',
    lg: 'w-13 h-13',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      {isImageMode ? (
        <div 
          className={`${sizeClasses[size]} rounded-full bg-white border border-slate-200/90 flex items-center justify-center shadow-2xs overflow-hidden p-0.5 transition-transform duration-150 hover:scale-105`}
        >
          <img
            src={config.imageUrl}
            alt={category}
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div 
          className={`${sizeClasses[size]} rounded-full ${theme.bgClass} border ${theme.borderClass} flex items-center justify-center shadow-2xs transition-transform duration-150 hover:scale-105`}
        >
          <IconDef className={`${iconSizes[size]} ${theme.textClass}`} />
        </div>
      )}

      {showEditBtn && onEditClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(category);
          }}
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-300 shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-all cursor-pointer active:scale-90 z-10"
          title={`Đổi biểu tượng/hình ảnh cho ${category}`}
        >
          <Pencil className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
};

export interface SectorIconPickerModalProps {
  isOpen: boolean;
  category: string;
  customMap: Record<string, SectorIconConfig>;
  onClose: () => void;
  onSave: (category: string, config: SectorIconConfig) => void;
  isSupervisor?: boolean;
}

export const SectorIconPickerModal: React.FC<SectorIconPickerModalProps> = ({
  isOpen,
  category,
  customMap,
  onClose,
  onSave,
  isSupervisor = true,
}) => {
  const [activeTab, setActiveTab] = useState<'icon' | 'image'>('icon');
  const [selectedIcon, setSelectedIcon] = useState<string>('Package');
  const [selectedColor, setSelectedColor] = useState<string>('emerald');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  useEffect(() => {
    if (isOpen && category) {
      const current = getSectorIconConfig(category, customMap);
      if (current.mode === 'image' && current.imageUrl) {
        setActiveTab('image');
        setCustomImageUrl(current.imageUrl);
        setUrlInput(current.imageUrl.startsWith('data:') ? '' : current.imageUrl);
      } else {
        setActiveTab('icon');
        setSelectedIcon(current.iconName || 'Package');
        setSelectedColor(current.colorId || 'emerald');
        setCustomImageUrl(current.imageUrl || '');
      }
    }
  }, [isOpen, category, customMap]);

  if (!isOpen) return null;

  const currentTheme = COLOR_THEMES[selectedColor] || COLOR_THEMES.emerald;
  const CurrentIconComp = AVAILABLE_ICONS[selectedIcon]?.component || Package;

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify.warning('Vui lòng chọn file hình ảnh (PNG, JPG, WEBP, SVG,...)');
      return;
    }
    setIsProcessingFile(true);
    try {
      const compressed = await compressImageFile(file);
      setCustomImageUrl(compressed);
      setActiveTab('image');
    } catch (err) {
      console.error('Error compressing image:', err);
      notify.error('Không thể xử lý hình ảnh này. Vui lòng thử hình khác!');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setCustomImageUrl(urlInput.trim());
    setActiveTab('image');
  };

  const handleSave = () => {
    if (activeTab === 'image' && customImageUrl) {
      onSave(category, {
        mode: 'image',
        imageUrl: customImageUrl,
        iconName: selectedIcon,
        colorId: selectedColor,
      });
    } else {
      onSave(category, {
        mode: 'icon',
        iconName: selectedIcon,
        colorId: selectedColor,
        imageUrl: customImageUrl || undefined,
      });
    }
    onClose();
  };

  return (
    <div 
      className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Tùy chỉnh biểu tượng ${category}`}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-4 space-y-3.5 overflow-hidden max-h-[90vh] flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Pencil className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Tùy chỉnh biểu tượng</h3>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                Đối tượng: <span className="font-bold text-emerald-700">{category}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="flex flex-col items-center justify-center py-2.5 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
          {activeTab === 'image' && customImageUrl ? (
            <div className="w-14 h-14 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shadow-xs overflow-hidden p-0.5">
              <img 
                src={customImageUrl} 
                alt={category} 
                className="w-full h-full object-cover rounded-full" 
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className={`w-14 h-14 rounded-full ${currentTheme.bgClass} border ${currentTheme.borderClass} flex items-center justify-center shadow-xs`}>
              <CurrentIconComp className={`w-7 h-7 ${currentTheme.textClass}`} />
            </div>
          )}
          <span className="text-[11px] text-slate-700 font-bold mt-1.5 uppercase tracking-tight">{category}</span>
          <span className="text-[10px] text-emerald-600 font-medium">
            {activeTab === 'image' && customImageUrl ? 'Đang dùng hình ảnh tùy chỉnh' : 'Đang dùng biểu tượng mẫu'}
          </span>
        </div>

        {/* Navigation Tabs (Biểu tượng mẫu / Chèn hình ảnh) */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('icon')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'icon' 
                ? 'bg-white text-emerald-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Biểu tượng mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'image' 
                ? 'bg-white text-emerald-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Chèn hình ảnh</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-0.5">
          {activeTab === 'icon' ? (
            <>
              {/* Color Palette */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Màu sắc nền</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COLOR_THEMES).map(([key, theme]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedColor(key)}
                      className={`w-6 h-6 rounded-full ${theme.dotClass} flex items-center justify-center transition-all cursor-pointer ${
                        selectedColor === key ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={theme.label}
                    >
                      {selectedColor === key && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Grid */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Chọn biểu tượng</label>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                  {Object.entries(AVAILABLE_ICONS).map(([key, item]) => {
                    const Comp = item.component;
                    const isSelected = selectedIcon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedIcon(key)}
                        className={`p-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected 
                            ? `${currentTheme.bgClass} border-2 ${currentTheme.borderClass} ${currentTheme.textClass} shadow-xs scale-105` 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={item.label}
                      >
                        <Comp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {/* File Upload Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50/60' 
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-slate-50'
                }`}
              >
                {isProcessingFile ? (
                  <div className="flex items-center gap-2 text-emerald-700 py-2 font-medium text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang nén và xử lý ảnh...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Tải ảnh từ máy / điện thoại</p>
                      <p className="text-[10px] text-slate-500">Chạm để chọn hoặc kéo thả ảnh vào đây</p>
                    </div>
                  </>
                )}
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">Hoặc dán Link URL ảnh</label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Link className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Dán
                  </button>
                </div>
              </div>

              {/* Remove Custom Image button if exists */}
              {customImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomImageUrl('');
                    setUrlInput('');
                    setActiveTab('icon');
                  }}
                  className="w-full py-1.5 px-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ảnh tùy chỉnh, quay lại biểu tượng mẫu</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Lưu & Đồng bộ
          </button>
        </div>
      </div>
    </div>
  );
};
