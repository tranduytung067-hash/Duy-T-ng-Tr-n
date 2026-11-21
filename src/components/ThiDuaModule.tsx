import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy,
  RefreshCw,
  Award,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Gift,
  Check,
  Calendar,
  Share2,
  ExternalLink,
  Copy,
  Download,
  ImageIcon,
  Edit3,
  Sliders,
  Shield,
  Clock,
  Plus,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Monitor,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { ThiDuaBlock, CompetitionProgramConfig } from '../types';
import { fetchThiDuaSheetData, fetchRawThiDuaRows, parseThiDuaBlocks, generateMockThiDuaData, cleanEmployeeName } from '../utils/sheetParser';
import {
  subscribeCompetitionPrograms,
  getLocalCompetitionProgramsSnapshot,
  isProgramActiveStrict,
  isProgramArchivedStrict
} from '../utils/competitionService';
import { isValidColLetter, colLetterToIndex } from '../utils/competitionUtils';
import CompetitionSchemeModal from './CompetitionSchemeModal';
import DynamicProgramModal from './DynamicProgramModal';
import {
  parseStatusAndAmount,
  parseMoneyNum,
  parseCleanNumber,
  formatGeneralNumber,
  formatMoneyBonus,
  formatPercentage,
  formatCellValue,
  buildProgramSpecs,
  getProgramColMap,
  computeThiDuaEmployeeSummary,
  sortEmployeesByOriginalOrder,
} from '../utils/thiDuaSummary';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';



interface ThiDuaModuleProps {
  sheetId: string;
  selectedEmployeeName?: string;
  onSelectEmployee?: (name: string) => void;
  isEmployeeView?: boolean;
  isSupervisor?: boolean;
  isMarketSupervisor?: boolean;
  userRole?: string;
  currentUserName?: string;
  syncKey?: string | number;
}

// Zalo Icon SVG Component
function ZaloIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C12.95 4 4 11.97 4 21.8C4 26.85 7.02 31.33 11.83 34.45L9.67 41.56C9.45 42.28 10.21 42.89 10.88 42.53L18.06 38.67C19.96 39.27 21.94 39.6 24 39.6C35.05 39.6 44 31.63 44 21.8C44 11.97 35.05 4 24 4Z" fill="#0068FF"/>
      <path d="M15.2 28H19.8V26.2H17.2L20.2 21.8V20H15.6V21.8H18.2L15.2 26.2V28ZM21.2 28H23V20H21.2V28ZM24.4 28H26.2V25.2H28.4C29.8 25.2 30.8 24.2 30.8 22.6C30.8 21 29.8 20 28.4 20H24.4V28ZM26.2 23.6V21.6H28.2C28.8 21.6 29.2 22 29.2 22.6C29.2 23.2 28.8 23.6 28.2 23.6H26.2ZM32.4 28C34.4 28 36 26.4 36 24C36 21.6 34.4 20 32.4 20C30.4 20 28.8 21.6 28.8 24C28.8 26.4 30.4 28 32.4 28ZM32.4 26.4C31.4 26.4 30.6 25.4 30.6 24C30.6 22.6 31.4 21.6 32.4 21.6C33.4 21.6 34.2 22.6 34.2 24C34.2 25.4 33.4 26.4 32.4 26.4Z" fill="white"/>
    </svg>
  );
}

interface ZaloModalState {
  isOpen: boolean;
  programTitle: string;
  dataUrl: string;
  blob: Blob | null;
  fileName: string;
  copied: boolean;
  targetPhone: string;
}

