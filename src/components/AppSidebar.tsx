import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  BarChart3,
  Zap,
  Store,
  Trophy,
  Calendar,
  Warehouse,
  Users,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ZoomIn,
  Settings,
  LogOut,
  Flag,
  Palette,
  ChevronDown,
} from 'lucide-react';
import { AppZoomControl } from './AppZoomControl';
import { useDialogFocus } from '../utils/useDialogFocus';
import { renderAppIconElement, APP_ICON_OPTIONS } from './AppIconPickerModal';

export interface AppSidebarProps {
  activeTab: 'trangchu' | 'doanhso' | 'kichhoat' | 'trungbay' | 'chamcong' | 'thidua' | 'tracuu' | 'taikhoan';
  onSelectTab: (tab: 'trangchu' | 'doanhso' | 'kichhoat' | 'trungbay' | 'chamcong' | 'thidua' | 'tracuu' | 'taikhoan') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isSupervisor: boolean;
  userRole: string;
  userName: string;
  userVtbh?: string;
  userAvatarUrl?: string;
  canSendZalo: boolean;
  onOpenMonthlyReport: () => void;
  onOpenZaloShare: () => void;
  onOpenProfileModal: () => void;
  isNationalDayTheme: boolean;
  onToggleNationalDayTheme: () => void;
  onLogout: () => void;
  appLogoIcon?: string;
  appLogoCustomUrl?: string;
  onOpenIconPicker?: () => void;
}

