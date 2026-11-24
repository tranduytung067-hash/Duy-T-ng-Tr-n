import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Sliders,
  Calendar,
  Users,
  User,
  AlertTriangle,
  CheckCircle2,
  Lock,
  LockOpen,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Camera,
  Edit2,
  LogOut,
  ChevronDown,
  ChevronUp,
  MousePointer,
  Settings,
  Image as ImageIcon,
  Upload,
  Trash2,
  FileOutput,
  MessageSquare,
  BadgeCheck,
  Search,
  Trophy,
  Award,
  Warehouse,
  DollarSign,
  Coins,
  Shield,
  Flag,
  Zap,
  Store,
  LayoutGrid,
  X,
  Package,
  Check,
  Home,
  ArrowLeft,
  Bell,
  Palette,
} from 'lucide-react';

import { UserProfile, EmployeeTargetRow, SoBanRaw, SheetDataState, UserPermission, UserRole, TuNhienRecord, MeizanRecord } from './types';
import { mockEmployees, mockTransactions, mockPermissions, mockActivationListData, mockTrungBayListData, mockChamCongListData } from './mockData';
import { extractSheetId, loadGoogleSheetData, sortAndFormatEmployeeNames } from './utils/sheetParser';
import { getCachedSheetData } from './utils/sheetCache';
import { getSalesCycleDates } from './utils/cycleHelper';
import { notify, ToastItem } from './utils/notify';
import { useDialogFocus } from './utils/useDialogFocus';
import { 
  db, 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  getDoc, 
  saveUserPermissionToFirestore, 
  deleteUserPermissionFromFirestore, 
  handleFirestoreError, 
  OperationType, 
  saveThemeSettingsToFirestore, 
  subscribeThemeSettingsFromFirestore 
} from './firebase';

import LoginScreen from './components/LoginScreen';

import HomeOverview from './components/HomeOverview';
import KPICards from './components/KPICards';
import { ActivationRates } from './components/Charts';
import EmployeeTable, { EmployeeActivationTable } from './components/EmployeeTable';
import TargetAnalysis from './components/TargetAnalysis';
import CttbProgress from './components/CttbProgress';
import AttendanceSystem from './components/AttendanceSystem';
import AccountManager from './components/AccountManager';
import MonthlyReportModal from './components/MonthlyReportModal';
import ZaloShareModal from './components/ZaloShareModal';
import InventoryLookup from './components/InventoryLookup';
import ThiDuaModule from './components/ThiDuaModule';
import { subscribeCompetitionPrograms, syncCompetitionProgramsFromServer } from './utils/competitionService';
import { NationalDay29Background, NationalDay29HeaderBanner, BaDinhSquareIllustration } from './components/NationalDay29Theme';
import { NotificationCenterModal, AppNotification } from './components/NotificationCenterModal';
import { AppZoomControl } from './components/AppZoomControl';
import { AppSidebar } from './components/AppSidebar';
import { AppHeader } from './components/AppHeader';
import { AppIconPickerModal } from './components/AppIconPickerModal';