export default function ThiDuaModule({
  sheetId,
  selectedEmployeeName,
  onSelectEmployee,
  isEmployeeView = false,
  isSupervisor = false,
  isMarketSupervisor,
  userRole,
  currentUserName = 'Người Dùng',
  syncKey,
}: ThiDuaModuleProps) {
  // Quyền Tạo & Chỉnh sửa Cột CT Thi Đua Mới: CHỈ DÀNH RIÊNG cho Giám Sát Thị Trường.
  // Các phân quyền còn lại (OM, Nhân viên, Saleman, v.v.) tuyệt đối không hiển thị chức năng này.
  const canCreateProgram = isMarketSupervisor !== undefined
    ? isMarketSupervisor
    : (userRole === 'Admin' || userRole === 'MKT Sup' || userRole === 'Giám Sát' || userRole === 'Giám Sát Thị Trường');
  const [blocks, setBlocks] = useState<ThiDuaBlock[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showDetailSummary, setShowDetailSummary] = useState<boolean>(true);
  const [showSupervisorEmpList, setShowSupervisorEmpList] = useState<boolean>(false);
  const [expandedEmpMap, setExpandedEmpMap] = useState<Record<string, boolean>>({});

  // Dynamic Competition Scheme state subscribed from centralized store (initialized from safe local cache)
  const [customPrograms, setCustomPrograms] = useState<CompetitionProgramConfig[]>(() => {
    return getLocalCompetitionProgramsSnapshot();
  });
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState<boolean>(false);
  const [schemeModalInitialId, setSchemeModalInitialId] = useState<string | null>(null);

  // Dynamic program builder modal states
  const [rawSheetRows, setRawSheetRows] = useState<any[]>([]);
  const customProgramsRef = useRef<CompetitionProgramConfig[]>(customPrograms);
  customProgramsRef.current = customPrograms;
  const rawSheetRowsRef = useRef<any[]>(rawSheetRows);
  rawSheetRowsRef.current = rawSheetRows;
  const [isDynamicModalOpen, setIsDynamicModalOpen] = useState<boolean>(false);
  const [dynamicProgramToEdit, setDynamicProgramToEdit] = useState<CompetitionProgramConfig | null>(null);

  // Trạng thái thu gọn chương trình cho giao diện Giám Sát (khi người dùng chủ động bấm thu gọn trên card)
  const [collapsedProgramMap, setCollapsedProgramMap] = useState<Record<string, boolean>>({});

  const toggleProgramCollapse = (progId: string) => {
    setCollapsedProgramMap((prev) => ({
      ...prev,
      [progId]: !prev[progId],
    }));
  };

  // Optimistic handler: Cập nhật tức thời trạng thái bật/tắt của chương trình thi đua (cache được quản lý tập trung tại competitionService)
  const handleToggleProgramActive = (progId: string, newActive: boolean) => {
    setCustomPrograms((prev) => {
      const updated = prev.map((p) =>
        p.id === progId
          ? { ...p, isActive: newActive, isArchived: newActive ? false : p.isArchived }
          : p
      );
      customProgramsRef.current = updated;
      return updated;
    });
  };

  // Optimistic handler: Cập nhật tức thời khi chỉnh sửa cơ cấu chương trình
  const handleUpdateProgramConfig = (savedProg: CompetitionProgramConfig) => {
    setCustomPrograms((prev) => {
      const exists = prev.some((p) => p.id === savedProg.id);
      const updated = exists
        ? prev.map((p) => (p.id === savedProg.id ? savedProg : p))
        : [...prev, savedProg];
      customProgramsRef.current = updated;
      return updated;
    });
  };

  const toggleEmpExpand = (empName: string) => {
    setExpandedEmpMap((prev) => ({
      ...prev,
      [empName]: !prev[empName],
    }));
  };

  // Chế độ phóng to toàn màn hình phục vụ cuộc họp
  const [meetingProgramId, setMeetingProgramId] = useState<string | null>(null);
  const [isModuleFullscreen, setIsModuleFullscreen] = useState<boolean>(false);
  const [meetingZoom, setMeetingZoom] = useState<number>(1.35); // Kích thước bảng ở trong màn hình Full Screen mặc định 135%
  const zaloModalRef = useRef<HTMLDivElement>(null);

  // Helper yêu cầu & thoát Fullscreen HTML5 của trình duyệt
  const requestNativeFs = () => {
    const docEl = document.documentElement as any;
    const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    if (document.fullscreenEnabled !== false && typeof req === 'function') {
      try {
        const p = req.call(docEl);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
    }
  };

  const exitNativeFs = () => {
    const exit = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).mozCancelFullScreen || (document as any).msExitFullscreen;
    if (document.fullscreenElement && typeof exit === 'function') {
      try {
        const p = exit.call(document);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
    }
  };

  const openMeetingFullscreen = (progId: string) => {
    setMeetingProgramId(progId);
    setMeetingZoom(1.35); // Đặt kích thước bảng ở Full Screen là 135%
    requestNativeFs();
  };

  const closeMeetingFullscreen = () => {
    setMeetingProgramId(null);
    exitNativeFs();
  };

  const toggleModuleFullscreen = () => {
    if (isModuleFullscreen) {
      setIsModuleFullscreen(false);
      exitNativeFs();
    } else {
      setIsModuleFullscreen(true);
      requestNativeFs();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (meetingProgramId) {
          setMeetingProgramId(null);
          exitNativeFs();
        } else if (isModuleFullscreen) {
          setIsModuleFullscreen(false);
          exitNativeFs();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [meetingProgramId, isModuleFullscreen]);

  // Real-time Firestore subscription via centralized store (never falls back to all-active defaults on error)
  useEffect(() => {
    const unsub = subscribeCompetitionPrograms((progs) => {
      if (progs && progs.length > 0) {
        customProgramsRef.current = progs;
        setCustomPrograms(progs);
        // If raw sheet rows are already loaded, immediately re-parse with the newly received programs
        if (rawSheetRowsRef.current && rawSheetRowsRef.current.length > 0) {
          const updated = parseThiDuaBlocks(rawSheetRowsRef.current, sheetId, progs);
          setBlocks(updated);
        }
      }
    });
    return () => unsub();
  }, [sheetId]);

  const programRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [sharingProgramId, setSharingProgramId] = useState<string | null>(null);
  const [zaloModalState, setZaloModalState] = useState<ZaloModalState | null>(null);
  useDialogFocus(!!(zaloModalState && zaloModalState.isOpen), zaloModalRef, () => setZaloModalState(null));

  const handleShareZaloProgram = async (programId: string, programTitle: string) => {
    const targetEl = programRefs.current[programId];
    if (!targetEl) return;

    setSharingProgramId(programId);

    const isSummary = programId === 'summary';

    // Backup position and opacity styles for offscreen elements
    const origPosition = targetEl.style.position;
    const origLeft = targetEl.style.left;
    const origTop = targetEl.style.top;
    const origZIndex = targetEl.style.zIndex;
    const origOpacity = targetEl.style.opacity;
    const origPointerEvents = targetEl.style.pointerEvents;
    const origVisibility = targetEl.style.visibility;
    const hadOpacity0 = targetEl.classList.contains('opacity-0');

    if (isSummary) {
      if (hadOpacity0) {
        targetEl.classList.remove('opacity-0');
      }
      targetEl.style.position = 'fixed';
      targetEl.style.left = '0px';
      targetEl.style.top = '0px';
      targetEl.style.zIndex = '-999';
      targetEl.style.opacity = '1';
      targetEl.style.pointerEvents = 'none';
      targetEl.style.visibility = 'visible';
    }

    // Measure required full width for table rendering to avoid mobile overflow clipping
    const tableEl = targetEl.querySelector('table');
    const minDesiredWidth = isSummary ? 1080 : 780;
    const requiredWidth = Math.max(minDesiredWidth, targetEl.scrollWidth, tableEl ? tableEl.scrollWidth + 20 : 0);

    // Backup original inline styles
    const origStyle = {
      width: targetEl.style.width,
      minWidth: targetEl.style.minWidth,
      maxWidth: targetEl.style.maxWidth,
      overflow: targetEl.style.overflow,
      transition: targetEl.style.transition,
    };

    // Find all scroll/overflow containers inside targetEl and backup their styles
    const overflowEls = Array.from(targetEl.querySelectorAll('.overflow-x-auto, .overflow-auto')) as HTMLElement[];
    const origOverflowStyles = overflowEls.map((el) => ({
      el,
      overflow: el.style.overflow,
      overflowX: el.style.overflowX,
      width: el.style.width,
      minWidth: el.style.minWidth,
    }));

    // Hide control buttons and action strip containers from the captured image
    const hiddenNodes = Array.from(targetEl.querySelectorAll('button, [data-zalo-hide="true"]')) as HTMLElement[];
    const origHiddenDisplays = hiddenNodes.map((el) => ({
      el,
      display: el.style.display,
    }));

    // Ensure program title above the table is never truncated, hidden, or white-on-white in captured PNG
    const titleNodes = Array.from(targetEl.querySelectorAll('[data-zalo-title="true"]')) as HTMLElement[];
    const origTitleStyles = titleNodes.map((el) => ({
      el,
      whiteSpace: el.style.whiteSpace,
      overflow: el.style.overflow,
      textOverflow: el.style.textOverflow,
      color: el.style.color,
      display: el.style.display,
      visibility: el.style.visibility,
      opacity: el.style.opacity,
      width: el.style.width,
      maxWidth: el.style.maxWidth,
      fontSize: el.style.fontSize,
      lineHeight: el.style.lineHeight,
    }));

    try {
      // 1. Hide buttons & action strip in captured image
      hiddenNodes.forEach((el) => { el.style.display = 'none'; });

      // 2. Ensure title text renders crisply in dark ink right after the yellow badge without truncation
      titleNodes.forEach((el) => {
        el.style.whiteSpace = 'normal';
        el.style.overflow = 'visible';
        el.style.textOverflow = 'clip';
        el.style.color = '#0f172a';
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.width = 'auto';
        el.style.maxWidth = 'none';
        el.style.fontSize = '15px';
        el.style.lineHeight = '1.35';
      });

      // 3. Expand overflow containers so tables are not clipped on narrow screens
      overflowEls.forEach((el) => {
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.width = '100%';
        el.style.minWidth = '100%';
      });

      // 4. Temporarily set targetEl to full required width without CSS transition lag
      targetEl.style.transition = 'none';
      targetEl.style.width = `${requiredWidth}px`;
      targetEl.style.minWidth = `${requiredWidth}px`;
      targetEl.style.maxWidth = 'none';
      targetEl.style.overflow = 'visible';

      // Brief pause to ensure DOM re-layout
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(targetEl, {
        quality: 0.98,
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: requiredWidth
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const cleanTitle = programTitle
        .replace(/[^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const fileName = `ThiDua_${cleanTitle || 'Program'}.png`;

      // Copy PNG image directly to Clipboard automatically
      let copied = false;
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          copied = true;
        } catch (clipErr) {
          console.warn('Clipboard write failed:', clipErr);
        }
      }

      // Try Native Web Share API first (Mobile / Tablet browsers) to share directly into the Zalo App
      const imageFile = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        try {
          await navigator.share({
            title: `Bảng Thi Đua - ${programTitle}`,
            text: `Bảng kết quả thi đua: ${programTitle}`,
            files: [imageFile]
          });
          return; // Native share dialog opened successfully
        } catch (shareErr) {
          console.log('Web share cancelled or closed:', shareErr);
        }
      }

      setZaloModalState({
        isOpen: true,
        programTitle,
        dataUrl,
        blob,
        fileName,
        copied,
        targetPhone: ''
      });
    } catch (err) {
      console.error('Lỗi xuất ảnh thi đua qua Zalo:', err);
      notify.error('Không thể xuất hình ảnh bảng thi đua. Vui lòng thử lại!');
    } finally {
      // RESTORE ALL ORIGINAL DOM STYLES AND BUTTONS
      origHiddenDisplays.forEach(({ el, display }) => { el.style.display = display; });
      origTitleStyles.forEach(({ el, whiteSpace, overflow, textOverflow, color, display, visibility, opacity, width, maxWidth, fontSize, lineHeight }) => {
        el.style.whiteSpace = whiteSpace;
        el.style.overflow = overflow;
        el.style.textOverflow = textOverflow;
        el.style.color = color;
        el.style.display = display;
        el.style.visibility = visibility;
        el.style.opacity = opacity;
        el.style.width = width;
        el.style.maxWidth = maxWidth;
        el.style.fontSize = fontSize;
        el.style.lineHeight = lineHeight;
      });
      origOverflowStyles.forEach(({ el, overflow, overflowX, width, minWidth }) => {
        el.style.overflow = overflow;
        el.style.overflowX = overflowX;
        el.style.width = width;
        el.style.minWidth = minWidth;
      });
      targetEl.style.transition = origStyle.transition;
      targetEl.style.width = origStyle.width;
      targetEl.style.minWidth = origStyle.minWidth;
      targetEl.style.maxWidth = origStyle.maxWidth;
      targetEl.style.overflow = origStyle.overflow;

      if (isSummary) {
        if (hadOpacity0) {
          targetEl.classList.add('opacity-0');
        }
        targetEl.style.position = origPosition;
        targetEl.style.left = origLeft;
        targetEl.style.top = origTop;
        targetEl.style.zIndex = origZIndex;
        targetEl.style.opacity = origOpacity;
        targetEl.style.pointerEvents = origPointerEvents;
        targetEl.style.visibility = origVisibility;
      }

      setSharingProgramId(null);
    }
  };

  const loadData = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const rawRows = await fetchRawThiDuaRows(sheetId, force);
      if (rawRows && rawRows.length > 0) {
        rawSheetRowsRef.current = rawRows;
        setRawSheetRows(rawRows);
        const currentProgs = customProgramsRef.current && customProgramsRef.current.length > 0 ? customProgramsRef.current : customPrograms;
        const res = parseThiDuaBlocks(rawRows, sheetId, currentProgs);
        setBlocks(res);
      } else {
        const currentProgs = customProgramsRef.current && customProgramsRef.current.length > 0 ? customProgramsRef.current : customPrograms;
        const res = await fetchThiDuaSheetData(sheetId, force, currentProgs);
        setBlocks(res && res.length > 0 ? res : generateMockThiDuaData());
      }
      setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'));
    } catch (err) {
      console.error('Lỗi tải dữ liệu Thi Đua:', err);
      setBlocks(generateMockThiDuaData());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sheetId, syncKey]);

  // Re-parse blocks dynamically whenever customPrograms update in real-time
  useEffect(() => {
    const rows = (rawSheetRows && rawSheetRows.length > 0) ? rawSheetRows : rawSheetRowsRef.current;
    if (rows && rows.length > 0) {
      const updated = parseThiDuaBlocks(rows, sheetId, customPrograms);
      setBlocks(updated);
    }
  }, [customPrograms, sheetId]);

  // Dynamic PROGRAM_SPECS merged with centralized Firestore configurations and custom dynamic programs
  const PROGRAM_SPECS = useMemo(() => buildProgramSpecs(customPrograms), [customPrograms]);

  const getColMap = (progId: string) => getProgramColMap(progId, customPrograms);

  // Danh sách các chương trình thi đua đang kích hoạt (loại bỏ hoàn toàn các chương trình đã tắt hoặc lưu trữ)
  const visibleProgramSpecs = useMemo(() => {
    return PROGRAM_SPECS.filter((s) => s.isActive === true && (s as any).isArchived !== true);
  }, [PROGRAM_SPECS]);

  // Build employee bonus summary strictly based on visible (active) programs
  const { employeeSummaryList, grandTotalBonus, rewardedEmpCount } = useMemo(() => {
    return computeThiDuaEmployeeSummary(blocks, visibleProgramSpecs, customPrograms);
  }, [blocks, visibleProgramSpecs, customPrograms]);

  const currentEmpSummary = useMemo(() => {
    if (!employeeSummaryList.length) return null;
    if (!selectedEmployeeName || selectedEmployeeName === 'Tất cả') {
      return employeeSummaryList[0];
    }
    const cleanSel = cleanEmployeeName(selectedEmployeeName).toLowerCase();
    return (
      employeeSummaryList.find(
        (e) =>
          cleanEmployeeName(e.empName).toLowerCase() === cleanSel ||
          e.empName.toLowerCase().includes(cleanSel)
      ) || employeeSummaryList[0]
    );
  }, [employeeSummaryList, selectedEmployeeName]);

  // Total summary calculator for a program column
  const calculateColumnTotal = (
    rows: Record<string, string>[],
    spec: typeof PROGRAM_SPECS[0],
    colCode: string,
    summaryRow?: Record<string, string>
  ) => {
    const colSpec = spec.columns.find((c) => c.colCode === colCode || (c as any).id === colCode || c.key === colCode);
    if (!colSpec) return '-';
    const labelLower = colSpec.label.toLowerCase().replace(/[\s\n]+/g, ' ');

    if (labelLower.includes('nhân viên') || colCode === 'Mã NV' || (colSpec as any).role === 'employee_name') {
      return 'TỔNG CỘNG';
    }

    // NẾU LÀ CHƯƠNG TRÌNH THỦ CÔNG (isCustom): LẤY DỮ LIỆU TỪ HÀNG THỨ 10 CỦA BẢNG GOOGLE SHEET
    if ((spec as any).isCustom) {
      // 1. Kiểm tra summaryRow từ blockData (đã trích xuất từ hàng 10)
      let row10Val = summaryRow
        ? (summaryRow[(colSpec as any).id] || summaryRow[colCode] || summaryRow[colSpec.label] || '')
        : '';

      // 2. Nếu chưa có trong summaryRow, tìm trực tiếp trong rawSheetRows ở hàng thứ 10
      if (!row10Val && rawSheetRows && rawSheetRows.length > 0) {
        const row10 = rawSheetRows.find((r: any) => r._physicalRowIndex === 10)
          || rawSheetRows.find((r: any) => r._physicalRowIndex === 11)
          || rawSheetRows.find((r: any) => {
              const texts = Object.values(r).map(v => typeof v === 'string' ? v.toLowerCase().trim() : '');
              return texts.some(t => t === 'tổng' || t === 'tổng cộng' || t.startsWith('tổng'));
            })
          || (rawSheetRows.length >= 9 ? rawSheetRows[8] : null);

        if (row10) {
          const letter = ((colSpec as any).colLetter || colCode || '').toUpperCase().trim();
          const colIdx = isValidColLetter(letter) ? colLetterToIndex(letter) : -1;
          if (colIdx >= 0 && row10._rawCells && row10._rawCells[colIdx]) {
            const cell = row10._rawCells[colIdx];
            const strF = cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : '';
            const strV = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
            if (strF && !strF.startsWith('=')) {
              row10Val = strF;
            } else if (strV && !strV.startsWith('=')) {
              row10Val = strV;
            } else if (strV) {
              row10Val = strV;
            } else if (strF) {
              row10Val = strF;
            }
          }
          if (!row10Val && letter) {
            row10Val = String(row10[letter] ?? row10[letter.toLowerCase()] ?? row10[letter.toUpperCase()] ?? '').trim();
          }
        }
      }

      if (row10Val && row10Val !== '-' && row10Val.toLowerCase() !== 'null') {
        if ((colSpec as any).role === 'bonus' || (colSpec as any).format === 'currency' || labelLower.includes('tiền thưởng')) {
          if (row10Val.includes('₫')) return row10Val;
          const n = parseCleanNumber(row10Val);
          return `${n.toLocaleString('vi-VN')} ₫`;
        }
        if ((colSpec as any).role === 'percentage' || (colSpec as any).format === 'percentage' || labelLower.includes('%') || labelLower.includes('hoàn thành')) {
          if (row10Val.includes('%')) return row10Val;
          const n = parseCleanNumber(row10Val);
          const pct = n <= 1 && n > 0 ? n * 100 : n;
          return `${pct.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
        }
        if ((colSpec as any).role === 'evaluation' || labelLower.includes('xét thưởng') || labelLower.includes('trạng thái')) {
          return row10Val.toLowerCase() === 'tổng' ? '-' : row10Val;
        }
        return row10Val;
      }
    }

    if (labelLower.includes('xét thưởng') || labelLower.includes('trạng thái')) {
      return '-';
    }

    // Cột Tiền Thưởng: tính tổng và phân tách hàng nghìn/triệu kèm ₫
    if (labelLower.includes('tiền thưởng')) {
      const totalBonus = rows.reduce((acc, r) => {
        const raw = spec.getValue(r, colCode);
        return acc + parseMoneyNum(raw);
      }, 0);
      return totalBonus > 0 ? totalBonus.toLocaleString('vi-VN') + ' ₫' : '0 ₫';
    }

    // Cột % Hoàn Thành: Luôn tính tỷ lệ = (Tổng Thực Hiện / Tổng Chỉ Tiêu) * 100, tuyệt đối không cộng dồn các giá trị %
    if (
      labelLower.includes('%') ||
      labelLower.includes('hoàn thành') ||
      colCode === 'M' ||
      colCode === 'T' ||
      colCode === 'BA'
    ) {
      // 1. Chương trình Thi đua MCC (Cột K: Chỉ Tiêu, Cột L: Thực Hiện, Cột M: % Hoàn Thành)
      if (spec.id === 'mcc' || colCode === 'M') {
        const totalChiTieu = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'K')), 0);
        const totalThucHien = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'L')), 0);
        if (totalChiTieu > 0) {
          return formatPercentage((totalThucHien / totalChiTieu) * 100);
        }
        return '-';
      }

      // 2. Chương trình Thi Đua Gạo (Cột R: Chỉ Tiêu, Cột S: Thực Hiện, Cột T: % Hoàn Thành)
      if (spec.id === 'gao' || colCode === 'T') {
        const totalChiTieu = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'R')), 0);
        const totalThucHien = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'S')), 0);
        if (totalChiTieu > 0) {
          return formatPercentage((totalThucHien / totalChiTieu) * 100);
        }
        return '-';
      }

      // 3. Chương trình Thi đua Tổng Sản Lượng HPC (Cột AY: Chỉ Tiêu, Cột AZ: Thực Hiện, Cột BA: % Hoàn Thành)
      if (spec.id === 'tong_san_luong_hpc' || colCode === 'BA') {
        const totalChiTieu = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'AY')), 0);
        const totalThucHien = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'AZ')), 0);
        if (totalChiTieu > 0) {
          return formatPercentage((totalThucHien / totalChiTieu) * 100);
        }
        return '-';
      }

      // 4. Chương trình Thi đua Tổng Sản Lượng Bột Mì (Cột BF: Chỉ Tiêu, Cột BG: Thực Hiện, Cột BOT_MI_PCT: % Hoàn Thành)
      if (spec.id === 'bot_mi_meizan' || colCode === 'BOT_MI_PCT') {
        const totalChiTieu = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'BF')), 0);
        const totalThucHien = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, 'BG')), 0);
        if (totalChiTieu > 0) {
          return formatPercentage((totalThucHien / totalChiTieu) * 100);
        }
        return '-';
      }

      // 5. Tìm tự động theo tên cột Chỉ Tiêu & Thực Hiện đối với các cấu hình bảng thi đua khác
      const chiTieuCol = spec.columns.find((c) => {
        const l = c.label.toLowerCase().replace(/[\s\n]+/g, ' ');
        return l.includes('chỉ tiêu');
      });
      const thucHienCol = spec.columns.find((c) => {
        const l = c.label.toLowerCase().replace(/[\s\n]+/g, ' ');
        return l.includes('thực hiện');
      });

      if (chiTieuCol && thucHienCol) {
        const totalChiTieu = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, chiTieuCol.colCode)), 0);
        const totalThucHien = rows.reduce((acc, r) => acc + parseCleanNumber(spec.getValue(r, thucHienCol.colCode)), 0);
        if (totalChiTieu > 0) {
          return formatPercentage((totalThucHien / totalChiTieu) * 100);
        }
      }

      return '-';
    }

    // Các cột số lượng, chỉ tiêu, thực hiện, tấn, thùng: tính tổng số học chính xác
    let sum = 0;
    let count = 0;

    rows.forEach((r) => {
      const rawVal = spec.getValue(r, colCode);
      if (!rawVal || rawVal === '-') return;

      const num = parseCleanNumber(rawVal);
      if (!isNaN(num)) {
        sum += num;
        count++;
      }
    });

    if (count === 0) return '-';
    return formatGeneralNumber(sum);
  };

  return (
    <div className={`space-y-6 max-w-full overflow-hidden ${
      isModuleFullscreen ? 'fixed inset-0 z-[950] bg-slate-100 overflow-y-auto p-3 sm:p-6 shadow-2xl' : ''
    }`}>
      {/* Thanh điều khiển khi phóng to toàn bộ màn hình thi đua phục vụ cuộc họp */}
      {isModuleFullscreen && (
        <div className="sticky top-0 z-50 bg-white text-slate-900 px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-between border border-emerald-300 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-emerald-600" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-tight text-slate-900">
              Chế Độ Phóng To Toàn Màn Hình
            </span>
          </div>
          <button
            type="button"
            onClick={toggleModuleFullscreen}
            className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <Minimize2 className="w-4 h-4 text-emerald-600" />
            <span>Thu Nhỏ (ESC)</span>
          </button>
        </div>
      )}

      {/* 1. PHÂN QUYỀN GIÁM SÁT: CARD TỔNG QUAN 3 CHỈ SỐ + NÚT XEM CHI TIẾT */}
      {!isEmployeeView && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3">
          {/* Header of Overview Card: Title + 1-Row Compact Action Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-tight truncate">
                    Tổng Quan Thi Đua
                  </h2>
                  <span className="text-[10px] text-emerald-600 font-medium hidden sm:inline-block">
                    Nguồn: Sheet Tổng hợp thi đua
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar sm:overflow-visible sm:shrink-0">
              {/* Nút Quản Lý Cơ Cấu Thi Đua */}
              <button
                type="button"
                onClick={() => {
                  setSchemeModalInitialId(null);
                  setIsSchemeModalOpen(true);
                }}
                className="h-9 sm:h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                title="Xem & quản lý cơ cấu thi đua, bật/tắt chương trình"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Cơ Cấu</span>
              </button>

              {/* Nút Tạo Chương Trình Mới */}
              {canCreateProgram && (
                <button
                  type="button"
                  onClick={() => {
                    setDynamicProgramToEdit(null);
                    setIsDynamicModalOpen(true);
                  }}
                  className="h-9 sm:h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                  title="Tạo chương trình thi đua mới với cấu trúc động"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="sm:hidden">Tạo Mới</span>
                  <span className="hidden sm:inline">Tạo CT Mới</span>
                </button>
              )}

              {/* Nút Làm Mới Dữ Liệu Sheet */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => loadData(true)}
                className="h-9 sm:h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 whitespace-nowrap"
                title="Tải lại dữ liệu từ Sheet Tổng hợp thi đua"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </button>

              {/* Nút Gửi Zalo */}
              <button
                type="button"
                disabled={sharingProgramId === 'summary'}
                onClick={() => handleShareZaloProgram('summary', 'Tổng Hợp Tiền Thưởng Theo Nhân Viên')}
                className="h-9 sm:h-8 px-2.5 sm:px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 whitespace-nowrap"
                title="Gửi ảnh tổng tiền thưởng theo nhân viên qua Zalo"
              >
                {sharingProgramId === 'summary' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                ) : (
                  <ZaloIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                <span>{sharingProgramId === 'summary' ? 'Đang tạo...' : 'Gửi Zalo'}</span>
              </button>
            </div>
          </div>

          {/* 3 KHUNG CHỈ SỐ: TỔNG TIỀN THƯỞNG, SỐ NV ĐẠT THƯỞNG, NÚT XEM CHI TIẾT THEO NV */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 bg-emerald-50/40 p-2 sm:p-3 rounded-xl border border-emerald-100">
            {/* 1. TỔNG TIỀN THƯỞNG */}
            <div className="flex flex-col items-center justify-center text-center px-1 py-0.5">
              <span className="text-[9px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider line-clamp-1">
                Tổng Tiền Thưởng
              </span>
              <span className="text-xs sm:text-lg font-black text-amber-900 font-mono tracking-tight mt-0.5 whitespace-nowrap">
                {grandTotalBonus > 0 ? grandTotalBonus.toLocaleString('vi-VN') : '0'} <span className="text-[9px] sm:text-xs font-sans font-bold">₫</span>
              </span>
            </div>

            {/* 2. SỐ NV ĐẠT THƯỞNG */}
            <div className="flex flex-col items-center justify-center text-center px-1 py-0.5 border-x border-emerald-200/80">
              <span className="text-[9px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider line-clamp-1">
                Số NV Đạt Thưởng
              </span>
              <span className="text-xs sm:text-lg font-black text-emerald-700 tracking-tight mt-0.5 whitespace-nowrap">
                {rewardedEmpCount} <span className="text-[10px] sm:text-xs font-medium text-slate-500">/ {employeeSummaryList.length}</span>
              </span>
            </div>

            {/* 3. NÚT XEM CHI TIẾT THEO NHÂN VIÊN THAY THẾ CHO PHẦN TỔNG CHƯƠNG TRÌNH */}
            <button
              type="button"
              onClick={() => setShowSupervisorEmpList((p) => !p)}
              className="flex flex-col items-center justify-center text-center px-1 py-0.5 rounded-lg bg-white/80 hover:bg-emerald-100/80 border border-emerald-200 shadow-2xs transition-all cursor-pointer group active:scale-95 select-none"
              title={showSupervisorEmpList ? 'Thu gọn danh sách nhân viên' : 'Xem chi tiết tiền thưởng theo từng nhân viên'}
            >
              <div className="flex items-center gap-0.5 text-[9px] sm:text-[11px] font-bold text-emerald-900 uppercase tracking-wider line-clamp-1 group-hover:text-emerald-950">
                <span>Chi Tiết NV</span>
                {showSupervisorEmpList ? (
                  <ChevronUp className="w-3 h-3 text-emerald-700 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-emerald-700 shrink-0" />
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-extrabold text-emerald-700 mt-0.5 whitespace-nowrap flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{showSupervisorEmpList ? 'Thu gọn' : `${employeeSummaryList.length} NV`}</span>
              </span>
            </button>
          </div>

          {/* DANH SÁCH CARD TỔNG TIỀN THƯỞNG CỦA TỪNG NHÂN VIÊN */}
          {showSupervisorEmpList && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              {employeeSummaryList.map((emp, index) => {
                const isExpanded = !!expandedEmpMap[emp.empName];
                const hasBonus = emp.totalBonus > 0;

                return (
                  <div
                    key={emp.empName}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? 'border-emerald-400 bg-white shadow-sm ring-1 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    {/* Header Card Nhân Viên */}
                    <div
                      onClick={() => toggleEmpExpand(emp.empName)}
                      className="p-3 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                            index === 0
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : index === 1
                              ? 'bg-slate-300 text-slate-800'
                              : index === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {emp.empName}
                          </h4>
                          <span className="text-[10.5px] font-semibold text-slate-500 block">
                            {emp.completedCount}/{visibleProgramSpecs.length} chương trình đạt
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="text-xs sm:text-sm font-black text-amber-600 font-mono">
                            {hasBonus ? emp.totalBonus.toLocaleString('vi-VN') + ' ₫' : '0 ₫'}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`p-1.5 rounded-lg transition-colors border ${
                            isExpanded
                              ? 'bg-white text-emerald-700 border-emerald-400 shadow-xs'
                              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 shadow-2xs'
                          }`}
                          title={isExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết các chương trình'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* CARD TỔNG HỢP TIỀN THƯỞNG CHI TIẾT THEO TỪNG CHƯƠNG TRÌNH CỦA NHÂN VIÊN ĐÓ */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-50/90 border-t border-emerald-200/80 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-slate-700 tracking-wider">
                          <div className="flex items-center gap-1.5 text-emerald-800">
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            <span>Chi tiết tiền thưởng các chương trình</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium lowercase">
                            {emp.completedCount} đạt thưởng
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {visibleProgramSpecs.map((spec) => {
                            const reward = emp.programRewards[spec.id];
                            const isAchieved =
                              (reward?.numAmount || 0) > 0 ||
                              (reward?.status &&
                                reward.status !== '-' &&
                                !reward.status.toLowerCase().includes('không') &&
                                !reward.status.toLowerCase().includes('chưa'));
                            const statusText =
                              reward?.status && reward.status !== '-'
                                ? reward.status
                                : isAchieved
                                ? 'Đạt'
                                : 'Chưa Đạt';
                            const amountText =
                              (reward?.numAmount || 0) > 0
                                ? reward.numAmount.toLocaleString('vi-VN') + ' ₫'
                                : reward?.rawAmount
                                ? formatMoneyBonus(reward.rawAmount)
                                : '0 ₫';

                            return (
                              <div
                                key={spec.id}
                                className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all ${
                                  isAchieved
                                    ? 'bg-white border-emerald-300 shadow-2xs ring-1 ring-emerald-200/60'
                                    : 'bg-white/70 border-slate-200 opacity-85'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span
                                    className="text-[11px] font-black text-slate-800 line-clamp-1 leading-tight"
                                    title={spec.title}
                                  >
                                    {spec.shortTitle}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSchemeModalInitialId(spec.id);
                                      setIsSchemeModalOpen(true);
                                    }}
                                    className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-[9.5px] font-bold shrink-0 cursor-pointer shadow-2xs active:scale-95"
                                  >
                                    Cơ cấu
                                  </button>
                                </div>

                                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                                  <span
                                    className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded ${
                                      isAchieved
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}
                                  >
                                    {statusText}
                                  </span>
                                  <span
                                    className={`text-[11px] font-black font-mono ${
                                      isAchieved ? 'text-amber-600' : 'text-slate-400'
                                    }`}
                                  >
                                    {amountText}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. PHÂN QUYỀN NHÂN VIÊN: CARD THÔNG TIN TỔNG HỢP TIỀN THƯỞNG CỦA NHÂN VIÊN (ẨN TỔNG QUAN ĐỘI NGŨ) */}
      {isEmployeeView && currentEmpSummary && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-emerald-300 shadow-sm p-3.5 sm:p-5 space-y-4">
          {/* Header Card Nhân Viên */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 sm:p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 shrink-0 shadow-2xs">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                  Thông Tin Tổng Hợp Tiền Thưởng
                </span>
                <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {currentEmpSummary.empName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Nút Phóng To Toàn Màn Hình (Phục vụ họp) */}
              <button
                type="button"
                onClick={toggleModuleFullscreen}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
                title={isModuleFullscreen ? "Thu nhỏ về giao diện thường (ESC)" : "Phóng to toàn màn hình các chương trình thi đua (Phục vụ họp)"}
              >
                {isModuleFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">Thu Nhỏ</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">Phóng To</span>
                  </>
                )}
              </button>

              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs border border-emerald-200 shadow-2xs">
                {currentEmpSummary.completedCount}/{visibleProgramSpecs.length} chương trình đạt
              </span>
            </div>
          </div>

          {/* Banner Tổng Tiền Thưởng Nổi Bật */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-3.5 sm:p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div>
              <span className="text-[11px] font-bold text-amber-100 uppercase tracking-wider block">
                Tổng Tiền Thưởng Thi Đua Đạt Được
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-tight">
                {currentEmpSummary.totalBonus > 0
                  ? currentEmpSummary.totalBonus.toLocaleString('vi-VN')
                  : '0'}{' '}
                <span className="text-base sm:text-lg font-sans font-bold">₫</span>
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-amber-100 font-medium">
              Cập nhật tự động theo tiến độ & kết quả kinh doanh
            </div>
          </div>

          {/* Chi Tiết Tiền Thưởng Từng Chương Trình */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Chi Tiết Tiền Thưởng Theo Từng Chương Trình</span>
              </h3>
            </div>

            {visibleProgramSpecs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5 opacity-60" />
                <p className="text-xs font-bold text-slate-600">Hiện tại không có chương trình thi đua nào đang áp dụng.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {visibleProgramSpecs.map((spec) => {
                  const reward = currentEmpSummary.programRewards[spec.id];
                  const isAchieved =
                    (reward?.numAmount || 0) > 0 ||
                    (reward?.status &&
                      reward.status !== '-' &&
                      !reward.status.toLowerCase().includes('không') &&
                      !reward.status.toLowerCase().includes('chưa'));
                  const statusText =
                    reward?.status && reward.status !== '-'
                      ? reward.status
                      : isAchieved
                      ? 'Đạt'
                      : 'Chưa Đạt';
                  const amountText =
                    (reward?.numAmount || 0) > 0
                      ? reward.numAmount.toLocaleString('vi-VN') + ' ₫'
                      : reward?.rawAmount
                      ? formatMoneyBonus(reward.rawAmount)
                      : '0 ₫';

                  return (
                    <div
                      key={spec.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                        isAchieved
                          ? 'bg-gradient-to-b from-white to-emerald-50/30 border-emerald-300 shadow-2xs ring-1 ring-emerald-200/60'
                          : 'bg-slate-50/70 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate" title={spec.title}>
                            {spec.title}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSchemeModalInitialId(spec.id);
                            setIsSchemeModalOpen(true);
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-[10px] font-bold shrink-0 cursor-pointer shadow-2xs active:scale-95"
                        >
                          Cơ cấu
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500 font-medium">Trạng thái:</span>
                          <span
                            className={`text-[10px] sm:text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                              isAchieved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200/80 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {statusText}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xs sm:text-sm font-black font-mono ${
                              isAchieved ? 'text-amber-600' : 'text-slate-400'
                            }`}
                          >
                            {amountText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HIDDEN OFF-SCREEN SUMMARY TABLE FOR CAPTURING ZALO PNG / COPYING DATA */}
      <div 
        ref={(el) => { programRefs.current['summary'] = el; }}
        style={{ position: 'fixed', left: '-9999px', top: '0px', width: '1080px', zIndex: -100 }}
        className="bg-white p-6 pointer-events-none"
        aria-hidden="true"
      >
        <div className="mb-4 flex items-center justify-between border-b-2 border-emerald-600 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-700 shrink-0" /> BẢNG TỔNG HỢP TIỀN THƯỞNG THI ĐUA THEO NHÂN VIÊN
            </h2>
            <div className="flex items-center gap-4 mt-1.5 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="text-slate-400">Tổng Tiền Thưởng:</span>
                <strong className="text-amber-800 font-mono font-black text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {grandTotalBonus > 0 ? grandTotalBonus.toLocaleString('vi-VN') : '0'} ₫
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400">Số NV Đạt Thưởng:</span>
                <strong className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {rewardedEmpCount} / {employeeSummaryList.length} Nhân Viên
                </strong>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cập nhật</span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {lastUpdated || new Date().toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>
        <div className="overflow-visible rounded-xl border border-emerald-400">
          <table className="w-full text-xs border-collapse table-fixed bg-white">
            <thead>
              <tr className="bg-emerald-50/70 text-emerald-950 font-extrabold uppercase text-[11px] tracking-tight leading-tight">
                <th className="py-2.5 px-1 w-10 text-center text-emerald-950 font-bold border border-emerald-300">STT</th>
                <th className="py-2.5 px-2 w-44 text-center font-extrabold border border-emerald-300">Tên Nhân Viên</th>
                {visibleProgramSpecs.map((spec) => (
                  <th key={spec.id} className="py-2.5 px-1 text-center font-extrabold border border-emerald-300">
                    {spec.shortTitle}
                  </th>
                ))}
                <th className="py-2.5 px-1 w-28 text-center font-extrabold border border-emerald-300 text-emerald-950">
                  Tổng Thưởng
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-800 font-medium">
              {employeeSummaryList.map((emp, idx) => {
                const hasTotalBonus = emp.totalBonus > 0;
                return (
                  <tr key={emp.empName} className="bg-white">
                    <td className="py-2 px-1 text-center text-slate-500 font-mono border border-emerald-200 bg-white">{idx + 1}</td>
                    <td className="py-2 px-2 text-left font-bold text-slate-900 border border-emerald-200 bg-white truncate">{emp.empName}</td>
                    {visibleProgramSpecs.map((spec) => {
                      const reward = emp.programRewards[spec.id];
                      const hasBonus = (reward?.numAmount || 0) > 0;
                      let amtStr = '-';
                      if (hasBonus) {
                        amtStr = reward!.numAmount.toLocaleString('vi-VN');
                      } else if (reward?.status && reward.status !== '-') {
                        amtStr = reward.status;
                      } else if (reward?.rawAmount && reward.rawAmount !== '-') {
                        const n = parseMoneyNum(reward.rawAmount);
                        amtStr = n > 0 ? n.toLocaleString('vi-VN') : reward.rawAmount.replace(/[\s]*[₫đ]$/i, '');
                      }
                      const cleanAmtStr = (amtStr || '').replace(/\u00A0/g, ' ').trim();
                      const isChuaDatZalo = cleanAmtStr && /^(chưa\s*đạt|không\s*đạt)$/i.test(cleanAmtStr);
                      return (
                        <td
                          key={spec.id}
                          className={`py-1.5 px-0.5 text-center border border-emerald-200 bg-white ${
                            hasBonus ? 'font-bold text-slate-900' : 'font-semibold text-slate-600'
                          }`}
                        >
                          {isChuaDatZalo ? (
                            <span className="inline-block max-w-full break-words whitespace-normal leading-tight text-[10px]">
                              {cleanAmtStr}
                            </span>
                          ) : (
                            amtStr
                          )}
                        </td>
                      );
                    })}
                    <td className={`py-2 px-1 text-center font-black border border-emerald-200 bg-white ${
                      hasTotalBonus ? 'text-slate-900' : 'text-slate-600'
                    }`}>
                      {hasTotalBonus ? emp.totalBonus.toLocaleString('vi-VN') + ' ₫' : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50/80 text-slate-900 font-black text-xs">
                <td className="py-2.5 px-1 text-center border border-emerald-300 font-bold">#</td>
                <td className="py-2.5 px-2 text-left uppercase border border-emerald-300">TỔNG CỘNG</td>
                {visibleProgramSpecs.map((spec) => {
                  const progTotal = employeeSummaryList.reduce((acc, curr) => acc + (curr.programRewards[spec.id]?.numAmount || 0), 0);
                  return (
                    <td key={spec.id} className="py-2.5 px-1 text-center font-black text-slate-900 border border-emerald-300 font-mono">
                      {progTotal > 0 ? progTotal.toLocaleString('vi-VN') : '-'}
                    </td>
                  );
                })}
                <td className="py-2.5 px-1 text-center font-black text-slate-900 border border-emerald-300 font-mono">
                  {grandTotalBonus > 0 ? grandTotalBonus.toLocaleString('vi-VN') + ' ₫' : '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* RENDER EACH CONTEST PROGRAM TABLE - FULL UNFILTERED DATA */}
      <div className="space-y-6 sm:space-y-8">
        {visibleProgramSpecs.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-3">
            <Award className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
            <h3 className="text-sm font-black text-slate-800">Không có chương trình thi đua nào đang bật</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Các chương trình thi đua hiện đang ở trạng thái Tắt / Tạm dừng. Bạn có thể mở menu Cơ Cấu để kiểm tra hoặc bật lại chương trình.
            </p>
            {!isEmployeeView && (
              <button
                type="button"
                onClick={() => {
                  setSchemeModalInitialId(null);
                  setIsSchemeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 mx-auto"
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Quản Lý Cơ Cấu Thi Đua</span>
              </button>
            )}
          </div>
        )}
        {visibleProgramSpecs.map((spec) => {
          // Find matching ThiDuaBlock from sheet data (prioritize matching by programId or exact programName)
          const blockData = blocks.find((b) => {
            if (b.programId && b.programId === spec.id) return true;
            if (b.programName.trim().toLowerCase() === spec.title.trim().toLowerCase()) return true;
            if (spec.shortTitle && b.programName.trim().toLowerCase() === spec.shortTitle.trim().toLowerCase()) return true;
            if (spec.id === 'bot_mi_meizan') {
              return b.programName.toLowerCase().includes('bột mì');
            }
            if (spec.title.toLowerCase().includes('hạt nêm') || spec.id.includes('hat_nem')) {
              return b.programName.toLowerCase().includes('hạt nêm');
            }
            if (spec.title.toLowerCase().includes('horeca') || spec.id.includes('horeca')) {
              return b.programName.toLowerCase().includes('horeca') || b.startCol.toUpperCase() === 'BZ';
            }
            if (spec.range && b.range && b.range.toUpperCase() === spec.range.toUpperCase()) return true;
            if (spec.range && b.startCol && b.startCol.toUpperCase() === spec.range.split(':')[0].replace(/\d+/g, '')) return true;
            return false;
          });

          const colMap = getColMap(spec.id);
          const nameColCode =
            colMap?.nameCol ||
            spec.columns.find((c) => c.label.toLowerCase().replace(/[\s\n]+/g, ' ').includes('nhân viên') || (c as any).role === 'employee_name')?.colCode ||
            spec.columns[0].colCode;

          const rawRows = [...(blockData?.rows || [])].sort((a, b) => {
            const nameA = spec.getValue(a, nameColCode);
            const nameB = spec.getValue(b, nameColCode);
            return sortEmployeesByOriginalOrder(nameA, nameB);
          });
          const nonNameColsCount = spec.columns.filter((c) => !c.label.toLowerCase().includes('nhân viên')).length;

          // Trạng thái thu gọn cho Giám Sát (khi người dùng tự bấm thu gọn; luôn mở nếu đang xem/gửi từ Fullscreen):
          const isCollapsed = !isEmployeeView && Boolean(collapsedProgramMap[spec.id]) && meetingProgramId !== spec.id;

          return (
            <div
              key={spec.id}
              ref={(el) => { programRefs.current[spec.id] = el; }}
              className="bg-white rounded-2xl border border-emerald-400/80 shadow-xs overflow-hidden transition-all"
            >
              {/* CONTEST PROGRAM HEADER: Title + 1-Row Compact Action Strip */}
              <div
                className={`bg-white px-3 sm:px-4 py-2.5 text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none ${
                  !isCollapsed ? 'border-b border-emerald-200' : ''
                }`}
              >
                <div
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                  onClick={() => !isEmployeeView && toggleProgramCollapse(spec.id)}
                  title={!isEmployeeView ? (isCollapsed ? 'Bấm để mở rộng chi tiết' : 'Bấm để thu gọn') : undefined}
                >
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-500" />
                  <h3
                    data-zalo-title="true"
                    className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate"
                  >
                    {spec.title}
                  </h3>
                  {isCollapsed && (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      Đã thu gọn
                    </span>
                  )}
                </div>

                <div
                  data-zalo-hide="true"
                  className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar sm:overflow-visible shrink-0"
                >
                  {/* Nút Phóng To */}
                  <button
                    type="button"
                    onClick={() => openMeetingFullscreen(spec.id)}
                    className="h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                    title={`Phóng to ${spec.title} toàn màn hình phục vụ cuộc họp`}
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">Phóng To</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSchemeModalInitialId(spec.id);
                      setIsSchemeModalOpen(true);
                    }}
                    className="h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                    title={`Xem cơ cấu & cấu hình ${spec.title}`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Cơ Cấu</span>
                  </button>

                  {!isEmployeeView && !isCollapsed && (
                    <button
                      type="button"
                      disabled={sharingProgramId === spec.id}
                      onClick={() => handleShareZaloProgram(spec.id, spec.title)}
                      className="h-8 px-2.5 sm:px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 whitespace-nowrap"
                      title={`Gửi hình ảnh ${spec.title} qua Zalo`}
                    >
                      {sharingProgramId === spec.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                      ) : (
                        <ZaloIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span>{sharingProgramId === spec.id ? 'Đang tạo...' : 'Gửi Zalo'}</span>
                    </button>
                  )}

                  {!isEmployeeView && (
                    <button
                      type="button"
                      onClick={() => toggleProgramCollapse(spec.id)}
                      className="h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                      title={isCollapsed ? 'Mở rộng bảng dữ liệu' : 'Thu gọn bảng dữ liệu'}
                    >
                      {isCollapsed ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Mở rộng</span>
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Thu gọn</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* TABLE DATA (CHỈ HIỂN THỊ KHI CHƯA THU GỌN) */}
              {!isCollapsed && (
                <>
                  {rawRows.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center text-slate-500 space-y-2 bg-white">
                      <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400 mx-auto opacity-60" />
                      <p className="text-xs font-bold">Chưa có dữ liệu thi đua</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {(() => {
                        const nonNameColsCount = spec.columns.filter(
                          (c) => !(c.label.toLowerCase().includes('nhân viên') || c.colCode === 'Mã NV' || (c as any).role === 'employee_name')
                        ).length;

                        return (
                          <table className="w-full text-xs border-collapse table-fixed bg-white">
                            <thead>
                              <tr className="bg-white text-emerald-950 font-extrabold uppercase text-[9px] sm:text-[10.5px] md:text-[11px] tracking-tight leading-tight">
                                {spec.columns.map((col) => {
                                  const labelNorm = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
                                  const isNameCol = labelNorm.includes('nhân viên') || col.colCode === 'Mã NV' || (col as any).role === 'employee_name';
                                  const isBonusCol = (col as any).role === 'bonus' || (col as any).format === 'currency' || labelNorm.includes('tiền thưởng') || (labelNorm.includes('thưởng') && !labelNorm.includes('xét') && (col as any).role !== 'evaluation');
                                  const colWidthStyle = {
                                    width: isNameCol ? '20%' : `${80 / Math.max(1, nonNameColsCount)}%`,
                                  };
                                  return (
                                    <th
                                      key={col.key}
                                      style={colWidthStyle}
                                      className={`py-2 px-1 md:py-2.5 md:px-2 align-middle font-extrabold leading-tight border border-emerald-300 bg-emerald-50/70 text-emerald-950 text-center select-none ${
                                        isNameCol
                                          ? 'min-w-[110px] md:min-w-[180px] text-left px-2 md:px-3'
                                          : isBonusCol
                                          ? 'min-w-[68px]'
                                          : 'min-w-[68px]'
                                      }`}
                                    >
                                      {col.label.includes('\n') ? (
                                        col.label.split('\n').map((line, i) => (
                                          <React.Fragment key={i}>
                                            {i > 0 && <br />}
                                            {line}
                                          </React.Fragment>
                                        ))
                                      ) : (
                                        col.label
                                      )}
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="text-slate-800 font-medium">
                              {rawRows.map((row, idx) => {
                                return (
                                  <tr
                                    key={idx}
                                    className="bg-white hover:bg-emerald-50/30 transition-colors"
                                  >
                                    {spec.columns.map((col) => {
                                      const rawVal = spec.getValue(row, col.colCode);
                                      const displayVal = formatCellValue(rawVal, col.label, col.colCode, (col as any).role, (col as any).format, (spec as any).isCustom);
                                      const labelNorm = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
                                      const isNameCol = labelNorm.includes('nhân viên') || col.colCode === 'Mã NV' || (col as any).role === 'employee_name';
                                      const isBonusCol = (col as any).role === 'bonus' || (col as any).format === 'currency' || labelNorm.includes('tiền thưởng') || (labelNorm.includes('thưởng') && !labelNorm.includes('xét') && (col as any).role !== 'evaluation');
                                      const isPercentCol = (col as any).role === 'percentage' || (col as any).format === 'percentage' || labelNorm.includes('%') || labelNorm.includes('hoàn thành');
                                      const isAwardCol = (col as any).role === 'evaluation' || labelNorm.includes('xét');
                                      const isAchieved = isAwardCol && displayVal !== '-' && !displayVal.toLowerCase().includes('không') && !displayVal.toLowerCase().includes('chưa') && displayVal !== '0 ₫';
                                      const cleanText = (displayVal || '').replace(/\u00A0/g, ' ').trim();
                                      const isChuaDat = cleanText && /^(chưa\s*đạt|không\s*đạt)$/i.test(cleanText);

                                      return (
                                        <td
                                          key={col.key}
                                          className={`align-middle border border-emerald-200 text-[9.5px] sm:text-[10.5px] md:text-xs ${
                                            isChuaDat
                                              ? 'py-0.5 md:py-2 px-0.5 md:px-2 text-center text-slate-800 font-semibold bg-white'
                                              : isNameCol
                                              ? 'py-1.5 md:py-2 text-left px-1.5 md:px-3 font-bold text-slate-900 bg-white truncate whitespace-nowrap'
                                              : isBonusCol
                                              ? 'py-1.5 md:py-2 text-center px-1 md:px-2 font-bold font-mono text-slate-900 bg-white tracking-tight whitespace-nowrap'
                                              : isPercentCol
                                              ? 'py-1.5 md:py-2 text-center px-1 md:px-2 font-bold text-slate-900 bg-white whitespace-nowrap'
                                              : isAchieved
                                              ? 'py-1.5 md:py-2 text-center px-1 md:px-2 font-bold text-emerald-700 bg-emerald-50/50 whitespace-nowrap'
                                              : 'py-1.5 md:py-2 text-center px-1 md:px-2 text-slate-900 font-semibold bg-white whitespace-nowrap'
                                          }`}
                                          title={cleanText || '-'}
                                        >
                                          {isChuaDat ? (
                                            <span className="inline-block max-w-full break-words whitespace-normal sm:whitespace-nowrap leading-[9.5px] sm:leading-normal text-[8px] sm:text-[10.5px] md:text-xs font-semibold">
                                              {cleanText}
                                            </span>
                                          ) : (
                                            displayVal || '-'
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-emerald-50/80 text-slate-900 font-extrabold text-[9.5px] sm:text-[10.5px] md:text-xs">
                                {spec.columns.map((col) => {
                                  const labelNorm = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
                                  const isNameCol = labelNorm.includes('nhân viên') || col.colCode === 'Mã NV' || (col as any).role === 'employee_name';
                                  const isBonusCol = (col as any).role === 'bonus' || (col as any).format === 'currency' || labelNorm.includes('tiền thưởng') || (labelNorm.includes('thưởng') && !labelNorm.includes('xét') && (col as any).role !== 'evaluation');
                                  const totalVal = calculateColumnTotal(rawRows, spec, col.colCode, blockData?.summaryRow);

                                  return (
                                    <td
                                      key={col.key}
                                      className={`py-2 md:py-2.5 align-middle font-black border border-emerald-300 whitespace-nowrap text-[9.5px] sm:text-[10.5px] md:text-xs ${
                                        isNameCol
                                          ? 'text-left px-1.5 md:px-3 text-slate-900 uppercase font-black truncate'
                                          : isBonusCol
                                          ? 'text-center px-1 md:px-2 font-mono text-slate-900 font-black'
                                          : 'text-center px-1 md:px-2 text-slate-900 font-extrabold'
                                      }`}
                                      title={totalVal}
                                    >
                                      {totalVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tfoot>
                          </table>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* FULLSCREEN MEETING PRESENTATION MODAL VIEW (PHÓNG TO PHỤC VỤ HỌP) */}
      {meetingProgramId && (() => {
        const spec = visibleProgramSpecs.find(s => s.id === meetingProgramId) || PROGRAM_SPECS.find(s => s.id === meetingProgramId);
        if (!spec) return null;

        const blockData = blocks.find((b) => {
          if (b.programId && b.programId === spec.id) return true;
          if (b.programName.trim().toLowerCase() === spec.title.trim().toLowerCase()) return true;
          if (spec.shortTitle && b.programName.trim().toLowerCase() === spec.shortTitle.trim().toLowerCase()) return true;
          if (spec.id === 'bot_mi_meizan') return b.programName.toLowerCase().includes('bột mì');
          if (spec.title.toLowerCase().includes('hạt nêm') || spec.id.includes('hat_nem')) return b.programName.toLowerCase().includes('hạt nêm');
          if (spec.title.toLowerCase().includes('horeca') || spec.id.includes('horeca')) return b.programName.toLowerCase().includes('horeca') || b.startCol.toUpperCase() === 'BZ';
          if (spec.range && b.range && b.range.toUpperCase() === spec.range.toUpperCase()) return true;
          return false;
        });

        const colMap = getColMap(spec.id);
        const nameColCode = colMap?.nameCol || spec.columns.find((c) => c.label.toLowerCase().includes('nhân viên') || (c as any).role === 'employee_name')?.colCode || spec.columns[0].colCode;
        const rawMeetingRows = [...(blockData?.rows || [])].sort((a, b) => {
          const nameA = spec.getValue(a, nameColCode);
          const nameB = spec.getValue(b, nameColCode);
          return sortEmployeesByOriginalOrder(nameA, nameB);
        });

        const progEmpSummary = employeeSummaryList.map(e => ({
          empName: e.empName,
          reward: e.programRewards[spec.id],
          numAmount: e.programRewards[spec.id]?.numAmount || 0,
          status: e.programRewards[spec.id]?.status || '-'
        }));
        const totalMeetingBonus = progEmpSummary.reduce((sum, e) => sum + e.numAmount, 0);
        const achievedEmpCount = progEmpSummary.filter(e => e.numAmount > 0 || (e.status !== '-' && !e.status.toLowerCase().includes('chưa') && !e.status.toLowerCase().includes('không'))).length;

        return (
          <div className="app-modal-overlay fixed inset-0 z-[1000] bg-slate-100 flex flex-col overflow-hidden text-slate-900 select-none animate-in fade-in duration-200">
            {/* Top Meeting Header Bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-amber-500 shrink-0">
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-extrabold text-slate-900 uppercase tracking-tight truncate">
                    {spec.title}
                  </h2>
                  {(spec.scheme.time || spec.range) && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                      {spec.scheme.time || spec.range}
                    </p>
                  )}
                </div>
              </div>

              {/* Controls: Zoom In/Out, Cơ Cấu, Zalo, Thoát */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {/* Zoom controls for projector */}
                <div className="flex items-center bg-white border border-emerald-300 rounded-xl p-1 gap-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setMeetingZoom(z => Math.max(0.85, Math.round((z - 0.1) * 100) / 100))}
                    className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                    title="Thu nhỏ bảng (-)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeetingZoom(1.35)}
                    className="px-2 py-0.5 text-xs font-mono font-bold text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                    title="Bấm để đặt lại 135%"
                  >
                    {Math.round(meetingZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeetingZoom(z => Math.min(2.0, Math.round((z + 0.1) * 100) / 100))}
                    className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                    title="Phóng to bảng (+)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Scheme button */}
                <button
                  type="button"
                  onClick={() => {
                    setSchemeModalInitialId(spec.id);
                    setIsSchemeModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  title="Xem cơ cấu & thể lệ chương trình"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cơ Cấu</span>
                </button>

                {/* Zalo Share */}
                <button
                  type="button"
                  disabled={sharingProgramId === spec.id}
                  onClick={() => handleShareZaloProgram(spec.id, spec.title)}
                  className="px-3 py-1.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                  title="Gửi ảnh bảng thi đua này qua Zalo"
                >
                  {sharingProgramId === spec.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  ) : (
                    <ZaloIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{sharingProgramId === spec.id ? 'Đang tạo...' : 'Gửi Zalo'}</span>
                </button>

                {/* Close / Minimize Exit Fullscreen Button */}
                <button
                  type="button"
                  onClick={closeMeetingFullscreen}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  title="Thu nhỏ và thoát chế độ họp (ESC)"
                >
                  <Minimize2 className="w-4 h-4 text-emerald-600" />
                  <span>Thu Nhỏ (ESC)</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar in Meeting View */}
            <div className="bg-white border-b border-emerald-200/80 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-semibold">Tổng tiền thưởng dự kiến:</span>
                  <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                    {totalMeetingBonus > 0 ? totalMeetingBonus.toLocaleString('vi-VN') + ' ₫' : '0 ₫'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-semibold">Nhân sự đạt thưởng:</span>
                  <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                    {achievedEmpCount} <span className="text-xs text-slate-500 font-normal">/ {rawMeetingRows.length || employeeSummaryList.length} NV</span>
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-medium hidden md:block">
                Nhấn <kbd className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-300">ESC</kbd> để thu nhỏ và thoát chế độ họp
              </div>
            </div>

            {/* Scrollable Meeting Presentation Table Body - Stretches 100% according to screen aspect ratio */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-6 bg-slate-100 flex flex-col items-stretch w-full">
              <div 
                style={{ zoom: meetingZoom }}
                className="w-full max-w-none bg-white rounded-2xl border border-emerald-400/80 shadow-xs overflow-hidden text-slate-900 transition-all duration-150 flex flex-col"
              >
                {/* Table Header inside Card */}
                <div className="bg-white px-4 py-3 sm:py-3.5 border-b border-emerald-200 flex items-center justify-between text-slate-900 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <Award className="w-5 h-5 text-amber-500 shrink-0" />
                    <span className="font-extrabold uppercase tracking-tight text-sm sm:text-base md:text-lg text-slate-900">
                      {spec.title}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm text-slate-500 font-mono">
                    Cập nhật: {lastUpdated || 'Hôm nay'}
                  </span>
                </div>

                {/* The Data Table - Expands to 100% of screen width proportionally */}
                <div className="overflow-x-auto w-full flex-1">
                  {(() => {
                    const nonNameColsCount = spec.columns.filter(
                      (c) => !(c.label.toLowerCase().includes('nhân viên') || c.colCode === 'Mã NV' || (c as any).role === 'employee_name')
                    ).length;
                    const sttPercent = 4;
                    const namePercent = 20;
                    const remainingPercent = 100 - sttPercent - namePercent;
                    const otherColPercent = Math.max(7, Number((remainingPercent / Math.max(1, nonNameColsCount)).toFixed(2)));

                    return (
                      <table className="w-full text-xs sm:text-sm border-collapse table-fixed bg-white">
                        <thead>
                          <tr className="bg-white text-emerald-950 font-extrabold uppercase text-[10px] sm:text-xs md:text-sm tracking-tight leading-tight">
                            <th 
                              style={{ width: `${sttPercent}%`, minWidth: '44px' }}
                              className="py-3 px-2 text-center border border-emerald-300 bg-emerald-50/70 text-emerald-950 font-extrabold select-none"
                            >
                              STT
                            </th>
                            {spec.columns.map((col) => {
                              const labelNorm = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
                              const isNameCol = labelNorm.includes('nhân viên') || col.colCode === 'Mã NV' || (col as any).role === 'employee_name';
                              const isBonusCol = (col as any).role === 'bonus' || (col as any).format === 'currency' || labelNorm.includes('tiền thưởng') || (labelNorm.includes('thưởng') && !labelNorm.includes('xét') && (col as any).role !== 'evaluation');
                              const colWidth = isNameCol ? `${namePercent}%` : `${otherColPercent}%`;
                              const minColWidth = isNameCol ? '180px' : isBonusCol ? '95px' : '85px';

                              return (
                                <th
                                  key={col.key}
                                  style={{ width: colWidth, minWidth: minColWidth }}
                                  className={`py-3 px-2 align-middle font-extrabold leading-tight border border-emerald-300 bg-emerald-50/70 text-emerald-950 text-center select-none ${
                                    isNameCol ? 'text-left px-3' : ''
                                  }`}
                                >
                                  {col.label.includes('\n') ? (
                                    col.label.split('\n').map((line, i) => (
                                      <React.Fragment key={i}>
                                        {i > 0 && <br />}
                                        {line}
                                      </React.Fragment>
                                    ))
                                  ) : (
                                    col.label
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="text-slate-800 font-medium">
                          {rawMeetingRows.map((row, idx) => {
                            return (
                              <tr
                                key={idx}
                                className="bg-white hover:bg-emerald-50/30 transition-colors"
                              >
                                <td 
                                  style={{ width: `${sttPercent}%`, minWidth: '44px' }}
                                  className="py-3 px-2 text-center border border-emerald-200 bg-white font-semibold text-slate-600 font-mono"
                                >
                                  {idx + 1}
                                </td>
                                {spec.columns.map((col) => {
                                  const rawVal = spec.getValue(row, col.colCode);
                                  const displayVal = formatCellValue(rawVal, col.label, col.colCode, (col as any).role, (col as any).format, (spec as any).isCustom);
                                  const labelNorm = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
                                  const isNameCol = labelNorm.includes('nhân viên') || col.colCode === 'Mã NV' || (col as any).role === 'employee_name';
                                  const isBonusCol = (col as any).role === 'bonus' || (col as any).format === 'currency' || labelNorm.includes('tiền thưởng') || (labelNorm.includes('thưởng') && !labelNorm.includes('xét') && (col as any).role !== 'evaluation');
                                  const isPercentCol = (col as any).role === 'percentage' || (col as any).format === 'percentage' || labelNorm.includes('%') || labelNorm.includes('hoàn thành');
                                  const isAwardCol = (col as any).role === 'evaluation' || labelNorm.includes('xét');
                                  const isAchieved = isAwardCol && displayVal !== '-' && !displayVal.toLowerCase().includes('không') && !displayVal.toLowerCase().includes('chưa') && displayVal !== '0 ₫';
                                  const cleanText = (displayVal || '').replace(/\u00A0/g, ' ').trim();
                                  const isChuaDat = cleanText && /^(chưa\s*đạt|không\s*đạt)$/i.test(cleanText);
                                  const colWidth = isNameCol ? `${namePercent}%` : `${otherColPercent}%`;
                                  const minColWidth = isNameCol ? '180px' : isBonusCol ? '95px' : '85px';

                                  return (
                                    <td
                                      key={col.key}
                                      style={{ width: colWidth, minWidth: minColWidth }}
                                      className={`align-middle border border-emerald-200 text-xs sm:text-sm md:text-base ${
                                        isNameCol
                                          ? 'py-3 px-3 text-left font-bold text-slate-900 bg-white truncate whitespace-nowrap'
                                          : isBonusCol
                                          ? 'py-3 px-2 text-center font-bold font-mono text-slate-900 bg-white tracking-tight whitespace-nowrap'
                                          : isPercentCol
                                          ? 'py-3 px-2 text-center font-bold text-slate-900 bg-white whitespace-nowrap'
                                          : isAchieved
                                          ? 'py-3 px-2 text-center font-bold text-emerald-700 bg-emerald-50/50 whitespace-nowrap'
                                          : isChuaDat
                                          ? 'py-3 px-2 text-center font-semibold text-slate-800 bg-white whitespace-nowrap'
                                          : 'py-3 px-2 text-center font-semibold text-slate-900 bg-white whitespace-nowrap'
                                      }`}
                                    >
                                      {displayVal || '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50/80 text-slate-900 font-extrabold text-xs sm:text-sm md:text-base">
                            <td 
                              style={{ width: `${sttPercent}%`, minWidth: '44px' }}
                              className="py-3 px-2 text-center border border-emerald-300 font-bold"
                            >
                              #
                            </td>
                            {spec.columns.map((col) => {
                              const labelNorm = col.label.toLowerCase().replace(/[\s\n]+/g, ' ');
                              const isNameCol = labelNorm.includes('nhân viên') || col.colCode === 'Mã NV' || (col as any).role === 'employee_name';
                              const isBonusCol = (col as any).role === 'bonus' || (col as any).format === 'currency' || labelNorm.includes('tiền thưởng') || (labelNorm.includes('thưởng') && !labelNorm.includes('xét') && (col as any).role !== 'evaluation');
                              const totalVal = calculateColumnTotal(rawMeetingRows, spec, col.colCode, blockData?.summaryRow);
                              const colWidth = isNameCol ? `${namePercent}%` : `${otherColPercent}%`;
                              const minColWidth = isNameCol ? '180px' : isBonusCol ? '95px' : '85px';

                              return (
                                <td
                                  key={col.key}
                                  style={{ width: colWidth, minWidth: minColWidth }}
                                  className={`py-3 align-middle font-black border border-emerald-300 whitespace-nowrap ${
                                    isNameCol
                                      ? 'text-left px-3 text-slate-900 uppercase font-black truncate'
                                      : isBonusCol
                                      ? 'text-center px-2 font-mono text-slate-900 font-black'
                                      : 'text-center px-2 text-slate-900 font-extrabold'
                                  }`}
                                >
                                  {totalVal}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CENTRALIZED COMPETITION SCHEME MODAL (DYNAMIC CONFIGURATION & AUDIT TRAIL) */}
      <CompetitionSchemeModal
        isOpen={isSchemeModalOpen}
        onClose={() => setIsSchemeModalOpen(false)}
        programs={customPrograms}
        isSupervisor={isSupervisor}
        isMarketSupervisor={canCreateProgram}
        currentUserName={currentUserName}
        initialSelectedProgramId={schemeModalInitialId}
        onToggleActive={handleToggleProgramActive}
        onUpdateProgram={handleUpdateProgramConfig}
        onOpenDynamicBuilder={canCreateProgram ? (prog) => {
          setIsSchemeModalOpen(false);
          setDynamicProgramToEdit(prog || null);
          setIsDynamicModalOpen(true);
        } : undefined}
      />

      {/* DYNAMIC COMPETITION PROGRAM BUILDER MODAL */}
      <DynamicProgramModal
        isOpen={isDynamicModalOpen && canCreateProgram}
        onClose={() => {
          setIsDynamicModalOpen(false);
          setDynamicProgramToEdit(null);
        }}
        isMarketSupervisor={canCreateProgram}
        programToEdit={dynamicProgramToEdit}
        rawSheetRows={rawSheetRows}
        currentUserName={currentUserName || 'Giám Sát Thị Trường'}
        onSaved={(savedProg) => {
          const updatedProgs = customPrograms.some((p) => p.id === savedProg.id)
            ? customPrograms.map((p) => (p.id === savedProg.id ? savedProg : p))
            : [...customPrograms, savedProg];
          setCustomPrograms(updatedProgs);
          if (rawSheetRows.length > 0) {
            const updatedBlocks = parseThiDuaBlocks(rawSheetRows, sheetId, updatedProgs);
            setBlocks(updatedBlocks);
          } else {
            fetchThiDuaSheetData(sheetId, true, updatedProgs).then((res) => {
              if (res && res.length > 0) setBlocks(res);
            });
          }
        }}
      />

      {/* ZALO SHARE FULL PREVIEW MODAL WINDOW */}
      {zaloModalState && zaloModalState.isOpen && (
        <div
          className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setZaloModalState(null)}
        >
          <div
            ref={zaloModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Gửi Bảng Thi Đua Qua Zalo"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Official Zalo Brand Styling */}
            <div className="bg-[#0068FF] px-4 sm:px-5 py-3.5 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shrink-0">
                  <ZaloIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">Gửi Bảng Thi Đua Qua Zalo</h3>
                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/30 hidden sm:inline-block">
                      Hình Ảnh PNG
                    </span>
                  </div>
                  <p className="text-xs text-blue-100 font-medium truncate max-w-[280px] sm:max-w-[420px]">
                    {zaloModalState.programTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZaloModalState(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
              {/* Automatic Copy Alert Banner */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
                zaloModalState.copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-blue-50 border-blue-200 text-blue-950'
              }`}>
                <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${zaloModalState.copied ? 'text-emerald-600' : 'text-blue-600'}`} />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-xs">
                    {zaloModalState.copied
                      ? 'ĐÃ SAO CHÉP HÌNH ẢNH VÀO CLIPBOARD (BỘ NHỚ TẠM)!'
                      : 'HÌNH ẢNH BẢNG THI ĐUA ĐÃ SẴN SÀNG GỬI QUA ZALO'}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Bạn có thể mở cửa sổ Zalo và nhấn tổ hợp phím <kbd className="bg-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">Ctrl + V</kbd> (hoặc chạm giữ chọn <strong className="text-slate-900 font-bold">Dán</strong>) để dán và gửi ảnh ngay lập tức!
                  </p>
                </div>
              </div>

              {/* IMAGE PREVIEW BOX */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#0068FF]" />
                    <span>Xem Trước Hình Ảnh Bảng Thi Đua (.PNG):</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!zaloModalState.blob) return;
                        try {
                          if (navigator.clipboard && window.ClipboardItem) {
                            await navigator.clipboard.write([
                              new ClipboardItem({ 'image/png': zaloModalState.blob })
                            ]);
                            setZaloModalState(p => p ? { ...p, copied: true } : null);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-3 py-1.5 bg-[#0068FF] hover:bg-[#0052cc] text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="Sao chép ảnh vào Bộ nhớ tạm"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{zaloModalState.copied ? 'Đã Sao Chép!' : 'Sao Chép Ảnh'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.download = zaloModalState.fileName;
                        link.href = zaloModalState.dataUrl;
                        link.click();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="Tải file ảnh PNG về máy"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải Ảnh (.PNG)</span>
                    </button>
                  </div>
                </div>

                {/* IMAGE CONTAINER */}
                <div className="border border-slate-200 rounded-xl bg-slate-100 p-2 sm:p-3 overflow-auto max-h-[420px] flex justify-center shadow-inner">
                  {zaloModalState.dataUrl ? (
                    <img
                      src={zaloModalState.dataUrl}
                      alt="Báo cáo Thi đua"
                      className="w-full h-auto rounded-lg shadow-md border border-slate-300 object-contain"
                    />
                  ) : (
                    <div className="p-8 text-center text-slate-400 font-bold">Đang tải hình ảnh...</div>
                  )}
                </div>
              </div>

              {/* SĐT ZALO OPTION */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ZaloIcon className="w-4 h-4" />
                  <span>SĐT Zalo Người Nhận (Tùy chọn):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nhập SĐT Zalo (VD: 0912345678)..."
                    value={zaloModalState.targetPhone}
                    onChange={(e) => setZaloModalState(p => p ? { ...p, targetPhone: e.target.value } : null)}
                    className="flex-1 bg-white border border-slate-300 text-slate-800 text-xs font-mono font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0068FF]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      window.open('https://chat.zalo.me', '_blank');
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Zalo Web</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer / Direct Zalo Actions */}
            <div className="bg-slate-100 border-t border-slate-200 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="text-[11px] text-slate-500 font-medium">
                Bấm <strong>Mở Zalo Web</strong>, sau đó nhấn <kbd className="font-mono font-bold text-slate-700 bg-slate-200 px-1 py-0.5 rounded">Ctrl+V</kbd> trong khung chat để dán và gửi ảnh.
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {zaloModalState.blob && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!zaloModalState.blob) return;
                      const file = new File([zaloModalState.blob], zaloModalState.fileName, { type: 'image/png' });
                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                          await navigator.share({
                            title: zaloModalState.programTitle,
                            files: [file]
                          });
                        } catch (e) {
                          console.log('Native share closed:', e);
                        }
                      } else {
                        notify.info('Thiết bị hoặc trình duyệt này không hỗ trợ menu chia sẻ trực tiếp. Vui lòng bấm "Mở Zalo Web & Dán Ảnh" bên cạnh.');
                      }
                    }}
                    className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    title="Gửi trực tiếp tới ứng dụng Zalo trên điện thoại / máy tính"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Chia Sẻ Trực Tiếp App Zalo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setZaloModalState(null)}
                  className="px-3.5 py-2 border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.open('https://chat.zalo.me', '_blank');
                  }}
                  className="px-5 py-2.5 bg-[#0068FF] hover:bg-[#0052cc] text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-[colors,transform] shadow-xs active:scale-95 cursor-pointer"
                >
                  <ZaloIcon className="w-4 h-4" />
                  <span>Mở Zalo Web & Dán Ảnh</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

