import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  RefreshCw,
  Maximize2,
  Minimize2,
  MousePointer,
  Settings,
  LogOut,
  ChevronDown,
  Hand,
} from 'lucide-react';
import { BaDinhSquareIllustration } from './NationalDay29Theme';

export interface AppHeaderProps {
  activeTab: 'trangchu' | 'doanhso' | 'kichhoat' | 'trungbay' | 'chamcong' | 'thidua' | 'tracuu' | 'taikhoan';
  onOpenMobileMenu: () => void;
  cycleStartDate: string;
  cycleEndDate: string;
  isSyncing: boolean;
  syncTime: string | null;
  onManualSync: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSupervisor: boolean;
  cursorType: 'default' | 'laser' | 'hand';
  onChangeCursorType: (type: 'default' | 'laser' | 'hand') => void;
  totalUnreadNotifications: number;
  onOpenNotificationCenter: () => void;
  isNationalDayTheme: boolean;
  onToggleNationalDayTheme: () => void;
  nationalDayOpacity?: number;
  nationalDayCustomBgUrl?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  headerStylePreset?: string;
  userName: string;
  userRole: string;
  userVtbh?: string;
  userChannel?: string;
  userAvatarUrl?: string;
  activeEmployeeContext?: string;
  onOpenProfileModal: () => void;
  onLogout: () => void;
}