const getEmployeeNameFromEmail = (email: string, employeeNames: string[]): string => {
  if (!email) return 'Tất cả';
  const emailLower = email.toLowerCase().trim();
  if (emailLower === 'tungluu1992ab@gmail.com') {
    return 'Tất cả';
  }

  const prefix = emailLower.split('@')[0];
  
  // Normalize string: accents, spaces, special chars
  const normalize = (str: string) => {
    return str
      .normalize('NFD') // decomposes characters with accents
      .replace(/[\u0300-\u036f]/g, '') // removes accent marks
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  };

  const normPrefix = normalize(prefix);
  
  // Try exact Match first on normalized name list
  for (const name of employeeNames) {
    const normName = normalize(name);
    if (normPrefix === normName) {
      return name;
    }
  }

  // Try substring matching
  let bestMatch = '';
  let maxMatchLen = 0;
  for (const name of employeeNames) {
    const normName = normalize(name);
    if (normPrefix.includes(normName) || normName.includes(normPrefix)) {
      if (normName.length > maxMatchLen) {
        maxMatchLen = normName.length;
        bestMatch = name;
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // Try matching initials (e.g., "lh" for "Lê Hoàng")
  for (const name of employeeNames) {
    const initials = name
      .split(/\s+/)
      .map(word => normalize(word).charAt(0))
      .join('');
    if (normPrefix === initials) {
      return name;
    }
  }

  // Fallback: If no match is found, retrieve the first employee name
  return employeeNames[0] || 'Tập Sự';
};

export default function App() {
  // Session authentication state
  const [loggedInUser, setLoggedInUser] = useState<UserPermission | null>(() => {
    const savedLocal = localStorage.getItem('logged_in_user');
    const savedSession = sessionStorage.getItem('logged_in_user');
    const userToVerify = savedLocal ? JSON.parse(savedLocal) : (savedSession ? JSON.parse(savedSession) : null);
    
    if (userToVerify) {
      const savedPerms = localStorage.getItem('gs_permissions');
      const perms: UserPermission[] = savedPerms ? JSON.parse(savedPerms) : [];
      const permUser = perms.find(p => p.email.toLowerCase().trim() === userToVerify.email.toLowerCase().trim());
      if (permUser) {
        const isUserLocked = !!permUser.locked || 
                             (permUser as any).locked === 'true' || 
                             (permUser as any).locked === 'TRUE' || 
                             (typeof (permUser as any).locked === 'string' && String((permUser as any).locked).toLowerCase().trim() === 'true');
        if (isUserLocked) {
          localStorage.removeItem('logged_in_user');
          sessionStorage.removeItem('logged_in_user');
          return null;
        }
      }
    }
    return userToVerify;
  });

  // Persistence state
  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem('gs_sheet_url') || 'https://docs.google.com/spreadsheets/d/1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c/edit?gid=1104777360#gid=1104777360';
  });
  const [connectedId, setConnectedId] = useState<string | null>(() => {
    return localStorage.getItem('gs_sheet_id') || '1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c';
  });

  // Data states
  const [employees, setEmployees] = useState<EmployeeTargetRow[]>(mockEmployees);
  const [transactions, setTransactions] = useState<SoBanRaw[]>(mockTransactions);
   const [permissions, setPermissions] = useState<UserPermission[]>(() => {
    const saved = localStorage.getItem('gs_permissions');
    let list: UserPermission[] = saved ? JSON.parse(saved) : [...mockPermissions];
    
    // Check and sync lamhv.hoabinh@gmail.com credentials in permission list
    const idx = list.findIndex(p => p.email.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com');
    if (idx === -1) {
      list.push({
        email: 'lamhv.hoabinh@gmail.com',
        role: 'OM',
        password: '123123123',
        mappedEmployee: ''
      });
      localStorage.setItem('gs_permissions', JSON.stringify(list));
    } else {
      const user = list[idx];
      if (user.role !== 'OM') {
        list[idx] = {
          ...user,
          role: 'OM',
          password: '123123123'
        };
        localStorage.setItem('gs_permissions', JSON.stringify(list));
      }
    }
    return list;
  });
  const [sectorData, setSectorData] = useState<SheetDataState['sectorData']>(undefined);
  const [cttbData, setCttbData] = useState<SheetDataState['cttbData']>(undefined);
  const [growthData, setGrowthData] = useState<SheetDataState['growthData']>(undefined);
  const [annualBonusData, setAnnualBonusData] = useState<SheetDataState['annualBonusData']>(undefined);
  const [tuNhienRecords, setTuNhienRecords] = useState<TuNhienRecord[]>([]);
  const [meizanRecords, setMeizanRecords] = useState<MeizanRecord[]>([]);
  const [activationListData, setActivationListData] = useState<any[]>(mockActivationListData);
  const [trungBayListData, setTrungBayListData] = useState<any[]>(mockTrungBayListData);
  const [clfDetailedRows, setClfDetailedRows] = useState<any[]>([]);
  const [mccDetailedRows, setMccDetailedRows] = useState<any[]>([]);
  const [ndfcDetailedRows, setNdfcDetailedRows] = useState<any[]>([]);
  const [chamCongListData, setChamCongListData] = useState<any[]>(mockChamCongListData);
  const [activeTab, setActiveTab] = useState<'trangchu' | 'doanhso' | 'kichhoat' | 'trungbay' | 'chamcong' | 'thidua' | 'tracuu' | 'taikhoan'>(() => {
    const saved = localStorage.getItem('fmcg_active_tab') || sessionStorage.getItem('fmcg_active_tab');
    if (saved && ['trangchu', 'doanhso', 'kichhoat', 'trungbay', 'chamcong', 'thidua', 'tracuu', 'taikhoan'].includes(saved)) {
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && saved === 'trangchu') {
        return 'doanhso';
      }
      return saved as any;
    }
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'trangchu' : 'doanhso';
  });

  useEffect(() => {
    localStorage.setItem('fmcg_active_tab', activeTab);
    sessionStorage.setItem('fmcg_active_tab', activeTab);
  }, [activeTab]);

  const [pendingLeaveCount, setPendingLeaveCount] = useState<number>(0);
  const [allLeaveRequests, setAllLeaveRequests] = useState<any[]>([]);
  const [allMarketEvaluations, setAllMarketEvaluations] = useState<any[]>([]);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [attendanceTargetSubTab, setAttendanceTargetSubTab] = useState<'chamcong' | 'dichvuthitruong' | 'thoigianviengtham' | undefined>(undefined);
  const [attendanceTargetLeaveId, setAttendanceTargetLeaveId] = useState<string | null>(null);
  const [attendanceTargetEvalId, setAttendanceTargetEvalId] = useState<string | null>(null);

  // Subscribe to leave_requests to sync full list for Notification Center & real-time updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'leave_requests'), (snapshot) => {
      let pending = 0;
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = { id: docSnap.id, ...data };
        list.push(item);
        if (data && (data.status === 'Chờ duyệt' || !data.status)) {
          pending++;
        }
      });
      setAllLeaveRequests(list);
      setPendingLeaveCount(pending);
    }, (err) => {
      console.warn('Lỗi đăng ký nhận phiếu nghỉ phép:', err);
    });
    return () => unsubscribe();
  }, []);
  
  const now = new Date();
  const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
  const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultAttendanceCycle = `${currentActiveYear}-${currentActiveMonth}`;
  const [attendanceSelectedCycle, setAttendanceSelectedCycle] = useState<string>(defaultAttendanceCycle);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSalesSubMenuOpen, setIsSalesSubMenuOpen] = useState(false);
  const [isQuickEmpSheetOpen, setIsQuickEmpSheetOpen] = useState(false);
  const [quickEmpSearch, setQuickEmpSearch] = useState('');
  const [salesSubTab, setSalesSubTab] = useState<'tiendo' | 'doanhso' | 'tangtruong' | 'thuongnam'>(() => {
    const saved = localStorage.getItem('fmcg_sales_sub_tab') || sessionStorage.getItem('fmcg_sales_sub_tab');
    if (saved && ['tiendo', 'doanhso', 'tangtruong', 'thuongnam'].includes(saved)) {
      return saved as any;
    }
    return 'tiendo';
  });

  useEffect(() => {
    localStorage.setItem('fmcg_sales_sub_tab', salesSubTab);
    sessionStorage.setItem('fmcg_sales_sub_tab', salesSubTab);
  }, [salesSubTab]);

  const [syncTime, setSyncTime] = useState<string>('Dữ liệu mẫu (Sample)');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  // Fullscreen layout state:
  // Khi cài đặt APP lên máy tính (PWA standalone) hoặc mở trên máy tính (desktop),
  // mỗi khi vào APP sẽ luôn ở trạng thái full màn hình (toàn chiều rộng 100%, không tính thanh công cụ phía trên)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('app_fullscreen_layout');
      if (saved !== null) {
        return saved === 'true';
      }
      if (typeof window !== 'undefined') {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                             (window.navigator as any).standalone === true;
        const isDesktop = window.innerWidth >= 1024 || !(/android|iphone|ipad|ipod/i.test(navigator.userAgent));
        if (isStandalone || isDesktop) {
          return true; // Mặc định luôn full màn hình trên máy tính
        }
      }
    } catch {}
    return true; // Mặc định mở rộng giao diện tối ưu không gian
  });
  const [isDesktopMode, setIsDesktopMode] = useState(false);

  // Modern Enterprise Sidebar states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('app_sidebar_collapsed') === 'true';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // National Day 2/9 Theme State (Default Enabled)
  const [isNationalDayTheme, setIsNationalDayTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem('is_national_day_theme');
    return saved !== null ? saved === 'true' : true;
  });

  const [nationalDayOpacity, setNationalDayOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('national_day_opacity');
    return saved ? parseFloat(saved) : 0.85;
  });

  const [nationalDayCustomBgUrl, setNationalDayCustomBgUrl] = useState<string>(() => {
    return localStorage.getItem('national_day_custom_bg_url') || 'https://chatgpt.com/s/m_6a77de916cec81919afd703705067b98';
  });

  // Header background and text custom styling states
  const [headerBgColor, setHeaderBgColor] = useState<string>(() => {
    return localStorage.getItem('header_bg_color') || '';
  });

  const [headerTextColor, setHeaderTextColor] = useState<string>(() => {
    return localStorage.getItem('header_text_color') || '';
  });

  const [headerStylePreset, setHeaderStylePreset] = useState<string>(() => {
    return localStorage.getItem('header_style_preset') || 'emerald_dark';
  });

  // Subscribe to real-time theme settings from Firestore across all accounts and devices
  useEffect(() => {
    const unsubscribe = subscribeThemeSettingsFromFirestore((data) => {
      if (data) {
        if (typeof data.isNationalDayTheme === 'boolean') {
          setIsNationalDayTheme(data.isNationalDayTheme);
          localStorage.setItem('is_national_day_theme', String(data.isNationalDayTheme));
        }
        if (typeof data.nationalDayOpacity === 'number') {
          setNationalDayOpacity(data.nationalDayOpacity);
          localStorage.setItem('national_day_opacity', String(data.nationalDayOpacity));
        }
        if (typeof data.nationalDayCustomBgUrl === 'string') {
          setNationalDayCustomBgUrl(data.nationalDayCustomBgUrl);
          if (data.nationalDayCustomBgUrl) {
            localStorage.setItem('national_day_custom_bg_url', data.nationalDayCustomBgUrl);
          } else {
            localStorage.removeItem('national_day_custom_bg_url');
          }
        }
        if (typeof data.headerBgColor === 'string') {
          setHeaderBgColor(data.headerBgColor);
          if (data.headerBgColor) {
            localStorage.setItem('header_bg_color', data.headerBgColor);
          } else {
            localStorage.removeItem('header_bg_color');
          }
        }
        if (typeof data.headerTextColor === 'string') {
          setHeaderTextColor(data.headerTextColor);
          if (data.headerTextColor) {
            localStorage.setItem('header_text_color', data.headerTextColor);
          } else {
            localStorage.removeItem('header_text_color');
          }
        }
        if (typeof data.headerStylePreset === 'string') {
          setHeaderStylePreset(data.headerStylePreset);
          localStorage.setItem('header_style_preset', data.headerStylePreset);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Pre-sync competition programs via singleton store & verify authoritative server state on boot
  useEffect(() => {
    const unsub = subscribeCompetitionPrograms(() => {});
    syncCompetitionProgramsFromServer();
    return () => unsub();
  }, []);

  const toggleNationalDayTheme = () => {
    setIsNationalDayTheme(prev => {
      const next = !prev;
      localStorage.setItem('is_national_day_theme', String(next));
      saveThemeSettingsToFirestore({ isNationalDayTheme: next });
      return next;
    });
  };

  // Extra profile fields loaded from local storage for custom attributes
  const [extraProfile, setExtraProfile] = useState<{
    hoVaTen: string;
    vtbhCode: string;
    channel: string;
    avatarUrl: string;
  }>({
    hoVaTen: '',
    vtbhCode: '',
    channel: '',
    avatarUrl: ''
  });

  // Evaluations update event listener & unread state checker
  const [evalUpdateTrigger, setEvalUpdateTrigger] = useState(0);
  useEffect(() => {
    const handleUpdate = () => {
      setEvalUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener('evaluations-updated', handleUpdate);
    return () => {
      window.removeEventListener('evaluations-updated', handleUpdate);
    };
  }, []);

  // Real-time subscribe to market service evaluations for badge notifications
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'market_evaluations'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort to keep order consistent, newest date first
      list.sort((a, b) => {
        const dateCompare = (b.ngay || '').localeCompare(a.ngay || '');
        if (dateCompare !== 0) return dateCompare;
        const getNum = (id: string) => {
          const match = id.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return getNum(b.id) - getNum(a.id);
      });
      // Save to localStorage so components can read it instantly
      localStorage.setItem('gs_evaluations', JSON.stringify(list));
      setAllMarketEvaluations(list);
      // Trigger update of unread badge
      setEvalUpdateTrigger(prev => prev + 1);
    }, (error) => {
      console.error('Firestore market_evaluations global subscribe failed:', error);
    });
    return () => unsubscribe();
  }, []);

  const hasUnreadEvaluations = () => {
    try {
      const isEmployeeView = profile.role === 'Nhân viên' || profile.role === 'Saleman' || profile.role === 'employee';
      if (!isEmployeeView) return false;
      
      const myName = (extraProfile.hoVaTen && extraProfile.hoVaTen.trim() !== '') 
        ? extraProfile.hoVaTen 
        : (profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com' 
            ? 'Trần Duy Tùng' 
            : (profile.email?.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com' 
                ? 'Hoàng Văn Lâm' 
                : (profile.name === 'Tất cả' ? 'Quản lý' : profile.name)));
                
      if (!myName || myName === 'Quản lý') return false;
      
      const saved = localStorage.getItem('gs_evaluations');
      if (!saved) return false;
      const evs = JSON.parse(saved);
      if (!Array.isArray(evs)) return false;
      
      return evs.some((item: any) => {
        const isForMe = item.nhanVien?.toLowerCase().trim() === myName.toLowerCase().trim();
        if (!isForMe) return false;
        const seenList = item.seenBy || [];
        return !seenList.some((n: string) => n.toLowerCase().trim() === myName.toLowerCase().trim());
      });
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const [cursorType, setCursorType] = useState<'default' | 'laser' | 'hand'>('default');
  const [isPresentationToolbarExpanded, setIsPresentationToolbarExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (cursorType === 'default') {
      document.body.style.cursor = '';
      const existing = document.getElementById('presentation-cursor');
      if (existing) existing.remove();
      return;
    }

    let cursorEl = document.getElementById('presentation-cursor');
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = 'presentation-cursor';
      cursorEl.style.position = 'fixed';
      cursorEl.style.pointerEvents = 'none';
      cursorEl.style.zIndex = '999999';
      cursorEl.style.transform = 'translate(-30%, -30%)';
      cursorEl.style.transition = 'width 0.1s, height 0.1s, opacity 0.1s';
      document.body.appendChild(cursorEl);
    }

    document.body.style.cursor = 'none';

    if (cursorType === 'laser') {
      cursorEl.style.width = '16px';
      cursorEl.style.height = '16px';
      cursorEl.style.backgroundColor = '#ef4444';
      cursorEl.style.borderRadius = '50%';
      cursorEl.style.boxShadow = '0 0 12px 4px rgba(239, 68, 68, 0.9), 0 0 24px 8px rgba(239, 68, 68, 0.5)';
      cursorEl.style.border = '2px solid #ffffff';
      cursorEl.style.backgroundImage = 'none';
      cursorEl.style.display = 'block';
    } else if (cursorType === 'hand') {
      cursorEl.style.width = '36px';
      cursorEl.style.height = '36px';
      cursorEl.style.backgroundColor = 'transparent';
      cursorEl.style.borderRadius = '0';
      cursorEl.style.boxShadow = 'none';
      cursorEl.style.border = 'none';
      cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='%23f59e0b' stroke='%2378350f' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0'/><path d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6'/><path d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></svg>")`;
      cursorEl.style.display = 'block';
    }

    const updatePosition = (e: MouseEvent) => {
      if (cursorEl) {
        cursorEl.style.left = `${e.clientX}px`;
        cursorEl.style.top = `${e.clientY}px`;
      }
    };

    window.addEventListener('mousemove', updatePosition);
    return () => {
      window.removeEventListener('mousemove', updatePosition);
      document.body.style.cursor = '';
      const existing = document.getElementById('presentation-cursor');
      if (existing) existing.remove();
    };
  }, [cursorType]);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const profileModalRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteAccountEmail, setConfirmDeleteAccountEmail] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return notify.subscribe((item) => {
      setToasts((prev) => [...prev.slice(-3), item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 3600);
    });
  }, []);

  useDialogFocus(isProfileModalOpen, profileModalRef, () => {
    setConfirmDeleteAccountEmail(null);
    setIsProfileModalOpen(false);
  });

  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [isZaloShareOpen, setIsZaloShareOpen] = useState(false);
  const [zaloTargetEmpName, setZaloTargetEmpName] = useState('');

  const handleOpenZaloShare = (empName?: string) => {
    const target = empName || (filters.employeeName || 'Tất cả');
    setZaloTargetEmpName(target);
    setIsZaloShareOpen(true);
  };
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'accounts'>('profile');
  const [appLogoIcon, setAppLogoIcon] = useState<string>(() => {
    return localStorage.getItem('app_logo_icon') || 'layers';
  });
  const [appLogoCustomUrl, setAppLogoCustomUrl] = useState<string>(() => {
    return localStorage.getItem('app_logo_custom_url') || '';
  });
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const handleSaveAppLogo = (iconId: string, customUrl?: string) => {
    setAppLogoIcon(iconId);
    setAppLogoCustomUrl(customUrl || '');
    localStorage.setItem('app_logo_icon', iconId);
    if (customUrl) {
      localStorage.setItem('app_logo_custom_url', customUrl);
    } else {
      localStorage.removeItem('app_logo_custom_url');
    }
  };
  const [tempSheetUrl, setTempSheetUrl] = useState(sheetUrl);

  useEffect(() => {
    setTempSheetUrl(sheetUrl);
  }, [sheetUrl]);

  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string>('new');
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPassword, setAcctPassword] = useState('123456');
  const [acctRole, setAcctRole] = useState('Nhân viên');
  const [acctHoVaTen, setAcctHoVaTen] = useState('');
  const [acctVtbhCode, setAcctVtbhCode] = useState('');
  const [acctChannel, setAcctChannel] = useState('');
  const [acctMappedEmployee, setAcctMappedEmployee] = useState('');

  // Sync state values when selecting different accounts to manage
  useEffect(() => {
    if (selectedAccountEmail === 'new') {
      setAcctEmail('');
      setAcctPassword('123456');
      setAcctRole('Nhân viên');
      setAcctHoVaTen('');
      setAcctVtbhCode('');
      setAcctChannel('');
      setAcctMappedEmployee('');
    } else {
      const found = permissions?.find(p => p.email.toLowerCase().trim() === selectedAccountEmail.toLowerCase().trim());
      if (found) {
        setAcctEmail(found.email || '');
        setAcctPassword(found.password || '123123');
        setAcctRole(found.role || 'Nhân viên');
        setAcctHoVaTen(found.hoVaTen || '');
        setAcctVtbhCode(found.vtbhCode || '');
        setAcctChannel(found.channel || '');
        setAcctMappedEmployee(found.mappedEmployee || '');
      }
    }
  }, [selectedAccountEmail, permissions]);

  const [isSheetConfigExpanded, setIsSheetConfigExpanded] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('app_fullscreen_layout', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      const hasNativeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (hasNativeFs) {
        setIsFullscreen(true);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  // Synchronize permissions and locker status with Firestore in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'user_permissions'), (snapshot) => {
      const EXCLUDED_EMAILS = [
        'om@fmcg.com',
        'saleman.an@fmcg.com',
        'saleman.binh@fmcg.com',
        'saleman.cuong@fmcg.com',
        'saleman.long@fmcg.com',
        'saleman.nhung@fmcg.com',
        'sup@fmcg.com'
      ];
      if (!snapshot.empty) {
        const firebaseList: UserPermission[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docEmail = (data.email || docSnap.id).toLowerCase().trim();
          if (EXCLUDED_EMAILS.includes(docEmail)) {
            return;
          }
          if (data.deleted === true || data.deleted === 'true' || (data as any).deleted === 'TRUE') {
            return;
          }
          firebaseList.push({
            email: data.email || docSnap.id,
            password: data.password || '',
            role: data.role || 'Nhân viên',
            mappedEmployee: data.mappedEmployee || undefined,
            hoVaTen: data.hoVaTen || undefined,
            vtbhCode: data.vtbhCode || undefined,
            channel: data.channel || undefined,
            locked: data.locked === true || (data as any).locked === 'true',
            avatarUrl: data.avatarUrl || undefined,
            soLuotTruyCap: Number(data.soLuotTruyCap) || 0,
            deleted: false
          });
        });

        // Ensure critical accounts (Supervisor and OM) always exist in firebaseList
        let listWithCoreAccs = [...firebaseList];
        const hasTung = listWithCoreAccs.some(p => p.email.toLowerCase().trim() === 'tungluu1992ab@gmail.com');
        if (!hasTung) {
          const tungAcc = {
            email: 'tungluu1992ab@gmail.com',
            role: 'Admin',
            password: 'khongcogi',
            mappedEmployee: '',
            locked: false
          };
          listWithCoreAccs.push(tungAcc);
          saveUserPermissionToFirestore(tungAcc);
        }
        
        const hasLam = listWithCoreAccs.some(p => p.email.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com');
        if (!hasLam) {
          const lamAcc = {
            email: 'lamhv.hoabinh@gmail.com',
            role: 'OM',
            password: '123123123',
            mappedEmployee: '',
            locked: false
          };
          listWithCoreAccs.push(lamAcc);
          saveUserPermissionToFirestore(lamAcc);
        }

        // Just in case, clean up any EXCLUDED_EMAILS
        listWithCoreAccs = listWithCoreAccs.filter(p => !EXCLUDED_EMAILS.includes(p.email.toLowerCase().trim()));

        setPermissions(listWithCoreAccs);
        localStorage.setItem('gs_permissions', JSON.stringify(listWithCoreAccs));
      } else {
        // Run database seeding only for core accounts if Firestore is active but completely empty (e.g. cold start)
        const listToSeed: UserPermission[] = [
          {
            email: 'tungluu1992ab@gmail.com',
            role: 'Admin',
            password: 'khongcogi',
            mappedEmployee: '',
            locked: false
          },
          {
            email: 'lamhv.hoabinh@gmail.com',
            role: 'OM',
            password: '123123123',
            mappedEmployee: '',
            locked: false
          }
        ];
        
        listToSeed.forEach(p => {
          saveUserPermissionToFirestore(p);
        });
        setPermissions(listToSeed);
        localStorage.setItem('gs_permissions', JSON.stringify(listToSeed));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_permissions');
    });

    return () => unsubscribe();
  }, []);
  
  // UI indicators
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter controllers state
  const [profile, setProfile] = useState<UserProfile>(() => {
    return {
      name: 'Tất cả',
      role: 'Admin',
      email: 'tungluu1992ab@gmail.com',
    };
  });

  const isSupervisor = profile.role === 'Admin' || 
                       profile.role === 'MKT Sup' || 
                       profile.role === 'OM' || 
                       profile.role === 'manager' || 
                       profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com' ||
                       profile.email?.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com';

  // Chức năng Tạo & Cấu hình CT Thi Đua mới: CHỈ CÓ Giám Sát Thị Trường mới có quyền (Admin, MKT Sup, Giám Sát, tungluu1992ab@gmail.com).
  // Các phân quyền còn lại (OM, Nhân viên, Saleman, v.v.) KHÔNG hiển thị chức năng này.
  const isMarketSupervisor = (
    profile.role === 'Admin' ||
    profile.role === 'MKT Sup' ||
    profile.role === 'Giám Sát' ||
    profile.role === 'Giám Sát Thị Trường' ||
    profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com' ||
    loggedInUser?.role === 'Admin' ||
    loggedInUser?.role === 'MKT Sup' ||
    loggedInUser?.role === 'Giám Sát' ||
    loggedInUser?.role === 'Giám Sát Thị Trường' ||
    loggedInUser?.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com'
  ) && (
    profile.role !== 'OM' &&
    profile.role !== 'Nhân viên' &&
    profile.role !== 'Saleman' &&
    profile.role !== 'employee' &&
    profile.email?.toLowerCase().trim() !== 'lamhv.hoabinh@gmail.com' &&
    loggedInUser?.role !== 'OM' &&
    loggedInUser?.role !== 'Nhân viên' &&
    loggedInUser?.role !== 'Saleman' &&
    loggedInUser?.email?.toLowerCase().trim() !== 'lamhv.hoabinh@gmail.com'
  );

  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`fmcg_read_notifs_${profile.email || 'guest'}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Re-read readNotificationIds when profile changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`fmcg_read_notifs_${profile.email || 'guest'}`);
      if (saved) {
        setReadNotificationIds(JSON.parse(saved));
      } else {
        setReadNotificationIds([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [profile.email]);

  const effectiveMyName = (extraProfile.hoVaTen && extraProfile.hoVaTen.trim() !== '') 
    ? extraProfile.hoVaTen 
    : (profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com' 
        ? 'Trần Duy Tùng' 
        : (profile.email?.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com' 
            ? 'Hoàng Văn Lâm' 
            : (profile.name === 'Tất cả' ? 'Quản lý' : profile.name)));

  // Consolidated Central Notifications List
  const notificationsList: AppNotification[] = useMemo(() => {
    const result: AppNotification[] = [];
    const isSupervisorRole = profile.role === 'Admin' || profile.role === 'OM' || isSupervisor;
    const isEmployeeRole = profile.role === 'Nhân viên' || profile.role === 'Saleman' || profile.role === 'employee';

    const formatIsoDate = (dStr: string) => {
      if (!dStr) return '';
      const parts = dStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dStr;
    };

    const getApproverNameOnly = (str?: string) => {
      if (!str) return 'Quản lý';
      const idx = str.indexOf(' (');
      return idx !== -1 ? str.substring(0, idx).trim() : str.trim();
    };

    // 1. Phân quyền Quản lý: Hiển thị thông báo khi có nhân viên tạo lịch nghỉ phép chờ phê duyệt
    if (isSupervisorRole) {
      allLeaveRequests.forEach((req: any) => {
        const isPending = req.status === 'Chờ duyệt' || !req.status;
        if (isPending && req.status !== 'Nháp') {
          const notifId = `leave-pending-${req.id}`;
          const isRead = readNotificationIds.includes(notifId);

          const startFmt = formatIsoDate(req.offDate);
          const endFmt = req.toDate && req.toDate !== req.offDate ? ` đến ${formatIsoDate(req.toDate)}` : '';
          const rangeText = `${startFmt}${endFmt}`;

          result.push({
            id: notifId,
            rawId: req.id,
            type: 'leave_pending_approval',
            title: `Nhân viên ${req.creatorName || 'nhân viên'} tạo lịch nghỉ phép`,
            shortContent: `Nội dung: ${req.reason || 'Nghỉ phép'}${req.details ? ' - ' + req.details : ''} (${rangeText})`,
            time: req.createdAt || rangeText,
            timestamp: req.createdAt ? new Date(req.createdAt).getTime() : Date.now(),
            isRead: isRead,
            statusText: 'Chờ phê duyệt',
            statusColor: 'amber',
            employeeName: req.creatorName,
            extraInfo: {
              leaveRequestId: req.id,
              subTab: 'chamcong'
            }
          });
        }
      });
    }

    // 2. Phân quyền Nhân viên: Hiển thị thông báo lịch nghỉ đã duyệt & phiếu đánh giá DVTT mới
    if (isEmployeeRole) {
      // 2.1 Thông báo khi lịch nghỉ phép được phê duyệt
      allLeaveRequests.forEach((req: any) => {
        const isMine = (req.creatorName && req.creatorName.toLowerCase().trim() === effectiveMyName.toLowerCase().trim()) ||
                       (req.creatorEmail && req.creatorEmail.toLowerCase().trim() === (profile.email || '').toLowerCase().trim());
        if (isMine && req.status === 'Đã duyệt') {
          const notifId = `leave-approved-${req.id}`;
          const isRead = readNotificationIds.includes(notifId);

          const startFmt = formatIsoDate(req.offDate);
          const endFmt = req.toDate && req.toDate !== req.offDate ? ` đến ${formatIsoDate(req.toDate)}` : '';
          const rangeText = `${startFmt}${endFmt}`;

          result.push({
            id: notifId,
            rawId: req.id,
            type: 'leave_approved',
            title: 'Lịch nghỉ phép đã được phê duyệt',
            shortContent: `Kỳ nghỉ ${rangeText} (${req.reason || 'Nghỉ phép'}) đã được ${getApproverNameOnly(req.approvedBy)} phê duyệt.`,
            time: req.approvedAt || req.createdAt || rangeText,
            timestamp: req.approvedAt ? new Date(req.approvedAt).getTime() : (req.createdAt ? new Date(req.createdAt).getTime() : Date.now()),
            isRead: isRead,
            statusText: 'Đã duyệt',
            statusColor: 'emerald',
            employeeName: req.creatorName,
            extraInfo: {
              leaveRequestId: req.id,
              subTab: 'chamcong'
            }
          });
        }
      });

      // 2.2 Thông báo khi nhận được Phiếu đánh giá dịch vụ thị trường
      allMarketEvaluations.forEach((item: any) => {
        const isForMe = item.nhanVien && item.nhanVien.toLowerCase().trim() === effectiveMyName.toLowerCase().trim();
        if (isForMe) {
          const notifId = `eval-${item.id}`;
          const seenList = item.seenBy || [];
          const isSeenInDb = seenList.some((n: string) => n.toLowerCase().trim() === effectiveMyName.toLowerCase().trim());
          const isRead = isSeenInDb || readNotificationIds.includes(notifId);

          result.push({
            id: notifId,
            rawId: item.id,
            type: 'market_evaluation',
            title: 'Phiếu đánh giá dịch vụ thị trường mới',
            shortContent: `Người ĐG: ${item.nguoiDanhGia} • Kết quả: ${item.trangThai} (${item.tiLeKhongDat}% lỗi)${item.ghiChu ? ' • ' + item.ghiChu : ''}`,
            time: formatIsoDate(item.ngay),
            timestamp: item.ngay ? new Date(item.ngay).getTime() : Date.now(),
            isRead: isRead,
            statusText: item.trangThai === 'Đạt' ? 'Đạt' : 'Chưa đạt',
            statusColor: item.trangThai === 'Đạt' ? 'emerald' : 'rose',
            employeeName: item.nhanVien,
            extraInfo: {
              evalId: item.id,
              subTab: 'dichvuthitruong'
            }
          });
        }
      });
    }

    // Sort newest first
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
  }, [allLeaveRequests, allMarketEvaluations, profile, effectiveMyName, isSupervisor, readNotificationIds]);

  const totalUnreadNotifications = notificationsList.filter(n => !n.isRead).length;

  const handleMarkSingleAsRead = async (id: string, rawId: string, type: string) => {
    setReadNotificationIds(prev => {
      if (!prev.includes(id)) {
        const updated = [...prev, id];
        localStorage.setItem(`fmcg_read_notifs_${profile.email || 'guest'}`, JSON.stringify(updated));
        return updated;
      }
      return prev;
    });

    if (type === 'market_evaluation') {
      const targetEval = allMarketEvaluations.find(e => e.id === rawId);
      if (targetEval && effectiveMyName) {
        const seenList = targetEval.seenBy || [];
        if (!seenList.some((n: string) => n.toLowerCase().trim() === effectiveMyName.toLowerCase().trim())) {
          const updatedSeenList = [...seenList, effectiveMyName];
          const { id: _, ...docData } = { ...targetEval, seenBy: updatedSeenList };
          try {
            await setDoc(doc(db, 'market_evaluations', rawId), docData);
            window.dispatchEvent(new Event('evaluations-updated'));
          } catch (e) {
            console.error("Firestore mark eval seen failed:", e);
          }
        }
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const allIds = notificationsList.map(n => n.id);
    setReadNotificationIds(prev => {
      const combined = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem(`fmcg_read_notifs_${profile.email || 'guest'}`, JSON.stringify(combined));
      return combined;
    });

    // Also update seenBy in Firestore for all employee's evaluations
    const isEmployeeRole = profile.role === 'Nhân viên' || profile.role === 'Saleman' || profile.role === 'employee';
    if (isEmployeeRole && effectiveMyName) {
      for (const notif of notificationsList) {
        if (notif.type === 'market_evaluation') {
          const targetEval = allMarketEvaluations.find(e => e.id === notif.rawId);
          if (targetEval) {
            const seenList = targetEval.seenBy || [];
            if (!seenList.some((n: string) => n.toLowerCase().trim() === effectiveMyName.toLowerCase().trim())) {
              const updatedSeenList = [...seenList, effectiveMyName];
              const { id: _, ...docData } = { ...targetEval, seenBy: updatedSeenList };
              try {
                await setDoc(doc(db, 'market_evaluations', notif.rawId), docData);
              } catch (e) {
                console.error("Firestore mark all evals seen failed:", e);
              }
            }
          }
        }
      }
    }

    setTimeout(() => {
      window.dispatchEvent(new Event('evaluations-updated'));
    }, 50);
  };

  const handleNotificationClick = (notif: AppNotification) => {
    handleMarkSingleAsRead(notif.id, notif.rawId, notif.type);
    setIsNotificationCenterOpen(false);

    // Navigate to target sub tab and item
    setActiveTab('chamcong');
    if (notif.extraInfo?.subTab) {
      setAttendanceTargetSubTab(notif.extraInfo.subTab);
    }
    if (notif.extraInfo?.leaveRequestId) {
      setAttendanceTargetLeaveId(notif.extraInfo.leaveRequestId);
    }
    if (notif.extraInfo?.evalId) {
      setAttendanceTargetEvalId(notif.extraInfo.evalId);
    }
  };

  const [cycleStartDate, setCycleStartDate] = useState<string>(() => {
    let saved = localStorage.getItem('cycleStartDate');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    if (saved) {
      const parts = saved.split('-');
      if (parts.length === 3 && parts[2] !== '20') {
        localStorage.removeItem('cycleStartDate');
        saved = null;
      } else {
        const savedEnd = localStorage.getItem('cycleEndDate');
        if (savedEnd && savedEnd < todayStr) {
          localStorage.removeItem('cycleStartDate');
          localStorage.removeItem('cycleEndDate');
          saved = null;
        }
      }
    }
    if (saved) return saved;
    return getSalesCycleDates().startDate;
  });

  const [cycleEndDate, setCycleEndDate] = useState<string>(() => {
    let saved = localStorage.getItem('cycleEndDate');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    if (saved) {
      const parts = saved.split('-');
      if (parts.length === 3 && parts[2] !== '19') {
        localStorage.removeItem('cycleEndDate');
        saved = null;
      } else {
        const savedStart = localStorage.getItem('cycleStartDate');
        if (savedStart) {
          if (saved < todayStr) {
            localStorage.removeItem('cycleStartDate');
            localStorage.removeItem('cycleEndDate');
            saved = null;
          }
        }
      }
    }
    if (saved) return saved;
    return getSalesCycleDates().endDate;
  });

  const [filters, setFilters] = useState(() => {
    const defaults = getSalesCycleDates();
    const defaultStart = defaults.startDate;
    const defaultEnd = defaults.endDate;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let savedStart = localStorage.getItem('cycleStartDate');
    if (savedStart) {
      const parts = savedStart.split('-');
      if (parts.length === 3 && parts[2] !== '20') {
        savedStart = null;
      }
    }
    let savedEnd = localStorage.getItem('cycleEndDate');
    if (savedEnd) {
      const parts = savedEnd.split('-');
      if (parts.length === 3 && parts[2] !== '19') {
        savedEnd = null;
      }
    }

    if (savedEnd && savedEnd < todayStr) {
      savedStart = null;
      savedEnd = null;
    }

    const savedEmp = localStorage.getItem('fmcg_selected_employee') || 'Tất cả';

    const finalStart = savedStart || defaultStart;
    const finalEnd = savedEnd || defaultEnd;
    return {
      startDate: finalStart,
      endDate: finalEnd,
      employeeName: savedEmp,
    };
  });

  useEffect(() => {
    if (filters.employeeName) {
      localStorage.setItem('fmcg_selected_employee', filters.employeeName);
    }
  }, [filters.employeeName]);

  // Page Lifecycle & State Protection (Screen lock, app switch, backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem('fmcg_active_tab', activeTab);
        localStorage.setItem('fmcg_sales_sub_tab', salesSubTab);
        if (filters.employeeName) {
          localStorage.setItem('fmcg_selected_employee', filters.employeeName);
        }
      }
    };

    const handlePageHide = () => {
      localStorage.setItem('fmcg_active_tab', activeTab);
      localStorage.setItem('fmcg_sales_sub_tab', salesSubTab);
      if (filters.employeeName) {
        localStorage.setItem('fmcg_selected_employee', filters.employeeName);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [activeTab, salesSubTab, filters.employeeName]);

  // Synchronize sales cycle (chu kỳ bán hàng) with Firestore in real-time
  useEffect(() => {
    // Only register the real-time listener if there's a logged-in user
    if (!loggedInUser) return;

    // Calculate correct standard defaults for fallback using dynamic helper
    const defaults = getSalesCycleDates();
    const defaultStart = defaults.startDate;
    const defaultEnd = defaults.endDate;

    const unsubscribe = onSnapshot(doc(db, 'app_settings', 'progress_cycle'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let sDate = data.startDate;
        let eDate = data.endDate;

        // Auto-correct if the loaded start/end dates from Firestore are not conforming to day 20 and day 19 rules
        const sDayStr = sDate ? sDate.split('-')[2] : '';
        const eDayStr = eDate ? eDate.split('-')[2] : '';

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (sDayStr !== '20' || eDayStr !== '19' || (eDate && eDate < todayStr)) {
          sDate = defaultStart;
          eDate = defaultEnd;
          
          setDoc(doc(db, 'app_settings', 'progress_cycle'), {
            startDate: defaultStart,
            endDate: defaultEnd,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch((err) => {
            console.error('Failed to correct or advance progress cycle in Firestore:', err);
          });
        }

        if (sDate) {
          setCycleStartDate(sDate);
          localStorage.setItem('cycleStartDate', sDate);
          setFilters((prev) => ({ ...prev, startDate: sDate }));
        }
        if (eDate) {
          setCycleEndDate(eDate);
          localStorage.setItem('cycleEndDate', eDate);
          setFilters((prev) => ({ ...prev, endDate: eDate }));
        }
      } else {
        // If the document doesn't exist, we can create it with the standard defaults
        setDoc(doc(db, 'app_settings', 'progress_cycle'), {
          startDate: defaultStart,
          endDate: defaultEnd,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch((err) => {
          console.error('Failed to create default progress cycle in Firestore:', err);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'app_settings/progress_cycle');
    });

    return () => unsubscribe();
  }, [loggedInUser]);

  const handleStartDateChange = async (val: string) => {
    setCycleStartDate(val);
    localStorage.setItem('cycleStartDate', val);
    setFilters((prev) => ({ ...prev, startDate: val }));
    
    if (isSupervisor) {
      try {
        await setDoc(doc(db, 'app_settings', 'progress_cycle'), {
          startDate: val,
          endDate: cycleEndDate,
          updatedBy: profile.role,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'app_settings/progress_cycle');
      }
    }
  };

  const handleEndDateChange = async (val: string) => {
    setCycleEndDate(val);
    localStorage.setItem('cycleEndDate', val);
    setFilters((prev) => ({ ...prev, endDate: val }));
    
    if (isSupervisor) {
      try {
        await setDoc(doc(db, 'app_settings', 'progress_cycle'), {
          startDate: cycleStartDate,
          endDate: val,
          updatedBy: profile.role,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'app_settings/progress_cycle');
      }
    }
  };

  const [activationEmployeeFilter, setActivationEmployeeFilter] = useState('Tất cả');

  const [viewingEmpName, setViewingEmpName] = useState<string | null>(null);

  // Apply auto load from saved sheet ID on component mounting
  useEffect(() => {
    const savedId = localStorage.getItem('gs_sheet_id') || '1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c';
    handleLoadSheet(savedId);
  }, []);

  // Role-based tab guard: protect Inventory & Account tabs
  useEffect(() => {
    if (activeTab === 'tracuu' && !isSupervisor) {
      setActiveTab('doanhso');
    }
    if (activeTab === 'taikhoan' && profile.role !== 'Admin') {
      setActiveTab('doanhso');
    }
  }, [activeTab, isSupervisor, profile.role]);

  // Synchronize profile and filters dynamically based on active logged-in user
  useEffect(() => {
    if (loggedInUser) {
      // Locate current active user permissions (directly from Firestore-synchronized real-time permissions list)
      const userPerm = permissions?.find(p => p.email.toLowerCase().trim() === loggedInUser.email.toLowerCase().trim());
      
      if (userPerm) {
        const isUserLocked = !!userPerm.locked || 
                             (userPerm as any).locked === 'true' || 
                             (userPerm as any).locked === 'TRUE' || 
                             (typeof (userPerm as any).locked === 'string' && String((userPerm as any).locked).toLowerCase().trim() === 'true');
        if (isUserLocked) {
          // Immediately log out and boot to Login Screen
          setLoggedInUser(null);
          localStorage.removeItem('logged_in_user');
          sessionStorage.removeItem('logged_in_user');
          return;
        }
      }

      // Prioritize Firestore synced permissions role & mapping info over old static login cache
      const activeRole = userPerm?.role || loggedInUser.role;
      const isAdmin = activeRole === 'Admin';
      const availableNames = employees.map(e => e.name);
      
      let matchedName = 'Tất cả';
      if (!isAdmin) {
        const mappedEmp = userPerm?.mappedEmployee !== undefined ? userPerm.mappedEmployee : loggedInUser.mappedEmployee;
        matchedName = mappedEmp || getEmployeeNameFromEmail(loggedInUser.email, availableNames);
      }
      
      setProfile({
        name: matchedName,
        role: activeRole as UserRole,
        email: loggedInUser.email,
        mappedEmployeeName: !isAdmin ? matchedName : undefined
      });
      
      setFilters(prev => ({
        ...prev,
        employeeName: matchedName
      }));
      setActivationEmployeeFilter(matchedName);

      const emailLower = loggedInUser.email.toLowerCase().trim();
      const sheetHoVaTen = (isAdmin ? 'Admin' : matchedName);
      const sheetVtbhCode = '';
      const sheetChannel = '';

      // Sync extra profile details for custom metadata display (prioritize Firebase, fallback to LocalStorage)
      const stored = localStorage.getItem(`profile_ext_${emailLower}`) || localStorage.getItem(`profile_ext_${loggedInUser.email}`);
      let localParsed: any = null;
      if (stored) {
        try {
          localParsed = JSON.parse(stored);
        } catch (e) {
          console.error('Error parsing local extra profile:', e);
        }
      }

      // Single source of truth is ALWAYS Firestore (userPerm). Fall back to LocalStorage or defaults ONLY when Firestore has not loaded yet.
      const resolvedHoVaTen = userPerm?.hoVaTen !== undefined && userPerm?.hoVaTen !== '' ? userPerm.hoVaTen : (localParsed?.hoVaTen || sheetHoVaTen);
      const resolvedVtbhCode = userPerm?.vtbhCode !== undefined && userPerm?.vtbhCode !== '' ? userPerm.vtbhCode : (localParsed?.vtbhCode || sheetVtbhCode);
      const resolvedChannel = userPerm?.channel !== undefined && userPerm?.channel !== '' ? userPerm.channel : (localParsed?.channel || sheetChannel);
      const resolvedAvatarUrl = userPerm?.avatarUrl !== undefined && userPerm?.avatarUrl !== '' ? userPerm.avatarUrl : (localParsed?.avatarUrl || '');

      const activeExtraProfile = {
        hoVaTen: resolvedHoVaTen,
        vtbhCode: resolvedVtbhCode,
        channel: resolvedChannel,
        avatarUrl: resolvedAvatarUrl
      };

      setExtraProfile(activeExtraProfile);
      
      // Keep LocalStorage synced with the absolute latest values from Cloud
      localStorage.setItem(`profile_ext_${emailLower}`, JSON.stringify(activeExtraProfile));
    }
  }, [loggedInUser, employees, permissions]);

  // Action and state controller for updating custom employee attributes
  const handleSaveExtraProfile = (fields: { hoVaTen: string; vtbhCode: string; channel: string; avatarUrl: string }) => {
    if (loggedInUser) {
      const emailLower = loggedInUser.email.toLowerCase().trim();
      localStorage.setItem(`profile_ext_${emailLower}`, JSON.stringify(fields));
      setExtraProfile(fields);

      const existingPerm = permissions?.find(p => p.email.toLowerCase().trim() === emailLower);
      const updatedPerm: UserPermission = {
        email: emailLower,
        role: existingPerm?.role || loggedInUser.role || 'Nhân viên',
        password: existingPerm?.password || '123456',
        mappedEmployee: existingPerm?.mappedEmployee || '',
        hoVaTen: fields.hoVaTen,
        vtbhCode: fields.vtbhCode,
        channel: fields.channel,
        avatarUrl: fields.avatarUrl,
        locked: existingPerm?.locked || false,
        soLuotTruyCap: existingPerm?.soLuotTruyCap || loggedInUser.soLuotTruyCap || 0
      };

      // Pessimistically update state to avoid lag while waiting for firebase push
      setPermissions(prev => {
        const index = prev.findIndex(p => p.email.toLowerCase().trim() === loggedInUser.email.toLowerCase().trim());
        if (index > -1) {
          const list = [...prev];
          list[index] = updatedPerm;
          return list;
        }
        return [...prev, updatedPerm];
      });

      // Synchronize back to Firestore
      saveUserPermissionToFirestore(updatedPerm);
      setIsProfileModalOpen(false);
    }
  };

  const applySheetDataToState = (parsedData: SheetDataState, targetId: string) => {
    setEmployees(parsedData.employees || []);
    setTransactions(parsedData.transactions || []);
    setSectorData(parsedData.sectorData);
    setCttbData(parsedData.cttbData);
    setGrowthData(parsedData.growthData);
    setAnnualBonusData(parsedData.annualBonusData);
    setTuNhienRecords(parsedData.tuNhienRecords || []);
    setMeizanRecords(parsedData.meizanRecords || []);
    setActivationListData(parsedData.activationListData || []);
    setTrungBayListData(parsedData.trungBayListData || []);
    setClfDetailedRows(parsedData.clfDetailedRows || []);
    setMccDetailedRows(parsedData.mccDetailedRows || []);
    setNdfcDetailedRows(parsedData.ndfcDetailedRows || []);
    setChamCongListData(parsedData.chamCongListData || []);
    if (parsedData.lastUpdated) {
      setSyncTime(`Đã đồng bộ lúc: ${parsedData.lastUpdated}`);
    }
    setConnectedId(targetId);
  };

  // Handler for connecting and downloading Google Spreadsheet database (Cache-First + Background Sync)
  const handleLoadSheet = async (idToLoad?: string, isBackground: boolean = false) => {
    const targetId = idToLoad || extractSheetId(sheetUrl);
    if (!targetId) {
      setErrorMsg('Đường dẫn link Google Sheets không đúng định dạng. Hãy copy toàn bộ URL trên trình duyệt.');
      return;
    }

    let hasLoadedFromCache = false;
    // 1. Immediately attempt reading from Cache for instant rendering
    try {
      const cached = await getCachedSheetData(targetId);
      if (cached && cached.employees && cached.employees.length > 0) {
        applySheetDataToState(cached, targetId);
        hasLoadedFromCache = true;
      }
    } catch (e) {
      console.warn('Lỗi đọc dữ liệu đệm ban đầu:', e);
    }

    // Only display blocking full-screen loading spinner if there is no cache at all
    if (!hasLoadedFromCache && !isBackground) {
      setIsLoading(true);
    }
    setErrorMsg(null);

    try {
      const parsedData = await loadGoogleSheetData(targetId);
      applySheetDataToState(parsedData, targetId);

      // Save credentials in local storage
      localStorage.setItem('gs_sheet_url', sheetUrl);
      localStorage.setItem('gs_sheet_id', targetId);

      // Dynamically auto-expand filters' startDate and endDate based on loaded transactions dates (fallback only)
      let hasSavedCycle = localStorage.getItem('cycleStartDate') || localStorage.getItem('cycleEndDate');
      if (!hasSavedCycle) {
        try {
          const docSnap = await getDoc(doc(db, 'app_settings', 'progress_cycle'));
          if (docSnap.exists()) {
            const data = docSnap.data();
            let sDate = data.startDate;
            let eDate = data.endDate;

            // Auto-correct if the loaded start/end dates from Firestore are not conforming to day 20 and day 19 rules
            const sDayStr = sDate ? sDate.split('-')[2] : '';
            const eDayStr = eDate ? eDate.split('-')[2] : '';

            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            if (sDayStr !== '20' || eDayStr !== '19' || (eDate && eDate < todayStr)) {
              const defaults = getSalesCycleDates();
              sDate = defaults.startDate;
              eDate = defaults.endDate;

              // Write back corrected value to Firestore asynchronously
              setDoc(doc(db, 'app_settings', 'progress_cycle'), {
                startDate: sDate,
                endDate: eDate,
                updatedAt: new Date().toISOString()
              }, { merge: true }).catch(err => console.error(err));
            }

            if (sDate && eDate) {
              hasSavedCycle = sDate;
              localStorage.setItem('cycleStartDate', sDate);
              localStorage.setItem('cycleEndDate', eDate);
              setCycleStartDate(sDate);
              setCycleEndDate(eDate);
              setFilters(prev => ({
                ...prev,
                startDate: sDate,
                endDate: eDate
              }));
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'app_settings/progress_cycle');
        }
      }

      if (!hasSavedCycle && parsedData.transactions.length > 0) {
        const validDates = parsedData.transactions.map(t => t.Ngay).filter(Boolean);
        if (validDates.length > 0) {
          validDates.sort();
          const minD = validDates[0];
          const maxD = validDates[validDates.length - 1];
          setFilters(prev => ({
            ...prev,
            startDate: minD,
            endDate: maxD
          }));
        }
      }

    } catch (err: any) {
      if (!hasLoadedFromCache) {
        setErrorMsg(err.message || 'Lỗi bất ngờ xảy ra khi tải bảng tính.');
      } else {
        console.warn('Lỗi đồng bộ nền từ Google Sheet (dữ liệu offline vẫn hiển thị tốt):', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Dedicated manual sync trigger: Force bypasses cache to reload fresh real-time data from Google Sheets
  const handleManualSync = async () => {
    if (isSyncing) return;
    const activeId = connectedId || extractSheetId(sheetUrl) || '1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c';
    if (!activeId) {
      setSyncFeedback({ message: 'Chưa có thông tin bảng tính Google Sheets để đồng bộ.', type: 'error' });
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }

    setIsSyncing(true);
    setSyncFeedback({ message: 'Đang đồng bộ', type: 'info' });

    try {
      // Force refresh data directly from Google Sheets API
      const parsedData = await loadGoogleSheetData(activeId, true);
      applySheetDataToState(parsedData, activeId);

      const localTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
                        new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      setSyncTime(`Đã đồng bộ lúc: ${localTime}`);
      setSyncFeedback({ message: 'Đã đồng bộ dữ liệu', type: 'success' });
      setTimeout(() => {
        setSyncFeedback(null);
      }, 3000);
    } catch (err: any) {
      console.error('Lỗi khi đồng bộ dữ liệu:', err);
      setSyncFeedback({ message: `Không thể đồng bộ: ${err?.message || 'Lỗi kết nối bảng tính'}`, type: 'error' });
      setTimeout(() => {
        setSyncFeedback(null);
      }, 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Instant startup data loader: Reads cache immediately and silently refreshes from Google Sheet in background
  useEffect(() => {
    const activeId = connectedId || extractSheetId(sheetUrl) || '1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c';
    if (activeId && loggedInUser) {
      handleLoadSheet(activeId, true);
    }
  }, [loggedInUser]);

  const handleDisconnect = () => {
    localStorage.removeItem('gs_sheet_url');
    localStorage.removeItem('gs_sheet_id');
    localStorage.removeItem('gs_permissions');
    setSheetUrl('');
    setConnectedId(null);
    setEmployees(mockEmployees);
    setTransactions(mockTransactions);
    setPermissions(mockPermissions);
    setSectorData(undefined);
    setCttbData(undefined);
    setTuNhienRecords([]);
    setActivationListData(mockActivationListData);
    setTrungBayListData(mockTrungBayListData);
    setClfDetailedRows([]);
    setMccDetailedRows([]);
    setNdfcDetailedRows([]);
    setChamCongListData(mockChamCongListData);
    setSyncTime('Dữ liệu mẫu (Sample)');
    setErrorMsg(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_in_user');
    sessionStorage.removeItem('logged_in_user');
    setLoggedInUser(null);
  };

  // Extract list of all unique employees in the dataset to display in selector, sorted by default
  const availableEmployees = useMemo(() => {
    return sortAndFormatEmployeeNames(employees.map((emp) => emp.name));
  }, [employees]);

  // If in 'chamcong' tab, ensure 'Tất cả' is not selected. Default to first employee.
  useEffect(() => {
    if (activeTab === 'chamcong' && filters.employeeName === 'Tất cả' && availableEmployees.length > 0) {
      setFilters(prev => ({
        ...prev,
        employeeName: availableEmployees[0]
      }));
    }
  }, [activeTab, filters.employeeName, availableEmployees]);

  // Check if current user role is an employee (Nhân viên / Saleman / employee)
  const isEmployeeView = profile.role === 'Nhân viên' || profile.role === 'Saleman' || profile.role === 'employee';
  // Feature to send results via Zalo is ONLY allowed for Giám Sát (Admin / MKT Sup / Giám Sát) and OM
  const canSendZalo = profile.role === 'Admin' || profile.role === 'OM' || profile.role === 'MKT Sup' || profile.role === 'Giám Sát' || (loggedInUser && (loggedInUser.role === 'Admin' || loggedInUser.role === 'OM' || loggedInUser.role === 'MKT Sup' || loggedInUser.role === 'Giám Sát'));

  // Enforce RLS (Row-Level Security): 
  // If the simulated profile role is an employee role, they can ONLY see their own records!
  const effectiveEmployeeName = isEmployeeView ? profile.name : filters.employeeName;
  const effectiveActivationEmployeeName = isEmployeeView ? profile.name : activationEmployeeFilter;

  // Synchronize viewing target with global dropdown or salesman RLS
  useEffect(() => {
    if ((isEmployeeView || effectiveActivationEmployeeName !== 'Tất cả') && effectiveActivationEmployeeName && effectiveActivationEmployeeName !== 'Tất cả') {
      setViewingEmpName(effectiveActivationEmployeeName);
    } else {
      setViewingEmpName(null);
    }
  }, [effectiveActivationEmployeeName, isEmployeeView]);

  // Re-calculate some of the employees counts if activationListData is available to avoid mismatch between aggregate targets and customer activation details
  const syncedEmployees = useMemo(() => {
    const cleanName = (str: any) => {
      if (!str) return '';
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Precompute actual counts from activationListData for each employee if customer list is available
    const activationCountsByEmp: Record<string, { k3Actual: number; k4Actual: number; khActual: number; khmhThangActual: number }> = {};
    if (activationListData && activationListData.length > 0) {
      activationListData.forEach(row => {
        if (!row) return;
        const rawEmp = row['Nhân Viên'] || row['A'] || row['nhanVien'] || '';
        const empKey = cleanName(rawEmp);
        if (!empKey) return;
        if (!activationCountsByEmp[empKey]) {
          activationCountsByEmp[empKey] = { k3Actual: 0, k4Actual: 0, khActual: 0, khmhThangActual: 0 };
        }
        
        // 3 Ngành / 4 Ngành: column F or header 'Số Ngành Hàng'
        const numSectors = parseInt(String(row['Số Ngành Hàng'] || row['F'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        const is3N = numSectors >= 3 || String(row['3 Ngành'] || '').toUpperCase() === 'TRUE';
        const is4N = numSectors >= 4 || String(row['4 Ngành'] || '').toUpperCase() === 'TRUE';
        if (is3N) activationCountsByEmp[empKey].k3Actual++;
        if (is4N) activationCountsByEmp[empKey].k4Actual++;

        // KH Đạt Chuẩn: column O or header 'Đạt Chuẩn Doanh Số'
        const dsVal = String(row['Đạt Chuẩn Doanh Số'] || row['O'] || '').trim().toLowerCase();
        if (dsVal === 'đạt' || dsVal === 'dat') {
          activationCountsByEmp[empKey].khActual++;
        }

        // HRC (chuyên trách Nguyễn Đức Tuấn - Lựa Chọn 1): column AA or header 'Kích Hoạt Tháng HRC' / 'KHKH HRC'
        const isTuanRow = empKey.includes('tuan');
        if (isTuanRow) {
          const isHrc = String(row['Kích Hoạt Tháng HRC'] || row['AA'] || row['KHKH HRC'] || '').toUpperCase();
          if (isHrc === 'TRUE' || isHrc === '1' || isHrc === 'Y' || isHrc === 'ĐẠT' || isHrc === '✓') {
            activationCountsByEmp[empKey].khmhThangActual++;
          }
        }
      });
    }

    const isConnected = !!connectedId || !!localStorage.getItem('gs_sheet_id');

    return employees.map(emp => {
      const empClean = cleanName(emp.name);
      const listCounts = activationCountsByEmp[empClean];
      const isEmpTuan = empClean.includes('tuan');

      // 1. Chỉ tiêu lấy chuẩn từ cơ sở dữ liệu (Database / Sheet)
      let k3Target = (emp.k3Target !== undefined && emp.k3Target !== null) ? Number(emp.k3Target) : 0;
      let k4Target = (emp.k4Target !== undefined && emp.k4Target !== null) ? Number(emp.k4Target) : 0;
      let khTarget = (emp.khTarget !== undefined && emp.khTarget !== null) ? Number(emp.khTarget) : 0;
      let khmhThangTarget = 0;

      // 2. Thực hiện: Ưu tiên số liệu thực đạt từ Sheet (nếu có); nếu sheet = 0 thì đồng bộ theo số khách hàng thực đạt từ danh sách Data Kích Hoạt
      let k3Actual = (emp.k3Actual !== undefined && emp.k3Actual !== null) ? Number(emp.k3Actual) : 0;
      if (k3Actual === 0 && listCounts && listCounts.k3Actual > 0) {
        k3Actual = listCounts.k3Actual;
      }

      let k4Actual = (emp.k4Actual !== undefined && emp.k4Actual !== null) ? Number(emp.k4Actual) : 0;
      if (k4Actual === 0 && listCounts && listCounts.k4Actual > 0) {
        k4Actual = listCounts.k4Actual;
      }

      let khActual = (emp.khActual !== undefined && emp.khActual !== null) ? Number(emp.khActual) : 0;
      if (khActual === 0 && listCounts && listCounts.khActual > 0) {
        khActual = listCounts.khActual;
      }

      // HRC (Lựa Chọn 1): Chỉ tiêu và Thực hiện chỉ áp dụng cho Nguyễn Đức Tuấn
      let khmhThangActual = 0;
      if (isEmpTuan) {
        khmhThangTarget = (emp.khmhThangTarget !== undefined && emp.khmhThangTarget !== null && Number(emp.khmhThangTarget) > 0)
          ? Number(emp.khmhThangTarget)
          : 110;

        khmhThangActual = (emp.khmhThangActual !== undefined && emp.khmhThangActual !== null && Number(emp.khmhThangActual) > 0)
          ? Number(emp.khmhThangActual)
          : 0;

        if (khmhThangActual === 0 && listCounts && listCounts.khmhThangActual > 0) {
          khmhThangActual = listCounts.khmhThangActual;
        } else if (khmhThangActual === 0) {
          khmhThangActual = 85;
        }
      }

      // Chỉ sử dụng mẫu mock khi CHƯA kết nối bảng tính database và toàn bộ chỉ tiêu đều trống
      if (!isConnected && k3Target === 0 && k4Target === 0 && khTarget === 0) {
        const DEFAULT_KPIS: Record<string, { k3Target: number; k3Actual: number; k4Target: number; k4Actual: number; khTarget: number; khActual: number; khmhThangTarget?: number; khmhThangActual?: number; }> = {
          'le thi huong': { k3Target: 110, k3Actual: 114, k4Target: 66, k4Actual: 78, khTarget: 116, khActual: 121, khmhThangTarget: 0, khmhThangActual: 0 },
          'nguyen thanh thuc': { k3Target: 105, k3Actual: 108, k4Target: 62, k4Actual: 70, khTarget: 110, khActual: 115, khmhThangTarget: 0, khmhThangActual: 0 },
          'bui manh cuong': { k3Target: 100, k3Actual: 102, k4Target: 60, k4Actual: 65, khTarget: 105, khActual: 108, khmhThangTarget: 0, khmhThangActual: 0 },
          'nguyen sy vu': { k3Target: 95, k3Actual: 90, k4Target: 55, k4Actual: 50, khTarget: 100, khActual: 92, khmhThangTarget: 0, khmhThangActual: 0 },
          'duong thi thanh': { k3Target: 120, k3Actual: 125, k4Target: 75, k4Actual: 82, khTarget: 125, khActual: 130, khmhThangTarget: 0, khmhThangActual: 0 },
          'vu anh tung': { k3Target: 90, k3Actual: 88, k4Target: 50, k4Actual: 48, khTarget: 95, khActual: 90, khmhThangTarget: 0, khmhThangActual: 0 },
          'nguyen thi hung nguyen': { k3Target: 85, k3Actual: 82, k4Target: 45, k4Actual: 42, khTarget: 90, khActual: 85, khmhThangTarget: 0, khmhThangActual: 0 },
          'nguyen duc tuan': { k3Target: 95, k3Actual: 96, k4Target: 58, k4Actual: 60, khTarget: 102, khActual: 105, khmhThangTarget: 110, khmhThangActual: 85 },
        };
        const def = DEFAULT_KPIS[empClean];
        if (def) {
          k3Target = def.k3Target;
          k3Actual = def.k3Actual;
          k4Target = def.k4Target;
          k4Actual = def.k4Actual;
          khTarget = def.khTarget;
          khActual = def.khActual;
          khmhThangTarget = def.khmhThangTarget || 0;
          khmhThangActual = def.khmhThangActual || 0;
        }
      }

      return {
        ...emp,
        k3Target,
        k3Actual,
        k4Target,
        k4Actual,
        khTarget,
        khActual,
        khmhThangTarget,
        khmhThangActual
      };
    });
  }, [employees, activationListData, connectedId]);

  // Helper to robustly match employee names in filters, including N/A -> N/A => Chưa gán KHBH
  const isEmployeeMatch = (recordName: string | null | undefined, filterName: string): boolean => {
    if (filterName === 'Tất cả') return true;
    const cleanFilter = filterName.trim().toLowerCase();
    const cleanRecord = (recordName || '').trim().toLowerCase();
    
    if (
      cleanFilter === 'n/a => chưa gán khbh' || 
      cleanFilter === 'n/a' || 
      cleanFilter === 'na' || 
      cleanFilter === '-' ||
      cleanFilter === 'chưa gán khbh'
    ) {
      return (
        cleanRecord === '' ||
        cleanRecord === 'n/a' ||
        cleanRecord === 'na' ||
        cleanRecord === 'nan' ||
        cleanRecord === '-' ||
        cleanRecord === 'chưa gán khbh' ||
        cleanRecord === 'n/a => chưa gán khbh'
      );
    }
    
    // Normal match (ignoring accent normalize form slightly if needed)
    return cleanRecord === cleanFilter || 
           cleanRecord.normalize('NFC') === cleanFilter.normalize('NFC');
  };

  // 1. Filtered target metadata list matching current active user scopes
  const filteredEmployeesData = syncedEmployees.filter((emp) => {
    if (isEmployeeView) {
      return isEmployeeMatch(emp.name, profile.name);
    }
    if (filters.employeeName !== 'Tất cả') {
      return isEmployeeMatch(emp.name, filters.employeeName);
    }
    return true;
  });

  // 2. Filtered list of raw daily transactions (number of items, cash volume etc)
  const filteredTransactions = transactions.filter((tx) => {
    // Check Date boundaries
    const dateOk = (!filters.startDate || tx.Ngay >= filters.startDate) && 
                   (!filters.endDate || tx.Ngay <= filters.endDate);
    
    // Check Employee scope
    const empOk = isEmployeeView 
      ? isEmployeeMatch(tx.NhanVien, profile.name)
      : isEmployeeMatch(tx.NhanVien, filters.employeeName);
      
    return dateOk && empOk;
  });

  // Compute aggregated sales performance targets versus realized actual metrics for sub-modules
  const totalTarget = filteredEmployeesData.reduce((sum, emp) => sum + emp.targetVal, 0);
  const totalActual = filteredEmployeesData.reduce((sum, emp) => sum + emp.actualVal, 0);

  // 3. Home Overview (Trang Chủ) uses the active employee filter (synced with Desktop top filter & Mobile bottom quick filter)
  const homeEmployeesData = filteredEmployeesData;
  const homeTransactions = filteredTransactions;
  const homeTotalTarget = totalTarget;
  const homeTotalActual = totalActual;
  const homeSelectedEmployeeName = effectiveEmployeeName;

  const sampleSheetTemplateUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing';
  const isOwner = profile.role === 'Admin' || profile.role === 'MKT Sup' || profile.role === 'OM' || profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com';

  if (!loggedInUser) {
    return (
      <LoginScreen
        initialSheetUrl={sheetUrl}
        onLoginSuccess={(user, url, id, fetchedData, remember) => {
          if (remember) {
            localStorage.setItem('logged_in_user', JSON.stringify(user));
          } else {
            sessionStorage.setItem('logged_in_user', JSON.stringify(user));
          }
          setLoggedInUser(user);
          
          if (url) {
            setSheetUrl(url);
            localStorage.setItem('gs_sheet_url', url);
          }
          if (id) {
            setConnectedId(id);
            localStorage.setItem('gs_sheet_id', id);
          }
          
          if (fetchedData) {
            setEmployees(fetchedData.employees);
            setTransactions(fetchedData.transactions);
            if (fetchedData.permissions && fetchedData.permissions.length > 0) {
              setPermissions(fetchedData.permissions);
              localStorage.setItem('gs_permissions', JSON.stringify(fetchedData.permissions));
            }
            setSectorData(fetchedData.sectorData);
            setCttbData(fetchedData.cttbData);
            setGrowthData(fetchedData.growthData);
            setAnnualBonusData(fetchedData.annualBonusData);
            setSyncTime(`Đã đồng bộ lúc: ${fetchedData.lastUpdated}`);
          }
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50/60 text-slate-800 font-sans selection:bg-emerald-500 selection:text-white relative flex flex-row ${isDesktopMode ? 'overflow-x-auto w-full' : ''}`}>
      {/* September 2nd National Day Background Theme */}
      <NationalDay29Background enabled={isNationalDayTheme} opacity={nationalDayOpacity} />

      {/* Modern Enterprise Sidebar: Fixed/Sticky on Desktop, Off-canvas Drawer on Mobile */}
      <AppSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'tracuu') {
            setActiveTab('tracuu');
            setIsSalesSubMenuOpen(false);
            setIsMoreMenuOpen(false);

          } else if (tab === 'taikhoan') {
            setIsSalesSubMenuOpen(false);
            setIsMoreMenuOpen(false);
            if (profile.role === 'Admin') {
              setActiveTab('taikhoan');
            } else {
              setIsProfileModalOpen(true);
            }
          } else {
            setActiveTab(tab);
            setIsSalesSubMenuOpen(false);
            setIsMoreMenuOpen(false);
          }
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => {
          setIsSidebarCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('app_sidebar_collapsed', String(next));
            return next;
          });
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isSupervisor={isSupervisor}
        userRole={profile.role}
        userName={effectiveMyName || extraProfile.hoVaTen || profile.name}
        userVtbh={extraProfile.vtbhCode}
        userAvatarUrl={extraProfile.avatarUrl}
        canSendZalo={canSendZalo}
        onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
        onOpenZaloShare={() => handleOpenZaloShare()}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        isNationalDayTheme={isNationalDayTheme}
        onToggleNationalDayTheme={toggleNationalDayTheme}
        onLogout={handleLogout}
        appLogoIcon={appLogoIcon}
        appLogoCustomUrl={appLogoCustomUrl}
        onOpenIconPicker={() => setIsIconPickerOpen(true)}
      />

      {/* Main Content Column: Takes the entire remaining space */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen relative transition-[min-width] duration-200 ${isDesktopMode ? 'min-w-[1280px]' : ''}`}>
        {/* Top Festive Header Banner */}
        <NationalDay29HeaderBanner enabled={isNationalDayTheme} />

        {/* Modern Enterprise Dashboard Header: Screen Title on Left, Notifications & Account on Right */}
        <AppHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          cycleStartDate={cycleStartDate}
          cycleEndDate={cycleEndDate}
          isSyncing={isSyncing}
          syncTime={syncTime}
          onManualSync={handleManualSync}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          isSupervisor={isSupervisor}
          cursorType={cursorType}
          onChangeCursorType={setCursorType}
          totalUnreadNotifications={totalUnreadNotifications}
          onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
          isNationalDayTheme={isNationalDayTheme}
          onToggleNationalDayTheme={toggleNationalDayTheme}
          nationalDayOpacity={nationalDayOpacity}
          nationalDayCustomBgUrl={nationalDayCustomBgUrl}
          headerBgColor={headerBgColor}
          headerTextColor={headerTextColor}
          headerStylePreset={headerStylePreset}
          userName={effectiveMyName || extraProfile.hoVaTen || profile.name}
          userRole={profile.role}
          userVtbh={extraProfile.vtbhCode}
          userChannel={extraProfile.channel}
          userAvatarUrl={extraProfile.avatarUrl}
          activeEmployeeContext={
            !isEmployeeView && activeTab !== 'trangchu'
              ? (activeTab === 'kichhoat' ? effectiveActivationEmployeeName : effectiveEmployeeName)
              : undefined
          }
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
        />

        <main className={`${isFullscreen || activeTab === 'kichhoat' || activeTab === 'thidua' || activeTab === 'doanhso' ? 'max-w-none w-full px-2 sm:px-4 md:px-6 lg:px-8' : ((!isEmployeeView ? 'max-w-[1550px]' : 'max-w-7xl') + ' px-2 sm:px-4 md:px-8')} mx-auto py-2.5 sm:py-6 pb-24 md:pb-8 transition-[padding,max-width] duration-200`}>
        {activeTab !== 'trangchu' && activeTab !== 'kichhoat' && activeTab !== 'chamcong' && activeTab !== 'trungbay' && activeTab !== 'doanhso' && activeTab !== 'thidua' && activeTab !== 'taikhoan' && activeTab !== 'tracuu' && (
          <div id="filters-panel-card" className="app-surface p-4 md:p-5 mb-6">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700">Bộ lọc thông tin dữ liệu</h3>
              </div>
              {isEmployeeView ? (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                  <User className="w-3 h-3" /> {profile.name} (Nhân viên)
                </span>
              ) : (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                  <LockOpen className="w-3 h-3" /> Quyền Quản Trị ({profile.role})
                </span>
              )}
            </div>

            <div className="max-w-md">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Lọc theo nhân viên
                </label>
                {isEmployeeView ? (
                  <div className="app-control flex items-center justify-between bg-slate-50 text-slate-800 font-semibold">
                    <span>{profile.name}</span>
                  </div>
                ) : (
                  <select
                    value={filters.employeeName}
                    onChange={(e) => setFilters((p) => ({ ...p, employeeName: e.target.value }))}
                    className="app-control cursor-pointer"
                  >
                    {activeTab !== 'chamcong' && (
                      <option value="Tất cả">Tất cả nhân viên</option>
                    )}
                    {availableEmployees.map((emp) => (
                      <option key={emp} value={emp}>
                        {emp}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Nested Tabs Views container stack */}
        <div className="space-y-6 w-full min-w-0">
            {/* TRANG CHỦ (HOME OVERVIEW) */}
            {activeTab === 'trangchu' && (
              <div key="tab-trangchu" className="space-y-6">
                <HomeOverview
                  totalTarget={homeTotalTarget}
                  totalActual={homeTotalActual}
                  selectedEmployeeName={homeSelectedEmployeeName}
                  onSelectEmployee={(name) => setFilters((p) => ({ ...p, employeeName: name }))}
                  availableEmployees={availableEmployees}
                  isEmployeeView={isEmployeeView}
                  employees={homeEmployeesData}
                  transactions={homeTransactions}
                  sectorData={sectorData}
                  cttbData={cttbData}
                  activationListData={activationListData}
                  trungBayListData={trungBayListData}
                  tuNhienRecords={tuNhienRecords}
                  profileName={profile.name}
                  profileRole={profile.role}
                  cycleStartDate={cycleStartDate}
                  cycleEndDate={cycleEndDate}
                  sheetId={connectedId || extractSheetId(sheetUrl) || ''}
                  syncKey={syncTime}
                  onNavigateToTab={(tab, subTab, attendanceSubTab) => {
                    setActiveTab(tab);
                    if (subTab) {
                      setSalesSubTab(subTab);
                    }
                    if (tab === 'chamcong') {
                      setAttendanceTargetSubTab(attendanceSubTab || 'chamcong');
                    }
                  }}
                />
              </div>
            )}

            {activeTab === 'doanhso' && (
              <div key="tab-doanhso" className="space-y-4">
                {/* Sales submodule switcher: desktop only; mobile uses the bottom sheet. */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-xl px-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSalesSubTab('tiendo')}
                      className={`min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                        salesSubTab === 'tiendo'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40 font-bold'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Package className="w-4 h-4 shrink-0" />
                      <span>Tiến Độ Số Bán</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSalesSubTab('doanhso')}
                      className={`min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                        salesSubTab === 'doanhso'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40 font-bold'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4 shrink-0" />
                      <span>Tiến Độ Doanh Số</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSalesSubTab('thuongnam')}
                      className={`min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                        salesSubTab === 'thuongnam'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40 font-bold'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Trophy className="w-4 h-4 shrink-0" />
                      <span>Tiến Độ Thưởng Năm</span>
                    </button>

                    {isSupervisor && (
                      <button
                        type="button"
                        onClick={() => setSalesSubTab('tangtruong')}
                        className={`min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                          salesSubTab === 'tangtruong'
                            ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40 font-bold'
                            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        <span>Tăng Trưởng Năm</span>
                      </button>
                    )}
                  </div>
                </div>

                {salesSubTab === 'doanhso' ? (
                  <div className="space-y-4">
                    <EmployeeTable
                      employees={filteredEmployeesData}
                      selectedEmployeeName={effectiveEmployeeName}
                      onSelectEmployee={(name) => setFilters((p) => ({ ...p, employeeName: name }))}
                      isEmployeeView={isEmployeeView}
                      isSupervisor={profile.role === 'Admin'}
                      onOpenZaloShare={canSendZalo ? handleOpenZaloShare : undefined}
                    />
                  </div>
                ) : (
                  <TargetAnalysis
                    transactions={filteredTransactions}
                    employeeNameFilter={effectiveEmployeeName}
                    employees={filteredEmployeesData}
                    sectorData={sectorData}
                    clfDetailedRows={clfDetailedRows}
                    mccDetailedRows={mccDetailedRows}
                    ndfcDetailedRows={ndfcDetailedRows}
                    isEmployeeView={isEmployeeView}
                    activationListData={activationListData}
                    growthData={growthData}
                    annualBonusData={annualBonusData}
                    salesSubTab={salesSubTab}
                    onSalesSubTabChange={setSalesSubTab}
                    onSelectEmployee={(name) => setFilters((p) => ({ ...p, employeeName: name }))}
                    availableEmployees={availableEmployees}
                    profileRole={profile.role}
                    cycleStartDate={cycleStartDate}
                    cycleEndDate={cycleEndDate}
                    onStartDateChange={handleStartDateChange}
                    onEndDateChange={handleEndDateChange}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onOpenZaloShare={canSendZalo ? () => handleOpenZaloShare() : undefined}
                  />
                )}
              </div>
            )}
  
            {activeTab === 'kichhoat' && (
              <div key="tab-kichhoat" className="space-y-6">
                {/* Tỷ lệ hoàn thành kích hoạt các ngành hàng - Hiển thị cho cả Quản lý và Saleman */}
                <ActivationRates
                  employees={syncedEmployees}
                  isEmployeeView={isEmployeeView}
                  selectedEmployeeName={effectiveActivationEmployeeName}
                  onSelectEmployee={(name) => setActivationEmployeeFilter(name)}
                  profileName={profile.name}
                  profileRole={profile.role}
                  viewingEmpName={viewingEmpName}
                  setViewingEmpName={setViewingEmpName}
                  activationListData={activationListData}
                />
  
                {/* TIẾN ĐỘ KÍCH HOẠT ĐA NGÀNH HÀNG */}
                <EmployeeActivationTable
                  employees={syncedEmployees}
                  selectedEmployeeName={effectiveActivationEmployeeName}
                  onSelectEmployee={(name) => setActivationEmployeeFilter(name)}
                  isEmployeeView={isEmployeeView}
                  activationListData={activationListData}
                  trungBayListData={trungBayListData}
                  viewingEmpName={viewingEmpName}
                  setViewingEmpName={setViewingEmpName}
                  sheetId={connectedId || extractSheetId(sheetUrl) || ''}
                  currentUserName={effectiveMyName}
                  userRole={profile.role}
                />
              </div>
            )}
  
            {activeTab === 'trungbay' && (
              <div key="tab-trungbay" className="space-y-6">
                {/* Tiến độ thực hiện các CTTB - Hiển thị cho cả Quản lý và Saleman */}
                <CttbProgress 
                  cttbData={cttbData} 
                  selectedEmployeeName={effectiveEmployeeName} 
                  isEmployeeView={isEmployeeView}
                  trungBayListData={trungBayListData}
                  employees={filteredEmployeesData}
                  tuNhienRecords={tuNhienRecords}
                  meizanRecords={meizanRecords}
                  onSelectEmployee={(name) => setFilters((p) => ({ ...p, employeeName: name }))}
                />
              </div>
            )}
  
            {activeTab === 'chamcong' && (
              <div key="tab-chamcong" className="space-y-6">
                <AttendanceSystem 
                  chamCongListData={chamCongListData}
                  selectedEmployeeName={effectiveEmployeeName}
                  currentUser={{
                    ...profile,
                    name: (extraProfile.hoVaTen && extraProfile.hoVaTen.trim() !== '') 
                      ? extraProfile.hoVaTen 
                      : (profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com' 
                          ? 'Trần Duy Tùng' 
                          : (profile.email?.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com' 
                              ? 'Hoàng Văn Lâm' 
                              : (profile.name === 'Tất cả' ? 'Quản lý' : profile.name)))
                  }}
                  employees={employees}
                  onSelectEmployee={(name) => setFilters((p) => ({ ...p, employeeName: name }))}
                  selectedCycle={attendanceSelectedCycle}
                  onSelectCycle={setAttendanceSelectedCycle}
                  initialSubTab={attendanceTargetSubTab}
                  initialLeaveId={attendanceTargetLeaveId}
                  initialEvalId={attendanceTargetEvalId}
                  onClearInitialTargets={() => {
                    setAttendanceTargetLeaveId(null);
                    setAttendanceTargetEvalId(null);
                  }}
                  onOpenZaloShare={canSendZalo ? () => handleOpenZaloShare() : undefined}
                />
              </div>
            )}
  
            {activeTab === 'thidua' && (
              <div key="tab-thidua" className="space-y-6">
                <ThiDuaModule
                  sheetId={connectedId || extractSheetId(sheetUrl) || ''}
                  selectedEmployeeName={effectiveEmployeeName}
                  onSelectEmployee={(name) => setFilters((p) => ({ ...p, employeeName: name }))}
                  isEmployeeView={isEmployeeView}
                  isSupervisor={isSupervisor}
                  isMarketSupervisor={isMarketSupervisor}
                  userRole={profile.role}
                  currentUserName={effectiveMyName}
                  syncKey={syncTime}
                />
              </div>
            )}

            {activeTab === 'tracuu' && (
              <div key="tab-tracuu" className="space-y-6">
                <InventoryLookup 
                  sheetId={connectedId || extractSheetId(sheetUrl) || ''} 
                  syncKey={syncTime}
                  currentUser={{
                    ...profile,
                    name: (extraProfile.hoVaTen && extraProfile.hoVaTen.trim() !== '') 
                      ? extraProfile.hoVaTen 
                      : (profile.email?.toLowerCase().trim() === 'tungluu1992ab@gmail.com' 
                          ? 'Trần Duy Tùng' 
                          : (profile.email?.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com' 
                              ? 'Hoàng Văn Lâm' 
                              : (profile.name === 'Tất cả' ? 'Quản lý' : profile.name))),
                    hoVaTen: extraProfile.hoVaTen
                  }}
                />
              </div>
            )}

            {activeTab === 'taikhoan' && profile.role === 'Admin' && (
              <div key="tab-taikhoan" className="space-y-6">
                <AccountManager 
                  permissions={permissions}
                  setPermissions={setPermissions}
                  employees={employees}
                  currentUserEmail={loggedInUser?.email}
                />
              </div>
            )}
          </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-slate-500 text-xs py-5 border-t border-slate-200 max-w-7xl mx-auto px-4 mt-6">
        <p>
          Wilmar Marketing CLV © Hệ thống quản trị bán hàng &amp; đồng bộ dữ liệu trực tuyến
        </p>
      </footer>

      {/* Profile & Admin Account Settings Modal Dialog */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteAccountEmail(null);
              setIsProfileModalOpen(false);
            }
          }}
        >
          <div
            ref={profileModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Cài đặt tài khoản và hiển thị"
            tabIndex={-1}
            className={`w-full bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-xl overflow-y-auto max-h-[88vh] p-4 sm:p-5 space-y-4 outline-none ${
              activeSettingsTab === 'accounts' && loggedInUser?.role === 'Admin' ? 'max-w-md sm:max-w-lg' : 'max-w-sm sm:max-w-md'
            }`}
          >
            {/* Tab Selection Header for Admins */}
            {loggedInUser && loggedInUser.role === 'Admin' ? (
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 gap-3">
                <div className="flex gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteAccountEmail(null);
                      setActiveSettingsTab('profile');
                    }}
                    className={`min-h-[44px] sm:min-h-[36px] px-1 transition-colors border-b-2 cursor-pointer ${
                      activeSettingsTab === 'profile'
                        ? 'border-emerald-600 text-emerald-700 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cá nhân
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteAccountEmail(null);
                      setActiveSettingsTab('accounts');
                    }}
                    className={`min-h-[44px] sm:min-h-[36px] px-1 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                      activeSettingsTab === 'accounts'
                        ? 'border-emerald-600 text-emerald-700 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="tabular-nums">Quản lý tài khoản ({permissions?.length || 0})</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteAccountEmail(null);
                    setIsProfileModalOpen(false);
                  }}
                  aria-label="Đóng"
                  className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Cập nhật thông tin nhân viên</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  aria-label="Đóng"
                  className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* TAB CONTENT: ACCOUNT MANAGEMENT */}
            {activeSettingsTab === 'accounts' && loggedInUser?.role === 'Admin' ? (
              <div className="space-y-3.5 text-xs text-left">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Sửa tài khoản hoặc tạo mới
                  </label>
                  <select
                    value={selectedAccountEmail}
                    onChange={(e) => {
                      setConfirmDeleteAccountEmail(null);
                      setSelectedAccountEmail(e.target.value);
                    }}
                    className="app-control text-xs font-medium cursor-pointer"
                  >
                    <option value="new">+ Tạo tài khoản mới</option>
                    {permissions.map((p) => (
                      <option key={p.email} value={p.email}>
                        {p.hoVaTen || p.email.split('@')[0]} ({p.email}) [{p.role}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Email đăng nhập
                      </label>
                      <input
                        type="text"
                        value={acctEmail}
                        disabled={selectedAccountEmail !== 'new'}
                        onChange={(e) => setAcctEmail(e.target.value)}
                        className="app-control text-xs disabled:opacity-60 disabled:bg-slate-100"
                        placeholder="VD: nguyen.van.a"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Mật khẩu
                      </label>
                      <input
                        type="text"
                        value={acctPassword}
                        onChange={(e) => setAcctPassword(e.target.value)}
                        className="app-control text-xs font-mono"
                        placeholder="Mật khẩu"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Vai trò
                      </label>
                      <select
                        value={acctRole}
                        onChange={(e) => setAcctRole(e.target.value)}
                        className="app-control text-xs cursor-pointer font-medium"
                      >
                        <option value="Nhân viên">Nhân viên / Salesman</option>
                        <option value="Admin">Giám Sát Thị Trường</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Họ và tên
                      </label>
                      <input
                        type="text"
                        value={acctHoVaTen}
                        onChange={(e) => setAcctHoVaTen(e.target.value)}
                        className="app-control text-xs font-medium"
                        placeholder="Họ và tên đầy đủ"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {(profile.role === 'Admin' || profile.role === 'OM' || profile.role === 'MKT Sup') ? 'Mã NV' : 'Mã VTBH'}
                      </label>
                      <input
                        type="text"
                        value={acctVtbhCode}
                        onChange={(e) => setAcctVtbhCode(e.target.value.toUpperCase())}
                        className="app-control text-xs font-mono"
                        placeholder="VD: VTBH309"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Kênh bán hàng
                      </label>
                      <input
                        type="text"
                        value={acctChannel}
                        onChange={(e) => setAcctChannel(e.target.value)}
                        className="app-control text-xs"
                        placeholder="VD: GT, MT"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nhân viên / Salesman liên kết
                    </label>
                    <select
                      value={acctMappedEmployee}
                      onChange={(e) => setAcctMappedEmployee(e.target.value)}
                      className="app-control text-xs cursor-pointer font-medium"
                    >
                      <option value="">Không liên kết (Tự lọc hoặc Admin)</option>
                      {sortAndFormatEmployeeNames(employees.map(e => e.name))
                        .filter(name => name !== 'N/A => Chưa gán KHBH')
                        .map((empName) => (
                          <option key={empName} value={empName}>{empName}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 mt-4">
                  <div>
                    {selectedAccountEmail !== 'new' ? (
                      confirmDeleteAccountEmail === selectedAccountEmail ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = permissions.filter(p => p.email.toLowerCase().trim() !== selectedAccountEmail.toLowerCase().trim());
                              setPermissions(filtered);
                              localStorage.setItem('gs_permissions', JSON.stringify(filtered));
                              deleteUserPermissionFromFirestore(selectedAccountEmail);
                              setSelectedAccountEmail('new');
                              setConfirmDeleteAccountEmail(null);
                              notify.success('Đã xóa tài khoản.');
                            }}
                            className="py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAccountEmail(null)}
                            className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAccountEmail(selectedAccountEmail)}
                          className="py-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold transition-colors cursor-pointer"
                        >
                          Xóa
                        </button>
                      )
                    ) : (
                      <span />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteAccountEmail(null);
                        setIsProfileModalOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!acctEmail.trim()) {
                          notify.error('Email đăng nhập không được để trống.');
                          return;
                        }
                        const finalEmail = acctEmail.trim().toLowerCase();
                        let updated = [...permissions];
                        
                        if (selectedAccountEmail === 'new') {
                          const fullEmail = finalEmail.includes('@') ? finalEmail : `${finalEmail}@fmcg.com`;
                          const exists = permissions.some(p => p.email.toLowerCase().trim() === fullEmail);
                          if (exists) {
                            notify.error('Email tài khoản này đã tồn tại.');
                            return;
                          }
                          const newRecord: UserPermission = {
                            email: fullEmail,
                            password: acctPassword,
                            role: acctRole,
                            mappedEmployee: acctMappedEmployee || undefined,
                            hoVaTen: acctHoVaTen || undefined,
                            vtbhCode: acctVtbhCode || undefined,
                            channel: acctChannel || undefined,
                            locked: false,
                            soLuotTruyCap: 0
                          };
                          updated.push(newRecord);
                          saveUserPermissionToFirestore(newRecord);
                          notify.success(`Đã tạo tài khoản: ${newRecord.email}`);
                        } else {
                          let editedAccount: UserPermission | null = null;
                          updated = permissions.map(p => {
                            if (p.email.toLowerCase().trim() === selectedAccountEmail.toLowerCase().trim()) {
                              editedAccount = {
                                ...p,
                                password: acctPassword,
                                role: acctRole,
                                mappedEmployee: acctMappedEmployee || undefined,
                                hoVaTen: acctHoVaTen || undefined,
                                vtbhCode: acctVtbhCode || undefined,
                                channel: acctChannel || undefined
                              };
                              return editedAccount;
                            }
                            return p;
                          });
                          if (editedAccount) {
                            saveUserPermissionToFirestore(editedAccount);
                            if (loggedInUser && loggedInUser.email.toLowerCase().trim() === (editedAccount as UserPermission).email.toLowerCase().trim()) {
                              const updatedUser = { ...loggedInUser, ...editedAccount };
                              setLoggedInUser(updatedUser);
                              if (localStorage.getItem('logged_in_user')) {
                                localStorage.setItem('logged_in_user', JSON.stringify(updatedUser));
                              } else {
                                sessionStorage.setItem('logged_in_user', JSON.stringify(updatedUser));
                              }
                            }
                          }
                          notify.success('Cập nhật tài khoản thành công.');
                        }

                        setPermissions(updated);
                        localStorage.setItem('gs_permissions', JSON.stringify(updated));
                        setSelectedAccountEmail('new');
                        setConfirmDeleteAccountEmail(null);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                    >
                      {selectedAccountEmail === 'new' ? 'Tạo mới' : 'Lưu lại'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB CONTENT: PROFILE EDIT */
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const hoValue = formData.get('hoVaTen') as string;
                const vtbhValue = formData.get('vtbhCode') as string;
                const channelValue = formData.get('channel') as string;
                
                handleSaveExtraProfile({
                  hoVaTen: hoValue.trim(),
                  vtbhCode: vtbhValue.trim(),
                  channel: channelValue.trim(),
                  avatarUrl: extraProfile.avatarUrl
                });
                notify.success('Đã cập nhật thông tin.');
              }} className="space-y-3 text-xs">
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh đại diện (Hình ảnh)</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 shrink-0">
                      {extraProfile.avatarUrl ? (
                        <img referrerPolicy="no-referrer" src={extraProfile.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] font-semibold">Chưa có</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="form-avatar-file"
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setExtraProfile(prev => ({ ...prev, avatarUrl: reader.result as string }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="form-avatar-file"
                        className="min-h-[44px] sm:min-h-[36px] flex items-center justify-center px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-center cursor-pointer transition-colors"
                      >
                        Chọn file ảnh từ máy
                      </label>
                      {extraProfile.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setExtraProfile(prev => ({ ...prev, avatarUrl: '' }))}
                          className="text-xs text-rose-600 font-semibold hover:underline self-start bg-transparent border-0 cursor-pointer py-1"
                        >
                          Xóa ảnh hiện tại
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên nhân viên</label>
                  <input
                    type="text"
                    name="hoVaTen"
                    required
                    defaultValue={extraProfile.hoVaTen}
                    className="app-control text-xs font-medium"
                    placeholder="Nhập họ và tên đầy đủ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {(profile.role === 'Admin' || profile.role === 'OM' || profile.role === 'MKT Sup') ? 'Mã NV' : 'Mã VTBH'}
                    </label>
                    <input
                      type="text"
                      name="vtbhCode"
                      defaultValue={extraProfile.vtbhCode}
                      className="app-control text-xs font-mono"
                      placeholder="VD: VTBH309"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kênh bán hàng</label>
                    <input
                      type="text"
                      name="channel"
                      defaultValue={extraProfile.channel}
                      className="app-control text-xs"
                      placeholder="VD: GT, MT, Horeca"
                    />
                  </div>
                </div>

                {/* Display & Layout Settings inside App.tsx Settings */}
                <div className="border-t border-slate-200 pt-3 mt-3 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Thiết lập hiển thị &amp; thu phóng (Zoom)
                  </label>

                  {/* UI Zoom Control */}
                  <AppZoomControl />

                  <div className="text-[11px] space-y-2.5">
                    {/* Phone vs Desktop layout switcher */}
                    <button
                      type="button"
                      onClick={() => setIsDesktopMode(prev => !prev)}
                      className={`w-full min-h-[44px] sm:min-h-[36px] p-2 rounded-lg border flex items-center justify-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                        isDesktopMode
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isDesktopMode ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5 text-slate-600" />}
                      <span>{isDesktopMode ? 'Lượt xem di động' : 'Xem Máy tính'}</span>
                    </button>

                    {/* National Day 2/9 Theme Toggle in Settings */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-amber-400 shrink-0 flex items-center justify-center bg-[#DA251D]">
                            <svg className="w-full h-full" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect width="300" height="200" fill="#DA251D" />
                              <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
                            </svg>
                          </div>
                          <span className="font-semibold text-slate-800">Chủ đề Quốc khánh 2/9</span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleNationalDayTheme}
                          className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                            isNationalDayTheme
                              ? 'bg-red-600 text-amber-100 border border-red-700'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isNationalDayTheme ? 'Đang bật' : 'Tắt'}
                        </button>
                      </div>

                      {isNationalDayTheme && (
                        <div className="pt-2 border-t border-slate-200 space-y-2.5">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] text-slate-600">
                              <span>Độ mờ / Độ đậm hình nền:</span>
                              <span className="font-mono text-emerald-700 font-bold tabular-nums">{Math.round(nationalDayOpacity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.05"
                              value={nationalDayOpacity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setNationalDayOpacity(val);
                                localStorage.setItem('national_day_opacity', String(val));
                                saveThemeSettingsToFirestore({ nationalDayOpacity: val });
                              }}
                              className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* Custom Background Image Manager (Supervisor Only) */}
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            {isSupervisor ? (
                              <>
                                <label className="block text-[11px] font-semibold text-slate-700">
                                  Chèn hình nền tùy chỉnh (Giám Sát):
                                </label>

                                <div className="flex items-center gap-2">
                                  <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors">
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Chọn ảnh từ thiết bị...</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = () => {
                                            const img = new Image();
                                            img.onload = () => {
                                              const canvas = document.createElement('canvas');
                                              let width = img.width;
                                              let height = img.height;
                                              const MAX_SIZE = 1200;
                                              if (width > MAX_SIZE || height > MAX_SIZE) {
                                                if (width > height) {
                                                  height = Math.round((height * MAX_SIZE) / width);
                                                  width = MAX_SIZE;
                                                } else {
                                                  width = Math.round((width * MAX_SIZE) / height);
                                                  height = MAX_SIZE;
                                                }
                                              }
                                              canvas.width = width;
                                              canvas.height = height;
                                              const ctx = canvas.getContext('2d');
                                              if (ctx) {
                                                ctx.drawImage(img, 0, 0, width, height);
                                                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                                setNationalDayCustomBgUrl(dataUrl);
                                                localStorage.setItem('national_day_custom_bg_url', dataUrl);
                                                saveThemeSettingsToFirestore({ nationalDayCustomBgUrl: dataUrl });
                                              }
                                            };
                                            img.src = reader.result as string;
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>

                                  {nationalDayCustomBgUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNationalDayCustomBgUrl('');
                                        localStorage.removeItem('national_day_custom_bg_url');
                                        saveThemeSettingsToFirestore({ nationalDayCustomBgUrl: '' });
                                      }}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] transition-colors cursor-pointer"
                                      title="Xóa/Khôi phục ảnh mặc định"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[10px] text-slate-600">Hoặc dán đường dẫn URL hình ảnh:</span>
                                  <input
                                    type="text"
                                    value={nationalDayCustomBgUrl}
                                    onChange={(e) => {
                                      const url = e.target.value;
                                      setNationalDayCustomBgUrl(url);
                                      if (url) {
                                        localStorage.setItem('national_day_custom_bg_url', url);
                                      } else {
                                        localStorage.removeItem('national_day_custom_bg_url');
                                      }
                                      saveThemeSettingsToFirestore({ nationalDayCustomBgUrl: url });
                                    }}
                                    placeholder="Dán URL link ảnh ở đây..."
                                    className="app-control text-[10.5px] font-mono py-1"
                                  />
                                </div>

                                {nationalDayCustomBgUrl && (
                                  <div className="mt-1 p-1.5 bg-white rounded-lg border border-slate-200 flex items-center gap-2">
                                    <img
                                      src={nationalDayCustomBgUrl}
                                      alt="Preview"
                                      className="w-12 h-10 object-contain bg-slate-100 rounded border border-slate-200 shrink-0"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                    <div className="text-[9.5px] text-slate-600 truncate flex-1">
                                      <span className="font-bold text-emerald-700 block">Đã áp dụng &amp; đồng bộ đám mây</span>
                                      <span>Tự động đồng bộ trên tất cả thiết bị.</span>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 text-[10px]">
                                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                                  <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Hình nền tùy chỉnh (Dành riêng cho Giám Sát)</span>
                                </div>
                                {nationalDayCustomBgUrl && (
                                  <div className="mt-1 p-1.5 bg-slate-50 rounded-md border border-slate-200 flex items-center gap-2">
                                    <img
                                      src={nationalDayCustomBgUrl}
                                      alt="Preview"
                                      className="w-10 h-8 object-contain bg-white rounded border border-slate-200 shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="text-[9.5px] text-slate-600 truncate">
                                      <span className="font-bold text-slate-800 block">Hình nền do Giám Sát cài đặt</span>
                                      <span>Tự động đồng bộ trên thiết bị của bạn</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Header Background & Text Color Customization */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                          <Palette className="w-4 h-4 text-emerald-600" />
                          <span>Tùy chỉnh màu nền &amp; màu chữ header</span>
                        </div>
                        {(headerBgColor || headerTextColor || headerStylePreset !== 'emerald_dark') && (
                          <button
                            type="button"
                            onClick={() => {
                              setHeaderBgColor('');
                              setHeaderTextColor('');
                              setHeaderStylePreset('emerald_dark');
                              localStorage.removeItem('header_bg_color');
                              localStorage.removeItem('header_text_color');
                              localStorage.setItem('header_style_preset', 'emerald_dark');
                              saveThemeSettingsToFirestore({
                                headerBgColor: '',
                                headerTextColor: '',
                                headerStylePreset: 'emerald_dark'
                              });
                            }}
                            className="text-[10px] text-slate-500 hover:text-emerald-700 underline cursor-pointer font-semibold"
                          >
                            Đặt lại mặc định
                          </button>
                        )}
                      </div>

                      {/* Presets Grid */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-600 block font-medium">1. Chọn bộ màu phối sẵn:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                          {[
                            { id: 'emerald_dark', name: 'Xanh Ngọc (Mặc định)', bg: 'from-[#022c28] to-[#0a5c54]', text: '#99f6e4' },
                            { id: 'midnight_blue', name: 'Xanh Đêm (Midnight)', bg: 'from-[#0f172a] to-[#1e293b]', text: '#38bdf8' },
                            { id: 'crimson_gold', name: 'Đỏ Cờ & Vàng Kim', bg: 'from-[#7f1d1d] to-[#450a0a]', text: '#fef08a' },
                            { id: 'royal_purple', name: 'Tím Hoàng Gia', bg: 'from-[#3b0764] to-[#2e1065]', text: '#f5d0fe' },
                            { id: 'slate_dark', name: 'Xám Titan (Lịch lãm)', bg: 'from-[#1e293b] to-[#0f172a]', text: '#e2e8f0' },
                          ].map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setHeaderStylePreset(preset.id);
                                setHeaderBgColor('');
                                setHeaderTextColor(preset.text);
                                localStorage.setItem('header_style_preset', preset.id);
                                localStorage.removeItem('header_bg_color');
                                localStorage.setItem('header_text_color', preset.text);
                                saveThemeSettingsToFirestore({
                                  headerStylePreset: preset.id,
                                  headerBgColor: '',
                                  headerTextColor: preset.text
                                });
                              }}
                              className={`p-1.5 rounded-lg border flex flex-col items-start gap-1 transition-colors cursor-pointer text-left ${
                                headerStylePreset === preset.id && !headerBgColor
                                  ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500/30'
                                  : 'border-slate-200 bg-white hover:bg-slate-100'
                              }`}
                            >
                              <div className={`w-full h-3.5 rounded bg-gradient-to-r ${preset.bg} border border-black/10`} />
                              <div className="flex items-center justify-between w-full">
                                <span className="font-bold text-slate-800 truncate">{preset.name}</span>
                                <span className="w-2 h-2 rounded-full shrink-0 border border-slate-300" style={{ backgroundColor: preset.text }} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Color Pickers */}
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <span className="text-[10px] text-slate-600 block font-medium">2. Hoặc tự phối màu tùy chọn:</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                            <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                              <span>Màu nền header</span>
                              {headerBgColor && <span className="text-emerald-700 font-mono text-[9px]">{headerBgColor}</span>}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={headerBgColor || '#05443e'}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  setHeaderBgColor(col);
                                  localStorage.setItem('header_bg_color', col);
                                  saveThemeSettingsToFirestore({ headerBgColor: col });
                                }}
                                className="w-7 h-7 rounded border border-slate-300 bg-transparent cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={headerBgColor}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  setHeaderBgColor(col);
                                  if (col) {
                                    localStorage.setItem('header_bg_color', col);
                                  } else {
                                    localStorage.removeItem('header_bg_color');
                                  }
                                  saveThemeSettingsToFirestore({ headerBgColor: col });
                                }}
                                placeholder="Mặc định gradient"
                                className="app-control px-1.5 py-1 text-[10px] font-mono"
                              />
                            </div>
                          </div>

                          <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                            <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                              <span>Màu chữ header</span>
                              {headerTextColor && <span className="text-emerald-700 font-mono text-[9px]">{headerTextColor}</span>}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={headerTextColor || '#99f6e4'}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  setHeaderTextColor(col);
                                  localStorage.setItem('header_text_color', col);
                                  saveThemeSettingsToFirestore({ headerTextColor: col });
                                }}
                                className="w-7 h-7 rounded border border-slate-300 bg-transparent cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={headerTextColor}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  setHeaderTextColor(col);
                                  if (col) {
                                    localStorage.setItem('header_text_color', col);
                                  } else {
                                    localStorage.removeItem('header_text_color');
                                  }
                                  saveThemeSettingsToFirestore({ headerTextColor: col });
                                }}
                                placeholder="#99f6e4"
                                className="app-control px-1.5 py-1 text-[10px] font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Live Header Preview Pill */}
                        <div 
                          style={{
                            backgroundColor: headerBgColor || undefined,
                            backgroundImage: !headerBgColor ? (
                              headerStylePreset === 'midnight_blue' ? 'linear-gradient(to right, #0f172a, #1e293b)' :
                              headerStylePreset === 'crimson_gold' ? 'linear-gradient(to right, #7f1d1d, #450a0a)' :
                              headerStylePreset === 'royal_purple' ? 'linear-gradient(to right, #3b0764, #2e1065)' :
                              headerStylePreset === 'slate_dark' ? 'linear-gradient(to right, #1e293b, #0f172a)' :
                              'linear-gradient(to right, #022c28, #0a5c54)'
                            ) : undefined
                          }}
                          className="px-3 py-2 rounded-lg border border-black/15 flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div 
                              style={{ color: headerTextColor || '#99f6e4' }} 
                              className="text-[11px] font-bold truncate"
                            >
                              Wilmar Marketing CLV
                            </div>
                            <div 
                              style={{ color: headerTextColor ? `${headerTextColor}cc` : '#99f6e4cc' }} 
                              className="text-[9px] font-semibold truncate"
                            >
                              Kỷ luật - Trách nhiệm - Nhiệt huyết
                            </div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/15 text-white font-bold border border-white/20">
                            Xem trước
                          </span>
                        </div>

                        {/* App Logo Icon Customization Row */}
                        <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Biểu tượng ứng dụng (Logo App)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsIconPickerOpen(true)}
                            className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-300 text-slate-800 hover:text-emerald-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          >
                            <Palette className="w-3.5 h-3.5" />
                            <span>Đổi biểu tượng</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] sm:min-h-[36px] px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors cursor-pointer"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* App Icon Customization Modal */}
      <AppIconPickerModal
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        currentIconId={appLogoIcon}
        currentCustomUrl={appLogoCustomUrl}
        onSave={handleSaveAppLogo}
      />

      {isMonthlyReportOpen && (
        <MonthlyReportModal
          isOpen={isMonthlyReportOpen}
          onClose={() => setIsMonthlyReportOpen(false)}
          selectedEmployeeName={filters.employeeName}
          isEmployeeView={isEmployeeView}
          employees={syncedEmployees}
          transactions={filteredTransactions}
          clfDetailedRows={clfDetailedRows}
          mccDetailedRows={mccDetailedRows}
          ndfcDetailedRows={ndfcDetailedRows}
          cttbData={cttbData}
          chamCongListData={chamCongListData}
          startDate={filters.startDate}
          endDate={filters.endDate}
          currentUser={loggedInUser}
          sectorData={sectorData}
          trungBayListData={trungBayListData}
          tuNhienRecords={tuNhienRecords}
          meizanRecords={meizanRecords}
          attendanceSelectedCycle={attendanceSelectedCycle}
          onOpenZaloShare={canSendZalo ? handleOpenZaloShare : undefined}
        />
      )}

      {isZaloShareOpen && canSendZalo && (
        <ZaloShareModal
          isOpen={isZaloShareOpen}
          onClose={() => setIsZaloShareOpen(false)}
          selectedEmployeeName={zaloTargetEmpName}
          isEmployeeView={isEmployeeView}
          employees={syncedEmployees}
          transactions={filteredTransactions}
          permissions={permissions}
          setPermissions={setPermissions}
          clfDetailedRows={clfDetailedRows}
          mccDetailedRows={mccDetailedRows}
          ndfcDetailedRows={ndfcDetailedRows}
          cttbData={cttbData}
          chamCongListData={chamCongListData}
          startDate={filters.startDate}
          endDate={filters.endDate}
          currentUser={loggedInUser}
          sectorData={sectorData}
          trungBayListData={trungBayListData}
          tuNhienRecords={tuNhienRecords}
          meizanRecords={meizanRecords}
          attendanceSelectedCycle={attendanceSelectedCycle}
        />
      )}

      {/* Mobile "Thêm" Bottom Sheet Modal */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[999] flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMoreMenuOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 bg-white text-slate-800 rounded-t-2xl shadow-lg border-t border-slate-200 max-h-[86dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Drag Handle Bar */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-1.5" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-600" />
                <span>Tất cả phân hệ &amp; tiện ích</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* GROUP 1: PHÂN HỆ */}
              <div>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="text-xs font-semibold text-slate-600">Phân hệ hoạt động</span>
                  <div className="flex-1 h-[1px] bg-slate-200" />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. Thi Đua */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('thidua');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`min-h-[56px] flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                      activeTab === 'thidua'
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'thidua'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold text-sm truncate ${activeTab === 'thidua' ? 'text-emerald-900' : 'text-slate-900'}`}>Thi đua</div>
                    </div>
                  </button>

                  {/* 2. Chấm Công */}
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceTargetSubTab('chamcong');
                      setActiveTab('chamcong');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`min-h-[56px] flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                      activeTab === 'chamcong'
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'chamcong'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-50 text-sky-600 border border-sky-200'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold text-sm truncate ${activeTab === 'chamcong' ? 'text-emerald-900' : 'text-slate-900'}`}>Chấm công</div>
                    </div>
                  </button>

                  {/* 3. Tồn Kho */}
                  {isSupervisor && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('tracuu');
                        setIsMoreMenuOpen(false);
                      }}
                      className={`min-h-[56px] flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                        activeTab === 'tracuu'
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        activeTab === 'tracuu'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}>
                        <Warehouse className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-bold text-sm truncate ${activeTab === 'tracuu' ? 'text-emerald-900' : 'text-slate-900'}`}>Tồn kho</div>
                      </div>
                    </button>
                  )}

                  {/* 4. Tài Khoản */}
                  {profile.role === 'Admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('taikhoan');
                        setIsMoreMenuOpen(false);
                      }}
                      className={`min-h-[56px] flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                        activeTab === 'taikhoan'
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        activeTab === 'taikhoan'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                      }`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-bold text-sm truncate ${activeTab === 'taikhoan' ? 'text-emerald-900' : 'text-slate-900'}`}>Tài khoản</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* GROUP 2: TÙY CHỈNH THU PHÓNG (ZOOM) GIAO DIỆN */}
              <div>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="text-xs font-semibold text-slate-600">Thu phóng giao diện</span>
                  <div className="flex-1 h-[1px] bg-slate-200" />
                </div>

                <AppZoomControl />
              </div>

              {/* GROUP 3: TIỆN ÍCH */}
              <div>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="text-xs font-semibold text-slate-600">Tiện ích nhanh</span>
                  <div className="flex-1 h-[1px] bg-slate-200" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Báo Cáo Tháng */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMonthlyReportOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-1">
                      <FileOutput className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-[11px] text-slate-800 leading-tight">Báo cáo tháng</span>
                  </button>

                  {/* Chủ Đề 2/9 */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleNationalDayTheme();
                      setIsMoreMenuOpen(false);
                    }}
                    className={`min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl border transition-colors cursor-pointer text-center ${
                      isNationalDayTheme
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1 ${
                      isNationalDayTheme ? 'bg-red-600 text-amber-300' : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}>
                      <Flag className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-[11px] leading-tight">Chủ đề 2/9</span>
                  </button>

                  {/* Logo App */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsIconPickerOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mb-1">
                      <Palette className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-[11px] text-slate-800 leading-tight">Logo app</span>
                  </button>

                  {/* Cài đặt */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-1">
                      <Settings className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-[11px] text-slate-800 leading-tight">Cài đặt</span>
                  </button>

                  {/* Đăng xuất */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      handleLogout();
                    }}
                    className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer text-center"
                  >
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center mb-1">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-[11px] text-rose-700 leading-tight">Đăng xuất</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Anchored Bottom Sheet for Doanh So Submenu on Mobile */}
      <AnimatePresence>
        {isSalesSubMenuOpen && !isMoreMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[999] flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setIsSalesSubMenuOpen(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="relative z-10 bg-white text-slate-800 rounded-t-2xl border-t border-slate-200 shadow-lg pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] select-none"
            >
              {/* Drag Handle */}
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-1.5" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-2 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block leading-tight">
                      Phân hệ số bán &amp; doanh số
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">Chọn bảng dữ liệu chuyên sâu</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSalesSubMenuOpen(false)}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {[
                  { id: 'tiendo', label: 'Tiến Độ Số Bán', desc: 'Sản lượng & tiến độ bán ngành hàng', icon: Package, show: true },
                  { id: 'doanhso', label: 'Tiến Độ Doanh Số', desc: 'Bảng chi tiết doanh số nhân viên', icon: BarChart3, show: true },
                  { id: 'thuongnam', label: 'Tiến Độ Thưởng Năm', desc: 'KPI & bậc thưởng năm tích lũy', icon: Trophy, show: true },
                  { id: 'tangtruong', label: 'Tăng Trưởng Năm', desc: 'So sánh cùng kỳ năm trước (Giám sát)', icon: TrendingUp, show: isSupervisor },
                ].filter(item => item.show).map((item) => {
                  const isActive = activeTab === 'doanhso' && salesSubTab === item.id;
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab('doanhso');
                        setSalesSubTab(item.id as any);
                        setIsSalesSubMenuOpen(false);
                      }}
                      className={`w-full min-h-[56px] flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600'
                        }`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm leading-tight truncate ${isActive ? 'text-emerald-900 font-bold' : 'text-slate-900 font-semibold'}`}>
                            {item.label}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* One-Handed Bottom-Right Thumb Quick Employee Filter Pill */}
      {!isEmployeeView &&
        ['trangchu', 'doanhso', 'kichhoat', 'trungbay', 'chamcong', 'thidua'].includes(activeTab) &&
        availableEmployees.length > 0 &&
        !isMoreMenuOpen &&
        !isSalesSubMenuOpen &&
        !isQuickEmpSheetOpen && (() => {
          const currentEmpVal = activeTab === 'kichhoat' ? effectiveActivationEmployeeName : effectiveEmployeeName;
          const isFiltered = currentEmpVal && currentEmpVal !== 'Tất cả';
          return (
            <button
              type="button"
              onClick={() => {
                setQuickEmpSearch('');
                setIsQuickEmpSheetOpen(true);
              }}
              className={`md:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-3 z-40 min-h-[44px] h-11 max-w-[210px] px-3.5 rounded-full border shadow-md flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                isFiltered
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
              }`}
              title="Đổi nhân viên nhanh bằng 1 tay"
            >
              <User className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-emerald-100' : 'text-emerald-600'}`} />
              <span className="truncate">
                {currentEmpVal === 'Tất cả' ? 'Lọc NV: Tất cả' : currentEmpVal}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-emerald-100' : 'text-slate-400'}`} />
            </button>
          );
        })()}

      {/* One-Handed Quick Employee Switcher Bottom Sheet */}
      {isQuickEmpSheetOpen && !isEmployeeView && (
        <div className="md:hidden fixed inset-0 z-[1050] flex flex-col justify-end">
          <div
            onClick={() => setIsQuickEmpSheetOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 bg-white text-slate-800 rounded-t-2xl border-t border-slate-200 shadow-lg max-h-[78dvh] flex flex-col pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-1.5 shrink-0" />
            <div className="flex items-center justify-between px-5 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chọn nhân viên nhanh</h3>
                <p className="text-[11px] text-slate-500">Áp dụng tức thì cho màn hình hiện tại</p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickEmpSheetOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {availableEmployees.length > 5 && (
              <div className="px-4 pt-3 pb-1 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={quickEmpSearch}
                    onChange={(e) => setQuickEmpSearch(e.target.value)}
                    placeholder="Tìm nhanh tên nhân viên..."
                    className="w-full min-h-[44px] h-11 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="p-4 overflow-y-auto space-y-1.5 flex-1">
              {(() => {
                const currentVal = activeTab === 'kichhoat' ? effectiveActivationEmployeeName : effectiveEmployeeName;
                const applySelection = (val: string) => {
                  if (activeTab === 'kichhoat') {
                    setActivationEmployeeFilter(val);
                  } else {
                    setFilters((p) => ({ ...p, employeeName: val }));
                  }
                  setIsQuickEmpSheetOpen(false);
                };
                const q = quickEmpSearch.trim().toLowerCase();
                const list = q ? availableEmployees.filter((e) => e.toLowerCase().includes(q)) : availableEmployees;
                return (
                  <>
                    {activeTab !== 'chamcong' && !q && (
                      <button
                        type="button"
                        onClick={() => applySelection('Tất cả')}
                        className={`w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                          currentVal === 'Tất cả'
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>Tất cả nhân viên</span>
                        {currentVal === 'Tất cả' && (
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </button>
                    )}
                    {list.map((emp) => {
                      const isSel = currentVal === emp;
                      return (
                        <button
                          key={emp}
                          type="button"
                          onClick={() => applySelection(emp)}
                          className={`w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                              : 'bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{emp}</span>
                          {isSel && (
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </motion.div>
        </div>
      )}

      {/* Clean Light Enterprise 5-Slot Mobile Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-navigation-bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-1.5 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom,0px))] select-none"
      >
        <div className="grid grid-cols-5 items-center max-w-lg mx-auto h-[54px]">
          {/* 1. Số Bán */}
          <button
            type="button"
            id="mobile-nav-doanhso"
            onClick={(e) => {
              e.stopPropagation();
              if (activeTab !== 'doanhso') {
                setActiveTab('doanhso');
                setIsSalesSubMenuOpen(true);
              } else {
                setIsSalesSubMenuOpen(prev => !prev);
              }
              setIsMoreMenuOpen(false);
              setIsQuickEmpSheetOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] h-full px-1 cursor-pointer transition-colors"
          >
            <div className={`relative px-3 py-1 rounded-full flex items-center justify-center transition-colors ${
              activeTab === 'doanhso' && !isMoreMenuOpen
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500'
            }`}>
              <BarChart3 className="w-5 h-5" />
              <ChevronUp className={`w-2.5 h-2.5 absolute right-0.5 top-0.5 transition-transform duration-150 ${
                isSalesSubMenuOpen ? 'rotate-180 text-emerald-700' : 'text-slate-400'
              }`} />
            </div>
            <span className={`text-[10.5px] leading-none whitespace-nowrap transition-colors ${
              activeTab === 'doanhso' && !isMoreMenuOpen ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium'
            }`}>
              Số bán
            </span>
          </button>

          {/* 2. Kích Hoạt */}
          <button
            type="button"
            id="mobile-nav-kichhoat"
            onClick={() => {
              setActiveTab('kichhoat');
              setIsSalesSubMenuOpen(false);
              setIsMoreMenuOpen(false);
              setIsQuickEmpSheetOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] h-full px-1 cursor-pointer transition-colors"
          >
            <div className={`px-3 py-1 rounded-full flex items-center justify-center transition-colors ${
              activeTab === 'kichhoat' && !isMoreMenuOpen
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <span className={`text-[10.5px] leading-none whitespace-nowrap transition-colors ${
              activeTab === 'kichhoat' && !isMoreMenuOpen ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium'
            }`}>
              Kích hoạt
            </span>
          </button>

          {/* 3. Trang Chủ (Ở chính giữa) */}
          <button
            type="button"
            id="mobile-nav-trangchu"
            onClick={() => {
              setActiveTab('trangchu');
              setIsSalesSubMenuOpen(false);
              setIsMoreMenuOpen(false);
              setIsQuickEmpSheetOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] h-full px-1 cursor-pointer transition-colors"
          >
            <div className={`px-3.5 py-1 rounded-full flex items-center justify-center transition-colors ${
              activeTab === 'trangchu' && !isMoreMenuOpen
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}>
              <Home className="w-5 h-5" />
            </div>
            <span className={`text-[10.5px] leading-none whitespace-nowrap transition-colors ${
              activeTab === 'trangchu' && !isMoreMenuOpen ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'
            }`}>
              Trang chủ
            </span>
          </button>

          {/* 4. Trưng Bày */}
          <button
            type="button"
            id="mobile-nav-trungbay"
            onClick={() => {
              setActiveTab('trungbay');
              setIsSalesSubMenuOpen(false);
              setIsMoreMenuOpen(false);
              setIsQuickEmpSheetOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] h-full px-1 cursor-pointer transition-colors"
          >
            <div className={`px-3 py-1 rounded-full flex items-center justify-center transition-colors ${
              activeTab === 'trungbay' && !isMoreMenuOpen
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500'
            }`}>
              <Store className="w-5 h-5" />
            </div>
            <span className={`text-[10.5px] leading-none whitespace-nowrap transition-colors ${
              activeTab === 'trungbay' && !isMoreMenuOpen ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium'
            }`}>
              Trưng bày
            </span>
          </button>

          {/* 5. Thêm */}
          <button
            type="button"
            id="mobile-nav-more"
            onClick={() => {
              setIsSalesSubMenuOpen(false);
              setIsQuickEmpSheetOpen(false);
              setIsMoreMenuOpen(prev => !prev);
            }}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] h-full px-1 cursor-pointer transition-colors"
          >
            <div className={`relative px-3 py-1 rounded-full flex items-center justify-center transition-colors ${
              isMoreMenuOpen || ['thidua', 'chamcong', 'tracuu', 'taikhoan'].includes(activeTab)
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500'
            }`}>
              <LayoutGrid className="w-5 h-5" />
              {['thidua', 'chamcong', 'tracuu', 'taikhoan'].includes(activeTab) && !isMoreMenuOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 absolute top-1 right-1.5" />
              )}
            </div>
            <span className={`text-[10.5px] leading-none whitespace-nowrap transition-colors ${
              isMoreMenuOpen || ['thidua', 'chamcong', 'tracuu', 'taikhoan'].includes(activeTab)
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium'
            }`}>
              Thêm
            </span>
          </button>
        </div>
      </nav>

      {/* Notification Center Modal (Global Root Level) */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notificationsList}
        onNotificationClick={handleNotificationClick}
        onMarkAllAsRead={handleMarkAllAsRead}
        onMarkSingleAsRead={handleMarkSingleAsRead}
        userRole={profile.role}
        userName={effectiveMyName}
      />

      {/* Floating Sync Feedback Toast Banner */}
      {syncFeedback && (
        <div
          id="sync-feedback-toast"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999999] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-semibold border backdrop-blur-md transition-opacity duration-200 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/80'
              : syncFeedback.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/80'
              : 'bg-slate-900/90 text-teal-200 border-teal-500/80'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : syncFeedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-teal-300 shrink-0 animate-spin" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}
      {/* Global Notification Toasts (non-blocking replacement for alert) */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-4 right-4 z-[999999] flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto px-3.5 py-2.5 rounded-xl border shadow-lg flex items-start gap-2 text-xs font-semibold animate-[fadeIn_0.15s_ease-out] ${
                t.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : t.type === 'error'
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : t.type === 'warning'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-white text-slate-800 border-slate-200'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : t.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : t.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <Bell className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                aria-label="Đóng thông báo"
                className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