interface MenuItem {
  id: 'trangchu' | 'doanhso' | 'kichhoat' | 'trungbay' | 'chamcong' | 'thidua' | 'tracuu' | 'taikhoan';
  label: string;
  shortLabel?: string;
  icon: React.ElementType;
  badge?: string;
  visible?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  isSupervisor,
  userRole,
  userName,
  userAvatarUrl,
  onOpenMonthlyReport,
  onOpenProfileModal,
  isNationalDayTheme,
  onToggleNationalDayTheme,
  onLogout,
  appLogoIcon = 'layers',
  appLogoCustomUrl = '',
  onOpenIconPicker,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isMobileOpen, drawerRef, onCloseMobile);
  useDialogFocus(isZoomModalOpen, zoomRef, () => setIsZoomModalOpen(false));

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  // Main menu items list
  const menuItems: MenuItem[] = [
    {
      id: 'trangchu',
      label: 'Trang Chủ',
      icon: Home,
    },
    {
      id: 'doanhso',
      label: 'Số Bán & Doanh Số',
      icon: BarChart3,
    },
    {
      id: 'kichhoat',
      label: 'Kích Hoạt',
      icon: Zap,
    },
    {
      id: 'trungbay',
      label: 'Trưng Bày',
      icon: Store,
    },
    {
      id: 'thidua',
      label: 'Thi Đua',
      icon: Trophy,
    },
    {
      id: 'chamcong',
      label: 'Chấm Công & Dịch Vụ',
      shortLabel: 'Chấm Công',
      icon: Calendar,
    },
    {
      id: 'tracuu',
      label: 'Tồn Kho',
      icon: Warehouse,
      visible: isSupervisor,
    },
    {
      id: 'taikhoan',
      label: 'Tài Khoản',
      icon: Users,
      visible: userRole === 'Admin',
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => item.visible !== false);
  const activeIconConfig = APP_ICON_OPTIONS.find((o) => o.id === appLogoIcon) || APP_ICON_OPTIONS[0];

  const renderNavContent = (isMobileView: boolean = false) => {
    const collapsed = !isMobileView && isCollapsed;

    return (
      <div className="flex flex-col h-full select-none text-slate-700 bg-white">
        {/* TOP BRAND / LOGO AREA */}
        <div
          className={`shrink-0 flex items-center border-b border-slate-200 transition-colors duration-200 ${
            collapsed ? 'h-16 px-2 justify-center' : 'h-16 px-4 justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* App Logo Icon with customizable picker trigger */}
            <button
              type="button"
              onClick={onOpenIconPicker}
              title="Cài đặt biểu tượng ứng dụng (Bấm để đổi)"
              className={`rounded-xl flex items-center justify-center shrink-0 border border-emerald-600/20 cursor-pointer group relative overflow-hidden ${
                appLogoCustomUrl
                  ? 'w-11 h-11'
                  : `w-11 h-11 bg-gradient-to-br ${activeIconConfig.gradient} text-white font-bold text-sm`
              }`}
            >
              {renderAppIconElement(appLogoIcon, appLogoCustomUrl, 'w-5 h-5 text-white')}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-white/95 text-slate-700 rounded-tl-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Palette className="w-2.5 h-2.5 text-emerald-600" />
              </span>
            </button>

            {/* Brand Title (hidden when collapsed) */}
            {!collapsed && (
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-bold text-slate-900" title="Wilmar">
                    Wilmar
                  </span>
                </div>
                <div className="text-xs font-semibold leading-none mt-1 text-emerald-800" title="Marketing CLV">
                  Marketing CLV
                </div>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          {isMobileView && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="min-w-[44px] min-h-[44px] rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Đóng menu"
              title="Đóng menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* NAVIGATION MENUS LIST */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-1 no-scrollbar">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (isMobileView) onCloseMobile();
                    setIsMoreMenuOpen(false);
                  }}
                  className={`w-full flex items-center transition-colors duration-150 cursor-pointer text-left relative ${
                    collapsed
                      ? 'min-h-[44px] h-11 justify-center rounded-xl px-0'
                      : 'min-h-[44px] h-11 px-3 gap-3 rounded-xl'
                  } ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/70'
                  }`}
                >
                  {/* Left Active Indicator */}
                  {isActive && !collapsed && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white" />
                  )}

                  {/* Icon */}
                  <div
                    className={`shrink-0 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-500 group-hover:text-emerald-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Text Label */}
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span
                        className={`text-[13px] truncate ${
                          isActive
                            ? 'font-semibold text-white'
                            : 'font-medium text-slate-700 group-hover:text-emerald-900'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none shrink-0 ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Hover Tooltip when Collapsed on Desktop */}
                {collapsed && (
                  <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-md border border-slate-800 whitespace-nowrap z-[99999] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1 bg-emerald-500/30 text-emerald-300 rounded">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* MENU "THÊM" (SECONDARY UTILITIES) */}
          <div className="relative group pt-1" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={`w-full flex items-center transition-colors duration-150 cursor-pointer text-left relative ${
                collapsed
                  ? 'min-h-[44px] h-11 justify-center rounded-xl px-0'
                  : 'min-h-[44px] h-11 px-3 gap-3 rounded-xl'
              } ${
                isMoreMenuOpen
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                  : 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/70'
              }`}
            >
              <div className={`shrink-0 ${isMoreMenuOpen ? 'text-emerald-700' : 'text-slate-500 group-hover:text-emerald-700'}`}>
                <LayoutGrid className="w-5 h-5" />
              </div>

              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className={`text-[13px] truncate ${
                    isMoreMenuOpen
                      ? 'font-semibold text-emerald-900'
                      : 'font-medium text-slate-700 group-hover:text-emerald-900'
                  }`}>
                    Thêm
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isMoreMenuOpen ? 'rotate-180 text-emerald-700' : 'text-slate-400'
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Hover Tooltip for "Thêm" when Collapsed */}
            {collapsed && !isMoreMenuOpen && (
              <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-md border border-slate-800 whitespace-nowrap z-[99999] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                Thêm tiện ích
              </div>
            )}

            {/* POPUP / POPOVER MENU FOR "THÊM" */}
            {isMoreMenuOpen && (
              <div
                className={`absolute z-[99999] rounded-xl shadow-lg p-2 text-xs bg-white border border-slate-200 text-slate-700 ${
                  collapsed
                    ? 'left-full bottom-0 ml-3 w-56'
                    : 'left-2 right-2 bottom-full mb-2'
                }`}
              >
                <div className="px-2 py-1 mb-1 flex items-center justify-between text-xs font-bold border-b border-slate-200 text-slate-800">
                  <span>Tiện ích mở rộng</span>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(false)}
                    aria-label="Đóng"
                    className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center cursor-pointer rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {/* Báo Cáo Tháng */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMonthlyReport();
                      setIsMoreMenuOpen(false);
                      if (isMobileView) onCloseMobile();
                    }}
                    className="w-full min-h-[44px] sm:min-h-[38px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <FileText className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="font-semibold truncate">Báo Cáo Tháng</span>
                  </button>

                  {/* Thu Phóng (Zoom) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsZoomModalOpen(true);
                      setIsMoreMenuOpen(false);
                      if (isMobileView) onCloseMobile();
                    }}
                    className="w-full min-h-[44px] sm:min-h-[38px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <ZoomIn className="w-4 h-4 shrink-0 text-slate-600" />
                    <span className="font-semibold truncate">Thu Phóng Giao Diện</span>
                  </button>

                  {/* Chủ Đề Quốc Khánh 2/9 */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleNationalDayTheme();
                    }}
                    className="w-full min-h-[44px] sm:min-h-[38px] flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Flag className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-semibold truncate">Chủ Đề 2/9</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isNationalDayTheme
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isNationalDayTheme ? 'Bật' : 'Tắt'}
                    </span>
                  </button>

                  {/* Cài Đặt Biểu Tượng App */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenIconPicker?.();
                      setIsMoreMenuOpen(false);
                      if (isMobileView) onCloseMobile();
                    }}
                    className="w-full min-h-[44px] sm:min-h-[38px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <Palette className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="font-semibold truncate">Biểu Tượng Logo App</span>
                  </button>

                  {/* Cài Đặt Giao Diện & Tài Khoản */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfileModal();
                      setIsMoreMenuOpen(false);
                      if (isMobileView) onCloseMobile();
                    }}
                    className="w-full min-h-[44px] sm:min-h-[38px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                    <span className="font-semibold truncate">Cài Đặt & Giao Diện</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM USER INFO & COLLAPSE TOGGLE */}
        <div className="shrink-0 border-t p-2 space-y-1.5 border-slate-200 bg-white">
          {/* User mini badge */}
          {!collapsed ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl border bg-slate-50 border-slate-200">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-xs bg-emerald-600 border border-emerald-500/30">
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
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate leading-tight text-slate-900">
                  {userName}
                </div>
                <div className="text-[11px] font-medium truncate mt-0.5 text-slate-500">
                  {userRole === 'Admin' ? 'Giám Sát Thị Trường' : userRole}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="w-11 h-11 rounded-xl overflow-hidden bg-emerald-600 border border-emerald-500/30 flex items-center justify-center font-bold text-white text-xs hover:ring-2 hover:ring-emerald-500 transition-shadow cursor-pointer"
                title={`Tài khoản: ${userName} (${userRole})`}
              >
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
              </button>
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          {!isMobileView && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`w-full flex items-center justify-center gap-2 min-h-[44px] h-11 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-xs font-medium ${
                collapsed ? 'px-0' : 'px-3'
              }`}
              title={collapsed ? 'Mở rộng thanh menu' : 'Thu gọn menu'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                  <span className="text-xs truncate">Thu gọn menu</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* DESKTOP SIDEBAR: Fixed/Sticky on the Left - White Background */}
      <aside
        id="app-desktop-sidebar"
        className={`hidden md:block sticky top-0 h-screen shrink-0 z-40 bg-white border-r border-slate-200 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-[230px] lg:w-[240px]'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {/* MOBILE DRAWER: Slide-in overlay from the Left - Light White Background */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-[99998] flex">
          {/* Backdrop */}
          <div
            className="app-modal-overlay fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
          />

          {/* Drawer Container */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu chính"
            tabIndex={-1}
            className="relative w-[280px] max-w-[85vw] h-full bg-white border-r border-slate-200 z-[99999] shadow-lg flex flex-col"
          >
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Zoom Control Modal popup when triggered from "Thêm" */}
      {isZoomModalOpen && (
        <div className="app-modal-overlay fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div
            ref={zoomRef}
            role="dialog"
            aria-modal="true"
            aria-label="Thu phóng giao diện"
            tabIndex={-1}
            className="bg-white border border-slate-200 rounded-2xl p-5 max-w-sm w-full shadow-lg text-slate-800"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Thu phóng màn hình
                </h3>
              </div>
              <button
                type="button"
                aria-label="Đóng thu phóng giao diện"
                onClick={() => setIsZoomModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-2">
              <AppZoomControl />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                aria-label="Đóng thu phóng giao diện"
                onClick={() => setIsZoomModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                Đã Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppSidebar;