const TAB_TITLES: Record<string, { title: string }> = {
  trangchu: { title: 'Trang chủ' },
  doanhso: { title: 'Số bán & doanh số' },
  kichhoat: { title: 'Kích hoạt' },
  trungbay: { title: 'Trưng bày' },
  thidua: { title: 'Thi đua' },
  chamcong: { title: 'Chấm công & dịch vụ' },
  tracuu: { title: 'Tồn kho' },
  taikhoan: { title: 'Tài khoản' },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  cycleStartDate,
  cycleEndDate,
  isSyncing,
  syncTime,
  onManualSync,
  isFullscreen,
  onToggleFullscreen,
  isSupervisor,
  cursorType,
  onChangeCursorType,
  totalUnreadNotifications,
  onOpenNotificationCenter,
  isNationalDayTheme,
  onToggleNationalDayTheme,
  nationalDayOpacity = 0.5,
  nationalDayCustomBgUrl,
  headerBgColor,
  headerTextColor,
  headerStylePreset,
  userName,
  userRole,
  userVtbh,
  userChannel,
  userAvatarUrl,
  activeEmployeeContext,
  onOpenProfileModal,
  onLogout,
}) => {
  const [isCursorDropdownOpen, setIsCursorDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Maintain --app-header-bottom dynamically for sticky table headers across the app
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

  const currentTabInfo = TAB_TITLES[activeTab] || { title: 'Trang chủ' };

  return (
    <header
      id="app-main-header"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-colors m-0 p-0 pt-[env(safe-area-inset-top,0px)]"
      style={{
        backgroundColor: headerBgColor || undefined,
        backgroundImage:
          !headerBgColor && headerStylePreset && headerStylePreset !== 'emerald_dark'
            ? headerStylePreset === 'midnight_blue'
              ? 'linear-gradient(to right, rgba(15,23,42,0.95), rgba(30,41,59,0.95))'
              : headerStylePreset === 'crimson_gold'
              ? 'linear-gradient(to right, rgba(127,29,29,0.95), rgba(69,10,10,0.95))'
              : headerStylePreset === 'royal_purple'
              ? 'linear-gradient(to right, rgba(59,7,100,0.95), rgba(46,16,101,0.95))'
              : headerStylePreset === 'slate_dark'
              ? 'linear-gradient(to right, rgba(30,41,59,0.95), rgba(15,23,42,0.95))'
              : undefined
            : undefined,
      }}
    >
      {/* Background illustration if National Day Theme is active */}
      <BaDinhSquareIllustration
        enabled={isNationalDayTheme}
        opacity={(nationalDayOpacity || 0.5) * 0.4}
        customImageUrl={nationalDayCustomBgUrl}
      />

      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-3 flex items-center justify-between gap-2 sm:gap-3 relative z-10">
        {/* LEFT SECTION: Mobile Menu Trigger + Current Screen Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden mobile-header-icon-btn w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 flex items-center justify-center shrink-0 active:scale-95 transition-[background-color,border-color,color,transform] cursor-pointer shadow-xs"
            title="Mở menu phân hệ"
            aria-label="Mở menu phân hệ"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1
                style={{ color: headerTextColor || undefined }}
                title={currentTabInfo.title}
                className={`text-base sm:text-xl lg:text-2xl font-bold tracking-tight leading-tight truncate ${
                  !headerTextColor ? 'text-slate-900' : ''
                }`}
              >
                {currentTabInfo.title}
              </h1>
            </div>
            {activeEmployeeContext && activeEmployeeContext !== 'Tất cả' && (
              <p className="md:hidden text-[10.5px] font-bold text-emerald-700 truncate mt-0.5 leading-tight">
                Đang lọc: {activeEmployeeContext}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT SECTION: Utilities & Account Area */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. Presentation Cursor Dropdown (Supervisor only on desktop) */}
          {isSupervisor && (
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setIsCursorDropdownOpen((prev) => !prev)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-[background-color,border-color,color,transform] cursor-pointer select-none border active:scale-95 shadow-xs ${
                  cursorType !== 'default'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-inner'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                }`}
                title="Kiểu con trỏ trình chiếu"
              >
                <MousePointer className="w-4 h-4" />
              </button>

              {isCursorDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[99990] bg-black/5"
                    onClick={() => setIsCursorDropdownOpen(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-[99999] text-xs">
                    <div className="text-[11px] font-semibold text-slate-500 px-2 py-1 border-b border-slate-100 mb-1 flex items-center gap-1.5">
                      <MousePointer className="w-3 h-3 text-emerald-600" />
                      <span>Con trỏ trình chiếu</span>
                    </div>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeCursorType('laser');
                          setIsCursorDropdownOpen(false);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                          cursorType === 'laser'
                            ? 'bg-red-50 text-red-700 border border-red-300'
                            : 'hover:bg-red-50/50 text-slate-700'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0" />
                        <span>1. Laser đỏ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onChangeCursorType('default');
                          setIsCursorDropdownOpen(false);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                          cursorType === 'default'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="w-2 h-2 bg-slate-400 rounded-full shrink-0" />
                        <span>2. Mặc định</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onChangeCursorType('hand');
                          setIsCursorDropdownOpen(false);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                          cursorType === 'hand'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : 'hover:bg-amber-50/50 text-slate-700'
                        }`}
                      >
                        <Hand className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>3. Ngón tay chỉ</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2. Synchronize / Refresh Button */}
          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            className={`mobile-header-icon-btn w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center transition-[background-color,border-color,color,transform] cursor-pointer select-none border ${
              isSyncing
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-inner'
                : 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 active:scale-95'
            }`}
            title={
              isSyncing
                ? 'Đang đồng bộ dữ liệu...'
                : syncTime
                ? `Đồng bộ dữ liệu (${syncTime.replace('Đã đồng bộ lúc: ', '')})`
                : 'Đồng bộ dữ liệu'
            }
            aria-label="Đồng bộ dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* 3. Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-[background-color,border-color,color,transform] cursor-pointer select-none border bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-xs active:scale-95"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* 4. National Day 2/9 Theme Quick Toggle */}
          <button
            type="button"
            onClick={onToggleNationalDayTheme}
            className={`hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-[background-color,border-color,color,transform] cursor-pointer select-none border active:scale-95 shadow-xs ${
              isNationalDayTheme
                ? 'bg-red-600 border-red-500 text-amber-300 shadow-sm ring-2 ring-red-400/30'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300'
            }`}
            title={isNationalDayTheme ? 'Đang bật hình nền Quốc khánh 2/9' : 'Bật hình nền Quốc khánh 2/9'}
          >
            <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-amber-300 shadow-xs shrink-0 flex items-center justify-center bg-[#DA251D]">
              <svg className="w-full h-full" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="200" fill="#DA251D" />
                <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
              </svg>
            </div>
          </button>

          {/* 5. Notification Center Bell Button */}
          <button
            type="button"
            onClick={onOpenNotificationCenter}
            className={`mobile-header-icon-btn relative w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center transition-[background-color,border-color,color,transform] cursor-pointer select-none border active:scale-95 ${
              totalUnreadNotifications > 0
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
            }`}
            title={`Trung tâm thông báo (${totalUnreadNotifications} chưa đọc)`}
            aria-label="Thông báo"
          >
            <Bell className="w-4 h-4" />
            {totalUnreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold font-tabular rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {totalUnreadNotifications > 99 ? '99+' : totalUnreadNotifications}
              </span>
            )}
          </button>

          {/* 6. User Account Avatar / Dropdown Menu */}
          <div className="relative ml-0.5 sm:ml-1">
            <button
              type="button"
              onClick={() => setIsUserDropdownOpen((prev) => !prev)}
              className="flex items-center justify-center gap-1.5 p-1 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-emerald-50/70 hover:border-emerald-300 transition-[background-color,border-color,color,transform] cursor-pointer select-none active:scale-95"
              title={`Tài khoản: ${userName}`}
              aria-label="Tài khoản"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-400/50 bg-emerald-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {userAvatarUrl ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={userAvatarUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userName?.trim().split(' ').pop()?.[0]?.toUpperCase() || 'W'
                )}
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pr-0.5 shrink-0 hidden sm:block" />
            </button>

            {isUserDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[99990] bg-black/5"
                  onClick={() => setIsUserDropdownOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 z-[99999] text-xs">
                  <div className="p-2 border-b border-slate-100 mb-2">
                    <div className="font-bold text-slate-900 text-sm truncate">
                      {userName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                      Vai trò: <strong className="text-emerald-700">{userRole}</strong>
                    </div>
                    {userVtbh && (
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Mã VTBH: <span className="font-mono text-slate-700 font-bold">{userVtbh}</span>
                      </div>
                    )}
                    {userChannel && (
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Kênh: <strong className="text-orange-700">{userChannel}</strong>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfileModal();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-semibold cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Cài đặt tài khoản & hiển thị</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-rose-600 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
