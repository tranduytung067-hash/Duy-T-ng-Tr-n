import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  User,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { EmployeeTargetRow } from '../types';
import { ALLOWED_EMPLOYEES_UP_TO_TUAN } from '../utils/sheetParser';
import { ZaloIcon } from './ZaloShareImageModal';
import MonthlyReportCard from './MonthlyReportCard';
import { useDialogFocus } from '../utils/useDialogFocus';

interface ZaloShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployeeName?: string;
  isEmployeeView?: boolean;
  employees: EmployeeTargetRow[];
  transactions?: any[];
  permissions?: any[];
  setPermissions?: any;
  clfDetailedRows?: any[];
  mccDetailedRows?: any[];
  ndfcDetailedRows?: any[];
  cttbData?: any;
  chamCongListData?: any[];
  startDate?: string;
  endDate?: string;
  currentUser?: any;
  sectorData?: any;
  trungBayListData?: any[];
  tuNhienRecords?: any[];
  meizanRecords?: any[];
  attendanceSelectedCycle?: string;
}

export default function ZaloShareModal({
  isOpen,
  onClose,
  selectedEmployeeName = 'Tất cả',
  isEmployeeView = false,
  employees = [],
  transactions = [],
  clfDetailedRows = [],
  mccDetailedRows = [],
  ndfcDetailedRows = [],
  cttbData = {},
  chamCongListData = [],
  startDate = '',
  endDate = '',
  currentUser,
  sectorData,
  trungBayListData = [],
  tuNhienRecords = [],
  meizanRecords = [],
  attendanceSelectedCycle
}: ZaloShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);
  const [containerWidth, setContainerWidth] = useState(860);
  const [cardHeight, setCardHeight] = useState(0);

  const [copiedImage, setCopiedImage] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filter by Employee Name (replaced previous sortMode filter)
  const [currentEmployeeName, setCurrentEmployeeName] = useState<string>(
    isEmployeeView ? (currentUser?.name || '') : (selectedEmployeeName || 'Tất cả')
  );

  useEffect(() => {
    if (selectedEmployeeName) {
      setCurrentEmployeeName(isEmployeeView ? (currentUser?.name || '') : selectedEmployeeName);
    }
  }, [selectedEmployeeName, isEmployeeView, currentUser]);

  const now = new Date();
  const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
  const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultAttendanceCycle = `${currentActiveYear}-${currentActiveMonth}`;

  // 2 cycles matching AttendanceSystem: current active cycle and 1 immediately preceding cycle
  const cycleOptions = useMemo(() => {
    return Array.from({ length: 2 }).map((_, idx) => {
      const d = new Date();
      d.setDate(20);
      d.setFullYear(currentActiveYear);
      d.setMonth(currentActiveMonth - idx);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = `Chu kỳ ${(m + 1) < 10 ? '0' + (m + 1) : (m + 1)}/${y}`;
      const value = `${y}-${m}`;
      return { label, value, month: m, year: y };
    });
  }, [currentActiveYear, currentActiveMonth]);

  // Attendance cycle filter state mapped with AttendanceSystem
  const [selectedCycle, setSelectedCycle] = useState<string>(
    attendanceSelectedCycle || defaultAttendanceCycle
  );

  useEffect(() => {
    if (attendanceSelectedCycle) {
      setSelectedCycle(attendanceSelectedCycle);
    }
  }, [attendanceSelectedCycle]);

  // Measure container width for dynamic proportional scaling
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Measure rendered card height
  useEffect(() => {
    if (!isOpen) return;
    const el = document.getElementById('zalo-monthly-report-card');
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCardHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, currentEmployeeName]);

  const scale = useMemo(() => {
    // 32px padding on container
    const availableWidth = containerWidth - 32;
    if (availableWidth >= 860) return 1;
    return Math.max(0.35, availableWidth / 860);
  }, [containerWidth]);

  if (!isOpen) return null;

  // Generate PNG image blob
  const generateReportImageBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const dataUrl = await toPng(cardRef.current, { 
        quality: 0.98, 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      console.error('Lỗi tạo ảnh báo cáo tháng:', err);
      return null;
    }
  };

  // Copy report card image directly to Clipboard
  const handleCopyImageToClipboard = async (): Promise<boolean> => {
    if (!cardRef.current) return false;
    try {
      setIsExportingImage(true);
      const blob = await generateReportImageBlob();
      if (!blob) return false;

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        setCopiedImage(true);
        setStatusMessage('Đã sao chép ảnh báo cáo vào bộ nhớ tạm! Bạn có thể dán (Ctrl+V) vào Zalo.');
        setTimeout(() => {
          setCopiedImage(false);
          setStatusMessage(null);
        }, 3500);
        return true;
      } else {
        handleExportImage();
        return false;
      }
    } catch (err) {
      console.error('Lỗi sao chép ảnh vào Clipboard:', err);
      handleExportImage();
      return false;
    } finally {
      setIsExportingImage(false);
    }
  };

  // Download Report PNG Image
  const handleExportImage = async () => {
    if (!cardRef.current) return;
    try {
      setIsExportingImage(true);
      const dataUrl = await toPng(cardRef.current, { 
        quality: 0.98, 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      const suffixName = (currentEmployeeName || 'Toan_Doi_Ngu').replace(/\s+/g, '_');
      link.download = `Bao_Cao_Thang_${suffixName}.png`;
      link.href = dataUrl;
      link.click();
      setStatusMessage('Đã tải ảnh báo cáo tháng về máy!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Lỗi tải ảnh báo cáo:', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Automated Zalo Action: Copy image & open Zalo chat
  const handleOpenZaloChat = async () => {
    setIsExportingImage(true);
    try {
      const blob = await generateReportImageBlob();

      // Native Web Share if available with image file
      if (blob && navigator.canShare) {
        const file = new File([blob], `Bao_Cao_Thang_${currentEmployeeName}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Báo cáo tháng - ${currentEmployeeName}`,
              files: [file]
            });
            return;
          } catch (shareErr) {
            console.log('Share dismissed, fallback to clipboard and web:', shareErr);
          }
        }
      }

      // Clipboard copy fallback
      if (blob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 3500);
        } catch (clipErr) {
          console.log('Không thể chép vào Clipboard:', clipErr);
        }
      }

      window.open('https://chat.zalo.me', '_blank');
      setStatusMessage('Đã sao chép ảnh vào bộ nhớ tạm! Nhấn Ctrl+V để dán ảnh vào cuộc trò chuyện Zalo.');
    } catch (err) {
      console.error('Lỗi chia sẻ Zalo:', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
      
      {/* Main Interactive Modal Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Gửi báo cáo tháng qua Zalo"
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden my-auto text-left flex flex-col max-h-[94vh] outline-none"
      >
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0068FF] via-blue-700 to-emerald-700 px-5 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 font-black shrink-0">
              <ZaloIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider">GỬI BÁO CÁO THÁNG QUA ZALO</h3>
              <p className="text-xs text-blue-100 font-medium">Báo cáo tổng hợp số liệu chấm công, doanh số, số bán & kích hoạt sẵn sàng gửi Zalo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Banner if active */}
        {statusMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between transition-all animate-in fade-in duration-200 shrink-0">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setStatusMessage(null)}
              aria-label="Đóng thông báo"
              className="text-white/80 hover:text-white cursor-pointer p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Control Bar: Employee Filter, Attendance Cycle Filter & Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border-b border-slate-200 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Bộ lọc chu kỳ chấm công */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Chu kỳ:</span>
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                className="bg-transparent text-slate-800 text-xs font-bold outline-none cursor-pointer pr-1"
              >
                {cycleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {opt.year === currentActiveYear && opt.month === currentActiveMonth ? '(Hiện tại)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {!isEmployeeView ? (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Nhân viên:</span>
                <select
                  value={currentEmployeeName}
                  onChange={(e) => setCurrentEmployeeName(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-bold outline-none cursor-pointer pr-1"
                >
                  <option value="Tất cả">Tất cả nhân viên</option>
                  {ALLOWED_EMPLOYEES_UP_TO_TUAN.map((emp) => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">{currentUser?.name || 'Nhân viên'}</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopyImageToClipboard}
              disabled={isExportingImage}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="Sao chép hình ảnh vào bộ nhớ tạm"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedImage ? 'Đã Sao Chép!' : 'Sao Chép Ảnh'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExportingImage}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="Tải ảnh file PNG về máy"
            >
              {isExportingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isExportingImage ? 'Đang tạo...' : 'Tải Ảnh (.PNG)'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body: Proportional, Balanced Scaled Preview with ZERO horizontal scroll */}
        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 p-3 sm:p-5">
          <div 
            className="w-full flex justify-center items-start"
            style={{ 
              height: (scale < 1 && cardHeight > 0) ? `${cardHeight * scale + 24}px` : 'auto',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                width: '860px',
                flexShrink: 0
              }}
            >
              <MonthlyReportCard
                cardRef={cardRef}
                id="zalo-monthly-report-card"
                selectedEmployeeName={currentEmployeeName}
                isEmployeeView={isEmployeeView}
                employees={employees}
                transactions={transactions}
                clfDetailedRows={clfDetailedRows}
                mccDetailedRows={mccDetailedRows}
                ndfcDetailedRows={ndfcDetailedRows}
                cttbData={cttbData}
                chamCongListData={chamCongListData}
                startDate={startDate}
                endDate={endDate}
                currentUser={currentUser}
                sectorData={sectorData}
                trungBayListData={trungBayListData}
                tuNhienRecords={tuNhienRecords}
                meizanRecords={meizanRecords}
                attendanceSelectedCycle={selectedCycle}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer / Primary Action */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            <strong className="text-slate-800">Chia sẻ nhanh:</strong> Bấm <strong className="text-[#0068FF]">Gửi Qua Zalo</strong> để tự động chép ảnh và dán (<kbd className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold text-slate-800">Ctrl+V</kbd>) vào nhóm Zalo.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 font-bold text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleOpenZaloChat}
              disabled={isExportingImage}
              className="flex items-center gap-2 bg-[#0068FF] hover:bg-[#0052cc] text-white px-5 py-2 rounded-xl text-xs font-black shadow-xs transition-[colors,transform] cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <ZaloIcon className="w-4 h-4 text-white" />
              <span>{isExportingImage ? 'Đang Tạo Ảnh...' : 'Gửi Qua Zalo'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
